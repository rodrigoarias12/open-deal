"use client";

import { useEffect, useRef, useState } from "react";

// Module-level counter — survives re-renders and StrictMode double-invoke
// so keys are always unique across the lifetime of the page.
let _lineSeq = 0;
function nextLineId() { return ++_lineSeq; }

export type LineColor = "green" | "purple" | "yellow" | "red" | "blue" | "gray";
export interface StructuredLine {
  tag: string;
  color: LineColor;
  message: string;
}

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

type Line = StructuredLine & { id: number };

const ZG_EXPLORER = "https://chainscan-galileo.0g.ai/tx/";

// Badge background + text colors per tag color
const BADGE_STYLE: Record<LineColor, { bg: string; text: string }> = {
  green:  { bg: "#1a3a1a", text: "#4ade80" },
  purple: { bg: "#2d1a3a", text: "#c084fc" },
  yellow: { bg: "#3a2e0a", text: "#fbbf24" },
  red:    { bg: "#3a1a1a", text: "#f87171" },
  blue:   { bg: "#1a2a3a", text: "#60a5fa" },
  gray:   { bg: "#2a2a2a", text: "#9ca3af" },
};

function Badge({ tag, color }: { tag: string; color: LineColor }) {
  const s = BADGE_STYLE[color];
  return (
    <span
      className="lt2-badge"
      style={{ background: s.bg, color: s.text }}
    >
      {tag}
    </span>
  );
}

function shortHash(h: string | null | undefined): string {
  if (!h || h.length < 12) return h ?? "";
  return `${h.slice(0, 8)}…${h.slice(-4)}`;
}

