"use client";

import { useEffect, useRef, useState } from "react";
import { ARTIFACTS } from "../../lib/landing-data";

// ─────────────────────────────────────────────────────────────────────────
// 6 named ports — irregular, organic positions on the chart.
// Coordinates are in the SVG viewBox (1100 × 560).
// ─────────────────────────────────────────────────────────────────────────
type PortId = "odoo" | "buyer" | "telegram" | "seller" | "escrow" | "audit";

type FlowItem = string;

type Port = {
  id: PortId;
  label: string;
  x: number;
  y: number;
  // label offset + anchor — keeps the typeset name off the dot
  lx: number;
  ly: number;
  anchor: "start" | "middle" | "end";
  // tooltip content
  step: number;
  blurb: string;
  mono: string;
  // Click-to-pin "rich" panel content
  flows: FlowItem[];
  // Optional on-chain artifact link
  link?: { label: string; href: string };
};

const PORTS: Record<PortId, Port> = {
  odoo: {
    id: "odoo",
    label: "ODOO",
    x: 165,
    y: 140,
    lx: 165,
    ly: 112,
    anchor: "middle",
    step: 1,
    blurb:
      "Reads what's running low. The agent pulls inventory + open bills from your existing ERP via JSON-RPC every tick — no migration.",
    mono: "odoo.execute_kw('product.product')",
    flows: [
      "47 SKUs scanned per tick",
      "3 below reorder threshold",
      "12 open vendor bills · $4,280 outstanding",
    ],
  },
  buyer: {
    id: "buyer",
    label: "BUYER · AGENT",
    x: 325,
    y: 310,
    lx: 240,
    ly: 335,
    anchor: "end",
    step: 2,
    blurb:
      "Decides what to buy. Discovers seller endpoints via ENS subnames, broadcasts a signed RFQ, ranks signed quotes.",
    mono: "openagents-treasury.eth",
    flows: [
      "4 sellers discovered via ENS subnames",
      "RFQ broadcast → 3 of 4 signed quotes returned",
      "claude-sonnet-4-6 ranks: 35.6% saving vs 3-buy avg",
    ],
    link: {
      label: "openagents-treasury.eth",
      href: `${ARTIFACTS.ensApp}/${ARTIFACTS.agentEns}`,
    },
  },
  telegram: {
    id: "telegram",
    label: "TELEGRAM",
    x: 555,
    y: 90,
    lx: 555,
    ly: 62,
    anchor: "middle",
    step: 3,
    blurb:
      "Asks you when needed. Cap exceeded? New seller? Big jump? The agent pings Telegram for human approval before signing.",
    mono: "bot · /approve /reject",
    flows: [
      "Triggers: cap exceeded · new carrier · price spike",
      "/approve · /reject · /raise-cap from chat",
      "Silent if all checks pass — humans only on exceptions",
    ],
  },
  seller: {
    id: "seller",
    label: "SELLER · AGENT",
    x: 775,
    y: 305,
    lx: 855,
    ly: 285,
    anchor: "start",
    step: 4,
    blurb:
      "The other side. Each seller runs the same agent shell — receives RFQ, returns a signed quote, fulfills the order.",
    mono: "seller-acme.openagents-treasury.eth",
    flows: [
      "Receives signed RFQ on /catalog endpoint",
      "Returns signed quote: $6.50/u × 240 = $1,560",
      "Same agent shell, same 3 plugins as buyer",
    ],
    link: {
      label: "seller-acme.openagents-treasury.eth",
      href: `${ARTIFACTS.ensApp}/${ARTIFACTS.sellerEns}`,
    },
  },
  escrow: {
    id: "escrow",
    label: "ESCROW · SEPOLIA",
    x: 895,
    y: 475,
    lx: 895,
    ly: 506,
    anchor: "middle",
    step: 5,
    blurb:
      "Pays only when delivered. Funds lock in ProcurementEscrow.sol; release on confirmation, refund on dispute.",
    mono: "0x43b3…60b8 · sepolia",
    flows: [
      "1,560 USDC locked in ProcurementEscrow.sol",
      "Release on shipment-proof · refund on dispute",
      "72h dispute window enforced onchain",
    ],
    link: {
      label: `${ARTIFACTS.escrowShort} · sepolia`,
      href: `${ARTIFACTS.sepoliaExplorer}/address/${ARTIFACTS.escrow}`,
    },
  },
  audit: {
    id: "audit",
    label: "AUDIT · 0G",
    x: 540,
    y: 490,
    lx: 540,
    ly: 521,
    anchor: "middle",
    step: 6,
    blurb:
      "Every tick gets a receipt. The full decision payload (policy hash, quotes, signatures) is anchored to 0G storage.",
    mono: "0xc4B9…1d89 · 0g galileo",
    flows: [
      "Full payload uploaded to 0G Storage (root: 0x7f1c…abe3)",
      "(cidRoot, policyHash) anchored on AuditAnchor.sol",
      "Anchor index 14 · third-party verifiable",
    ],
    link: {
      label: `${ARTIFACTS.anchorShort} · 0g galileo`,
      href: `${ARTIFACTS.zgExplorer}/address/${ARTIFACTS.anchor}`,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Trade-route segments. Each is a quadratic Bézier (M start Q ctrl end)
// with a hand-tuned control point so curves feel organic, not grid-snapped.
// ─────────────────────────────────────────────────────────────────────────
type Segment = {
  id: string;
  from: PortId;
  to: PortId;
  d: string;
  // midpoint + tangent angle for the direction arrow
  midX: number;
  midY: number;
  midAngle: number;
};

// Quadratic Bézier midpoint t=0.5 → P = 0.25 P0 + 0.5 Pc + 0.25 P1
function midOf(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) {
  const mx = 0.25 * x0 + 0.5 * cx + 0.25 * x1;
  const my = 0.25 * y0 + 0.5 * cy + 0.25 * y1;
  // tangent at t=0.5 → 2(1-t)(Pc-P0) + 2t(P1-Pc) = (Pc-P0) + (P1-Pc) = P1 - P0  (linear in t)
  // but the visual tangent at midpoint is better approximated by lerped derivative:
  const dx = (cx - x0) + (x1 - cx);
  const dy = (cy - y0) + (y1 - cy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return { mx, my, angle };
}

function seg(
  id: string,
  from: PortId,
  to: PortId,
  cx: number,
  cy: number
): Segment {
  const a = PORTS[from];
  const b = PORTS[to];
  const { mx, my, angle } = midOf(a.x, a.y, cx, cy, b.x, b.y);
  return {
    id,
    from,
    to,
    d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`,
    midX: mx,
    midY: my,
    midAngle: angle,
  };
}

// Cycle order: ODOO → BUYER → TELEGRAM → SELLER → ESCROW → AUDIT → (loop) ODOO
const SEGMENTS: Segment[] = [
  seg("s0", "odoo", "buyer", 200, 270),
  seg("s1", "buyer", "telegram", 380, 150),
  seg("s2", "telegram", "seller", 770, 140),
  seg("s3", "seller", "escrow", 900, 380),
  seg("s4", "escrow", "audit", 740, 540),
  // Faded loop-back to ODOO suggesting the cycle repeats
  seg("s5", "audit", "odoo", 280, 380),
];

// Faster cycle: 1.8s per segment → ~10.8s end-to-end loop.
const SEG_DURATION_MS = 1800;
// Trail dot lags ~30% of a segment (rounded down to keep transitions clean).
const TRAIL_LAG_MS = Math.round(SEG_DURATION_MS * 0.3);

// SVG viewBox — keep in sync with the <svg viewBox> below.
const VIEW_W = 1100;
const VIEW_H = 560;

export function TradeMap() {
  const [activeIdx, setActiveIdx] = useState(0);
  // Hover state — only set when nothing is pinned. Cleared on mouseleave.
  const [hoverPort, setHoverPort] = useState<PortId | null>(null);
  // Pinned state — set on click, cleared on click-again / outside / ESC.
  const [pinnedPort, setPinnedPort] = useState<PortId | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Advance the highlighted segment around the cycle once per loop.
  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveIdx((i) => (i + 1) % SEGMENTS.length);
    }, SEG_DURATION_MS);
    return () => window.clearInterval(id);
  }, []);

  // Outside-click closes a pinned panel. ESC also closes it.
  useEffect(() => {
    function onDocPointer(e: PointerEvent) {
      if (!pinnedPort) return;
      const wrap = wrapRef.current;
      if (!wrap) return;
      if (!wrap.contains(e.target as Node)) {
        setPinnedPort(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && pinnedPort) {
        setPinnedPort(null);
      }
    }
    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinnedPort]);

  const active = SEGMENTS[activeIdx];

  // Hover handlers — purely transient. Pinned panel takes precedence.
  const handleEnter = (id: PortId) => {
    setHoverPort(id);
  };
  const handleLeave = (id: PortId) => {
    setHoverPort((cur) => (cur === id ? null : cur));
  };
  // Click toggles pinned.
  const handleTap = (e: React.MouseEvent | React.PointerEvent, id: PortId) => {
    e.stopPropagation();
    setPinnedPort((cur) => (cur === id ? null : id));
  };

  // The "panel-active" port: pinned wins, else hover.
  const panelPortId = pinnedPort ?? hoverPort;
  const panelPort = panelPortId ? PORTS[panelPortId] : null;
  const isPinned = panelPortId !== null && pinnedPort === panelPortId;

  // Adjacency uses the panel-active port (matches the visual highlight).
  const highlightId = panelPortId;

  // Compute panel position in % of the chart wrap so it tracks the SVG.
  let panelStyle: React.CSSProperties | null = null;
  let flipX = false;
  let flipY = false;
  if (panelPort) {
    const pxPct = (panelPort.x / VIEW_W) * 100;
    const pyPct = (panelPort.y / VIEW_H) * 100;
    // Approximate edge-flip thresholds in viewBox units. Pinned panel is
    // wider/taller than hover panel, so use larger margins when pinned.
    const wMargin = isPinned ? 360 : 280;
    const hMargin = isPinned ? 260 : 160;
    flipX = panelPort.x + wMargin > VIEW_W;
    flipY = panelPort.y + hMargin > VIEW_H;
    panelStyle = {
      left: `${pxPct}%`,
      top: `${pyPct}%`,
    };
  }

  return (
    <div className="demo6-chart-wrap" ref={wrapRef}>
      <svg
        className="demo6-chart"
        viewBox="0 0 1100 560"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Nautical chart of an autonomous trade route between six waypoints"
      >
        {/* Reusable defs — motion-trail filter for the traveling dot. */}
        <defs>
          <filter
            id="demo6-traveler-trail"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* ──────────── faint topographic contour lines ──────────── */}
        <g className="demo6-contours" aria-hidden="true">
          {/* irregular concentric "hills" — three clusters across the chart */}
          <path d="M 220,180 C 320,120 440,140 480,210 C 520,280 420,330 320,310 C 220,290 160,250 220,180 Z" />
          <path d="M 250,200 C 320,160 410,170 440,220 C 470,270 400,310 330,300 C 260,290 220,250 250,200 Z" />
          <path d="M 280,220 C 330,200 390,205 410,235 C 430,265 380,290 340,285 C 295,278 270,250 280,220 Z" />

          <path d="M 720,360 C 820,310 940,330 980,400 C 1020,470 920,520 820,500 C 720,480 660,440 720,360 Z" />
          <path d="M 750,380 C 820,345 910,360 940,410 C 970,460 910,495 840,488 C 770,481 720,450 750,380 Z" />

          <path d="M 540,90 C 620,60 720,70 760,120 C 800,170 720,220 640,210 C 560,200 510,160 540,90 Z" />
          <path d="M 570,110 C 630,90 700,100 730,135 C 760,170 710,205 660,200 C 610,195 555,160 570,110 Z" />
        </g>

        {/* ──────────── dashed routes ──────────── */}
        <g className="demo6-routes" aria-hidden="true">
          {SEGMENTS.map((s, i) => {
            const isAdjacent =
              highlightId !== null &&
              (s.from === highlightId || s.to === highlightId);
            return (
              <path
                key={s.id}
                id={`demo6-path-${s.id}`}
                d={s.d}
                className={[
                  "demo6-route",
                  i === activeIdx ? "is-active" : "",
                  i === SEGMENTS.length - 1 ? "is-loop" : "",
                  isAdjacent ? "is-adjacent" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                fill="none"
              />
            );
          })}
        </g>

        {/* ──────────── direction arrows at each route midpoint ──────────── */}
        <g className="demo6-arrows" aria-hidden="true">
          {SEGMENTS.map((s, i) => {
            const isAdjacent =
              highlightId !== null &&
              (s.from === highlightId || s.to === highlightId);
            return (
              <polygon
                key={s.id}
                className={[
                  "demo6-arrow",
                  i === activeIdx ? "is-active" : "",
                  isAdjacent ? "is-adjacent" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                points="-5,-3.5 5,0 -5,3.5"
                transform={`translate(${s.midX} ${s.midY}) rotate(${s.midAngle})`}
              />
            );
          })}
        </g>

        {/* ──────────── ports — dot + leader + label ──────────── */}
        <g className="demo6-ports">
          {Object.values(PORTS).map((p) => {
            const isHover = hoverPort === p.id && pinnedPort !== p.id;
            const isPinnedDot = pinnedPort === p.id;
            const isActive = isHover || isPinnedDot;
            return (
              <g
                key={p.id}
                className={[
                  "demo6-port",
                  isActive ? "is-active" : "",
                  isPinnedDot ? "is-pinned" : "",
                  isHover ? "is-hover" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                tabIndex={0}
                role="button"
                aria-label={`${p.label} — step ${p.step} of 6. ${p.blurb}`}
                aria-pressed={isPinnedDot}
                onMouseEnter={() => handleEnter(p.id)}
                onMouseLeave={() => handleLeave(p.id)}
                onFocus={() => handleEnter(p.id)}
                onBlur={() => handleLeave(p.id)}
                onClick={(e) => handleTap(e, p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPinnedPort((cur) => (cur === p.id ? null : p.id));
                  }
                }}
              >
                <line
                  className="demo6-leader"
                  x1={p.x}
                  y1={p.y}
                  x2={p.lx}
                  y2={p.ly}
                />
                {/* Persistent dashed selection ring — visible only when pinned. */}
                <circle
                  className="demo6-port-pinring"
                  cx={p.x}
                  cy={p.y}
                  r={18}
                />
                {/* Sepia hover hint ring — visible on hover (non-pinned). */}
                <circle
                  className="demo6-port-hintring"
                  cx={p.x}
                  cy={p.y}
                  r={13}
                />
                <circle className="demo6-port-ring" cx={p.x} cy={p.y} r={9} />
                <circle className="demo6-port-dot" cx={p.x} cy={p.y} r={4.5} />
                {/* Concentric inner pin shown when pinned (small filled green). */}
                <circle
                  className="demo6-port-pin-inner"
                  cx={p.x}
                  cy={p.y}
                  r={2.2}
                />
                <text
                  className="demo6-port-label"
                  x={p.lx}
                  y={p.ly}
                  textAnchor={p.anchor}
                  dy={p.ly < p.y ? -8 : 14}
                >
                  {p.label}
                </text>
                {/* invisible larger hit target — easier to hover/tap */}
                <circle
                  className="demo6-port-hit"
                  cx={p.x}
                  cy={p.y}
                  r={22}
                  fill="transparent"
                />
              </g>
            );
          })}
        </g>

        {/* ──────────── traveling green dot along the active segment ──────────── */}
        <g className="demo6-traveler" key={`trav-${activeIdx}`} aria-hidden="true">
          {/* Lagging trail dot — same path, delayed start. */}
          <circle r={3} className="demo6-traveler-trail">
            <animateMotion
              dur={`${SEG_DURATION_MS}ms`}
              begin={`${TRAIL_LAG_MS}ms`}
              repeatCount="1"
              fill="freeze"
              path={active.d}
              rotate="auto"
            />
          </circle>
          {/* Outer glow — same path as the head dot. */}
          <circle r={9} className="demo6-traveler-glow">
            <animateMotion
              dur={`${SEG_DURATION_MS}ms`}
              repeatCount="1"
              fill="freeze"
              path={active.d}
              rotate="auto"
            />
          </circle>
          {/* Head dot — bright green, leads the pack. */}
          <circle r={4.5} className="demo6-traveler-dot">
            <animateMotion
              dur={`${SEG_DURATION_MS}ms`}
              repeatCount="1"
              fill="freeze"
              path={active.d}
              rotate="auto"
            />
          </circle>
        </g>

        {/* ──────────── compass rose (top-right) ──────────── */}
        <g className="demo6-compass" transform="translate(1010, 78)" aria-hidden="true">
          <circle r="38" className="demo6-compass-ring-outer" />
          <circle r="30" className="demo6-compass-ring-inner" />
          {/* 4-pointed star */}
          <polygon points="0,-34 5,0 0,34 -5,0" className="demo6-compass-vert" />
          <polygon points="-34,0 0,-5 34,0 0,5" className="demo6-compass-horiz" />
          {/* diagonal hairlines */}
          <line x1="-22" y1="-22" x2="22" y2="22" className="demo6-compass-diag" />
          <line x1="22" y1="-22" x2="-22" y2="22" className="demo6-compass-diag" />
          <circle r="2" className="demo6-compass-pin" />
          {/* labels */}
          <text y="-44" textAnchor="middle" className="demo6-compass-label">N</text>
          <text x="44" y="4" textAnchor="middle" className="demo6-compass-label">E</text>
          <text y="52" textAnchor="middle" className="demo6-compass-label">S</text>
          <text x="-44" y="4" textAnchor="middle" className="demo6-compass-label">W</text>
        </g>

        {/* ──────────── scale bar (bottom-left) ──────────── */}
        <g className="demo6-scale" transform="translate(48, 520)" aria-hidden="true">
          <line x1="0" y1="0" x2="160" y2="0" className="demo6-scale-bar" />
          {[0, 40, 80, 120, 160].map((tx) => (
            <line
              key={tx}
              x1={tx}
              y1="-4"
              x2={tx}
              y2="4"
              className="demo6-scale-tick"
            />
          ))}
          <text x="0" y="20" className="demo6-scale-label">0</text>
          <text x="80" y="20" textAnchor="middle" className="demo6-scale-label">50</text>
          <text x="160" y="20" textAnchor="end" className="demo6-scale-label">100 BLOCKS</text>
        </g>

        {/* ──────────── cartographer credit (bottom-right) ──────────── */}
        <text
          x="1052"
          y="540"
          textAnchor="end"
          className="demo6-credit"
          aria-hidden="true"
        >
          Cartographer: openagents-treasury.eth · 2026
        </text>

        {/* ──────────── chart frame (subtle inset border) ──────────── */}
        <rect
          x="6"
          y="6"
          width="1088"
          height="548"
          className="demo6-frame"
          fill="none"
        />
        <rect
          x="14"
          y="14"
          width="1072"
          height="532"
          className="demo6-frame-inner"
          fill="none"
        />
      </svg>

      {/* ──────────── info panel — hover (light) OR pinned (rich) ──────────── */}
      {panelPort && panelStyle && (
        <div
          key={`${panelPort.id}-${isPinned ? "pin" : "hov"}`}
          id={`demo6-panel-${panelPort.id}`}
          role={isPinned ? "dialog" : "tooltip"}
          aria-modal={isPinned ? "false" : undefined}
          aria-label={isPinned ? `${panelPort.label} — pinned details` : undefined}
          className={[
            "demo6-panel",
            isPinned ? "is-pinned" : "is-hover",
            flipX ? "is-flip-x" : "",
            flipY ? "is-flip-y" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={panelStyle}
          onClick={(e) => e.stopPropagation()}
        >
          {isPinned && (
            <div className="demo6-panel-pinbar">
              <span className="demo6-panel-pindot" />
              <span className="demo6-panel-pinlabel">PINNED</span>
              <span className="demo6-panel-pinkey">ESC to close</span>
            </div>
          )}

          <div className="demo6-panel-head">
            <span className="demo6-panel-name">{panelPort.label}</span>
            <span className="demo6-panel-step">step {panelPort.step} of 6</span>
          </div>

          <p className="demo6-panel-body">{panelPort.blurb}</p>

          {!isPinned && (
            <div className="demo6-panel-hint">
              <span className="demo6-panel-hint-key">click</span>
              <span>for live link · richer detail</span>
            </div>
          )}

          {isPinned && (
            <>
              <div className="demo6-panel-section">
                <div className="demo6-panel-section-label">
                  WHAT FLOWS THROUGH HERE
                </div>
                <ul className="demo6-panel-flows">
                  {panelPort.flows.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>

              {panelPort.link && (
                <div className="demo6-panel-section">
                  <div className="demo6-panel-section-label">LIVE LINK</div>
                  <a
                    className="demo6-panel-link"
                    href={panelPort.link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {panelPort.link.label}
                    <span className="demo6-panel-link-arrow">↗</span>
                  </a>
                </div>
              )}

              <div className="demo6-panel-mono">{panelPort.mono}</div>
            </>
          )}

          <div className="demo6-panel-rule" />
        </div>
      )}

      {/* legend strip beneath the chart */}
      <div className="demo6-legend">
        <div className="demo6-legend-item">
          <span className="demo6-legend-dash" />
          <span>charted route</span>
        </div>
        <div className="demo6-legend-item">
          <span className="demo6-legend-live" />
          <span>
            in&nbsp;flight ·{" "}
            <span className="demo6-legend-from">
              {PORTS[active.from].label}
            </span>{" "}
            <span className="demo6-legend-arrow">→</span>{" "}
            <span className="demo6-legend-to">{PORTS[active.to].label}</span>
          </span>
        </div>
        <div className="demo6-legend-item demo6-legend-meta">
          <span>seg {String(activeIdx + 1).padStart(2, "0")} / 06</span>
        </div>
      </div>
    </div>
  );
}
