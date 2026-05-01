"use client";

import { useEffect, useState } from "react";

// Mirrors ResolvedOrder + ProcurementTickResult from
// apps/buyer-agent/src/index.ts. Duplicated here to avoid bundling
// server-only modules into the client.
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

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const delta = Math.max(0, Date.now() - t);
  const m = Math.floor(delta / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function shortHash(h: string): string {
  if (!h || h.length < 12) return h;
  return `${h.slice(0, 8)}…${h.slice(-4)}`;
}

export function LiveTickPanel() {
  const [data, setData] = useState<ProcurementTickResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/procurement-tick/latest", { cache: "no-store" })
      .then((r) => {
        if (r.status === 404) {
          if (!cancelled) {
            setError("no live tick recorded yet");
            setLoading(false);
          }
          return null;
        }
        return r.json();
      })
      .then((j) => {
        if (cancelled || !j) return;
        if (j.error) setError(j.error);
        else setData(j as ProcurementTickResult);
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="livetick">
      <div className="livetick-head">
        <span className="livetick-badge">LIVE · CRON · 0 12 * * *</span>
        <span className="livetick-when">
          {loading
            ? "loading…"
            : error
            ? "—"
            : data
            ? `last run · ${relativeTime(data.at)}`
            : "—"}
        </span>
      </div>

      {loading && (
        <div className="livetick-empty">checking the latest cron run…</div>
      )}

      {error && !data && (
        <div className="livetick-empty">
          <div className="livetick-empty-line">
            no live tick has fired in this deployment yet.
          </div>
          <div className="livetick-empty-sub">
            the Vercel cron at <code>0 */6 * * *</code> will trigger one
            shortly — refresh in a few hours, or trigger one manually
            from the dashboard.
          </div>
        </div>
      )}

      {data && (
        <>
          <div className="livetick-meta-row">
            <div>
              <div className="livetick-meta-label">buyer</div>
              <div className="livetick-meta-value mono">{data.buyer_ens}</div>
            </div>
            <div>
              <div className="livetick-meta-label">source</div>
              <div className="livetick-meta-value mono">
                {data.connector_id} ({data.connector_name})
              </div>
            </div>
            <div>
              <div className="livetick-meta-label">needs</div>
              <div className="livetick-meta-value mono">
                {data.needs_count}
              </div>
            </div>
          </div>

          <div className="livetick-orders">
            {data.orders.map((o, i) => (
              <div key={i} className="livetick-order">
                <div className="livetick-order-head">
                  <span className="livetick-order-sku">
                    {o.sku} × {o.quantity}
                  </span>
                  <span className="livetick-order-winner">
                    {o.winner_ens
                      ? `→ ${o.winner_ens}${o.winner_total_usd ? ` · $${o.winner_total_usd}` : ""}`
                      : o.skipped_reason
                      ? `× skipped: ${o.skipped_reason}`
                      : "—"}
                  </span>
                </div>
                <div className="livetick-artifacts">
                  {o.escrow_explorer_url && o.escrow_tx && (
                    <a
                      className="livetick-artifact"
                      href={o.escrow_explorer_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="livetick-artifact-label">escrow</span>
                      <span className="livetick-artifact-value mono">
                        {shortHash(o.escrow_tx)} ↗
                      </span>
                    </a>
                  )}
                  {o.audit_anchor_index && o.audit_anchor_tx && (
                    <a
                      className="livetick-artifact"
                      href={`${ZG_EXPLORER}${o.audit_anchor_tx}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="livetick-artifact-label">
                        0G anchor #{o.audit_anchor_index}
                      </span>
                      <span className="livetick-artifact-value mono">
                        {shortHash(o.audit_anchor_tx)} ↗
                      </span>
                    </a>
                  )}
                  {o.erp_po_id && (
                    <a
                      className="livetick-artifact"
                      href={o.erp_po_url ?? "#"}
                      target={o.erp_po_url ? "_blank" : undefined}
                      rel={o.erp_po_url ? "noreferrer" : undefined}
                    >
                      <span className="livetick-artifact-label">
                        Odoo PO
                      </span>
                      <span className="livetick-artifact-value mono">
                        {o.erp_po_id} {o.erp_po_url ? "↗" : ""}
                      </span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="livetick-foot">
            <span>
              the loop closes →{" "}
              <span className="livetick-foot-em">
                ENS · Sepolia · 0G · ERP
              </span>{" "}
              all four agree on the same tick
            </span>
          </div>
        </>
      )}
    </div>
  );
}
