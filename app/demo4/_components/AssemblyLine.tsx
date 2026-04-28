"use client";

import type { ReactNode } from "react";

// AssemblyLine — six overhead ROUND STATIONS, a conveyor belt, and
// rectangular PACKAGES (purchase order manifests) that physically slide
// left-to-right collecting rubber-stamps on their surface as they pass
// each system.
//
// Each package = one autonomous purchase order (a paper manifest /
// envelope / box). Each station = one system the order moves through.
// As a package's center crosses a station, two animations fire in sync:
//   1. the station "pings" (expanding green ring + icon scale + label tint)
//   2. a rust-red rubber stamp pops onto the package surface
// By the time the package reaches the right edge, it has 6 stamps stacked
// on its surface like a real shipping manifest, then snaps into the
// openagents-treasury.eth vault.

type Station = {
  id: string;
  // Two-line uppercase label shown beneath the round node.
  name1: string;
  name2?: string;
  // Inline SVG glyph centered inside the round node.
  icon: ReactNode;
};

// Six stations — equally spaced. Their x-positions are computed from
// shared CSS variables (--demo4-s0..--demo4-s5) so the round nodes,
// the per-station ping keyframes AND the per-stamp keyframes all read
// from the same vars — guaranteed alignment.
const STATIONS: Station[] = [
  {
    id: "odoo",
    name1: "ODOO",
    icon: (
      // database/ERP cylinder
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter">
        <ellipse cx="12" cy="6" rx="7" ry="2.5" />
        <path d="M5 6 L5 18 C5 19.4 8.1 20.5 12 20.5 C15.9 20.5 19 19.4 19 18 L19 6" />
        <path d="M5 12 C5 13.4 8.1 14.5 12 14.5 C15.9 14.5 19 13.4 19 12" />
      </svg>
    ),
  },
  {
    id: "buyer",
    name1: "BUYER",
    name2: "AGENT",
    icon: (
      // eye / scanning agent
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M2.5 12 C5 7 8.5 5 12 5 C15.5 5 19 7 21.5 12 C19 17 15.5 19 12 19 C8.5 19 5 17 2.5 12 Z" />
        <circle cx="12" cy="12" r="3.2" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "telegram",
    name1: "TELEGRAM",
    icon: (
      // paper-plane
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M3 11 L21 4 L17 21 L12 14 Z" />
        <path d="M12 14 L21 4" />
        <path d="M12 14 L12 19" />
      </svg>
    ),
  },
  {
    id: "seller",
    name1: "SELLER",
    name2: "AGENT",
    icon: (
      // agent silhouette
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter">
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20 C5 16 8 14 12 14 C16 14 19 16 19 20" />
      </svg>
    ),
  },
  {
    id: "escrow",
    name1: "ESCROW",
    icon: (
      // padlock
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter">
        <rect x="5" y="11" width="14" height="9" />
        <path d="M8 11 L8 8 C8 5.8 9.8 4 12 4 C14.2 4 16 5.8 16 8 L16 11" />
        <circle cx="12" cy="15" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "audit",
    name1: "AUDIT",
    icon: (
      // anchor
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter">
        <circle cx="12" cy="6" r="2" />
        <path d="M12 8 L12 20" />
        <path d="M8 11 L16 11" />
        <path d="M4 15 C4 18.5 7.5 20 12 20 C16.5 20 20 18.5 20 15" />
        <path d="M4 15 L6 13.5" />
        <path d="M20 15 L18 13.5" />
      </svg>
    ),
  },
];

// Six rubber-stamp marks that get applied to each package as it moves.
// Order matches the station order. Rotation is fixed-but-varied per
// stamp so the deck of stamps reads "hand-applied" not "templated".
const STAMP_LABELS = ["RFQ", "QUOTED", "APPROVED", "ESCROWED", "AUDITED", "CLOSED"] as const;
const STAMP_ROT_DEG = [-7, 5, -3, 8, -5, 9]; // deterministic per index, in [-7°, +9°]
// Stacked positions on the box surface. Slight overlap, busy-document feel.
const STAMP_POS = [
  { top:  6, left:  8 },
  { top: 12, left: 38 },
  { top:  4, left: 70 },
  { top: 34, left: 22 },
  { top: 36, left: 54 },
  { top: 30, left: 86 },
];

type Pkg = {
  id: string;
  // Animation delay in seconds (negative = already in flight at mount).
  delay: number;
  line1: string;
  line2: string;
  line3: string;
};

const PACKAGES: Pkg[] = [
  { id: "pkg-a", delay: 0,    line1: "PO-2026-0014", line2: "240 × A4-PAPER-500", line3: "openagents-treasury.eth" },
  { id: "pkg-b", delay: -4,   line1: "PO-2026-0013", line2: "120 × USB-C-CABLE",  line3: "openagents-treasury.eth" },
  { id: "pkg-c", delay: -8,   line1: "PO-2026-0012", line2: "60 × MONITOR-27IN",  line3: "openagents-treasury.eth" },
  { id: "pkg-d", delay: -12,  line1: "PO-2026-0011", line2: "1000 × INK-CART-XL", line3: "openagents-treasury.eth" },
];

const TRAVEL_SECONDS = 16;

export function AssemblyLine() {
  return (
    <div className="demo4-floor" aria-label="assembly line of autonomous purchase orders">
      {/* ========== STATIONS (round nodes on a beam) ========== */}
      <div className="demo4-stations">
        {/* Thin horizontal beam connecting all 6 round stations. */}
        <div className="demo4-beam" aria-hidden="true" />

        {STATIONS.map((s, i) => (
          <div
            key={s.id}
            className={`demo4-station demo4-station-${i}`}
          >
            <div className="demo4-station-num">0{i + 1}</div>

            <div
              className="demo4-station-node"
              style={{
                animationDuration: `${TRAVEL_SECONDS}s`,
                animationDelay: `0s`,
              }}
            >
              {/* Expanding ping ring. */}
              <div
                className={`demo4-station-ping demo4-station-ping-${i}`}
                style={{ animationDuration: `${TRAVEL_SECONDS}s` }}
                aria-hidden="true"
              />
              {/* The circle itself (stroke + tint pulse). */}
              <div
                className={`demo4-station-circle demo4-station-circle-${i}`}
                style={{ animationDuration: `${TRAVEL_SECONDS}s` }}
              >
                <div
                  className={`demo4-station-icon demo4-station-icon-${i}`}
                  style={{ animationDuration: `${TRAVEL_SECONDS}s` }}
                >
                  {s.icon}
                </div>
              </div>
            </div>

            <div className={`demo4-station-name demo4-station-name-${i}`}>
              <div>{s.name1}</div>
              {s.name2 ? <div>{s.name2}</div> : null}
            </div>
          </div>
        ))}
      </div>

      {/* ========== CONVEYOR BELT ========== */}
      <div className="demo4-belt" aria-hidden="true">
        <div className="demo4-belt-line demo4-belt-top" />
        <div className="demo4-belt-surface" />
        <div className="demo4-belt-line demo4-belt-bottom" />
        <div className="demo4-belt-ticks" />
      </div>

      {/* ========== DESTINATION VAULT ========== */}
      <div className="demo4-vault" aria-hidden="true">
        <svg
          className="demo4-vault-glyph"
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="square"
          strokeLinejoin="miter"
        >
          <path d="M6 22 L24 8 L42 22" />
          <path d="M10 22 L10 40 L38 40 L38 22" />
          <rect x="19" y="26" width="10" height="14" />
          <circle cx="24" cy="32" r="2" />
        </svg>
        <div className="demo4-vault-label">openagents-treasury.eth</div>
      </div>

      {/* ========== PACKAGES (rectangular boxes on the belt) ========== */}
      <div className="demo4-pkgs">
        {PACKAGES.map((p) => (
          <div
            key={p.id}
            className="demo4-pkg"
          >
            <div
              className="demo4-box"
              style={{
                animationDuration: `${TRAVEL_SECONDS}s`,
                animationDelay: `${p.delay}s`,
              }}
            >
              {/* Box surface: 3 mono lines like a shipping manifest. */}
              <div className="demo4-box-text">
                <div className="demo4-box-l1">{p.line1}</div>
                <div className="demo4-box-l2">{p.line2}</div>
                <div className="demo4-box-l3">{p.line3}</div>
              </div>

              {/* Six rubber stamps that pop onto the box surface as it
                  passes under each station. Each has a deterministic
                  rotation and a stacked position. */}
              {STAMP_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={`demo4-stamp demo4-stamp-${i}`}
                  style={{
                    animationDuration: `${TRAVEL_SECONDS}s`,
                    animationDelay: `${p.delay}s`,
                    top: `${STAMP_POS[i].top}px`,
                    left: `${STAMP_POS[i].left}px`,
                    // CSS reads --r so the keyframe can preserve rotation
                    // through its scale animation (transform compounds).
                    ["--demo4-stamp-rot" as string]: `${STAMP_ROT_DEG[i]}deg`,
                  }}
                >
                  {label}
                </div>
              ))}

              {/* Final landing flash — green pulse when box reaches the vault. */}
              <div
                className="demo4-box-flash"
                style={{
                  animationDuration: `${TRAVEL_SECONDS}s`,
                  animationDelay: `${p.delay}s`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Floor caption — kraft-paper industrial label */}
      <div className="demo4-floor-caption">
        <span className="demo4-floor-caption-mark" />
        <span>BAY 04 · AUTONOMOUS PROCUREMENT · LIVE · {new Date().getUTCFullYear()}</span>
        <span className="demo4-floor-caption-mark" />
      </div>
    </div>
  );
}
