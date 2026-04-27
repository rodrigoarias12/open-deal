"use client";

import type { CSSProperties } from "react";

/* ─────────────────────────────────────────────────────────────
   ENGINEERING SCHEMATIC
   6 nodes, orthogonal ink traces, JSON-token capsules in flight.
   Coordinate space: 1100 × 520 (SVG viewBox).
   ───────────────────────────────────────────────────────────── */

type NodePos = { x: number; y: number };

const NODES: Record<string, NodePos> = {
  odoo:     { x: 110, y: 130 },  // [01] top-left
  buyer:    { x: 360, y: 230 },  // [02] center-left
  telegram: { x: 360, y: 410 },  // [03] bottom-left center
  seller:   { x: 720, y: 230 },  // [04] center-right
  escrow:   { x: 970, y: 130 },  // [05] top-right
  audit:    { x: 970, y: 380 },  // [06] bottom-right
};

/* Orthogonal trace paths. Each path is a polyline (M + L commands).
   We deliberately route with right-angle turns like a real schematic. */
const TRACES: { id: string; d: string; capsule: { text: string; cls: string } }[] = [
  {
    // [01] odoo → [02] buyer
    id: "t1",
    d: `M 130 130 L 240 130 L 240 230 L 342 230`,
    capsule: { text: "{ rfq: 240 }", cls: "pulse-1" },
  },
  {
    // [02] buyer → [04] seller (the RFQ broadcast)
    id: "t2",
    d: `M 378 230 L 540 230 L 540 230 L 702 230`,
    capsule: { text: "{ sig: 0x9c1d… }", cls: "pulse-2" },
  },
  {
    // [02] buyer → [03] telegram (approval ping)
    id: "t3",
    d: `M 360 248 L 360 320 L 360 320 L 360 394`,
    capsule: { text: "{ approved: true }", cls: "pulse-3" },
  },
  {
    // [04] seller → [05] escrow (settlement)
    id: "t4",
    d: `M 738 220 L 840 220 L 840 130 L 950 130`,
    capsule: { text: "{ tx: 0xa42b… }", cls: "pulse-4" },
  },
  {
    // [04] seller → [06] audit (decision record)
    id: "t5",
    d: `M 738 248 L 840 248 L 840 380 L 950 380`,
    capsule: { text: "{ cid: 0x7f1c… }", cls: "pulse-5" },
  },
  {
    // [05] escrow → [06] audit (anchor index)
    id: "t6",
    d: `M 970 150 L 970 240 L 970 240 L 970 360`,
    capsule: { text: "{ idx: 14 }", cls: "pulse-6" },
  },
];

