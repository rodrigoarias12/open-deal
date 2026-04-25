import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Contract, JsonRpcProvider, Wallet, keccak256, parseEther, toUtf8Bytes } from "ethers";
import policyPlugin from "../../../plugins/policy-from-ens/src/index.js";
import auditPlugin from "../../../plugins/audit-to-0g/src/index.js";

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

async function broadcastRfq(
  sellers: SellerEntry[],
  rfqId: string,
  need: Need,
  buyer: BuyerConfig,
): Promise<Quote[]> {
  const quotes: Quote[] = [];
  for (const seller of sellers) {
    const url = `${seller.endpoint}/rfq`;
    console.log(`[buyer]   → POST ${url}`);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfq_id: rfqId,
          sku: need.sku,
          quantity: need.quantity,
          buyer_ens: buyer.buyer_ens,
          buyer_address: buyer.buyer_address,
          deadline: new Date(
            Date.now() + need.deadline_days * 86400_000,
          ).toISOString(),
        }),
      });
      const body = (await resp.json()) as Quote | { error: string };
      if (!resp.ok) {
        console.log(
          `[buyer]     × ${seller.ens} → ${resp.status} ${(body as { error: string }).error}`,
        );
        continue;
      }
      const quote = body as Quote;
      quote.source_endpoint = seller.endpoint;
      quote.source_ens = seller.ens;
      console.log(
        `[buyer]     ✓ ${seller.ens} → $${quote.total_usd} ${quote.currency}, ${quote.delivery_days}d, sig ${quote.signature.slice(0, 18)}…`,
      );
      quotes.push(quote);
    } catch (e) {
      console.log(`[buyer]     × ${seller.ens} → fetch failed: ${(e as Error).message}`);
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

async function main(): Promise<void> {
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

  console.log(`[buyer] ${buyer.buyer} (${buyer.buyer_ens})`);
  console.log(
    `[buyer] ${buyer.needs.length} pending need(s) · ${registry.sellers.length} seller subname(s) in registry`,
  );

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

  for (const need of buyer.needs) {
    const rfqId = `rfq-${Date.now()}-${need.sku}`;
    console.log(`\n[buyer] need: ${need.sku} x${need.quantity} (${need.reason})`);
    console.log(`[buyer] broadcasting ${rfqId}…`);

    const quotes = await broadcastRfq(sellers, rfqId, need, buyer);
    if (quotes.length === 0) {
      console.log(`[buyer] no quotes for ${need.sku} — skipping`);
      continue;
    }

    const winner = pickWinner(need, quotes);
    if (!winner) {
      console.log(
        `[buyer] no quote within budget (max $${need.max_unit_price_usd}/u, ≤${need.deadline_days}d) — skipping`,
      );
      continue;
    }
    console.log(
      `[buyer] winner: ${winner.source_ens} → $${winner.total_usd} ${winner.currency}, ${winner.delivery_days}d`,
    );

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
    console.log(
      `[buyer]   → order #${escrowResult.orderId}, locked ${escrowResult.amountEth} ETH (mock $${winner.total_usd}), tx ${escrowResult.txHash.slice(0, 16)}…`,
    );
    console.log(
      `[buyer]   → explorer: https://sepolia.etherscan.io/tx/${escrowResult.txHash}`,
    );

    console.log(`[buyer] audit to 0G…`);
    const audit = (await recordAudit.execute("call-audit", {
      record: {
        at: new Date().toISOString(),
        case: "nanoprocure-rfq-decision",
        buyer: buyer.buyer,
        rfq_id: rfqId,
        need,
        quotes,
        winner: { ens: winner.source_ens, total_usd: winner.total_usd },
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
    console.log(
      `[buyer]   → audit anchor #${audit.details.chain.anchorIndex} tx ${audit.details.chain.txHash.slice(0, 16)}…`,
    );
  }

  console.log(`\n[buyer] tick complete ✓`);
}

main().catch((e) => {
  console.error("[buyer] failed:", e);
  process.exit(1);
});
