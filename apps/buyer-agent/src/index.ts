import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Contract, JsonRpcProvider, Wallet, keccak256, parseEther, toUtf8Bytes } from "ethers";
import policyPlugin from "../../../plugins/policy-from-ens/src/index";
import auditPlugin from "../../../plugins/audit-to-0g/src/index";
import { pickBuyerConnector } from "../../../src/connectors/buyer/factory";
import { TelegramApprover, type ApprovalResult } from "../../../src/notify/telegram";
import { readHistoryFrom0G } from "./history-from-0g";

interface Need {
  sku: string;
  quantity: number;
  max_unit_price_usd: number;
  deadline_days: number;
  reason: string;
}

interface BuyerConfig {
  buyer: string;
  buyer_address: string;
  buyer_ens: string;
  needs: Need[];
}

interface SellerEntry {
  ens: string;
  endpoint: string;
  address: string;
}

interface SellerRegistry {
  sellers: string[];
}

const RESOLVER_ABI = [
  "function setText(bytes32 node, string key, string value) external",
  "function text(bytes32 node, string key) view returns (string)",
  "function addr(bytes32 node, uint256 coinType) view returns (bytes)",
];

const RECURRING_THRESHOLD = 2; // ≥ N past purchases for the same SKU = "recurring"
const BETTER_DEAL_PCT = 15; // ≥ N% below avg = trigger human approval

function detectPattern(
  history: Purchase[],
  sku: string,
  newSellerEns: string,
  newUnitPriceUsd: number,
): PatternSignal {
  const past = history.filter((p) => p.sku === sku);
  const occurrences = past.length;
  const isRecurring = occurrences >= RECURRING_THRESHOLD;
  const avg = past.length === 0
    ? newUnitPriceUsd
    : past.reduce((s, p) => s + p.unit_price_usd, 0) / past.length;
  const savingPct = avg === 0 ? 0 : ((avg - newUnitPriceUsd) / avg) * 100;
  const isBetter = savingPct >= BETTER_DEAL_PCT;
  const lastSeller = past[past.length - 1]?.seller_ens ?? "—";

  let message: string;
  if (isRecurring && isBetter) {
    message = `Pattern: ${occurrences} past purchases of ${sku} from ${lastSeller} at avg $${avg.toFixed(2)}/u. New offer from ${newSellerEns} at $${newUnitPriceUsd.toFixed(2)}/u — ${savingPct.toFixed(0)}% saving. Recommend human approval before switching.`;
  } else if (isRecurring) {
    message = `Pattern: ${occurrences} past purchases of ${sku} (avg $${avg.toFixed(2)}/u). New offer at $${newUnitPriceUsd.toFixed(2)} is within range — auto-proceed.`;
  } else if (isBetter) {
    message = `New SKU but new offer is ${savingPct.toFixed(0)}% below first-seen price.`;
  } else {
    message = `No pattern signal — first or routine purchase.`;
  }
  return {
    sku,
    occurrences,
    avg_unit_price_usd: Math.round(avg * 100) / 100,
    last_seller_ens: lastSeller,
    new_unit_price_usd: newUnitPriceUsd,
    new_seller_ens: newSellerEns,
    saving_pct: Math.round(savingPct * 10) / 10,
    is_better_deal: isBetter,
    is_recurring: isRecurring,
    message,
  };
}

// USD → ETH conversion for the demo. Production would call a price oracle
// (or use real USDC and skip this entirely). 1 USD = 0.00001 ETH keeps the
// total small enough that 1 demo run costs <0.001 ETH on Sepolia.
const USD_TO_ETH = 0.00001;

async function lockEscrow(args: {
  sellerAddress: string;
  amountUsd: number;
  sku: string;
  quantity: number;
  deadlineDays: number;
}): Promise<{ orderId: string; amountEth: string; txHash: string; address: string }> {
  const artifact = JSON.parse(
    await readFile("contracts/ProcurementEscrow.deployment.json", "utf8"),
  );
  const rpc = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
  const provider = new JsonRpcProvider(rpc, 11155111);
  const signer = new Wallet(process.env.AGENT_PRIVATE_KEY ?? "", provider);
  const escrow = new Contract(artifact.address, artifact.abi, signer);

  const amountEth = (args.amountUsd * USD_TO_ETH).toFixed(8);
  const value = parseEther(amountEth);
  const skuHash = keccak256(toUtf8Bytes(`${args.sku} x${args.quantity}`));
  const deliveryDeadline = Math.floor(Date.now() / 1000) + args.deadlineDays * 86400;
  const disputeWindow = 600;

  const tx = await escrow.createOrder(
    args.sellerAddress,
    skuHash,
    deliveryDeadline,
    disputeWindow,
    { value },
  );
  await tx.wait();
  const orderId: bigint = await escrow.nextOrderId();
  return {
    orderId: orderId.toString(),
    amountEth,
    txHash: tx.hash,
    address: artifact.address,
  };
}

