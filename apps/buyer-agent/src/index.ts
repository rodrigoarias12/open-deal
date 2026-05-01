import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Contract, JsonRpcProvider, Wallet, keccak256, parseEther, toUtf8Bytes } from "ethers";
import policyPlugin from "../../../plugins/policy-from-ens/src/index";
import auditPlugin from "../../../plugins/audit-to-0g/src/index";
import { pickBuyerConnector } from "../../../src/connectors/buyer/factory";
import { TelegramApprover, type ApprovalResult } from "../../../src/notify/telegram";
import { llmAsk } from "../../../src/llm/client";
import { readHistoryFrom0G } from "./history-from-0g";
import {
  loadCatalogFromUri,
  buildSkuIndex,
  type IndexedSeller,
} from "../../../src/catalog/loader";
import type { Catalog } from "../../../src/connectors/seller/types";

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
  catalog_uri?: string;
  categories?: string[];
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
    const [endpoint, addrRaw, catalogUri, skusRaw, legacyCategoriesRaw] = await Promise.all([
      resolver.getText("endpoint"),
      resolver.getAddress(),
      resolver.getText("catalog-uri").catch(() => null),
      // Spec-canonical (PROTOCOL.md §1) — comma-separated SKU patterns
      // or category tags. Used as a coarse pre-filter so we don't fan out
      // RFQs to sellers that obviously don't sell what we need.
      resolver.getText("procurement.skus").catch(() => null),
      // Back-compat with sellers that set the old `categories` record.
      resolver.getText("categories").catch(() => null),
    ]);
    if (!endpoint) {
      console.log(`[buyer]   × ${ens} → no 'endpoint' text record`);
      continue;
    }
    const sourceRaw = skusRaw ?? legacyCategoriesRaw;
    const categories = sourceRaw
      ? sourceRaw.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean)
      : undefined;
    out.push({
      ens,
      endpoint,
      address: addrRaw ?? "",
      catalog_uri: catalogUri ?? undefined,
      categories,
    });
    const tags = [
      `endpoint=${endpoint}`,
      catalogUri ? `catalog=${catalogUri.slice(0, 32)}…` : "no-catalog",
      categories?.length ? `cats=[${categories.join(",")}]` : null,
    ].filter(Boolean);
    console.log(`[buyer]   ✓ ${ens} → ${tags.join(", ")}`);
  }
  return out;
}

/**
 * Discovery step 2: pull each seller's catalog (procurement.catalog-uri)
 * and build a SKU → sellers index. Sellers that fail to publish a
 * catalog stay in the registry for endpoint discovery but contribute
 * nothing to the index — they'll only be RFQ'd if their categories or
 * a manual override matches.
 *
 * The buyer ONLY fan-outs RFQs to sellers indexed for the requested
 * SKU. This is what lets the protocol scale past a single hardcoded
 * sellers.json — the index can grow to N sellers without any change
 * in the RFQ surface.
 */
