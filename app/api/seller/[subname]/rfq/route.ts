import { NextResponse } from "next/server";
import { mkdir, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonRpcProvider, Wallet } from "ethers";
import { Indexer } from "@0gfoundation/0g-ts-sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SEPOLIA_RPC =
  process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const SEPOLIA_ID = 11155111;
const ZG_RPC = process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const ZG_INDEXER =
  process.env.ZG_INDEXER_URL ||
  "https://indexer-storage-testnet-turbo.0g.ai";
const PARENT = process.env.ENS_PARENT || "openagents-treasury.eth";

interface RfqRequest {
  rfq_id?: string;
  sku?: string;
  quantity?: number;
  buyer_ens?: string;
  buyer_address?: string;
  deadline?: string;
}

interface CatalogItem {
  sku: string;
  name?: string;
  unit_price_usd: number;
  stock: number;
  delivery_days: number;
}

interface Catalog {
  seller?: string;
  address?: string;
  currency?: string;
  items: CatalogItem[];
}

function err(status: number, body: unknown): NextResponse {
  return NextResponse.json(body, { status });
}

async function loadCatalogFromUri(uri: string): Promise<Catalog> {
  if (uri.startsWith("0g://")) {
    const rootHash = uri.slice(5).startsWith("0x")
      ? uri.slice(5)
      : `0x${uri.slice(5)}`;
    const indexer = new Indexer(ZG_INDEXER);
    const dir = join(tmpdir(), `agentic-erp-catalog-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const path = join(dir, "catalog.json");
    const e = await indexer.download(rootHash, path, true);
    if (e) throw new Error(`0G download: ${e}`);
    const raw = await readFile(path, "utf8");
    await unlink(path).catch(() => {});
    return JSON.parse(raw) as Catalog;
  }
  if (uri.startsWith("https://") || uri.startsWith("http://")) {
    const r = await fetch(uri);
    if (!r.ok) throw new Error(`catalog fetch HTTP ${r.status}`);
    return (await r.json()) as Catalog;
  }
  throw new Error(`unsupported catalog-uri scheme: ${uri.slice(0, 16)}…`);
}

async function signQuote(
  signer: Wallet,
  q: { rfq_id: string; seller_address: string; sku: string; total_usd: number; valid_until: string },
): Promise<string> {
  return signer.signMessage(JSON.stringify(q));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ subname: string }> },
): Promise<NextResponse> {
  const { subname: rawSubname } = await params;
  const subname = rawSubname.includes(".")
    ? rawSubname
    : `${rawSubname}.${PARENT}`;

  let body: RfqRequest;
  try {
    body = (await req.json()) as RfqRequest;
  } catch {
    return err(400, { error: "invalid JSON" });
  }
  if (!body.sku || !body.quantity) {
    return err(400, {
      error: "rfq requires { sku, quantity }",
      schema: "procurement.rfq.v1",
    });
  }

  const provider = new JsonRpcProvider(SEPOLIA_RPC, SEPOLIA_ID);
  const resolver = await provider.getResolver(subname);
  if (!resolver) {
    return err(404, {
      error: `no ENS resolver for ${subname}`,
      hint: "make sure the seller is registered (try /sell)",
    });
  }

  const [endpoint, catalogUri, sellerAddrRaw, rfqPriceRaw] = await Promise.all([
    resolver.getText("endpoint"),
    resolver.getText("catalog-uri"),
    resolver.getAddress(),
    resolver.getText("procurement.rfq-price").catch(() => null),
  ]);
  if (!catalogUri) {
    return err(404, {
      error: `${subname} has no catalog-uri text record`,
      ens: `https://sepolia.app.ens.domains/${subname}`,
    });
  }

  // ── 402 dance per PROTOCOL.md §3.4 ────────────────────────────────────
  // If the seller has set procurement.rfq-price (decimal USDC), require
  // a payment proof header. Demo-mode validation: any non-empty
  // X-Payment-Proof of the form "x402-mock-<nonce>" or "0x<txhash>" is
  // accepted. In a production rail (KeeperHub / Coinbase x402) the seller
  // would verify the proof matches an onchain transfer matching the
  // nonce + amount + recipient.
  const rfqPrice = parseFloat(rfqPriceRaw ?? "0");
  if (rfqPriceRaw && rfqPrice > 0) {
    const paymentProof = req.headers.get("x-payment-proof");
    if (!paymentProof || paymentProof.trim().length < 8) {
      const nonce = `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
      const sellerWallet = sellerAddrRaw ?? "0x0";
      return new NextResponse(
        JSON.stringify({
          error: "rfq requires payment",
          schema: "procurement.rfq.v1",
          amount_usdc: rfqPrice.toFixed(3),
          rail: "x402",
          spec: "PROTOCOL.md#34",
          retry_with_header: "X-Payment-Proof",
        }),
        {
          status: 402,
          headers: {
            "Content-Type": "application/json",
            "X-Payment-Network": "base",
            "X-Payment-Token": "USDC",
            "X-Payment-Amount": rfqPrice.toFixed(3),
            "X-Payment-To": sellerWallet,
            "X-Payment-Nonce": nonce,
            "X-Spec": "procurement.settlement.v1/direct.v1",
          },
        },
      );
    }
    // Light validation: the proof must be present and look like a tx
    // hash or x402 mock receipt. Production validators check the chain.
    if (
      !paymentProof.startsWith("0x") &&
      !paymentProof.startsWith("x402-")
    ) {
      return err(400, {
        error: "X-Payment-Proof must be 0x… (tx hash) or x402-… (rail receipt)",
        spec: "PROTOCOL.md#34",
      });
    }
  }

  let catalog: Catalog;
  try {
    catalog = await loadCatalogFromUri(catalogUri);
  } catch (e) {
    return err(502, {
      error: `failed to load catalog from ${catalogUri}: ${(e as Error).message}`,
    });
  }

  const item = catalog.items.find((i) => i.sku === body.sku);
  if (!item) {
    return err(404, {
      error: `sku ${body.sku} not in catalog`,
      available_skus: catalog.items.map((i) => i.sku),
    });
  }
  if (item.stock < body.quantity) {
    return err(409, {
      error: `insufficient stock for ${body.sku}: have ${item.stock}, want ${body.quantity}`,
    });
  }

  const total = Math.round(item.unit_price_usd * body.quantity * 100) / 100;
  const validUntil = new Date(Date.now() + 5 * 60_000).toISOString();
  const sellerAddress = catalog.address ?? sellerAddrRaw ?? "0x0";

  const pk = process.env.AGENT_PRIVATE_KEY;
  let signature = "0xUNSIGNED_HOSTED_NO_KEY";
  if (pk) {
    signature = await signQuote(new Wallet(pk), {
      rfq_id: body.rfq_id ?? "no-rfq-id",
      seller_address: sellerAddress,
      sku: body.sku,
      total_usd: total,
      valid_until: validUntil,
    });
  }

  return NextResponse.json({
    $schema: "procurement.quote.v1",
    rfq_id: body.rfq_id ?? null,
    seller: catalog.seller ?? subname,
    seller_address: sellerAddress,
    seller_ens: subname,
    seller_endpoint_resolved: endpoint ?? null,
    sku: body.sku,
    unit_price_usd: item.unit_price_usd,
    total_usd: total,
    quantity: body.quantity,
    delivery_days: item.delivery_days,
    currency: catalog.currency ?? "USDC",
    valid_until: validUntil,
    signature,
    served_by: "agentic-erp-hosted",
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ subname: string }> },
): Promise<NextResponse> {
  const { subname: rawSubname } = await params;
  const subname = rawSubname.includes(".")
    ? rawSubname
    : `${rawSubname}.${PARENT}`;
  return NextResponse.json({
    schema: "procurement.rfq.v1",
    method: "POST",
    body_example: {
      rfq_id: "rfq-example",
      sku: "PAPEL-A4-RES",
      quantity: 10,
      buyer_ens: "your-buyer.eth",
      buyer_address: "0xYourWallet",
      deadline: new Date(Date.now() + 86400_000).toISOString(),
    },
    seller_ens: subname,
    ens_explorer: `https://sepolia.app.ens.domains/${subname}`,
  });
}
