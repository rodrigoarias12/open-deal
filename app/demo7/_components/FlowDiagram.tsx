"use client";

import { useEffect, useState } from "react";

// Sequence of "active" steps over a single cycle.
// Each id matches a data-step attribute on a box element.
// The animation walks this list, lighting each step in turn.
//
// New 5-band order:
//   BAND 1 (human):     set-policy → connect-erp
//   BAND 2 (auto):      seller-1..4 → reason → policy-gate
//   BAND 3 (human):     approve via Telegram (mid-loop checkpoint)
//   BAND 4 (auto):      escrow → anchor
//   BAND 5 (human):     receive + reconcile
const STEP_SEQUENCE = [
  "set-policy",
  "connect-erp",
  "seller-1",
  "seller-2",
  "seller-3",
  "seller-4",
  "reason",
  "policy-gate",
  "approve",
  "escrow",
  "anchor",
  "reconcile",
] as const;

type StepId = (typeof STEP_SEQUENCE)[number];

const TICK_MS = 1100;

export function FlowDiagram() {
  const [active, setActive] = useState<StepId>(STEP_SEQUENCE[0]);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) return;
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % STEP_SEQUENCE.length;
      setActive(STEP_SEQUENCE[i]);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <div className="demo7-flow">
      {/* ───────── BAND 1 — HUMAN INVOLVEMENT (TOP) ───────── */}
      <div className="demo7-band demo7-band-human">
        <div className="demo7-band-tag demo7-band-tag-human">Human involvement</div>
        <div className="demo7-band-inner">
          <div className="demo7-stack">
            <Box
              id="set-policy"
              active={active === "set-policy"}
              variant="human"
              badge="1"
              title="Set policy"
              desc="Caps, allowed sellers, cooldowns, blackouts. Written as ENS text records under treasury.*"
              wide
            />
            <ArrowDown active={active === "set-policy" || active === "connect-erp"} />
            <Box
              id="connect-erp"
              active={active === "connect-erp"}
              variant="human"
              badge="2"
              title="Connect ERP"
              desc="Point at your Odoo instance. JSON-RPC, 60s cache. No data migration."
              wide
            />
          </div>
        </div>
      </div>

      {/* Connector: Band 1 → Band 2 (cream → sepia) */}
      <div className="demo7-bridge demo7-bridge-cs">
        <ArrowDown
          active={active === "connect-erp" || active === "seller-1"}
          long
        />
      </div>

      {/* ───────── BAND 2 — FULLY AUTONOMOUS ───────── */}
      <div className="demo7-band demo7-band-auto">
        <div className="demo7-band-tag demo7-band-tag-auto">Fully autonomous</div>
        <div className="demo7-band-inner">
          <div className="demo7-sub-tag">Sellers discovered via ENS catalog-uri + SKU index</div>

          <div className="demo7-row demo7-row-4">
            <SellerBox
              id="seller-1"
              active={active === "seller-1"}
              name="seller-acme.eth"
              meta="$6.50/u · signed quote ✓"
              ok
            />
            <SellerBox
              id="seller-2"
              active={active === "seller-2"}
              name="seller-bulk.eth"
              meta="$7.20/u · signed quote ✓"
              ok
            />
            <SellerBox
              id="seller-3"
              active={active === "seller-3"}
              name="seller-fast.eth"
              meta="$8.90/u · signed quote ✓"
              ok
            />
            <SellerBox
              id="seller-4"
              active={active === "seller-4"}
              name="seller-legacy.eth"
              meta="no response · timeout"
            />
          </div>

          <ConvergeArrows
            active={
              active === "seller-1" ||
              active === "seller-2" ||
              active === "seller-3" ||
              active === "seller-4" ||
              active === "reason"
            }
          />

          <div className="demo7-stack">
            <Box
              id="reason"
              active={active === "reason"}
              variant="auto"
              badge="3"
              title="Reason"
              desc="Claude ranks signed quotes against policy + recurring-purchase history. Picks winner: 35.6% under 3-purchase moving average."
              wide
            />
            <ArrowDown active={active === "reason" || active === "policy-gate"} />
            <Box
              id="policy-gate"
              active={active === "policy-gate"}
              variant="auto"
              badge="4"
              title="Policy gate"
              desc="Re-read ENS policy. Verify cap, carrier whitelist, cooldown. PASS → continue. FAIL → escalate to human."
              wide
            />
          </div>
        </div>
      </div>

      {/* Connector: Band 2 → Band 3 (sepia → cream) */}
      <div className="demo7-bridge demo7-bridge-sc">
        <ArrowDown active={active === "policy-gate" || active === "approve"} long />
      </div>

      {/* ───────── BAND 3 — HUMAN INVOLVEMENT — APPROVAL (mid-loop checkpoint) ───────── */}
      <div className="demo7-band demo7-band-human demo7-band-thin">
        <div className="demo7-band-tag demo7-band-tag-human">
          Human involvement — approval
        </div>
        <div className="demo7-band-inner demo7-band-inner-thin">
          <div className="demo7-approval-row">
            <Box
              id="approve"
              active={active === "approve"}
              variant="human"
              badge="5"
              title="Approve via Telegram"
              desc="Only when policy edge case (cap exceeded, new seller, big jump). Bot pings: /approve or /reject. Default: silent → auto-pass."
              wide
            />
            <span className="demo7-approval-callout">(only when needed)</span>
          </div>
        </div>
      </div>

      {/* Connector: Band 3 → Band 4 (cream → sepia) */}
      <div className="demo7-bridge demo7-bridge-cs">
        <ArrowDown active={active === "approve" || active === "escrow"} long />
      </div>

      {/* ───────── BAND 4 — FULLY AUTONOMOUS ───────── */}
      <div className="demo7-band demo7-band-auto">
        <div className="demo7-band-tag demo7-band-tag-auto">Fully autonomous</div>
        <div className="demo7-band-inner">
          <div className="demo7-stack">
            <Box
              id="escrow"
              active={active === "escrow"}
              variant="auto"
              badge="6"
              title="Escrow"
              desc="ProcurementEscrow.sol on Sepolia. USDC funds locked: $1,560.00. Tx: 0xa42b…91d3"
              wide
            />
            <ArrowDown active={active === "escrow" || active === "anchor"} />
            <Box
              id="anchor"
              active={active === "anchor"}
              variant="auto"
              badge="7"
              title="Anchor"
              desc="Full payload (decision, quotes, policy hash, signatures) anchored to 0G storage. CID: 0x7f1c…abe3"
              wide
            />
          </div>
        </div>
      </div>

      {/* Connector: Band 4 → Band 5 (sepia → cream) */}
      <div className="demo7-bridge demo7-bridge-sc">
        <ArrowDown active={active === "anchor" || active === "reconcile"} long />
      </div>

      {/* ───────── BAND 5 — HUMAN INVOLVEMENT (BOTTOM) ───────── */}
      <div className="demo7-band demo7-band-human">
        <div className="demo7-band-tag demo7-band-tag-human">Human involvement</div>
        <div className="demo7-band-inner">
          <div className="demo7-row demo7-row-1">
            <Box
              id="reconcile"
              active={active === "reconcile"}
              variant="human"
              badge="8"
              title="Receive + reconcile"
              desc="Goods arrive. Vendor bill auto-matched in Odoo. Audit trail closes the loop."
              wide
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/* Boxes                                                         */
/* ──────────────────────────────────────────────────────────── */

