"use client";

import { useEffect, useRef, useState } from "react";

export type LedgerRow =
  | {
      kind: "entry";
      date: string;
      ref: string;
      refHref?: string;
      desc: string;
      account: string;
      debit?: string;
      credit?: string;
    }
  | {
      kind: "memo";
      date: string;
      ref: string;
      desc: string;
    }
  | {
      kind: "rule";
    }
  | {
      kind: "balance";
      label: string;
      debit: string;
      credit: string;
    };

const ROWS: LedgerRow[] = [
  {
    kind: "entry",
    date: "Apr 25",
    ref: "ODOO-3",
    desc: "Sense — 3 SKUs under reorder threshold (Odoo)",
    account: "Memo · trigger SKU-A4-PAPER-500",
    debit: "—",
    credit: "—",
  },
  {
    kind: "entry",
    date: "Apr 25",
    ref: "ENS-RFQ",
    desc: "RFQ broadcast — *.openagents-treasury.eth",
    account: "4 sellers · 3 signed quotes",
    debit: "—",
    credit: "—",
  },
  {
    kind: "entry",
    date: "Apr 25",
    ref: "AI-S46",
    desc: "Reason — claude-sonnet-4-6 ranks signed quotes",
    account: "winner · seller-acme.eth · 35.6% saving",
    debit: "—",
    credit: "—",
  },
  {
    kind: "entry",
    date: "Apr 25",
    ref: "POL-v1",
    desc: "Policy gate — ens.text(treasury.*)",
    account: "PASS · maxPerCarrier 1,000 · split 2×120",
    debit: "—",
    credit: "—",
  },
  { kind: "rule" },
  {
    kind: "entry",
    date: "Apr 25",
    ref: "0xa42b…91d3",
    desc: "Escrow funded — ProcurementEscrow.createOrder()",
    account: "Escrow · USDC (Sepolia)",
    debit: "1,560.00",
  },
  {
    kind: "entry",
    date: "Apr 25",
    ref: "0xa42b…91d3",
    desc: "240 × SKU-A4-PAPER-500 · seller-acme.eth",
    account: "Inventory expected (A/P · accrued)",
    credit: "1,560.00",
  },
  {
    kind: "memo",
    date: "Apr 25",
    ref: "0G·14",
    desc: "Audit anchor — cidRoot 0x7f1c…abe3 · policyHash 0x4d8a…5e21 · index 14",
  },
  { kind: "rule" },
  {
    kind: "balance",
    label: "Page totals",
    debit: "1,560.00",
    credit: "1,560.00",
  },
];

export function Ledger() {
  const [count, setCount] = useState(0);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let i = 0;
    function step() {
      if (cancelled) return;
      if (i >= ROWS.length) return;
      const row = ROWS[i];
      i++;
      setCount(i);
      const delay =
        row.kind === "rule" ? 140 : row.kind === "balance" ? 380 : 240;
      setTimeout(step, delay);
    }
    step();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [count]);

  const visible = ROWS.slice(0, count);

  return (
    <div className="ledger">
      <div className="ledger-tape" aria-hidden />
      <div className="ledger-edge" aria-hidden />

      <div className="ledger-head">
        <div className="ledger-head-left">
          <span className="ledger-folio">FOLIO 14</span>
          <span className="ledger-head-sep">·</span>
          <span>General Journal — Q2 2026</span>
        </div>
        <div className="ledger-head-right">
          <span className="ledger-stamp">posted</span>
        </div>
      </div>

      <div className="ledger-cols">
        <div className="lc-date">date</div>
        <div className="lc-ref">ref · tx</div>
        <div className="lc-desc">particulars</div>
        <div className="lc-num">debit · usd</div>
        <div className="lc-num">credit · usd</div>
      </div>

      <div className="ledger-body" ref={bodyRef}>
        {visible.map((row, i) => renderRow(row, i))}
        {count >= ROWS.length ? (
          <div className="ledger-sig">
            <span className="ledger-sig-label">posted by</span>
            <span className="ledger-sig-name">openagents-treasury.eth</span>
            <span className="ledger-sig-flourish">~</span>
          </div>
        ) : (
          <div className="ledger-row ledger-row-cursor">
            <span className="ledger-pen" />
          </div>
        )}
      </div>

      <div className="ledger-foot">
        <span>signer · 0x13aF…7AC1</span>
        <span>anchor · 0G Galileo · idx 14</span>
        <span>sealed</span>
      </div>
    </div>
  );
}

function renderRow(row: LedgerRow, i: number) {
  if (row.kind === "rule") {
    return <div key={i} className="ledger-rule" />;
  }
  if (row.kind === "memo") {
    return (
      <div key={i} className="ledger-row ledger-row-memo">
        <div className="lc-date">{row.date}</div>
        <div className="lc-ref">{row.ref}</div>
        <div className="lc-desc">
          <em>memo —</em> {row.desc}
        </div>
        <div className="lc-num">—</div>
        <div className="lc-num">—</div>
      </div>
    );
  }
  if (row.kind === "balance") {
    return (
      <div key={i} className="ledger-row ledger-row-balance">
        <div className="lc-date" />
        <div className="lc-ref" />
        <div className="lc-desc">
          <strong>{row.label}</strong>
        </div>
        <div className="lc-num lc-debit">
          <u>{row.debit}</u>
        </div>
        <div className="lc-num lc-credit">
          <u>{row.credit}</u>
        </div>
      </div>
    );
  }
  return (
    <div key={i} className="ledger-row">
      <div className="lc-date">{row.date}</div>
      <div className="lc-ref">{row.ref}</div>
      <div className="lc-desc">
        <span className="lc-desc-main">{row.desc}</span>
        <span className="lc-desc-sub">{row.account}</span>
      </div>
      <div className="lc-num lc-debit">{row.debit ?? ""}</div>
      <div className="lc-num lc-credit">{row.credit ?? ""}</div>
    </div>
  );
}
