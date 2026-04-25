import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { Wallet, getBytes, hashMessage } from "ethers";

interface CatalogItem {
  sku: string;
  name: string;
  unit_price_usd: number;
  stock: number;
  delivery_days: number;
}

interface Catalog {
  seller: string;
  address: string;
  currency: string;
  items: CatalogItem[];
}

interface RfqRequest {
  rfq_id: string;
  sku: string;
  quantity: number;
  buyer_ens?: string;
  buyer_address?: string;
  deadline?: string;
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
}

const PORT = parseInt(process.env.SELLER_PORT || "3030", 10);
const CATALOG_PATH = process.env.SELLER_CATALOG_PATH || "apps/seller-agent/catalog.json";

let catalog: Catalog;

async function loadCatalog(): Promise<Catalog> {
  const text = await readFile(CATALOG_PATH, "utf8");
  return JSON.parse(text);
}

async function signQuote(quote: Omit<Quote, "signature">): Promise<string> {
  const pk = process.env.AGENT_PRIVATE_KEY;
  if (!pk) return "0xUNSIGNED_DEMO_MODE";
  const wallet = new Wallet(pk);
  const payload = JSON.stringify({
    rfq_id: quote.rfq_id,
    seller_address: quote.seller_address,
    sku: quote.sku,
    total_usd: quote.total_usd,
    valid_until: quote.valid_until,
  });
  return wallet.signMessage(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body, null, 2));
}

async function handleRfq(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let payload: RfqRequest;
  try {
    const text = await readBody(req);
    payload = JSON.parse(text);
  } catch {
    return send(res, 400, { error: "invalid JSON" });
  }
  if (!payload.sku || !payload.quantity) {
    return send(res, 400, { error: "rfq requires { sku, quantity }" });
  }
  const item = catalog.items.find((i) => i.sku === payload.sku);
  if (!item) {
    return send(res, 404, {
      error: `sku ${payload.sku} not in catalog`,
      available_skus: catalog.items.map((i) => i.sku),
    });
  }
  if (item.stock < payload.quantity) {
    return send(res, 409, {
      error: `insufficient stock for ${payload.sku}: have ${item.stock}, want ${payload.quantity}`,
    });
  }
  const total = item.unit_price_usd * payload.quantity;
  const validUntil = new Date(Date.now() + 5 * 60_000).toISOString();
  const draft: Omit<Quote, "signature"> = {
    rfq_id: payload.rfq_id,
    seller: catalog.seller,
    seller_address: catalog.address,
    sku: payload.sku,
    unit_price_usd: item.unit_price_usd,
    total_usd: Math.round(total * 100) / 100,
    quantity: payload.quantity,
    delivery_days: item.delivery_days,
    currency: catalog.currency,
    valid_until: validUntil,
  };
  const signature = await signQuote(draft);
  console.log(
    `[seller] RFQ ${payload.rfq_id}: ${payload.sku} x${payload.quantity} → $${draft.total_usd} ${draft.currency}, ${draft.delivery_days}d`,
  );
  send(res, 200, { ...draft, signature });
}

function handleCatalog(_req: IncomingMessage, res: ServerResponse): void {
  send(res, 200, {
    seller: catalog.seller,
    address: catalog.address,
    currency: catalog.currency,
    item_count: catalog.items.length,
    skus: catalog.items.map((i) => ({
      sku: i.sku,
      name: i.name,
      stock: i.stock,
      unit_price_usd: i.unit_price_usd,
    })),
  });
}

function handleHealth(_req: IncomingMessage, res: ServerResponse): void {
  send(res, 200, { ok: true, seller: catalog.seller, port: PORT });
}

async function main(): Promise<void> {
  catalog = await loadCatalog();
  console.log(`[seller] loaded catalog: ${catalog.seller} — ${catalog.items.length} SKUs`);
  console.log(`[seller] address: ${catalog.address}`);

  const server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") return handleHealth(req, res);
    if (req.method === "GET" && req.url === "/catalog") return handleCatalog(req, res);
    if (req.method === "POST" && req.url === "/rfq") {
      handleRfq(req, res).catch((e: Error) => {
        console.error("[seller] /rfq error:", e.message);
        send(res, 500, { error: e.message });
      });
      return;
    }
    send(res, 404, { error: `not found: ${req.method} ${req.url}` });
  });

  server.listen(PORT, () => {
    console.log(`[seller] listening on http://localhost:${PORT}`);
    console.log(`[seller] endpoints: GET /health, GET /catalog, POST /rfq`);
  });
}

main().catch((e) => {
  console.error("[seller] failed to start:", e);
  process.exit(1);
});
