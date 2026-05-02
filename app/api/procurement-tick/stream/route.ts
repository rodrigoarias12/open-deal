import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { runProcurementTick } from "../../../../apps/buyer-agent/src/index";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// ── Structured line types ─────────────────────────────────────────────
// Instead of forwarding raw console.log text, we parse each line into
// a typed event with a tag, color and clean message. This lets the
// LiveTerminal render badge-based rows like the screenshot.

type LineColor = "green" | "purple" | "yellow" | "red" | "blue" | "gray";

interface StructuredLine {
  tag: string;
  color: LineColor;
  message: string;
}

// ── Log classifier ────────────────────────────────────────────────────
// Returns null for lines that are too noisy to show (SDK internals,
// verbose catalog fetches, etc.). Called for every console.log.
function classifyLine(raw: string): StructuredLine | null {
  const t = raw.trim();
  if (!t) return null;

  // ── 0G SDK noise — always skip ──────────────────────────────────
  if (
    t.includes("StorageNode") ||
    t.includes("Tasks created") ||
    t.includes("Processing tasks") ||
    t.includes("Waiting for storage node") ||
    t.startsWith("Wait for log entry") ||
    t.includes("flow contract") ||
    (t.includes("segment") && t.includes("merkle")) ||
    (t.includes("Indexer") && !t.startsWith("[buyer]") && !t.startsWith("[audit]"))
  ) return null;

  // ── [buyer] lines ────────────────────────────────────────────────
  if (t.startsWith("[buyer]")) {
    const body = t.slice(7).trim();

    // skip verbose internal lines
    if (
      body.startsWith("history seed") ||
      body.startsWith("reading live history") ||
      body.startsWith("effective history") ||
      body.startsWith("discovery step 2/2") ||
      body.match(/^indexed \d+/) ||
      body.includes("SKU index →") ||
      body.match(/carries .+ @ list \$/) ||
      body.match(/^broadcasting rfq-/) ||
      body.match(/→ POST https?:\/\//) ||
      body.match(/^\s*·\s+[\w\-]+\.openagents-treasury/) ||
      body.match(/\d+ match\(es\), \d+ no-catalog/)
    ) return null;

    // Connector / needs read
    if (body.startsWith("connector:")) {
      const name = body.split("—")[1]?.trim() ?? "ERP";
      return { tag: "BUYER", color: "green", message: `Reading needs from ${name}…` };
    }
    const needsRet = body.match(/✓ \w+ returned (\d+) need\(s\)/);
    if (needsRet) {
      return { tag: "BUYER", color: "green", message: `${needsRet[1]} items below threshold` };
    }
    // "(connector returned 0 items — falling back to fixture)"
    if (body.includes("returned 0 items")) {
      return { tag: "BUYER", color: "green", message: "No Odoo needs — using fixture" };
    }
    // Individual need item: "- SKU qty=X order=Y "name""
    const itemM = body.match(/^-\s+([A-Z][A-Z0-9\-]+)\s+qty=([\d.]+)\s+order=(\d+)(?:\s+"(.+)")?/);
    if (itemM) {
      return { tag: "BUYER", color: "green", message: `${itemM[1]} × ${itemM[3]}${itemM[4] ? ` — ${itemM[4]}` : ""}` };
    }
    // "N pending need(s) · M seller(s)"
    const pending = body.match(/^(\d+) pending need\(s\) · (\d+) seller/);
    if (pending) {
      return { tag: "BUYER", color: "green", message: `${pending[1]} needs · ${pending[2]} sellers in registry` };
    }
    // writeback enabled
    if (body.includes("writeback enabled")) {
      return { tag: "BUYER", color: "green", message: "Odoo writeback enabled for this tick" };
    }
    // Discovery step 1
    if (body.includes("discovery step 1/2")) {
      return { tag: "BUYER", color: "green", message: "Resolving seller ENS records…" };
    }
    // Seller resolved: "✓ NAME.openagents-treasury.eth → endpoint=..."
    const selRes = body.match(/✓\s+([\w\-]+)\.openagents-treasury\.eth → endpoint/);
    if (selRes) {
      return { tag: "BUYER", color: "green", message: `${selRes[1]}.eth ✓` };
    }
    // Seller failed
    const selFail = body.match(/×\s+([\w\-]+)\.openagents-treasury\.eth → (.+)/);
    if (selFail) {
      return { tag: "BUYER", color: "green", message: `${selFail[1]}.eth → ${selFail[2].slice(0, 60)}` };
    }
    // Catalog loaded: "✓ NAME.openagents-treasury.eth → N SKU(s)" — skip (verbose)
    if (body.match(/✓\s+[\w\-]+\.openagents-treasury\.eth → \d+ SKU/)) return null;

    // Phase A broadcast
    const phaseA = body.match(/phase A · broadcasting (\d+) RFQ\(s\) in parallel/);
    if (phaseA) {
      return { tag: "BUYER", color: "green", message: `Phase A: sending ${phaseA[1]} parallel RFQs` };
    }
    // "need: SKU xN (reason)"
    const needLine = body.match(/^need:\s+([A-Z][A-Z0-9\-]+)\s+x(\d+)/);
    if (needLine) {
      return { tag: "BUYER", color: "green", message: `RFQ: ${needLine[1]} × ${needLine[2]}` };
    }
    // 402 payment
    const pay402 = body.match(/↻\s+([\w\-]+)\.openagents-treasury\.eth → 402 · paying ([\d.]+) (\w+)/);
    if (pay402) {
      return { tag: "BUYER", color: "green", message: `${pay402[1]}.eth → paying ${pay402[2]} ${pay402[3]} (x402)` };
    }
    // Quote received
    const quote = body.match(/✓\s+([\w\-]+)\.openagents-treasury\.eth → \$([\d.]+)\s+(\w+),\s+(\d+)d/);
    if (quote) {
      return { tag: "BUYER", color: "green", message: `${quote[1]}.eth quoted $${quote[2]}/${quote[3]} (${quote[4]}d delivery)` };
    }
    // Quote error
    const quoteErr = body.match(/×\s+([\w\-]+)\.openagents-treasury\.eth → (\d{3})\s+(.+)/);
    if (quoteErr) {
      return { tag: "BUYER", color: "green", message: `${quoteErr[1]}.eth → ${quoteErr[2]} ${quoteErr[3].slice(0, 60)}` };
    }
    // no quotes
    if (body.match(/^no quotes for /)) {
      const sku = body.match(/no quotes for ([A-Z][A-Z0-9\-]+)/)?.[1] ?? "";
      return { tag: "BUYER", color: "green", message: `No quotes received for ${sku}` };
    }

    // LLM winner selection
    if (body.startsWith("asking Claude to pick winner")) {
      const sku = body.match(/for ([A-Z][A-Z0-9\-]+)/)?.[1] ?? "";
      return { tag: "LLM +", color: "purple", message: `Claude evaluating quotes${sku ? ` for ${sku}` : ""}…` };
    }
    // Winner line: "winner SKU: seller → $X [llm|fallback]"
    const winLine = body.match(/^winner\s+([A-Z][A-Z0-9\-]+):\s+([\w\-]+)\.openagents-treasury\.eth → \$([\d.]+).+\[(llm|fallback)/);
    if (winLine) {
      const method = winLine[4] === "llm" ? "Claude" : "fallback";
      return { tag: "LLM +", color: "purple", message: `Winner: ${winLine[2]}.eth — $${winLine[3]} (${method})` };
    }
    // Reasoning
    const llmReason = body.match(/\[llm\] reasoning:\s*(.+)/);
    if (llmReason) {
      return { tag: "LLM +", color: "purple", message: llmReason[1].slice(0, 130) };
    }
    const fallbackReason = body.match(/\[fallback\] reasoning:\s*(.+)/);
    if (fallbackReason) {
      return { tag: "LLM +", color: "purple", message: `fallback: ${fallbackReason[1].slice(0, 110)}` };
    }

    // Pattern lines — show triggers, skip routine
    if (body.includes("PATTERN TRIGGER")) {
      const sku = body.match(/\(([A-Z][A-Z0-9\-]+)\)/)?.[1] ?? "";
      return { tag: "BUYER", color: "green", message: `⚠ Pattern trigger${sku ? ` (${sku})` : ""} — requesting approval` };
    }
    if (body.match(/^pattern [A-Z]/)) return null; // verbose, skip

    // Telegram approval
    if (body.startsWith("sending approval request to Telegram")) {
      return { tag: "BUYER", color: "green", message: "Requesting human approval via Telegram…" };
    }
    if (body.includes("✅ APPROVED") || body.includes("APPROVED")) {
      return { tag: "BUYER", color: "green", message: "✅ Human approved" };
    }
    if (body.includes("NOT APPROVED")) {
      return { tag: "BUYER", color: "green", message: "✖ Human declined — skipping" };
    }

    // Phase A3 policy
    if (body.includes("phase A3")) {
      return { tag: "BUYER", color: "green", message: "Phase A3: policy gate (ENS policy)" };
    }
    const policyOk = body.match(/([A-Z][A-Z0-9\-]+) → allowed=true/);
    if (policyOk) {
      return { tag: "BUYER", color: "green", message: `Policy: ✓ ${policyOk[1]}` };
    }
    const policyNo = body.match(/([A-Z][A-Z0-9\-]+) → allowed=false/);
    if (policyNo) {
      return { tag: "BUYER", color: "green", message: `Policy: ✗ denied — ${policyNo[1]}` };
    }

    // Phase B — escrow
    const phaseB = body.match(/phase B · locking (\d+) escrow\(s\)/);
    if (phaseB) {
      return { tag: "TX", color: "red", message: `Phase B: locking ${phaseB[1]} escrow(s) on Sepolia` };
    }
    const locking = body.match(/^locking funds for ([A-Z][A-Z0-9\-]+)/);
    if (locking) {
      return { tag: "TX", color: "red", message: `ProcurementEscrow.createOrder() — ${locking[1]}` };
    }
    // "→ SKU order #N · locked X ETH · tx 0x..."
    const escrowDone = body.match(/→ ([A-Z][A-Z0-9\-]+) order #(\d+) · locked ([\d.]+) ETH · tx (0x[a-f0-9]+)/i);
    if (escrowDone) {
      return { tag: "TX", color: "red", message: `${escrowDone[4].slice(0, 10)}… (Sepolia · ${escrowDone[3]} ETH locked)` };
    }
    const escrowFail = body.match(/⚠ escrow lock failed for ([A-Z][A-Z0-9\-]+):/);
    if (escrowFail) {
      return { tag: "TX", color: "red", message: `Escrow failed for ${escrowFail[1]}` };
    }

    // Phase C — 0G audit
    const phaseC = body.match(/phase C · batched audit · (\d+) decision/);
    if (phaseC) {
      return { tag: "0G", color: "yellow", message: `Uploading ${phaseC[1]} decision(s) → 0G Storage` };
    }
    // "→ audit anchor #N tx 0x..."
    const anchorDone = body.match(/→ audit anchor #(\d+) tx (0x[a-f0-9]+)/i);
    if (anchorDone) {
      return { tag: "0G", color: "yellow", message: `Anchor #${anchorDone[1]} confirmed · ${anchorDone[2].slice(0, 10)}…` };
    }

    // Phase D — Odoo
    if (body.includes("phase D")) {
      return { tag: "ODOO", color: "blue", message: "Phase D: writing POs to Odoo" };
    }

    // catch-all: skip remaining verbose [buyer] lines
    return null;
  }

  // ── [audit] lines ────────────────────────────────────────────────
  if (t.startsWith("[audit]")) {
    const body = t.slice(7).trim();
    if (body.startsWith("uploading") || body.includes("upload")) {
      return { tag: "0G", color: "yellow", message: "Anchoring audit JSON → 0G Storage" };
    }
    const rootM = body.match(/root=(0x[a-f0-9]+)/i);
    if (rootM) {
      return { tag: "0G", color: "yellow", message: `root: ${rootM[1].slice(0, 12)}…` };
    }
    if (body.includes("anchor") || body.includes("AuditAnchor")) {
      return { tag: "0G", color: "yellow", message: body.slice(0, 100) };
    }
    return { tag: "0G", color: "yellow", message: body.slice(0, 100) };
  }

  // ── [odoo] lines ─────────────────────────────────────────────────
  if (t.startsWith("[odoo]")) {
    const body = t.slice(6).trim();
    if (body.match(/✓.*PO.*(P\d+)/)) {
      const po = body.match(/PO (P\d+)/)?.[1] ?? "";
      return { tag: "ODOO", color: "blue", message: `PO ${po} created — escrow + anchor in chatter ✓` };
    }
    if (body.includes("creating PO") || body.includes("Creating")) {
      const sku = body.match(/SKU=([A-Z][A-Z0-9\-]+)/)?.[1] ?? "";
      return { tag: "ODOO", color: "blue", message: `Creating PO${sku ? ` for ${sku}` : ""}…` };
    }
    return { tag: "ODOO", color: "blue", message: body.slice(0, 100) };
  }

  // everything else (SDK noise, policy internals, etc.) → skip
  return null;
}

function formatArg(a: unknown): string {
  if (typeof a === "string") return a;
  try { return JSON.stringify(a); } catch { return String(a); }
}

async function persistLatest(result: unknown): Promise<void> {
  try {
    const dir = path.join(process.cwd(), ".cache");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "latest-procurement-tick.json"),
      JSON.stringify(result, null, 2),
      "utf8",
    );
  } catch { /* read-only fs in some envs — non-fatal */ }
}

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string | null, data: unknown) => {
        const lines: string[] = [];
        if (event) lines.push(`event: ${event}`);
        lines.push(`data: ${JSON.stringify(data)}`);
        lines.push("", "");
        try { controller.enqueue(encoder.encode(lines.join("\n"))); } catch { /* client disconnected */ }
      };

      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { /* ignore */ }
      }, 15_000);

      const origLog = console.log;
      const origError = console.error;

      console.log = (...args: unknown[]) => {
        const raw = args.map(formatArg).join(" ");
        const structured = classifyLine(raw);
        if (structured) send("line", structured);
        try { origLog(...args); } catch { /* ignore */ }
      };
      console.error = (...args: unknown[]) => {
        const raw = args.map(formatArg).join(" ");
        // Always show errors
        send("line", { tag: "ERR", color: "red", message: raw.slice(0, 200) } satisfies StructuredLine);
        try { origError(...args); } catch { /* ignore */ }
      };

      send("hello", { startedAt: new Date().toISOString(), msg: "stream connected · starting procurement tick…" });

      try {
        const result = await runProcurementTick();
        await persistLatest(result);
        send("done", result);
      } catch (e) {
        send("error", { error: (e as Error).message });
      } finally {
        clearInterval(heartbeat);
        console.log = origLog;
        console.error = origError;
        try { controller.close(); } catch { /* ignore */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
