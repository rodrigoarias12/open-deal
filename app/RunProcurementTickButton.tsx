"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
}

interface ProcurementTickResult {
  at: string;
  buyer_ens: string;
  connector_id: string;
  connector_name: string;
  needs_count: number;
  orders: ResolvedOrder[];
}

const ZG_EXPLORER = "https://chainscan-galileo.0g.ai/tx/";

function shortHash(h: string) {
  if (!h || h.length < 12) return h;
  return `${h.slice(0, 8)}…${h.slice(-4)}`;
}

export function RunProcurementTickButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcurementTickResult | null>(null);

  async function onClick() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/procurement-tick", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setResult(body as ProcurementTickResult);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="dash-procurement">
      <div className="dash-procurement-bar">
        <div>
          <strong>procurement tick</strong>
          <span style={{ color: "var(--ink-faint)", marginLeft: 8 }}>
            RFQ → quote → policy → escrow → audit → ERP
          </span>
        </div>
        <button
          className="primary"
          onClick={onClick}
          disabled={running}
        >
          {running ? "Running…  (~30-60s)" : "Run procurement tick"}
        </button>
      </div>
      {error && (
        <div className="error" style={{ marginTop: 12 }}>
          tick failed: {error}
        </div>
      )}
      {result && (
        <div className="dash-procurement-result">
          <div className="dash-procurement-meta">
            <span>
              buyer · <code>{result.buyer_ens}</code>
            </span>
            <span>
              source · <code>{result.connector_id}</code>
            </span>
            <span>
              needs · <code>{result.needs_count}</code>
            </span>
            <span>
              orders · <code>{result.orders.length}</code>
            </span>
          </div>
          {result.orders.map((o, i) => (
            <div key={i} className="dash-procurement-order">
              <div className="dash-procurement-order-head">
                <span>
                  <code>{o.sku}</code> × {o.quantity}
                </span>
                <span style={{ color: "var(--ink-faint)" }}>
                  {o.winner_ens
                    ? `→ ${o.winner_ens} · $${o.winner_total_usd ?? "—"}`
                    : `× ${o.skipped_reason ?? "skipped"}`}
                </span>
              </div>
              <div className="dash-procurement-artifacts">
                {o.escrow_explorer_url && o.escrow_tx && (
                  <a href={o.escrow_explorer_url} target="_blank" rel="noreferrer">
                    escrow {shortHash(o.escrow_tx)} ↗
                  </a>
                )}
                {o.audit_anchor_index && o.audit_anchor_tx && (
                  <a
                    href={`${ZG_EXPLORER}${o.audit_anchor_tx}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    0G anchor #{o.audit_anchor_index} ↗
                  </a>
                )}
                {o.erp_po_id && (
                  <a
                    href={o.erp_po_url ?? "#"}
                    target={o.erp_po_url ? "_blank" : undefined}
                    rel={o.erp_po_url ? "noreferrer" : undefined}
                  >
                    ERP {o.erp_po_id} {o.erp_po_url ? "↗" : ""}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
