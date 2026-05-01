"use client";

import { useEffect, useRef, useState } from "react";

interface ResolvedOrder {
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
  llm_reasoning: string | null;
  selection_method: "llm" | "fallback-cheapest" | "no-eligible" | null;
}
interface ProcurementTickResult {
  at: string;
  buyer_ens: string;
  connector_id: string;
  connector_name: string;
  needs_count: number;
  orders: ResolvedOrder[];
}

type Line = { id: number; text: string; level: "info" | "error" | "system" };

const ZG_EXPLORER = "https://chainscan-galileo.0g.ai/tx/";

// Style classes derived from the line content. We don't refactor the
// agent's logging — just decorate matching patterns so the terminal
// reads like a live diagnostic instead of a log dump.
function decorate(text: string, level: Line["level"]): string {
  if (level === "error") return "lt-line-error";
  if (level === "system") return "lt-line-system";
  if (text.startsWith("[buyer]")) return "lt-line-buyer";
  if (
    text.includes("Storage upload") ||
    text.includes("Wait for log entry") ||
    text.includes("Waiting for storage node")
  )
    return "lt-line-zg";
  if (text.includes("Transaction submitted")) return "lt-line-tx";
  if (
    text.includes("Indexer") ||
    text.includes("StorageNode") ||
    text.startsWith("Tasks created") ||
    text.startsWith("Processing tasks")
  )
    return "lt-line-zg";
  return "lt-line-info";
}

function shortHash(h: string | null | undefined): string {
  if (!h || h.length < 12) return h ?? "";
  return `${h.slice(0, 8)}…${h.slice(-4)}`;
}

interface LiveTerminalProps {
  // Called when the user clicks Run. Returns a function that closes
  // the stream early if the user cancels (or component unmounts).
  autoStart?: boolean;
}