export function Schematic() {
  return (
    <svg
      className="demo5-schematic"
      viewBox="0 0 1100 520"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Open Deal — engineering schematic of the 6-step procurement loop"
    >
      <defs>
        {/* arrowhead — small ink triangle */}
        <marker
          id="demo5-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink)" />
        </marker>

        {/* corner tick marks — small cross decoration at sheet corners */}
        <symbol id="demo5-corner" viewBox="0 0 12 12">
          <line x1="0" y1="6" x2="12" y2="6" stroke="var(--ink)" strokeWidth="0.5" />
          <line x1="6" y1="0" x2="6" y2="12" stroke="var(--ink)" strokeWidth="0.5" />
        </symbol>
      </defs>

      {/* sheet border + corner registration marks */}
      <rect
        x="4"
        y="4"
        width="1092"
        height="512"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="0.5"
      />
      <use href="#demo5-corner" x="-2" y="-2" width="12" height="12" />
      <use href="#demo5-corner" x="1090" y="-2" width="12" height="12" />
      <use href="#demo5-corner" x="-2" y="510" width="12" height="12" />
      <use href="#demo5-corner" x="1090" y="510" width="12" height="12" />

      {/* tick rulers — top and left */}
      {Array.from({ length: 22 }, (_, i) => i * 50).map((x) => (
        <line
          key={`tx-${x}`}
          x1={x + 4}
          y1={4}
          x2={x + 4}
          y2={x % 100 === 0 ? 12 : 8}
          className="tick-mark"
        />
      ))}
      {Array.from({ length: 11 }, (_, i) => i * 50).map((y) => (
        <line
          key={`ty-${y}`}
          x1={4}
          y1={y + 4}
          x2={y % 100 === 0 ? 12 : 8}
          y2={y + 4}
          className="tick-mark"
        />
      ))}

      {/* ── traces (drawn before nodes so nodes overlap arrows) ── */}
      {TRACES.map((t) => (
        <path
          key={t.id}
          d={t.d}
          className="trace"
          markerEnd="url(#demo5-arrow)"
        />
      ))}

      {/* ── NODES ── */}

      {/* [01] ODOO-ERP — square 40×40 with internal grid */}
      <g>
        <rect
          x="90"
          y="110"
          width="40"
          height="40"
          className="ink-fill node node-pulse-1"
        />
        <line x1="90" y1="123" x2="130" y2="123" className="ink-thin" />
        <line x1="90" y1="137" x2="130" y2="137" className="ink-thin" />
        <line x1="103" y1="110" x2="103" y2="150" className="ink-thin" />
        <line x1="117" y1="110" x2="117" y2="150" className="ink-thin" />
        {/* leader + label */}
        <line x1="110" y1="110" x2="110" y2="78" className="leader" />
        <line x1="110" y1="78" x2="190" y2="78" className="leader" />
        <text x="195" y="74" className="node-pin">[01]</text>
        <text x="195" y="86" className="node-label">ODOO-ERP</text>
      </g>

      {/* [02] BUYER-AGENT — circle 36 dia + crosshair */}
      <g>
        <circle
          cx="360"
          cy="230"
          r="18"
          className="ink-fill node node-pulse-2"
        />
        <line x1="346" y1="230" x2="374" y2="230" className="ink-thin" />
        <line x1="360" y1="216" x2="360" y2="244" className="ink-thin" />
        <circle cx="360" cy="230" r="4" className="ink-thin" />
        {/* leader + label */}
        <line x1="360" y1="212" x2="360" y2="180" className="leader" />
        <line x1="360" y1="180" x2="440" y2="180" className="leader" />
        <text x="445" y="176" className="node-pin">[02]</text>
        <text x="445" y="188" className="node-label">BUYER-AGENT</text>
      </g>

      {/* [03] TELEGRAM — 32×32 rotated 45° (diamond) + small inner rect */}
      <g transform="rotate(45 360 410)">
        <rect
          x="344"
          y="394"
          width="32"
          height="32"
          className="ink-fill node node-pulse-3"
        />
        <rect
          x="352"
          y="402"
          width="16"
          height="16"
          className="ink-thin"
          fill="none"
        />
      </g>
      <line x1="360" y1="430" x2="360" y2="468" className="leader" />
      <line x1="360" y1="468" x2="440" y2="468" className="leader" />
      <text x="445" y="464" className="node-pin">[03]</text>
      <text x="445" y="476" className="node-label">TELEGRAM</text>

      {/* [04] SELLER-AGENT — circle 36 dia + crosshair (mirrored) */}
      <g>
        <circle
          cx="720"
          cy="230"
          r="18"
          className="ink-fill node node-pulse-4"
        />
        <line x1="706" y1="230" x2="734" y2="230" className="ink-thin" />
        <line x1="720" y1="216" x2="720" y2="244" className="ink-thin" />
        <circle cx="720" cy="230" r="4" className="ink-thin" />
        {/* leader + label */}
        <line x1="720" y1="212" x2="720" y2="180" className="leader" />
        <line x1="720" y1="180" x2="640" y2="180" className="leader" />
        <text x="555" y="176" className="node-pin">[04]</text>
        <text x="555" y="188" className="node-label">SELLER-AGENT</text>
      </g>

      {/* [05] ESCROW — hexagon 40 wide + lock shape inside */}
      <g>
        <polygon
          points="970,108 988,118 988,142 970,152 952,142 952,118"
          className="ink-fill node node-pulse-5"
        />
        {/* lock shackle */}
        <path
          d="M 962 128 Q 962 122 970 122 Q 978 122 978 128"
          className="ink-thin"
        />
        {/* lock body */}
        <rect x="962" y="128" width="16" height="12" className="ink-thin" />
        {/* leader + label */}
        <line x1="970" y1="108" x2="970" y2="78" className="leader" />
        <line x1="970" y1="78" x2="890" y2="78" className="leader" />
        <text x="810" y="74" className="node-pin">[05]</text>
        <text x="810" y="86" className="node-label">ESCROW</text>
      </g>

      {/* [06] AUDIT-0G — concentric circles */}
      <g>
        <circle
          cx="970"
          cy="380"
          r="20"
          className="ink-fill node node-pulse-6"
        />
        <circle cx="970" cy="380" r="13" className="ink-thin" />
        <circle cx="970" cy="380" r="6" className="ink-thin" />
        <circle cx="970" cy="380" r="1.5" fill="var(--ink)" />
        {/* leader + label */}
        <line x1="970" y1="400" x2="970" y2="436" className="leader" />
        <line x1="970" y1="436" x2="890" y2="436" className="leader" />
        <text x="810" y="432" className="node-pin">[06]</text>
        <text x="810" y="444" className="node-label">AUDIT-0G</text>
      </g>

      {/* ── floating JSON-token capsules ── */}
      {TRACES.map((t) => (
        <CapsuleAlongPath
          key={`cap-${t.id}`}
          pathD={t.d}
          text={t.capsule.text}
          cls={t.capsule.cls}
        />
      ))}
    </svg>
  );
}

/* A capsule that drifts along a path via CSS offset-path. */
function CapsuleAlongPath({
  pathD,
  text,
  cls,
}: {
  pathD: string;
  text: string;
  cls: string;
}) {
  // approximate text width — 6.2px/char + padding
  const w = Math.max(80, Math.min(110, text.length * 6.4 + 16));
  const h = 22;

  // We render a <g> positioned via CSS offset-path. The capsule sits
  // centered on the current point of the path.
  const style: CSSProperties = {
    offsetPath: `path("${pathD}")`,
    // @ts-expect-error - vendor prefix for older WebKit
    WebkitOffsetPath: `path("${pathD}")`,
    offsetRotate: "0deg",
    offsetAnchor: "center",
    // no transition needed — animation drives offset-distance
  };

  return (
    <g className={`capsule-group ${cls}`} style={style}>
      {/* capsule sits centered on the offset point */}
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx="3"
        ry="3"
        className="capsule-bg"
      />
      <text
        x="0"
        y="3.5"
        textAnchor="middle"
        className="capsule"
      >
        {text}
      </text>
    </g>
  );
}