async function readNeedsFromConnector(
  buyer: BuyerConfig,
): Promise<{
  needs: Need[];
  // The same connector instance is returned so the caller can write
  // resolved orders back to it (see pushOrder closing the loop).
  connector: Awaited<ReturnType<typeof pickBuyerConnector>>;
  // Whether the needs returned came from the connector (true) or from
  // the fallback fixture (false). pushOrder is only meaningful in the
  // first case — there's no point writing back to a connector that
  // didn't see the need in the first place.
  fromConnector: boolean;
}> {
  const connector = await pickBuyerConnector();
  console.log(`[buyer] connector: ${connector.id} — ${connector.name}`);
  try {
    const items = await connector.readNeeds();
    if (items.length > 0) {
      console.log(`[buyer]   ✓ ${connector.id} returned ${items.length} need(s):`);
      for (const item of items) {
        console.log(
          `[buyer]     - ${item.sku} qty=${item.current_stock ?? "?"} order=${item.quantity}${item.name ? ` "${item.name}"` : ""}`,
        );
      }
      return {
        connector,
        fromConnector: true,
        needs: items.map((it) => ({
          sku: it.sku,
          quantity: it.quantity,
          max_unit_price_usd: it.max_unit_price_usd ?? 100,
          deadline_days: it.deadline_days,
          reason: it.reason,
        })),
      };
    }
    console.log(`[buyer]   (${connector.id} returned 0 items — falling back to fixture needs)`);
  } catch (e) {
    console.log(`[buyer]   ⚠ connector error: ${(e as Error).message} — falling back to fixture`);
  }
  console.log(`[buyer] using fixture needs from needs.json`);
  return { connector, fromConnector: false, needs: buyer.needs };
}

async function resolveSellers(
  ensNames: string[],
  rpc: string,
): Promise<SellerEntry[]> {
  const provider = new JsonRpcProvider(rpc);
  const out: SellerEntry[] = [];
  for (const ens of ensNames) {
    const resolver = await provider.getResolver(ens);
    if (!resolver) {
      console.log(`[buyer]   × ${ens} → no resolver`);
      continue;
    }
    const [endpoint, addrRaw] = await Promise.all([
      resolver.getText("endpoint"),
      resolver.getAddress(),
    ]);
    if (!endpoint) {
      console.log(`[buyer]   × ${ens} → no 'endpoint' text record`);
      continue;
    }
    out.push({ ens, endpoint, address: addrRaw ?? "" });
    console.log(`[buyer]   ✓ ${ens} → endpoint=${endpoint}, addr=${addrRaw ?? "(none)"}`);
  }
  return out;
}

interface Purchase {
  sku: string;
  seller: string;
  seller_ens: string;
  unit_price_usd: number;
  quantity: number;
  total_usd: number;
  at: string;
}

interface PurchaseHistory {
  purchases: Purchase[];
}

interface PatternSignal {
  sku: string;
  occurrences: number;
  avg_unit_price_usd: number;
  last_seller_ens: string;
  new_unit_price_usd: number;
  new_seller_ens: string;
  saving_pct: number;
  is_better_deal: boolean;
  is_recurring: boolean;
  message: string;
}

interface Quote {
  rfq_id: string;
  seller: string;
  seller_address: string;
  sku: string;
  unit_price_usd: number;
  total_usd: number;
  quantity: number;
  delivery_days: number;
  currency: string;
  valid_until: string;
  signature: string;
  source_endpoint?: string;
  source_ens?: string;
}

type Tool = {
  name: string;
  execute: (id: string, params: unknown) => Promise<{ details: unknown }>;
};

function loadPlugin(plugin: { register?: (api: unknown) => void; id: string }): Tool[] {
  const tools: Tool[] = [];
  const fakeApi = {
    id: plugin.id,
    name: plugin.id,
    registerTool(t: Tool) {
      tools.push(t);
    },
    registerHook() {},
    registerHttpRoute() {},
    registerService() {},
    config: {},
    logger: { info: () => {}, warn: console.warn, error: console.error },
  };
  if (typeof plugin.register === "function") plugin.register(fakeApi as never);
  return tools;
}