export function LiveTerminal({ autoStart = false }: LiveTerminalProps) {
  const [lines, setLines] = useState<Line[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcurementTickResult | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);

  const linesRef = useRef<HTMLDivElement | null>(null);
  const idCounter = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const startedAt = useRef<number>(0);

  function pushLine(text: string, level: Line["level"]) {
    idCounter.current += 1;
    setLines((prev) => [
      ...prev,
      { id: idCounter.current, text, level },
    ]);
  }

  // Auto-scroll to the bottom as lines come in.
  useEffect(() => {
    const el = linesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  // Tick the elapsed timer while running.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  async function start() {
    if (running) return;
    setLines([]);
    setResult(null);
    setError(null);
    setDone(false);
    setElapsed(0);
    setRunning(true);
    startedAt.current = Date.now();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/procurement-tick/stream", {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok || !res.body) {
        throw new Error(`stream failed · HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      // Parse SSE events as they arrive.
      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buf += decoder.decode(value, { stream: true });

        // Each event is a block separated by "\n\n".
        const blocks = buf.split("\n\n");
        buf = blocks.pop() ?? ""; // keep the trailing partial

        for (const block of blocks) {
          if (!block.trim()) continue;
          if (block.startsWith(":")) continue; // heartbeat comment

          let eventName = "message";
          let dataLine = "";
          for (const ln of block.split("\n")) {
            if (ln.startsWith("event: ")) eventName = ln.slice(7).trim();
            else if (ln.startsWith("data: ")) dataLine += ln.slice(6);
          }
          if (!dataLine) continue;
          let data: unknown;
          try {
            data = JSON.parse(dataLine);
          } catch {
            continue;
          }

          if (eventName === "hello") {
            pushLine(
              `[stream] connected · ${(data as { msg: string }).msg}`,
              "system",
            );
          } else if (eventName === "line") {
            const d = data as { text: string; level: "info" | "error" };
            pushLine(d.text, d.level);
          } else if (eventName === "error") {
            const d = data as { error: string };
            setError(d.error);
            pushLine(`[stream] ✖ error: ${d.error}`, "error");
          } else if (eventName === "done") {
            setResult(data as ProcurementTickResult);
            setDone(true);
            pushLine(
              `[stream] ✓ tick complete · ${
                (data as ProcurementTickResult).orders.length
              } order(s) resolved`,
              "system",
            );
          }
        }
      }
    } catch (e) {
      const msg = (e as Error).message;
      if ((e as Error).name !== "AbortError") {
        setError(msg);
        pushLine(`[stream] ✖ ${msg}`, "error");
      }
    } finally {
      setRunning(false);
    }
  }

  function abort() {
    abortRef.current?.abort();
    pushLine("[stream] ⏹ aborted by user", "system");
    setRunning(false);
  }

  // Auto-start on mount if requested.
  useEffect(() => {
    if (autoStart) {
      void start();
    }
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="lt">
      <div className="lt-bar">
        <div className="lt-bar-dots">
          <span className="lt-dot lt-dot-r" />
          <span className="lt-dot lt-dot-y" />
          <span className="lt-dot lt-dot-g" />
        </div>
        <div className="lt-bar-title">
          buyer-agent · live · procurement tick
        </div>
        <div className="lt-bar-right">
          {running ? (
            <>
              <span className="lt-spinner" />
              <span className="lt-elapsed">
                {Math.floor(elapsed / 60)}:
                {(elapsed % 60).toString().padStart(2, "0")}
              </span>
            </>
          ) : done ? (
            <span className="lt-elapsed lt-elapsed-done">
              ✓ {Math.floor(elapsed / 60)}:
              {(elapsed % 60).toString().padStart(2, "0")}
            </span>
          ) : (
            <span className="lt-idle">idle</span>
          )}
        </div>
      </div>

      <div ref={linesRef} className="lt-body">
        {lines.length === 0 && !running && (
          <div className="lt-empty">
            press <kbd>run</kbd> to start a procurement tick. each step
            streams here as the agent calls Odoo, ENS, Sepolia and 0G.
          </div>
        )}
        {lines.map((l) => (
          <div key={l.id} className={`lt-line ${decorate(l.text, l.level)}`}>
            <span className="lt-line-text">{l.text}</span>
          </div>
        ))}
        {running && (
          <div className="lt-line">
            <span className="lt-cursor">▋</span>
          </div>
        )}
      </div>

      {result && (
        <div className="lt-result">
          <div className="lt-result-head">
            <span>✓ tick complete</span>
            <span className="lt-result-meta">
              {result.orders.length} order(s) · {result.connector_id}
            </span>
          </div>
          <div className="lt-result-grid">
            {result.orders.map((o, i) => (
              <div key={i} className="lt-result-card">
                <div className="lt-result-sku">
                  {o.sku} × {o.quantity}
                </div>
                <div className="lt-result-winner">
                  {o.winner_ens
                    ? `→ ${o.winner_ens.split(".")[0]} · $${o.winner_total_usd ?? "—"}`
                    : `× ${o.skipped_reason ?? "skipped"}`}
                </div>
                {o.llm_reasoning && (
                  <div
                    className={`lt-result-reasoning lt-result-reasoning-${o.selection_method ?? "none"}`}
                  >
                    <span className="lt-result-reasoning-tag">
                      {o.selection_method === "llm" ? "claude" : "fallback"}
                    </span>
                    <span className="lt-result-reasoning-text">
                      {o.llm_reasoning}
                    </span>
                  </div>
                )}
                <div className="lt-result-links">
                  {o.escrow_explorer_url && o.escrow_tx && (
                    <a
                      href={o.escrow_explorer_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      escrow {shortHash(o.escrow_tx)} ↗
                    </a>
                  )}
                  {o.audit_anchor_tx && o.audit_anchor_index && (
                    <a
                      href={`${ZG_EXPLORER}${o.audit_anchor_tx}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      0G #{o.audit_anchor_index} ↗
                    </a>
                  )}
                  {o.erp_po_id && (
                    <a
                      href={o.erp_po_url ?? "#"}
                      target={o.erp_po_url ? "_blank" : undefined}
                      rel={o.erp_po_url ? "noreferrer" : undefined}
                    >
                      Odoo {o.erp_po_id} {o.erp_po_url ? "↗" : ""}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="lt-foot">
        <button
          className="lt-btn lt-btn-primary"
          disabled={running}
          onClick={start}
        >
          {running ? "running…" : done ? "run again" : "▶ run buyer agent"}
        </button>
        {running && (
          <button className="lt-btn" onClick={abort}>
            stop
          </button>
        )}
        {error && <span className="lt-err">{error}</span>}
      </div>
    </div>
  );
}