export function LiveTerminal({ autoStart = false }: { autoStart?: boolean }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcurementTickResult | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAt = useRef(0);

  function pushLine(sl: StructuredLine) {
    setLines((prev) => [...prev, { ...sl, id: nextLineId() }]);
  }

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
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
      if (!res.ok || !res.body) throw new Error(`stream failed · HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buf += decoder.decode(value, { stream: true });
        const blocks = buf.split("\n\n");
        buf = blocks.pop() ?? "";

        for (const block of blocks) {
          if (!block.trim() || block.startsWith(":")) continue;
          let eventName = "message";
          let dataLine = "";
          for (const ln of block.split("\n")) {
            if (ln.startsWith("event: ")) eventName = ln.slice(7).trim();
            else if (ln.startsWith("data: ")) dataLine += ln.slice(6);
          }
          if (!dataLine) continue;
          let data: unknown;
          try { data = JSON.parse(dataLine); } catch { continue; }

          if (eventName === "hello") {
            pushLine({ tag: "SYS", color: "gray", message: "connected · running procurement tick…" });
          } else if (eventName === "line") {
            pushLine(data as StructuredLine);
          } else if (eventName === "error") {
            const d = data as { error: string };
            setError(d.error);
            pushLine({ tag: "ERR", color: "red", message: d.error });
          } else if (eventName === "done") {
            const r = data as ProcurementTickResult;
            setResult(r);
            setDone(true);
            const won = r.orders.filter((o) => o.winner_ens).length;
            const anchors = r.orders.filter((o) => o.audit_anchor_index).length;
            const pos = r.orders.filter((o) => o.erp_po_id).length;
            pushLine({
              tag: "✓",
              color: "green",
              message: `tick complete · ${Math.floor((Date.now() - startedAt.current) / 1000)}s · ${won} order(s) · ${anchors} anchor(s) · ${pos} PO(s) in Odoo`,
            });
          }
        }
      }
    } catch (e) {
      const msg = (e as Error).message;
      if ((e as Error).name !== "AbortError") {
        setError(msg);
        pushLine({ tag: "ERR", color: "red", message: msg });
      }
    } finally {
      setRunning(false);
    }
  }

  function abort() {
    abortRef.current?.abort();
    pushLine({ tag: "SYS", color: "gray", message: "aborted by user" });
    setRunning(false);
  }

  useEffect(() => {
    if (autoStart) void start();
    return () => { abortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const elapsedFmt = `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, "0")}`;

  return (
    <div className="lt2">
      {/* Title bar */}
      <div className="lt2-bar">
        <div className="lt2-bar-dots">
          <span className="lt2-dot" style={{ background: "#ff5f57" }} />
          <span className="lt2-dot" style={{ background: "#ffbd2e" }} />
          <span className="lt2-dot" style={{ background: "#28c840" }} />
        </div>
        <span className="lt2-bar-title">buyer-agent · live · procurement tick</span>
        <span className="lt2-bar-right">
          {running ? (
            <><span className="lt2-spinner" /> <span className="lt2-elapsed">{elapsedFmt}</span></>
          ) : done ? (
            <span className="lt2-elapsed-done">✓ {elapsedFmt}</span>
          ) : (
            <span className="lt2-idle">idle</span>
          )}
        </span>
      </div>

      {/* Log body */}
      <div ref={bodyRef} className="lt2-body">
        {lines.length === 0 && !running && (
          <div className="lt2-empty">
            press <kbd>▶ run</kbd> to trigger a procurement tick — each step streams here live
          </div>
        )}
        {lines.map((l) => {
          const isSuccess = l.tag === "✓";
          return (
            <div
              key={l.id}
              className={`lt2-line${isSuccess ? " lt2-line-done" : ""}`}
            >
              <Badge tag={l.tag} color={l.color} />
              <span className="lt2-msg">{l.message}</span>
            </div>
          );
        })}
        {running && (
          <div className="lt2-line">
            <span className="lt2-cursor">▋</span>
          </div>
        )}
      </div>

      {/* Result cards */}
      {result && (
        <div className="lt2-result">
          <div className="lt2-result-grid">
            {result.orders.map((o, i) => (
              <div key={i} className={`lt2-card ${o.winner_ens ? "lt2-card-won" : "lt2-card-skip"}`}>
                <div className="lt2-card-sku">{o.sku} × {o.quantity}</div>
                <div className="lt2-card-winner">
                  {o.winner_ens
                    ? `→ ${o.winner_ens.split(".")[0]} · $${o.winner_total_usd ?? "—"}`
                    : `× ${o.skipped_reason ?? "skipped"}`}
                </div>
                {o.llm_reasoning && (
                  <div className={`lt2-card-reason lt2-card-reason-${o.selection_method ?? "none"}`}>
                    <span className="lt2-card-reason-tag">
                      {o.selection_method === "llm" ? "claude" : "fallback"}
                    </span>
                    {o.llm_reasoning.slice(0, 160)}
                  </div>
                )}
                <div className="lt2-card-links">
                  {o.escrow_explorer_url && o.escrow_tx && (
                    <a href={o.escrow_explorer_url} target="_blank" rel="noreferrer">
                      escrow {shortHash(o.escrow_tx)} ↗
                    </a>
                  )}
                  {o.audit_anchor_tx && o.audit_anchor_index && (
                    <a href={`${ZG_EXPLORER}${o.audit_anchor_tx}`} target="_blank" rel="noreferrer">
                      0G #{o.audit_anchor_index} ↗
                    </a>
                  )}
                  {o.erp_po_id && (
                    <a href={o.erp_po_url ?? "#"} target={o.erp_po_url ? "_blank" : undefined} rel={o.erp_po_url ? "noreferrer" : undefined}>
                      Odoo {o.erp_po_id} {o.erp_po_url ? "↗" : ""}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer buttons */}
      <div className="lt2-foot">
        <button className="lt2-btn-primary" disabled={running} onClick={start}>
          {running ? "running…" : done ? "▶ run again" : "▶ run buyer agent"}
        </button>
        {running && <button className="lt2-btn" onClick={abort}>stop</button>}
        {error && <span className="lt2-err">{error}</span>}
      </div>
    </div>
  );
}