// Cap on how much the buyer is willing to pay per RFQ via x402.
// Sellers asking more than this get skipped (per PROTOCOL.md §3.4
// conformance: a buyer that can't afford a quote MUST skip, not error).
const MAX_RFQ_PRICE_USDC = parseFloat(
  process.env.MAX_RFQ_PRICE_USDC || "0.01",
);

// Pay an x402 challenge. In real life this either calls KeeperHub
// (kh_pay) or a direct USDC transfer; for the demo we emit a mock
// receipt that the seller-side validator will accept. Set
// KEEPERHUB_API_KEY to switch this to a real x402 call.
async function payX402Challenge(args: {
  amountUsdc: number;
  to: string;
  nonce: string;
  network: string;
}): Promise<string> {
  if (process.env.KEEPERHUB_API_KEY) {
    // Production path: hand off to KeeperHub. Kept as a TODO because
    // wiring real x402 needs the KH wallet funded — out of scope for
    // the demo build window. Falls through to mock receipt below.
    console.log(
      `[buyer]     · KEEPERHUB_API_KEY present but pay path is mock-only in this build`,
    );
  }
  // Demo receipt: deterministic, traceable, not redeemable. Sellers in
  // demo-mode validation accept any "x402-…" prefix (see seller route).
  return `x402-mock-${args.network}-${args.nonce}`;
}

async function broadcastRfq(
  sellers: SellerEntry[],
  rfqId: string,
  need: Need,
  buyer: BuyerConfig,
): Promise<Quote[]> {
  const quotes: Quote[] = [];
  for (const seller of sellers) {
    // The 'endpoint' text record is the full RFQ URL (per
    // procurement.discovery.v1). Don't append /rfq — onboarding via
    // /sell sets it as ".../api/seller/<label>/rfq", and self-hosted
    // sellers should set their own full URL too.
    const url = seller.endpoint.endsWith("/rfq")
      ? seller.endpoint
      : `${seller.endpoint.replace(/\/+$/, "")}/rfq`;
    console.log(`[buyer]   → POST ${url}`);

    const body = JSON.stringify({
      rfq_id: rfqId,
      sku: need.sku,
      quantity: need.quantity,
      buyer_ens: buyer.buyer_ens,
      buyer_address: buyer.buyer_address,
      deadline: new Date(
        Date.now() + need.deadline_days * 86400_000,
      ).toISOString(),
    });

    let paymentProof: string | null = null;
    let attempts = 0;
    let resp: Response;
    try {
      // Up to 2 attempts: first unpaid (might 200, might 402), then
      // paid (only fired if first hit returned 402 with valid headers).
      while (true) {
        attempts += 1;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (paymentProof) headers["X-Payment-Proof"] = paymentProof;

        resp = await fetch(url, { method: "POST", headers, body });

        // Per §3.4: handle the 402 dance transparently.
        if (resp.status === 402 && attempts === 1) {
          const network = resp.headers.get("x-payment-network") ?? "base";
          const token = resp.headers.get("x-payment-token") ?? "USDC";
          const amount = parseFloat(
            resp.headers.get("x-payment-amount") ?? "0",
          );
          const to = resp.headers.get("x-payment-to") ?? "";
          const nonce = resp.headers.get("x-payment-nonce") ?? "";
          if (!amount || !to) {
            console.log(
              `[buyer]     × ${seller.ens} → 402 missing X-Payment-* headers`,
            );
            break;
          }
          if (amount > MAX_RFQ_PRICE_USDC) {
            console.log(
              `[buyer]     × ${seller.ens} → 402 wants ${amount} ${token} (> max ${MAX_RFQ_PRICE_USDC}); skipping per spec`,
            );
            break;
          }
          console.log(
            `[buyer]     ↻ ${seller.ens} → 402 · paying ${amount} ${token} via x402 (${network})…`,
          );
          paymentProof = await payX402Challenge({
            amountUsdc: amount,
            to,
            nonce,
            network,
          });
          continue; // retry with proof
        }
        break; // non-402 (or post-payment), exit loop
      }

      const json = (await resp!.json()) as Quote | { error: string };
      if (!resp!.ok) {
        console.log(
          `[buyer]     × ${seller.ens} → ${resp!.status} ${(json as { error: string }).error}`,
        );
        continue;
      }
      const quote = json as Quote;
      quote.source_endpoint = seller.endpoint;
      quote.source_ens = seller.ens;
      console.log(
        `[buyer]     ✓ ${seller.ens} → $${quote.total_usd} ${quote.currency}, ${quote.delivery_days}d, sig ${quote.signature.slice(0, 18)}…${paymentProof ? " (via x402)" : ""}`,
      );
      quotes.push(quote);
    } catch (e) {
      console.log(
        `[buyer]     × ${seller.ens} → fetch failed: ${(e as Error).message}`,
      );
    }
  }
  return quotes;
}