async function fetchCatalogsAndIndex(
  sellers: SellerEntry[],
): Promise<{
  index: Map<string, IndexedSeller<SellerEntry>[]>;
  totals: { ok: number; skipped: number; total_skus: number };
}> {
  const indexed: IndexedSeller<SellerEntry>[] = [];
  let ok = 0;
  let skipped = 0;
  for (const seller of sellers) {
    if (!seller.catalog_uri) {
      console.log(`[buyer]   ⏭  ${seller.ens} → no catalog-uri (excluded from SKU index)`);
      skipped += 1;
      continue;
    }
    try {
      const catalog: Catalog = await loadCatalogFromUri(seller.catalog_uri);
      const skuList = catalog.items.map((i) => i.sku).join(", ");
      console.log(
        `[buyer]   ✓ ${seller.ens} → ${catalog.items.length} SKU(s) [${skuList}]`,
      );
      indexed.push({ seller, catalog });
      ok += 1;
    } catch (e) {
      console.log(
        `[buyer]   ⚠ ${seller.ens} → catalog fetch failed (${(e as Error).message}) — excluded from index`,
      );
      skipped += 1;
    }
  }
  const index = buildSkuIndex(indexed);
  const total_skus = index.size;
  return { index, totals: { ok, skipped, total_skus } };
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

// Lazy import — @keeperhub/wallet pulls in viem; only loaded when
// KH_WALLET_ENABLED is truthy so dev builds without KH config don't
// fail at module init.
let _kh: typeof import("@keeperhub/wallet") | null = null;
async function khSdk() {
  if (_kh) return _kh;
  _kh = await import("@keeperhub/wallet");
  return _kh;
}

function khEnabled(): boolean {
  // Two ways to enable real KH: env flag (production), or default-on
  // when wallet config file exists locally (dev convenience).
  if (process.env.KH_WALLET_ENABLED === "false") return false;
  return Boolean(
    process.env.KEEPERHUB_API_KEY ||
      process.env.KH_WALLET_ENABLED === "true",
  );
}

// Pay an x402 challenge — returns a payment proof string the seller
// will accept as X-Payment-Proof on the retry.
//
//   • Real path  (KH enabled): hand the 402 Response to KeeperHub's
//     paymentSigner.pay(). The SDK signs the USDC transfer via the
//     Turnkey-custodied wallet on Base, broadcasts the tx, and returns
//     the post-payment retry Response. We extract the actual on-chain
//     tx hash from that response (X-Payment-Receipt or body field) and
//     use it as the proof.
//
//   • Mock path  (no KH): emit a deterministic "x402-mock-…" receipt.
//     Seller-side validators in demo mode accept any well-formed proof,
//     so the wire format is exercised even without real KH funds.
async function payX402Challenge(args: {
  amountUsdc: number;
  to: string;
  nonce: string;
  network: string;
  // The original 402 Response — needed by paymentSigner.pay() so it
  // can read the X-Payment-* headers and compute the signed transfer.
  response402?: Response;
  // The original request init we want to replay after payment.
  retryInit?: { url: string; method: string; headers: Record<string, string>; body: string };
}): Promise<{ proof: string; usedRail: "keeperhub" | "mock"; postPaymentResponse?: Response }> {
  if (khEnabled() && args.response402 && args.retryInit) {
    try {
      const { paymentSigner } = await khSdk();
      const paid = await paymentSigner.pay(args.response402, {
        body: args.retryInit.body,
        headers: args.retryInit.headers,
      });
      // Try to read the on-chain tx hash from KH's response. KH echoes
      // it in X-KH-Payment-Tx (preferred) or in the response body.
      const txFromHeader = paid.headers.get("x-kh-payment-tx") ?? paid.headers.get("x-payment-tx");
      const proof = txFromHeader ?? `0xkh-${args.network}-${args.nonce}`;
      return { proof, usedRail: "keeperhub", postPaymentResponse: paid };
    } catch (e) {
      console.log(
        `[buyer]     · KeeperHub pay failed (${(e as Error).message}); falling back to mock receipt`,
      );
      // fall through to mock
    }
  }
  return {
    proof: `x402-mock-${args.network}-${args.nonce}`,
    usedRail: "mock",
  };
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
    let usedRail: "keeperhub" | "mock" | null = null;
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
          const railLabel = khEnabled() ? "KeeperHub (real x402)" : "mock receipt";
          console.log(
            `[buyer]     ↻ ${seller.ens} → 402 · paying ${amount} ${token} via ${railLabel} on ${network}…`,
          );
          const result = await payX402Challenge({
            amountUsdc: amount,
            to,
            nonce,
            network,
            response402: resp.clone(),
            retryInit: { url, method: "POST", headers, body },
          });
          paymentProof = result.proof;
          usedRail = result.usedRail;
          // KH already executed the post-payment retry for us; if it
          // returned a usable response, use it directly and skip the
          // manual retry round.
          if (result.postPaymentResponse) {
            resp = result.postPaymentResponse;
            console.log(
              `[buyer]     ✓ ${seller.ens} paid via ${result.usedRail} · proof ${paymentProof.slice(0, 20)}…`,
            );
            break;
          }
          continue; // retry with proof header
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
        `[buyer]     ✓ ${seller.ens} → $${quote.total_usd} ${quote.currency}, ${quote.delivery_days}d, sig ${quote.signature.slice(0, 18)}…${paymentProof ? ` (paid via ${usedRail})` : ""}`,
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

// Filter quotes against budget + deadline constraints from the RFQ.
// This is the deterministic eligibility gate — any quote that fails
// these checks is OFF THE TABLE before the LLM ever sees them.
function eligibleQuotes(need: Need, quotes: Quote[]): Quote[] {
  return quotes
    .filter((q) => q.unit_price_usd <= need.max_unit_price_usd)
    .filter((q) => q.delivery_days <= need.deadline_days);
}

// Lightweight summary of one quote — what the LLM sees, not the
// full Quote shape (signature etc. are not load-bearing for the choice).
interface QuoteForLlm {
  index: number;
  seller_ens: string;
  unit_price_usd: number;
  total_usd: number;
  delivery_days: number;
}

interface WinnerPick {
  winner: Quote | null;
  reasoning: string;
  // "llm" = chose via Claude · "fallback-cheapest" = LLM unavailable, picked the cheapest
  selection_method: "llm" | "fallback-cheapest" | "no-eligible";
}

const PICK_WINNER_SYSTEM = `You are a procurement agent picking the best supplier for a B2B order.

Given an RFQ, recent purchase history for the same SKU, and a list of eligible
quotes (already filtered by budget and deadline), choose the quote that best
serves the buyer.

Decision factors, in priority order:
  1. Total cost (cheaper is usually better, but not blindly).
  2. Delivery time relative to the deadline (faster is safer when the
     deadline is tight; not worth paying extra when the deadline is loose).
  3. Vendor relationship: if the buyer has bought this SKU from a vendor
     repeatedly, switching for a tiny savings has switching cost.
  4. Risk: a wildly out-of-band quote (much cheaper than history average)
     could indicate a data error — flag it but still consider.

Respond ONLY with a single JSON object on one line, no prose:
  {"winner_index": <int>, "reasoning": "<2 short sentences max>"}

The reasoning will be stored on-chain (in 0G audit), so it must be specific
and defensible — name the quote you chose and the trade-off you made.`;

async function pickWinner(
  need: Need,
  quotes: Quote[],
  historySnippet: { seller_ens: string; unit_price_usd: number; at: string }[],
): Promise<WinnerPick> {
  const eligible = eligibleQuotes(need, quotes);
  if (eligible.length === 0) {
    return { winner: null, reasoning: "no quotes met budget+deadline", selection_method: "no-eligible" };
  }

  // Single eligible quote → no reason to consult the LLM.
  if (eligible.length === 1) {
    return {
      winner: eligible[0],
      reasoning: `only one eligible quote (${eligible[0].source_ens})`,
      selection_method: "fallback-cheapest",
    };
  }

  const summary: QuoteForLlm[] = eligible.map((q, i) => ({
    index: i,
    seller_ens: q.source_ens ?? "unknown",
    unit_price_usd: q.unit_price_usd,
    total_usd: q.total_usd,
    delivery_days: q.delivery_days,
  }));

  const userMessage = JSON.stringify(
    {
      sku: need.sku,
      quantity: need.quantity,
      max_unit_price_usd: need.max_unit_price_usd,
      deadline_days: need.deadline_days,
      reason: need.reason,
      history_for_this_sku: historySnippet.slice(-5),
      quotes: summary,
    },
    null,
    2,
  );

  try {
    const llmResp = await llmAsk({
      system: PICK_WINNER_SYSTEM,
      user: userMessage,
      maxTokens: 200,
      prefill: '{"winner_index":',
    });
    // Parse strict JSON. The prefill ensures the response starts with our key.
    const parsed = JSON.parse(llmResp.text) as { winner_index: number; reasoning: string };
    if (
      typeof parsed.winner_index !== "number" ||
      parsed.winner_index < 0 ||
      parsed.winner_index >= eligible.length
    ) {
      throw new Error(`LLM returned out-of-range winner_index: ${parsed.winner_index}`);
    }
    return {
      winner: eligible[parsed.winner_index],
      reasoning: parsed.reasoning ?? "(no reasoning provided)",
      selection_method: "llm",
    };
  } catch (e) {
    // LLM unavailable / malformed response → fall back to deterministic
    // cheapest within budget. This keeps the agent functional even if
    // ANTHROPIC_API_KEY is missing or the API is down.
    const sorted = [...eligible].sort((a, b) => a.total_usd - b.total_usd);
    return {
      winner: sorted[0],
      reasoning: `LLM unavailable (${(e as Error).message}); fell back to cheapest in budget`,
      selection_method: "fallback-cheapest",
    };
  }
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
  // LLM-driven winner selection. Surfaced to the UI so the LiveTerminal /
  // dashboard can render WHY each winner was chosen.
  llm_reasoning: string | null;
  selection_method: "llm" | "fallback-cheapest" | "no-eligible" | null;
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
  console.log(`[buyer] discovery step 1/2 — resolving sellers from ENS (${ensRpc})…`);
  const sellers = await resolveSellers(registry.sellers, ensRpc);
  if (sellers.length === 0) {
    throw new Error("no sellers resolved from ENS — abort");
  }

  console.log(
    `[buyer] discovery step 2/2 — fetching catalogs from procurement.catalog-uri…`,
  );
  const { index: skuIndex, totals: catalogTotals } = await fetchCatalogsAndIndex(
    sellers,
  );
  console.log(
    `[buyer] indexed ${catalogTotals.total_skus} unique SKU(s) across ${catalogTotals.ok} seller(s) (${catalogTotals.skipped} skipped — no catalog or fetch failed)`,
  );

  const policyTools = loadPlugin(policyPlugin as never);
  const auditTools = loadPlugin(auditPlugin as never);
  const policyCheck = policyTools.find((t) => t.name === "treasury_policy_check");
  const recordAudit = auditTools.find((t) => t.name === "record_audit");
  if (!policyCheck || !recordAudit) {
    throw new Error("plugins did not register expected tools");
  }

  // ── Pipeline structure (parallelized) ────────────────────────────────
  //
  //   Phase A — pre-flight (parallel)
  //     N RFQs broadcast at once (each RFQ targeted by SKU index),
  //     winners picked, patterns detected
  //   Phase A2 — telegram approvals (serial, only triggered patterns)
  //   Phase A3 — policy gate (parallel, read-only)
  //   Phase B — escrow locks (serial — same wallet nonce, can't overlap)
  //   Phase C — ONE batched audit upload to 0G covering all decisions
  //   Phase D — Odoo writeback (parallel)
  //
  // Per-SKU intermediate state lives in `slots[]`, ordered to match `needs[]`.
  type Slot = {
    need: Need;
    rfqId: string;
    order: ResolvedOrder;
    quotes: Quote[];
    winner: Quote | null;
    pattern: PatternSignal | null;
    approval: ApprovalResult | null;
    policySnapshot: unknown;
    escrow: Awaited<ReturnType<typeof lockEscrow>> | null;
    // LLM-driven winner selection. Anchored on 0G as part of the audit
    // so a third party can verify the reasoning that justified the choice.
    llmReasoning: string | null;
    selectionMethod: "llm" | "fallback-cheapest" | "no-eligible" | null;
  };

  const slots: Slot[] = needs.map((need) => ({
    need,
    rfqId: `rfq-${Date.now()}-${need.sku}`,
    order: {
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
      llm_reasoning: null,
      selection_method: null,
    },
    quotes: [],
    winner: null,
    pattern: null,
    approval: null,
    policySnapshot: null,
    escrow: null,
    llmReasoning: null,
    selectionMethod: null,
  }));
  for (const s of slots) orders.push(s.order);

  // ── Phase A — RFQ + winner pick + pattern (parallel across SKUs) ──────
  // Each slot picks its own RFQ targets via the SKU index built above —
  // sellers whose published catalog carries this SKU, plus a fallback
  // for sellers without a catalog (preserves backward-compat with
  // self-hosted sellers that haven't set catalog-uri yet).
  console.log(
    `\n[buyer] phase A · broadcasting ${slots.length} RFQ(s) in parallel…`,
  );
  await Promise.all(
    slots.map(async (s) => {
      console.log(`[buyer] need: ${s.need.sku} x${s.need.quantity} (${s.need.reason})`);

      const indexed = skuIndex.get(s.need.sku) ?? [];
      const indexedEnsSet = new Set(indexed.map((e) => e.seller.ens));
      // Fallback sellers: those without a catalog. We still consider them
      // BUT respect their procurement.skus declaration if present — a
      // seller that says "I sell PAPER" gets the RFQ for "PAPEL-A4" but
      // not for "TINTA-NEG-XL". Saves wasted RFQ round-trips.
      const skuLower = s.need.sku.toLowerCase();
      const fallback = sellers.filter((sl) => {
        if (sl.catalog_uri || indexedEnsSet.has(sl.ens)) return false;
        if (!sl.categories || sl.categories.length === 0) return true;
        return sl.categories.some((c) => skuLower.includes(c));
      });
      const targets = [...indexed.map((e) => e.seller), ...fallback];
      if (targets.length === 0) {
        console.log(
          `[buyer]   no seller carries SKU ${s.need.sku} (registry of ${sellers.length}, indexed ${catalogTotals.ok}) — skipping`,
        );
        s.order.skipped_reason = "no seller carries SKU";
        return;
      }
      console.log(
        `[buyer]   SKU index → ${indexed.length} match(es), ${fallback.length} no-catalog fallback(s) — RFQ targets: ${targets.length}/${sellers.length}`,
      );
      for (const t of indexed) {
        const item = t.catalog.items.find((i) => i.sku === s.need.sku);
        if (item) {
          console.log(
            `[buyer]     · ${t.seller.ens} carries ${s.need.sku} @ list $${item.unit_price_usd}/u (stock ${item.stock})`,
          );
        }
      }
      console.log(`[buyer] broadcasting ${s.rfqId} to ${targets.length} seller(s)…`);

      const quotes = await broadcastRfq(targets, s.rfqId, s.need, buyer);
      s.quotes = quotes;
      if (quotes.length === 0) {
        console.log(`[buyer] no quotes for ${s.need.sku} — skipping`);
        s.order.skipped_reason = "no quotes received";
        return;
      }
      const histForSku = history.purchases
        .filter((p) => p.sku === s.need.sku)
        .map((p) => ({
          seller_ens: p.seller_ens,
          unit_price_usd: p.unit_price_usd,
          at: p.at,
        }));
      console.log(
        `[buyer] asking Claude to pick winner for ${s.need.sku} (${quotes.length} quotes, ${histForSku.length} historical)…`,
      );
      const pick = await pickWinner(s.need, quotes, histForSku);
      if (!pick.winner) {
        console.log(
          `[buyer] no eligible quote for ${s.need.sku}: ${pick.reasoning} — skipping`,
        );
        s.order.skipped_reason = pick.reasoning;
        return;
      }
      s.winner = pick.winner;
      s.llmReasoning = pick.reasoning;
      s.selectionMethod = pick.selection_method;
      s.order.winner_ens = pick.winner.source_ens ?? null;
      s.order.winner_total_usd = pick.winner.total_usd;
      s.order.llm_reasoning = pick.reasoning;
      s.order.selection_method = pick.selection_method;
      const tag =
        pick.selection_method === "llm"
          ? "[llm]"
          : pick.selection_method === "fallback-cheapest"
            ? "[fallback]"
            : "[—]";
      console.log(
        `[buyer] winner ${s.need.sku}: ${pick.winner.source_ens} → $${pick.winner.total_usd} ${pick.winner.currency}, ${pick.winner.delivery_days}d ${tag}`,
      );
      console.log(`[buyer]   ${tag} reasoning: ${pick.reasoning}`);
      s.pattern = detectPattern(
        history.purchases,
        s.need.sku,
        pick.winner.source_ens ?? "unknown",
        pick.winner.unit_price_usd,
      );
    }),
  );

  // ── Phase A2 — telegram approvals (serial, one prompt at a time) ──────
  for (const s of slots) {
    if (!s.winner || !s.pattern) continue;
    if (!(s.pattern.is_recurring && s.pattern.is_better_deal)) {
      console.log(`[buyer] pattern ${s.need.sku}: ${s.pattern.message}`);
      continue;
    }
    console.log(`[buyer] 🚨 PATTERN TRIGGER (${s.need.sku}) — pinging human:`);
    console.log(`[buyer]   ${s.pattern.message}`);
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      const tg = new TelegramApprover({
        token: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
      });
      console.log(`[buyer] sending approval request to Telegram (${s.need.sku})…`);
      s.approval = await tg.requestApproval({
        title: `Mejor oferta para ${s.need.sku}`,
        summary: s.pattern.message,
        amount_usd: s.winner.total_usd,
        timeoutMs: 90_000,
      });
      console.log(
        `[buyer]   → ${s.approval.approved ? "✅ APPROVED" : "✖ NOT APPROVED"} (${s.approval.reason})`,
      );
      if (!s.approval.approved) {
        console.log(`[buyer] human did not approve — skipping ${s.need.sku}`);
        s.order.skipped_reason = `human declined: ${s.approval.reason}`;
        s.winner = null;
      }
    } else {
      console.log(
        `[buyer]   (TELEGRAM_BOT_TOKEN/CHAT_ID not set — skipping human prompt, auto-proceeding for demo)`,
      );
    }
  }

  // ── Phase A3 — policy gate (parallel) ─────────────────────────────────
  console.log(`\n[buyer] phase A3 · policy gate via policy-from-ens (parallel)…`);
  await Promise.all(
    slots.map(async (s) => {
      if (!s.winner) return;
      const policy = (await policyCheck.execute("call-policy", {
        action: "pay_carrier",
        carrier_id: s.winner.seller_address,
        amount_usd: String(s.winner.total_usd),
        ens_name: buyer.buyer_ens,
      })) as { details: { allowed: boolean; reason: string | null; policy: unknown } };
      console.log(
        `[buyer]   ${s.need.sku} → allowed=${policy.details.allowed}${policy.details.reason ? `, reason=${policy.details.reason}` : ""}`,
      );
      s.policySnapshot = policy.details.policy;
      if (!policy.details.allowed) {
        s.order.skipped_reason = `policy denied: ${policy.details.reason ?? "unknown"}`;
        s.winner = null;
      }
    }),
  );

  // ── Phase B — escrow locks (serial, same wallet nonce) ───────────────
  const approvedSlots = slots.filter((s) => s.winner !== null);
  console.log(
    `\n[buyer] phase B · locking ${approvedSlots.length} escrow(s) on Sepolia (serial)…`,
  );
  for (const s of approvedSlots) {
    if (!s.winner) continue;
    console.log(`[buyer] locking funds for ${s.need.sku}…`);
    try {
      const escrowResult = await lockEscrow({
        sellerAddress: s.winner.seller_address,
        amountUsd: s.winner.total_usd,
        sku: s.winner.sku,
        quantity: s.winner.quantity,
        deadlineDays: s.winner.delivery_days + 1,
      });
      s.escrow = escrowResult;
      s.order.escrow_tx = escrowResult.txHash;
      s.order.escrow_explorer_url = `https://sepolia.etherscan.io/tx/${escrowResult.txHash}`;
      s.order.escrow_order_id = escrowResult.orderId;
      console.log(
        `[buyer]   → ${s.need.sku} order #${escrowResult.orderId} · locked ${escrowResult.amountEth} ETH · tx ${escrowResult.txHash.slice(0, 16)}…`,
      );
    } catch (e) {
      console.log(`[buyer]   ⚠ escrow lock failed for ${s.need.sku}: ${(e as Error).message}`);
      s.order.skipped_reason = `escrow lock failed: ${(e as Error).message}`;
      s.winner = null;
    }
  }

  // ── Phase C — single batched audit on 0G ─────────────────────────────
  // Instead of one upload+anchor per SKU, we collect every decision into
  // one record. One 0G Storage upload, one AuditAnchor.append() — all
  // orders in this tick share the same anchor index. Saves ~30s per
  // skipped audit. The decision is the unit of audit; the tick groups them.
  const lockedSlots = slots.filter((s) => s.escrow !== null);
  if (lockedSlots.length > 0) {
    const tickId = `tick-${Date.now()}`;
    console.log(
      `\n[buyer] phase C · batched audit · ${lockedSlots.length} decision(s) → 0G in ONE upload…`,
    );
    const audit = (await recordAudit.execute("call-audit", {
      record: {
        at: new Date().toISOString(),
        case: "agentic-erp-batched-tick",
        schema: "procurement.audit.v1",
        buyer: buyer.buyer,
        buyer_ens: buyer.buyer_ens,
        tick_id: tickId,
        decisions: lockedSlots.map((s, idx) => ({
          decision_index: idx,
          rfq_id: s.rfqId,
          need: s.need,
          quotes: s.quotes,
          winner: {
            ens: s.winner!.source_ens,
            total_usd: s.winner!.total_usd,
            unit_price_usd: s.winner!.unit_price_usd,
            delivery_days: s.winner!.delivery_days,
          },
          // The LLM's reasoning is anchored alongside the decision so
          // a third party can verify WHY this winner was chosen, not
          // just that it was. selection_method = "llm" means an LLM
          // call drove the choice; "fallback-cheapest" means the LLM
          // was unavailable and we used the deterministic baseline.
          selection: {
            method: s.selectionMethod,
            reasoning: s.llmReasoning,
          },
          pattern: s.pattern,
          approval: s.approval,
          policy: s.policySnapshot,
          escrow: {
            contract: s.escrow!.address,
            orderId: s.escrow!.orderId,
            amountEth: s.escrow!.amountEth,
            txHash: s.escrow!.txHash,
            chain: "sepolia",
          },
        })),
      },
    })) as {
      details: {
        cidRoot: string;
        chain: { txHash: string; explorer: string; anchorIndex: string };
      };
    };
    console.log(
      `[buyer]   → audit anchor #${audit.details.chain.anchorIndex} tx ${audit.details.chain.txHash.slice(0, 16)}… (covers ${lockedSlots.length} order(s))`,
    );
    // Tag every order in this tick with the same anchor.
    for (const s of lockedSlots) {
      s.order.audit_anchor_index = audit.details.chain.anchorIndex;
      s.order.audit_anchor_tx = audit.details.chain.txHash;
    }
  }

  // ── Phase D — Odoo writeback (parallel, one create call per order) ───
  if (canWriteBack && lockedSlots.length > 0) {
    console.log(
      `\n[buyer] phase D · writeback ${lockedSlots.length} PO(s) to ${connector.id} (parallel)…`,
    );
    await Promise.all(
      lockedSlots.map(async (s) => {
        try {
          const placed = await connector.pushOrder!({
            sku: s.winner!.sku,
            quantity: s.winner!.quantity,
            unit_price_usd: s.winner!.unit_price_usd,
            total_usd: s.winner!.total_usd,
            seller_ens: s.winner!.source_ens ?? "unknown",
            seller_address: s.winner!.seller_address,
            escrow_tx: s.escrow!.txHash,
            escrow_order_id: s.escrow!.orderId,
            audit_anchor_index: s.order.audit_anchor_index ?? undefined,
            at: new Date().toISOString(),
          });
          s.order.erp_po_id = placed.id;
          s.order.erp_po_url = placed.url ?? null;
          console.log(
            `[buyer]   → ✓ ${s.need.sku} → ${connector.id} PO ${placed.id}${placed.url ? ` · ${placed.url}` : ""}`,
          );
        } catch (e) {
          console.log(
            `[buyer]   ⚠ writeback ${s.need.sku} failed: ${(e as Error).message}`,
          );
        }
      }),
    );
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