function Box(props: {
  id: StepId;
  active: boolean;
  variant: "human" | "auto";
  badge: string;
  title: string;
  desc: string;
  wide?: boolean;
}) {
  const { id, active, variant, badge, title, desc, wide } = props;
  return (
    <div
      data-step={id}
      className={[
        "demo7-box",
        `demo7-box-${variant}`,
        wide ? "demo7-box-wide" : "",
        active ? "is-active" : "",
      ]
        .join(" ")
        .trim()}
    >
      <span className={`demo7-badge demo7-badge-${variant}`}>{badge}</span>
      <div className="demo7-box-title">{title}</div>
      <div className="demo7-box-desc">{desc}</div>
    </div>
  );
}

function SellerBox(props: {
  id: StepId;
  active: boolean;
  name: string;
  meta: string;
  ok?: boolean;
}) {
  const { id, active, name, meta, ok } = props;
  return (
    <div
      data-step={id}
      className={[
        "demo7-seller",
        ok ? "demo7-seller-ok" : "demo7-seller-fail",
        active ? "is-active" : "",
      ]
        .join(" ")
        .trim()}
    >
      <div className="demo7-seller-name">{name}</div>
      <div className="demo7-seller-meta">{meta}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/* Arrows (SVG for crispness)                                    */
/* ──────────────────────────────────────────────────────────── */

function ArrowH({ active }: { active: boolean }) {
  return (
    <div className={`demo7-arrow-h ${active ? "is-active" : ""}`}>
      <svg viewBox="0 0 80 12" preserveAspectRatio="none" aria-hidden>
        <line
          x1="0"
          y1="6"
          x2="72"
          y2="6"
          stroke="currentColor"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points="68,2 76,6 68,10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="miter"
          strokeLinecap="butt"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="demo7-arrow-dot" />
    </div>
  );
}

function ArrowDown({ active, long }: { active: boolean; long?: boolean }) {
  return (
    <div className={`demo7-arrow-v ${long ? "is-long" : ""} ${active ? "is-active" : ""}`}>
      <svg viewBox="0 0 12 80" preserveAspectRatio="none" aria-hidden>
        <line
          x1="6"
          y1="0"
          x2="6"
          y2="72"
          stroke="currentColor"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points="2,68 6,76 10,68"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="miter"
          strokeLinecap="butt"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="demo7-arrow-dot" />
    </div>
  );
}

function ConvergeArrows({ active }: { active: boolean }) {
  // 4 lines converging from the bottom of the 4 seller cards down to a
  // central point above the "Reason" box. SVG uses a viewBox with
  // preserveAspectRatio:none so it stretches with the row width.
  return (
    <div className={`demo7-converge ${active ? "is-active" : ""}`}>
      <svg viewBox="0 0 800 80" preserveAspectRatio="none" aria-hidden>
        {/* Each seller column center: 100, 300, 500, 700 (assuming 4 equal cols of 200) */}
        {[100, 300, 500, 700].map((x) => (
          <line
            key={x}
            x1={x}
            y1="0"
            x2="400"
            y2="68"
            stroke="currentColor"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {/* Single arrowhead at the convergence point */}
        <polyline
          points="392,60 400,72 408,60"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="miter"
          strokeLinecap="butt"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