function pickWinner(need: Need, quotes: Quote[]): Quote | null {
  const priced = quotes
    .filter((q) => q.unit_price_usd <= need.max_unit_price_usd)
    .filter((q) => q.delivery_days <= need.deadline_days);
  if (priced.length === 0) return null;
  priced.sort((a, b) => a.total_usd - b.total_usd);
  return priced[0];
}

/**
 * One resolved order — the structured equivalent of the per-need log lines.
 * Returned from runProcurementTick so callers (CLI, /api/procurement-tick,
 * Vercel cron, dashboard) can render the result without re-parsing logs.
 */
export interface ResolvedOrder {
  sku: string;
  quantity: number;
  winner_ens: string | null;
  winner_total_usd: number | null;
  escrow_tx: string | null;
  escrow_explorer_url: string | null;
  escrow_order_id: string | null;
  audit_anchor_index: string | null;
  audit_anchor_tx: string | null;
  erp_po_id: string | null;
  erp_po_url: string | null;
  skipped_reason: string | null;
}

export interface ProcurementTickResult {
  at: string;
  buyer_ens: string;
  connector_id: string;
  connector_name: string;
  needs_count: number;
  orders: ResolvedOrder[];
}

export async function runProcurementTick(): Promise<ProcurementTickResult> {
  const orders: ResolvedOrder[] = [];

  if (!process.env.ZG_AUDIT_ANCHOR) {
    const anchor = JSON.parse(
      await readFile("contracts/AuditAnchor.deployment.json", "utf8"),
    );
    process.env.ZG_AUDIT_ANCHOR = anchor.address;
  }

  const buyer = JSON.parse(
    await readFile("apps/buyer-agent/needs.json", "utf8"),
  ) as BuyerConfig;
  const registry = JSON.parse(
    await readFile("apps/buyer-agent/sellers.json", "utf8"),
  ) as SellerRegistry;
  // History sourcing strategy:
  //   - "seed" history (history.json) = legacy purchases from before the
  //     agent was deployed onchain (vendor relationships the operator
  //     already had). Loaded as the baseline.
  //   - "live" history (0G AuditAnchor + 0G Storage) = every purchase
  //     this agent has made since it started. Sourced from immutable
  //     onchain anchors + content-addressed storage.
  //   - The merged set is what the pattern detector reasons over.
  let history: PurchaseHistory;
  const seed = JSON.parse(
    await readFile("apps/buyer-agent/history.json", "utf8"),
  ) as PurchaseHistory;
  console.log(
    `[buyer] history seed (legacy fixture): ${seed.purchases.length} purchases`,
  );
  try {
    console.log(`[buyer] reading live history from 0G AuditAnchor…`);
    const anchorJson = JSON.parse(
      await readFile("contracts/AuditAnchor.deployment.json", "utf8"),
    );
    const result = await readHistoryFrom0G({
      rpc: process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai",
      indexerUrl:
        process.env.ZG_INDEXER_URL ||
        "https://indexer-storage-testnet-turbo.0g.ai",
      anchorAddress: process.env.ZG_AUDIT_ANCHOR || anchorJson.address,
      agentAddress: buyer.buyer_address,
      limit: 30,
    });
    console.log(
      `[buyer]   ✓ recovered ${result.purchases.length} live purchase(s) from ${result.sourceAnchors} anchor(s) on 0G`,
    );
    history = { purchases: [...seed.purchases, ...result.purchases] };
  } catch (e) {
    console.log(
      `[buyer]   ⚠ 0G history unavailable (${(e as Error).message}) — using seed only`,
    );
    history = seed;
  }
  console.log(
    `[buyer] effective history: ${history.purchases.length} purchases (seed + live)`,
  );

  console.log(`[buyer] ${buyer.buyer} (${buyer.buyer_ens})`);

  const { needs, connector, fromConnector } = await readNeedsFromConnector(buyer);
  console.log(
    `[buyer] ${needs.length} pending need(s) · ${registry.sellers.length} seller subname(s) in registry`,
  );
  const canWriteBack = fromConnector && typeof connector.pushOrder === "function";
  if (canWriteBack) {
    console.log(`[buyer]   ↺ writeback enabled — orders will be pushed back to ${connector.id}`);
  }

  const ensRpc =
    process.env.MAINNET_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
  console.log(`[buyer] resolving sellers from ENS (${ensRpc})…`);
  const sellers = await resolveSellers(registry.sellers, ensRpc);
  if (sellers.length === 0) {
    throw new Error("no sellers resolved from ENS — abort");
  }

  const policyTools = loadPlugin(policyPlugin as never);
  const auditTools = loadPlugin(auditPlugin as never);
  const policyCheck = policyTools.find((t) => t.name === "treasury_policy_check");
  const recordAudit = auditTools.find((t) => t.name === "record_audit");
  if (!policyCheck || !recordAudit) {
    throw new Error("plugins did not register expected tools");
  }

  for (const need of needs) {
    const rfqId = `rfq-${Date.now()}-${need.sku}`;
    const order: ResolvedOrder = {
      sku: need.sku,
      quantity: need.quantity,
      winner_ens: null,
      winner_total_usd: null,
      escrow_tx: null,
      escrow_explorer_url: null,
      escrow_order_id: null,
      audit_anchor_index: null,
      audit_anchor_tx: null,
      erp_po_id: null,
      erp_po_url: null,
      skipped_reason: null,
    };
    orders.push(order);
    console.log(`\n[buyer] need: ${need.sku} x${need.quantity} (${need.reason})`);
    console.log(`[buyer] broadcasting ${rfqId}…`);

    const quotes = await broadcastRfq(sellers, rfqId, need, buyer);
    if (quotes.length === 0) {
      console.log(`[buyer] no quotes for ${need.sku} — skipping`);
      order.skipped_reason = "no quotes received";
      continue;
    }

    const winner = pickWinner(need, quotes);
    if (!winner) {
      console.log(
        `[buyer] no quote within budget (max $${need.max_unit_price_usd}/u, ≤${need.deadline_days}d) — skipping`,
      );
      order.skipped_reason = "no quote within budget";
      continue;
    }
    order.winner_ens = winner.source_ens ?? null;
    order.winner_total_usd = winner.total_usd;
    console.log(
      `[buyer] winner: ${winner.source_ens} → $${winner.total_usd} ${winner.currency}, ${winner.delivery_days}d`,
    );

    const pattern = detectPattern(
      history.purchases,
      need.sku,
      winner.source_ens ?? "unknown",
      winner.unit_price_usd,
    );
    let approval: ApprovalResult | null = null;
    if (pattern.is_recurring && pattern.is_better_deal) {
      console.log(`[buyer] 🚨 PATTERN TRIGGER — pinging human:`);
      console.log(`[buyer]   ${pattern.message}`);
      if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        const tg = new TelegramApprover({
          token: process.env.TELEGRAM_BOT_TOKEN,
          chatId: process.env.TELEGRAM_CHAT_ID,
        });
        console.log(`[buyer] sending approval request to Telegram…`);
        approval = await tg.requestApproval({
          title: `Mejor oferta para ${need.sku}`,
          summary: pattern.message,
          amount_usd: winner.total_usd,
          timeoutMs: 90_000,
        });
        console.log(`[buyer]   → ${approval.approved ? "✅ APPROVED" : "✖ NOT APPROVED"} (${approval.reason})`);
        if (!approval.approved) {
          console.log(`[buyer] human did not approve — skipping ${need.sku}`);
          continue;
        }
      } else {
        console.log(`[buyer]   (TELEGRAM_BOT_TOKEN/CHAT_ID not set — skipping human prompt, auto-proceeding for demo)`);
      }
    } else {
      console.log(`[buyer] pattern: ${pattern.message}`);
    }

    console.log(`[buyer] policy gate via policy-from-ens…`);
    const policy = (await policyCheck.execute("call-policy", {
      action: "pay_carrier",
      carrier_id: winner.seller_address,
      amount_usd: String(winner.total_usd),
      ens_name: buyer.buyer_ens,
    })) as { details: { allowed: boolean; reason: string | null; policy: unknown } };
    console.log(
      `[buyer]   → allowed=${policy.details.allowed}, reason=${policy.details.reason ?? "ok"}`,
    );
    if (!policy.details.allowed) {
      console.log(`[buyer] policy denied — skipping payment.`);
      order.skipped_reason = `policy denied: ${policy.details.reason ?? "unknown"}`;
      continue;
    }

    console.log(`[buyer] locking funds in ProcurementEscrow…`);
    const escrowResult = await lockEscrow({
      sellerAddress: winner.seller_address,
      amountUsd: winner.total_usd,
      sku: winner.sku,
      quantity: winner.quantity,
      deadlineDays: winner.delivery_days + 1,
    });
    order.escrow_tx = escrowResult.txHash;
    order.escrow_explorer_url = `https://sepolia.etherscan.io/tx/${escrowResult.txHash}`;
    order.escrow_order_id = escrowResult.orderId;
    console.log(
      `[buyer]   → order #${escrowResult.orderId}, locked ${escrowResult.amountEth} ETH (mock $${winner.total_usd}), tx ${escrowResult.txHash.slice(0, 16)}…`,
    );
    console.log(
      `[buyer]   → explorer: ${order.escrow_explorer_url}`,
    );

    console.log(`[buyer] audit to 0G…`);
    const audit = (await recordAudit.execute("call-audit", {
      record: {
        at: new Date().toISOString(),
        case: "agentic-erp-rfq-decision",
        buyer: buyer.buyer,
        rfq_id: rfqId,
        need,
        quotes,
        winner: { ens: winner.source_ens, total_usd: winner.total_usd },
        pattern,
        approval,
        policy: policy.details.policy,
        escrow: {
          contract: escrowResult.address,
          orderId: escrowResult.orderId,
          amountEth: escrowResult.amountEth,
          txHash: escrowResult.txHash,
          chain: "sepolia",
        },
      },
    })) as {
      details: {
        cidRoot: string;
        chain: { txHash: string; explorer: string; anchorIndex: string };
      };
    };
    order.audit_anchor_index = audit.details.chain.anchorIndex;
    order.audit_anchor_tx = audit.details.chain.txHash;
    console.log(
      `[buyer]   → audit anchor #${audit.details.chain.anchorIndex} tx ${audit.details.chain.txHash.slice(0, 16)}…`,
    );

    // ── Close the loop: write the resolved purchase order back to the
    // source system (Odoo / Excel / SAP). This is what makes the agent
    // "connected to the real world" — the ERP sees what the agent did
    // instead of running in a parallel universe.
    if (canWriteBack) {
      console.log(`[buyer] writeback to ${connector.id} (${connector.name})…`);
      try {
        const placed = await connector.pushOrder!({
          sku: winner.sku,
          quantity: winner.quantity,
          unit_price_usd: winner.unit_price_usd,
          total_usd: winner.total_usd,
          seller_ens: winner.source_ens ?? "unknown",
          seller_address: winner.seller_address,
          escrow_tx: escrowResult.txHash,
          escrow_order_id: escrowResult.orderId,
          audit_anchor_index: audit.details.chain.anchorIndex,
          at: new Date().toISOString(),
        });
        order.erp_po_id = placed.id;
        order.erp_po_url = placed.url ?? null;
        console.log(
          `[buyer]   → ✓ ${connector.id} PO ${placed.id}${placed.url ? ` · ${placed.url}` : ""}`,
        );
      } catch (e) {
        console.log(
          `[buyer]   ⚠ writeback failed (${(e as Error).message}) — chain state is correct, ERP missed it`,
        );
      }
    }
  }

  console.log(`\n[buyer] tick complete ✓`);

  return {
    at: new Date().toISOString(),
    buyer_ens: buyer.buyer_ens,
    connector_id: connector.id,
    connector_name: connector.name,
    needs_count: needs.length,
    orders,
  };
}

// CLI entry point: only auto-runs when invoked directly via tsx /
// node — not when imported by /api/procurement-tick or tests.
const isCli =
  import.meta.url.endsWith("/buyer-agent/src/index.ts") &&
  Boolean(process.argv[1]?.includes("buyer-agent"));
if (isCli) {
  runProcurementTick().catch((e) => {
    console.error("[buyer] failed:", e);
    process.exit(1);
  });
}
