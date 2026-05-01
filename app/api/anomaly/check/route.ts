import "dotenv/config";
import { NextResponse } from "next/server";
import { mkdir, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Contract, JsonRpcProvider } from "ethers";
import { Indexer } from "@0gfoundation/0g-ts-sdk";

// Open Deal Watchdog API — second-tier audit agent that monitors the
// agent's anchors on 0G AuditAnchor for anomalies. Designed to be polled
// by an external KeeperHub workflow on a schedule (e.g. */30 * * * *).
//
// Request: GET /api/anomaly/check?since=<int>
//   `since` = last anchor index the caller has already processed.
//   If omitted, defaults to (count - 5) so first call returns recent
//   activity instead of the entire history.
//
// Response: {
//   from: int, to: int, scanned: int,
//   anomalies: [{ anchor_index, kind, severity, message, evidence }],
//   next_since: int,
//   note: string
// }

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ZG_RPC = process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const ZG_INDEXER =
  process.env.ZG_INDEXER_URL || "https://indexer-storage-testnet-turbo.0g.ai";
const AUDIT_ANCHOR =
  process.env.ZG_AUDIT_ANCHOR ||
  "0xc4B91f01352cff1191eBd3d15A521D94ED081d89";

const ANCHOR_ABI = [
  "function count() external view returns (uint256)",
  "function get(uint256) external view returns (tuple(bytes32 cidRoot, bytes32 policyHash, uint64 timestamp, address agent))",
];

interface AuditDecision {
  decision_index: number;
  rfq_id: string;
  need: { sku: string; quantity: number; max_unit_price_usd: number; deadline_days: number };
  quotes: Array<{ source_ens?: string; total_usd: number; unit_price_usd: number }>;
  winner: { ens: string; total_usd: number; unit_price_usd: number; delivery_days: number };
  selection?: {
    method?: "llm" | "fallback-cheapest" | "no-eligible" | null;
    reasoning?: string | null;
  };
  pattern?: { is_recurring?: boolean; saving_pct?: number };
  approval?: unknown | null;
  policy?: unknown;
  escrow: { contract: string; orderId: string; amountEth: string; txHash: string; chain: string };
}

interface AuditRecord {
  at?: string;
  case?: string;
  schema?: string;
  buyer?: string;
  buyer_ens?: string;
  tick_id?: string;
  decisions?: AuditDecision[];
}

interface Anomaly {
  anchor_index: number;
  kind: string;
  severity: "low" | "medium" | "high";
  message: string;
  evidence: Record<string, unknown>;
}

