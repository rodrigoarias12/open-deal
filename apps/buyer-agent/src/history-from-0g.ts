import { mkdir, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Contract, JsonRpcProvider } from "ethers";
import { Indexer } from "@0gfoundation/0g-ts-sdk";

export interface Purchase {
  sku: string;
  seller: string;
  seller_ens: string;
  unit_price_usd: number;
  quantity: number;
  total_usd: number;
  at: string;
}

const ANCHOR_ABI = [
  "event Anchored(uint256 indexed index, bytes32 indexed cidRoot, bytes32 indexed policyHash, address agent, uint64 timestamp)",
  "function count() external view returns (uint256)",
  "function get(uint256) external view returns (tuple(bytes32 cidRoot, bytes32 policyHash, uint64 timestamp, address agent))",
];

interface AuditRecord {
  case?: string;
  at?: string;
  need?: { sku?: string; quantity?: number };
  winner?: { ens?: string; total_usd?: number };
  quotes?: Array<{
    sku: string;
    seller_address: string;
    source_ens?: string;
    unit_price_usd: number;
    quantity: number;
    total_usd: number;
  }>;
}

/**
 * Reads the AuditAnchor contract on 0G Chain, downloads each anchored
 * audit JSON from 0G Storage, and parses out historical procurement
 * purchases. Returns the purchase history the buyer agent uses for
 * pattern detection.
 *
 * Falls back to an empty array on any single-step error so the caller
 * can fall back to the fixture and the agent doesn't block.
 */
export async function readHistoryFrom0G(opts: {
  rpc: string;
  indexerUrl: string;
  anchorAddress: string;
  agentAddress?: string;
  limit?: number;
}): Promise<{ purchases: Purchase[]; sourceAnchors: number }> {
  const provider = new JsonRpcProvider(opts.rpc, 16602);
  const contract = new Contract(opts.anchorAddress, ANCHOR_ABI, provider);
  const indexer = new Indexer(opts.indexerUrl);

  const total: bigint = await contract.count();
  const max = opts.limit ?? 20;
  const start = total > BigInt(max) ? total - BigInt(max) : 0n;

  const tmpRoot = join(tmpdir(), `agentic-erp-history-${Date.now()}`);
  await mkdir(tmpRoot, { recursive: true });

  const purchases: Purchase[] = [];
  let inspected = 0;
  for (let i = start; i < total; i++) {
    const a = await contract.get(i);
    inspected++;
    if (
      opts.agentAddress &&
      a.agent.toLowerCase() !== opts.agentAddress.toLowerCase()
    ) {
      continue;
    }
    const cidRoot: string = a.cidRoot;
    const tmpPath = join(tmpRoot, `${i}.json`);
    try {
      const dlErr = await indexer.download(cidRoot, tmpPath, true);
      if (dlErr) continue;
      const raw = await readFile(tmpPath, "utf8");
      const rec = JSON.parse(raw) as AuditRecord;
      // Accept both the legacy "nanoprocure-rfq-decision" case and the
      // current "agentic-erp-rfq-decision" so the buyer can still mine
      // history from anchors written before the rebrand.
      if (
        rec.case !== "agentic-erp-rfq-decision" &&
        rec.case !== "nanoprocure-rfq-decision"
      ) {
        continue;
      }
      const winnerQuote = rec.quotes?.find(
        (q) => q.source_ens === rec.winner?.ens,
      );
      if (!winnerQuote || !rec.need?.sku) continue;
      purchases.push({
        sku: winnerQuote.sku,
        seller: winnerQuote.seller_address,
        seller_ens: winnerQuote.source_ens ?? "(unknown)",
        unit_price_usd: winnerQuote.unit_price_usd,
        quantity: winnerQuote.quantity,
        total_usd: winnerQuote.total_usd,
        at: rec.at ?? new Date(Number(a.timestamp) * 1000).toISOString(),
      });
    } catch {
      /* skip malformed */
    } finally {
      await unlink(tmpPath).catch(() => {});
    }
  }
  return { purchases, sourceAnchors: inspected };
}
