"use client";

import { useState } from "react";
import Link from "next/link";
import { normaliseSheet } from "../lib/catalog-normalize";

interface OnboardEvent {
  step: string;
  status: string;
  detail?: string;
}

interface OnboardResult {
  ok: boolean;
  subname?: string;
  parent?: string;
  endpoint?: string;
  storeName?: string;
  catalog_cid?: string | null;
  catalog_storage_tx?: string | null;
  subname_tx?: string | null;
  records_tx?: string | null;
  explorer?: {
    ens?: string;
    catalog_storage?: string | null;
    subname?: string | null;
  };
  events?: OnboardEvent[];
  error?: string;
}

const SAMPLE_CATALOG = {
  seller: "Acme Cartonería S.A.",
  currency: "USDC",
  items: [
    {
      sku: "PAPEL-A4-RES",
      name: "Papel A4 (resma 500h, 75g)",
      unit_price_usd: 6.5,
      stock: 240,
      delivery_days: 2,
    },
    {
      sku: "CARTON-CAJA-30",
      name: "Caja cartón corrugado 30x20x15cm",
      unit_price_usd: 1.2,
      stock: 1500,
      delivery_days: 1,
    },
  ],
};

export default function SellPage() {
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [endpoint, setEndpoint] = useState("https://agentic-erp-eth.vercel.app/api/seller/__SUBNAME__/rfq");
  const [catalogText, setCatalogText] = useState(
    JSON.stringify(SAMPLE_CATALOG, null, 2),
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OnboardResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ingestFile(file: File): Promise<void> {
    setFileName(file.name);
    setError(null);
    const lower = file.name.toLowerCase();

    if (lower.endsWith(".json")) {
      const text = await file.text();
      setCatalogText(text);
      return;
    }

    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      try {
        // Lazy-load xlsx so we don't bloat the initial page bundle.
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          raw: true,
        });
        const result = normaliseSheet(rows);
        if (!result.ok) {
          setError(`xlsx parse failed: ${result.error ?? "unknown"}`);
          setCatalogText("");
          return;
        }
        const detected = result.detectedHeaders
          ?.map((h) => `${h.raw}→${h.canonical}`)
          .join(", ");
        const catalog = {
          seller: storeName || file.name.replace(/\.(xlsx|xls)$/i, ""),
          currency: "USDC",
          items: result.items,
          _ingested_from: file.name,
          _detected_columns: detected,
        };
        setCatalogText(JSON.stringify(catalog, null, 2));
      } catch (e) {
        setError(`xlsx read failed: ${(e as Error).message}`);
      }
      return;
    }

    setError(`unsupported file type: ${file.name}. Use .json, .xlsx or .xls`);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (file) void ingestFile(file);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void ingestFile(file);
  }

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);
    try {
      let catalog: unknown;
      try {
        catalog = JSON.parse(catalogText);
      } catch {
        throw new Error("catalog is not valid JSON");
      }
      const resp = await fetch("/api/seller/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeName, email, endpoint, catalog }),
      });
      const body = (await resp.json()) as OnboardResult;
      if (!resp.ok || !body.ok) {
        setError(body.error || `HTTP ${resp.status}`);
        setResult(body);
      } else {
        setResult(body);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (result?.ok) {
    return (
      <main className="landing">
        <nav className="brand">
          <span className="logo">openagents-treasury</span>
          <span>
            <Link href="/">home</Link>
            <Link href="/dashboard">dashboard</Link>
          </span>
        </nav>

        <section className="hero">
          <div className="eyebrow">Seller live ✓</div>
          <h1>
            <em>{result.storeName}</em> is now selling onchain.
          </h1>
          <p className="lede">
            Your catalog lives on 0G Storage. Your name lives on ENS Sepolia.
            Any buyer agent on the network can now discover you, request
            quotes, and settle through escrow — without you doing anything.
          </p>
          <div className="cta-row">
            {result.explorer?.ens && (
              <a href={result.explorer.ens} target="_blank" rel="noreferrer">
                <button className="primary">View on ENS app →</button>
              </a>
            )}
            <Link href="/dashboard">
              <button className="cta-secondary">Open dashboard</button>
            </Link>
          </div>
        </section>

        <div className="feature-grid">
          <div className="feature">
            <div className="num">01 / Identity</div>
            <h3>{result.subname}</h3>
            <p>
              ENS subname registered, pointing to your seller endpoint.
              {result.subname_tx && (
                <>
                  {" "}
                  <a
                    href={`https://sepolia.etherscan.io/tx/${result.subname_tx}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Registration tx
                  </a>
                  .
                </>
              )}
            </p>
          </div>
          <div className="feature">
            <div className="num">02 / Catalog</div>
            <h3>0G Storage</h3>
            <p>
              <code>{result.catalog_cid?.slice(0, 18)}…</code>
              {result.explorer?.catalog_storage && (
                <>
                  {" "}
                  <a
                    href={result.explorer.catalog_storage}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Storage tx
                  </a>
                  .
                </>
              )}{" "}
              Hash-anchored, content-addressed, anyone can audit.
            </p>
          </div>
          <div className="feature">
            <div className="num">03 / Records</div>
            <h3>Public discovery</h3>
            <p>
              {result.records_tx && (
                <>
                  Five text records set in one multicall (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${result.records_tx}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    tx
                  </a>
                  ): addr, endpoint, description, email, catalog-uri.
                </>
              )}
            </p>
          </div>
        </div>

        <section className="flow">
          <h2>What just happened</h2>
          <div className="flow-diagram">
            {result.events?.map((ev) => (
              <div className="flow-step" key={ev.step}>
                <div className="label">
                  {ev.status === "ok"
                    ? "✓"
                    : ev.status === "skipped"
                      ? "—"
                      : ev.status === "failed"
                        ? "×"
                        : "…"}
                </div>
                <div className="name">{ev.step}</div>
                <div className="detail">{ev.detail ?? ev.status}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="landing">
      <nav className="brand">
        <span className="logo">openagents-treasury</span>
        <span>
          <Link href="/">home</Link>
          <Link href="/dashboard">dashboard</Link>
        </span>
      </nav>

      <section className="hero">
        <div className="eyebrow">For sellers · public network</div>
        <h1>
          Sell what you have. <em>Without a website.</em>
        </h1>
        <p className="lede">
          Drop your price list. Pick a name. We register your ENS subname,
          publish your catalog to 0G Storage, and put you on the discovery
          network. Buyer agents start asking you for quotes within minutes.
        </p>
      </section>

      <section className="flow">
        <form onSubmit={onSubmit} className="onboard-form">
          <label className="label-block">
            <div className="label">Store name</div>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Acme Cartonería"
              required
              minLength={3}
              disabled={submitting}
            />
            <div className="hint">
              your onchain name will be <code>{storeName ? `${slug(storeName)}.openagents-treasury.eth` : "<slug>.openagents-treasury.eth"}</code>
            </div>
          </label>

          <label className="label-block">
            <div className="label">Notification email</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="[email protected]"
              required
              disabled={submitting}
            />
          </label>

          <label className="label-block">
            <div className="label">Seller agent endpoint (HTTP)</div>
            <input
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://agentic-erp-eth.vercel.app/api/seller/__SUBNAME__/rfq"
              disabled={submitting}
            />
            <div className="hint">
              the URL where your seller agent will accept RFQ posts. Leave the
              default for the local-demo flow.
            </div>
          </label>

          <label className="label-block">
            <div className="label">Catalog (drop your .xlsx, .json or paste below)</div>
            <div
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
            >
              <input
                type="file"
                accept=".json,.xlsx,.xls,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={onFileChange}
                disabled={submitting}
              />
              {fileName && <div className="hint">loaded: {fileName}</div>}
            </div>
            <textarea
              value={catalogText}
              onChange={(e) => setCatalogText(e.target.value)}
              rows={10}
              spellCheck={false}
              disabled={submitting}
            />
          </label>

          <div className="cta-row">
            <button
              type="submit"
              className="primary"
              disabled={submitting || !storeName || !email || !catalogText}
            >
              {submitting ? "Activating…" : "🚀 Activate my store"}
            </button>
          </div>

          {error && (
            <div className="onboard-error">
              <strong>Failed.</strong> {error}
              {result?.events && (
                <ul>
                  {result.events.map((ev) => (
                    <li key={ev.step}>
                      <code>
                        {ev.step}: {ev.status}
                      </code>{" "}
                      {ev.detail}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </form>
      </section>

      <style jsx>{`
        .onboard-form {
          display: grid;
          gap: 1.25rem;
          max-width: 720px;
        }
        .label-block {
          display: block;
        }
        .label-block .label {
          font-weight: 600;
          margin-bottom: 0.35rem;
          font-size: 0.85rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          opacity: 0.7;
        }
        .label-block input,
        .label-block textarea {
          width: 100%;
          font: inherit;
          padding: 0.6rem 0.75rem;
          border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
          background: transparent;
          color: inherit;
          border-radius: 6px;
          font-family: ui-monospace, "SF Mono", monospace;
          font-size: 0.85rem;
        }
        .label-block textarea {
          margin-top: 0.5rem;
          resize: vertical;
        }
        .dropzone {
          border: 1px dashed color-mix(in srgb, currentColor 30%, transparent);
          padding: 0.75rem;
          border-radius: 6px;
          font-size: 0.85rem;
        }
        .hint {
          font-size: 0.8rem;
          opacity: 0.6;
          margin-top: 0.4rem;
        }
        .onboard-error {
          padding: 0.75rem 1rem;
          border-left: 3px solid #d04848;
          background: color-mix(in srgb, #d04848 8%, transparent);
          border-radius: 4px;
          font-size: 0.9rem;
        }
        .onboard-error ul {
          margin: 0.5rem 0 0;
          padding-left: 1.25rem;
        }
      `}</style>
    </main>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}
