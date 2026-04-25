import "dotenv/config";
import { readFile } from "node:fs/promises";
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
  name: string;
  endpoint: string;
  address: string;
}

interface SellerRegistry {
  sellers: SellerEntry[];
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
    `[buyer] ${buyer.needs.length} pending need(s) · ${registry.sellers.length} seller(s) in registry`,
  );

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

    const quotes = await broadcastRfq(registry.sellers, rfqId, need, buyer);
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

    console.log(
      `[buyer] (in v2: createOrder on ProcurementEscrow.sol with $${winner.total_usd} USDC locked, then ping human via WhatsApp/Telegram for approval; for now we record the intent)`,
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
