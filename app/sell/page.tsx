"use client";

import { useState } from "react";
import { Topbar } from "../components/Topbar";

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
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OnboardResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File): Promise<void> {
    setFileName(file.name);
    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      const buf = await file.arrayBuffer();
      const xlsx = await import("xlsx");
      const { normaliseSheet } = await import("../lib/catalog-normalize");
      const wb = xlsx.read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: true,
      });
      const result = normaliseSheet(rows);
      if (!result.ok) {
        setError(`xlsx parse failed: ${result.error}`);
        return;
      }
      setCatalogText(
        JSON.stringify(
          {
            seller: storeName || "Your Store",
            currency: "USDC",
            items: result.items,
          },
          null,
          2,
        ),
      );
    } else {
      const text = await file.text();
      setCatalogText(text);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
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
      <>
        <Topbar />
        <section className="hero">
          <div className="container">
            <div className="hero-meta">
              <span className="hero-meta-dot" />
              <span>Seller live · {result.subname}</span>
            </div>
            <h1>
              <em>{result.storeName}</em>
              <br />
              is selling onchain.
            </h1>
            <p className="hero-sub">
              Catalog on 0G Storage. Identity on ENS Sepolia. Any buyer agent on
              the Open Deal network can now discover you, request quotes, and
              settle through escrow — without you doing anything.
            </p>
            <div className="hero-ctas">
              {result.explorer?.ens && (
                <a
                  className="btn btn-primary"
                  href={result.explorer.ens}
                  target="_blank"
                  rel="noreferrer"
                >
                  view on ENS app <span className="btn-arrow">→</span>
                </a>
              )}
              <a className="btn" href="/dashboard">
                open dashboard <span className="btn-arrow">→</span>
              </a>
              <a className="btn" href="/sell">
                onboard another <span className="btn-arrow">→</span>
              </a>
            </div>
          </div>
        </section>

        <section id="result-cards">
          <div className="container">
            <div className="section-tag">what just landed onchain</div>
            <h2 className="section-title">Three transactions, twenty-five seconds.</h2>
            <div className="pillars">
              <div className="pillar">
                <div className="pillar-num">01 / IDENTITY</div>
                <h3 className="pillar-title">{result.subname}</h3>
                <div className="pillar-body">
                  ENS subname registered on Sepolia, pointing to your seller
                  endpoint. Buyer agents resolve this name to find your catalog
                  and your wallet.
                </div>
                {result.subname_tx && (
                  <div className="pillar-foot">
                    <span>tx</span>
                    <a
                      className="src"
                      href={`https://sepolia.etherscan.io/tx/${result.subname_tx}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {result.subname_tx.slice(0, 10)}…{result.subname_tx.slice(-6)}
                    </a>
                  </div>
                )}
              </div>

              <div className="pillar">
                <div className="pillar-num">02 / CATALOG</div>
                <h3 className="pillar-title">0G Storage</h3>
                <div className="pillar-body">
                  Your price list is now content-addressed on 0G. Hash-anchored,
                  immutable, fetched on every RFQ. Anyone can audit what you're
                  quoting.
                </div>
                <div>
                  <span className="pillar-mono">
                    {result.catalog_cid?.slice(0, 18)}…
                  </span>
                </div>
                {result.explorer?.catalog_storage && (
                  <div className="pillar-foot">
                    <span>tx</span>
                    <a
                      className="src"
                      href={result.explorer.catalog_storage}
                      target="_blank"
                      rel="noreferrer"
                    >
                      0g galileo →
                    </a>
                  </div>
                )}
              </div>

              <div className="pillar">
                <div className="pillar-num">03 / DISCOVERY</div>
                <h3 className="pillar-title">5 text records</h3>
                <div className="pillar-body">
                  Set in one multicall on the Public Resolver: <code>addr</code>,
                  <code> endpoint</code>, <code>description</code>,
                  <code> email</code>, <code>catalog-uri</code>.
                </div>
                {result.records_tx && (
                  <div className="pillar-foot">
                    <span>tx</span>
                    <a
                      className="src"
                      href={`https://sepolia.etherscan.io/tx/${result.records_tx}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {result.records_tx.slice(0, 10)}…
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="result-events">
          <div className="container">
            <div className="section-tag">timeline</div>
            <h2 className="section-title">Step by step.</h2>
            <div className="event-grid">
              {result.events?.map((ev, i) => (
                <div className={`event-step event-${ev.status}`} key={ev.step}>
                  <div className="event-num">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="event-icon">
                    {ev.status === "ok"
                      ? "✓"
                      : ev.status === "skipped"
                        ? "—"
                        : ev.status === "failed"
                          ? "✗"
                          : "·"}
                  </div>
                  <div className="event-name">{ev.step.replace(/-/g, " ")}</div>
                  <div className="event-detail">{ev.detail ?? ev.status}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <Topbar />

      <section className="hero">
        <div className="container">
          <div className="hero-meta">
            <span className="hero-meta-dot" />
            <span>For sellers · open deal network</span>
          </div>
          <h1>
            Sell what you have.
            <br />
            <span className="em">Without a website.</span>
          </h1>
          <p className="hero-sub">
            Drop your price list. Pick a name. We register your ENS subname,
            publish your catalog to 0G Storage, and put you on the discovery
            network. Buyer agents start asking you for quotes within minutes —
            no servers, no API keys, no negotiation.
          </p>
        </div>
      </section>

      <section id="onboard-form">
        <div className="container">
          <div className="section-tag">activate your store</div>
          <h2 className="section-title">Three fields. Twenty-five seconds.</h2>

          <form onSubmit={onSubmit} className="sell-form">
            <div className="sell-grid">
              <label className="sell-field">
                <div className="sell-label">Store name</div>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Acme Cartonería"
                  required
                  minLength={3}
                  disabled={submitting}
                  className="sell-input"
                />
                <div className="sell-hint">
                  onchain name:{" "}
                  <code>
                    {storeName
                      ? `${slug(storeName)}.openagents-treasury.eth`
                      : "<slug>.openagents-treasury.eth"}
                  </code>
                </div>
              </label>

              <label className="sell-field">
                <div className="sell-label">Notification email</div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="[email protected]"
                  required
                  disabled={submitting}
                  className="sell-input"
                />
                <div className="sell-hint">
                  set as the <code>email</code> text record on your subname
                </div>
              </label>
            </div>

            <label className="sell-field">
              <div className="sell-label">Seller endpoint (HTTP)</div>
              <input
                type="url"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://agentic-erp-eth.vercel.app/api/seller/__SUBNAME__/rfq"
                disabled={submitting}
                className="sell-input sell-input-mono"
              />
              <div className="sell-hint">
                where your agent accepts RFQ posts. Leave the default to use the
                hosted endpoint — no infra needed on your side.
              </div>
            </label>

            <div className="sell-field">
              <div className="sell-label">Catalog</div>
              <div
                className={`sell-dropzone ${dragOver ? "is-drag" : ""} ${fileName ? "is-loaded" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <input
                  type="file"
                  accept=".json,.xlsx,.xls,application/json"
                  onChange={onFileChange}
                  disabled={submitting}
                  id="catalog-file"
                  className="sell-file-input"
                />
                <label htmlFor="catalog-file" className="sell-dropzone-label">
                  {fileName ? (
                    <>
                      <div className="sell-dropzone-title">
                        ✓ {fileName}
                      </div>
                      <div className="sell-dropzone-sub">
                        Loaded. Drop another to replace.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="sell-dropzone-title">
                        Drop your price list
                      </div>
                      <div className="sell-dropzone-sub">
                        .xlsx, .xls or .json — we parse it. Or paste below.
                      </div>
                    </>
                  )}
                </label>
              </div>
              <textarea
                value={catalogText}
                onChange={(e) => setCatalogText(e.target.value)}
                rows={10}
                spellCheck={false}
                disabled={submitting}
                className="sell-textarea"
              />
              <div className="sell-hint">
                preview / edit the catalog before submitting. Required fields per
                item: <code>sku</code>, <code>unit_price_usd</code>,
                <code> stock</code>.
              </div>
            </div>

            {error && (
              <div className="sell-error">
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

            <div className="sell-submit-row">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !storeName || !email || !catalogText}
              >
                {submitting ? "activating…" : "activate my store →"}
              </button>
              <span className="sell-submit-note">
                takes ~25 seconds — registers ENS, uploads catalog to 0G, sets 5
                text records
              </span>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}