async function downloadAuditJson(rootHash: string): Promise<AuditRecord> {
  const indexer = new Indexer(ZG_INDEXER);
  const dir = join(tmpdir(), `watchdog-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  const path = join(dir, "audit.json");
  const root = rootHash.startsWith("0x") ? rootHash : `0x${rootHash}`;
  const e = await indexer.download(root, path, true);
  if (e) throw new Error(`0G Storage download failed: ${e}`);
  const raw = await readFile(path, "utf8");
  await unlink(path).catch(() => {});
  return JSON.parse(raw) as AuditRecord;
}

// ── Anomaly heuristics ─────────────────────────────────────────────────
//
// Each heuristic is a pure function: takes the audit record + anchor
// index, returns 0 or N anomalies. Adding a new check = adding a new
// function to the array below.

function checkConcentration(idx: number, rec: AuditRecord): Anomaly[] {
  const decisions = rec.decisions ?? [];
  if (decisions.length < 2) return [];
  const winners = decisions
    .map((d) => d.winner?.ens)
    .filter((e): e is string => Boolean(e));
  const counts = new Map<string, number>();
  for (const w of winners) counts.set(w, (counts.get(w) ?? 0) + 1);
  const max = Math.max(...counts.values());
  const ratio = max / winners.length;
  if (ratio >= 0.7 && winners.length >= 3) {
    const dominant = [...counts.entries()].find(([, n]) => n === max)?.[0];
    return [
      {
        anchor_index: idx,
        kind: "vendor-concentration",
        severity: "medium",
        message: `Single seller ${dominant} won ${max}/${winners.length} (${(ratio * 100).toFixed(0)}%) decisions in this tick — possible vendor lock-in or collusion signal`,
        evidence: { dominant_seller: dominant, won: max, total: winners.length, ratio },
      },
    ];
  }
  return [];
}

function checkLlmFallback(idx: number, rec: AuditRecord): Anomaly[] {
  const decisions = rec.decisions ?? [];
  if (decisions.length === 0) return [];
  const fallbacks = decisions.filter(
    (d) => d.selection?.method === "fallback-cheapest",
  );
  if (fallbacks.length / decisions.length >= 0.5 && decisions.length >= 2) {
    return [
      {
        anchor_index: idx,
        kind: "llm-degraded",
        severity: "medium",
        message: `${fallbacks.length}/${decisions.length} decisions used fallback-cheapest — Claude was unavailable or returning bad output. The agent is still running but is now deterministic.`,
        evidence: { fallback_count: fallbacks.length, total: decisions.length },
      },
    ];
  }
  return [];
}

function checkBudgetCloseToCap(idx: number, rec: AuditRecord): Anomaly[] {
  const out: Anomaly[] = [];
  for (const d of rec.decisions ?? []) {
    const cap = d.need?.max_unit_price_usd;
    const winnerUnit = d.winner?.unit_price_usd;
    if (!cap || !winnerUnit) continue;
    const ratio = winnerUnit / cap;
    if (ratio >= 0.9) {
      out.push({
        anchor_index: idx,
        kind: "budget-near-cap",
        severity: "low",
        message: `${d.need.sku}: winner @ $${winnerUnit}/u is ${(ratio * 100).toFixed(0)}% of max budget $${cap}/u — consider raising the cap or investigating supply pressure`,
        evidence: { sku: d.need.sku, winner_unit: winnerUnit, cap, ratio },
      });
    }
  }
  return out;
}

function checkPatternTriggeredButNoApproval(idx: number, rec: AuditRecord): Anomaly[] {
  const out: Anomaly[] = [];
  for (const d of rec.decisions ?? []) {
    if (d.pattern?.is_recurring && d.pattern.saving_pct && d.pattern.saving_pct >= 15 && !d.approval) {
      out.push({
        anchor_index: idx,
        kind: "pattern-triggered-no-approval",
        severity: "high",
        message: `${d.need.sku}: pattern flagged a ${d.pattern.saving_pct}% saving on a recurring SKU but no human approval was recorded. Either Telegram is down or the agent skipped the gate.`,
        evidence: { sku: d.need.sku, saving_pct: d.pattern.saving_pct },
      });
    }
  }
  return out;
}

const HEURISTICS = [
  checkConcentration,
  checkLlmFallback,
  checkBudgetCloseToCap,
  checkPatternTriggeredButNoApproval,
];

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");
  const provider = new JsonRpcProvider(ZG_RPC);
  const anchor = new Contract(AUDIT_ANCHOR, ANCHOR_ABI, provider);

  let total: number;
  try {
    total = Number(await anchor.count());
  } catch (e) {
    return NextResponse.json(
      { error: `failed to read AuditAnchor.count(): ${(e as Error).message}` },
      { status: 502 },
    );
  }

  // Default: scan the last 5 anchors so first call has something to look at.
  const since = sinceParam !== null ? Math.max(0, parseInt(sinceParam, 10)) : Math.max(0, total - 5);
  const to = total;
  const scanned = Math.max(0, to - since);

  const anomalies: Anomaly[] = [];
  const errors: { index: number; error: string }[] = [];

  for (let i = since; i < to; i++) {
    try {
      const entry = (await anchor.get(i)) as { cidRoot: string };
      const rec = await downloadAuditJson(entry.cidRoot);
      for (const h of HEURISTICS) {
        anomalies.push(...h(i, rec));
      }
    } catch (e) {
      errors.push({ index: i, error: (e as Error).message });
    }
  }

  const summary = {
    new_anchors: scanned,
    anomalies_detected: anomalies.length,
    severity_breakdown: {
      high: anomalies.filter((a) => a.severity === "high").length,
      medium: anomalies.filter((a) => a.severity === "medium").length,
      low: anomalies.filter((a) => a.severity === "low").length,
    },
  };

  return NextResponse.json({
    from: since,
    to,
    scanned,
    anomalies,
    next_since: to,
    summary,
    errors: errors.length ? errors : undefined,
    note: anomalies.length === 0
      ? "No anomalies detected. All anchors look consistent with the agent's policy."
      : `${anomalies.length} anomaly/anomalies found across ${scanned} anchor(s). Review evidence before acting.`,
  });
}
