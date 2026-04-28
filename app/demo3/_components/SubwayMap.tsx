"use client";

import { useEffect, useRef, useState } from "react";

type Station = {
  id: string;
  name: string; // 2 lines max — split with \n
  caption: string; // tiny mono caption above
};

const STATIONS: Station[] = [
  { id: "odoo", name: "ODOO\nERP", caption: "01 · jsonrpc" },
  { id: "buyer", name: "BUYER\nAGENT", caption: "02 · openclaw" },
  { id: "telegram", name: "TELE\nGRAM", caption: "03 · approval" },
  { id: "seller", name: "SELLER\nAGENT", caption: "04 · openclaw" },
  { id: "escrow", name: "ESCROW\nSEPOLIA", caption: "05 · sepolia" },
  { id: "audit", name: "AUDIT\n0G", caption: "06 · 0g galileo" },
];

// Layout constants — match the SVG viewBox.
const VB_W = 1100;
const VB_H = 260;
const TRACK_Y = 130;
const PAD_X = 80;
const STATION_R = 14; // 28px diameter
const PULSE_RADIUS_PX = 24; // station "lights up" when packet within 24px of it
const LOOP_MS = 12_000;

// 3 packets, staggered phase offsets (0%, 33%, 66%).
const PACKET_PHASES = [0, 1 / 3, 2 / 3];

function stationX(i: number): number {
  // evenly spaced between PAD_X and VB_W - PAD_X.
  if (STATIONS.length === 1) return VB_W / 2;
  const usable = VB_W - PAD_X * 2;
  return PAD_X + (usable * i) / (STATIONS.length - 1);
}

const TRACK_X1 = stationX(0);
const TRACK_X2 = stationX(STATIONS.length - 1);
const TRACK_LEN = TRACK_X2 - TRACK_X1;

export function SubwayMap() {
  // Position of each packet along the track, in [0, 1].
  const [progress, setProgress] = useState<number[]>(PACKET_PHASES.slice());
  // Per-station: timestamp of the most recent "pulse" trigger (0 if none).
  const pulseTimesRef = useRef<number[]>(STATIONS.map(() => 0));
  const [, force] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    function tick(now: number) {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const base = (elapsed % LOOP_MS) / LOOP_MS;
      const next = PACKET_PHASES.map((phase) => (base + phase) % 1);
      setProgress(next);

      // Detect proximity → trigger pulses.
      for (let s = 0; s < STATIONS.length; s++) {
        const sx = stationX(s);
        for (const t of next) {
          const px = TRACK_X1 + t * TRACK_LEN;
          if (Math.abs(px - sx) <= PULSE_RADIUS_PX) {
            // Only re-trigger if last pulse was > 350ms ago to avoid spam.
            if (now - pulseTimesRef.current[s] > 350) {
              pulseTimesRef.current[s] = now;
              force((n) => n + 1);
            }
            break;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const now = typeof performance !== "undefined" ? performance.now() : 0;

  return (
    <div className="demo3-map" role="img" aria-label="Six systems linked by a single autonomous data line">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="demo3-map-svg"
      >
        {/* The single black track. */}
        <line
          x1={TRACK_X1}
          y1={TRACK_Y}
          x2={TRACK_X2}
          y2={TRACK_Y}
          className="demo3-track"
        />

        {/* Stations */}
        {STATIONS.map((s, i) => {
          const cx = stationX(i);
          const lastPulse = pulseTimesRef.current[i];
          const since = now - lastPulse;
          const pulsing = lastPulse > 0 && since < 400;
          // ring opacity: 1 → 0 over 400ms
          const ringOpacity = pulsing ? 1 - since / 400 : 0;
          const stationOpacity = pulsing ? 1 : 0.92;
          const captionLines = s.name.split("\n");

          return (
            <g key={s.id} className={`demo3-station${pulsing ? " is-pulsing" : ""}`}>
              {/* Caption above */}
              <text
                x={cx}
                y={TRACK_Y - 56}
                className="demo3-station-caption"
                textAnchor="middle"
              >
                {s.caption}
              </text>

              {/* Pulse ring (only visible when active) */}
              <circle
                cx={cx}
                cy={TRACK_Y}
                r={STATION_R + 8}
                className="demo3-station-ring"
                style={{ opacity: ringOpacity }}
              />

              {/* The station node itself */}
              <circle
                cx={cx}
                cy={TRACK_Y}
                r={STATION_R}
                className="demo3-station-dot"
                style={{ opacity: stationOpacity }}
              />

              {/* 2-line label below */}
              {captionLines.map((line, li) => (
                <text
                  key={li}
                  x={cx}
                  y={TRACK_Y + 38 + li * 14}
                  className="demo3-station-label"
                  textAnchor="middle"
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}

        {/* Packets — green dots traveling left-to-right */}
        {progress.map((t, i) => {
          const px = TRACK_X1 + t * TRACK_LEN;
          return (
            <circle
              key={i}
              cx={px}
              cy={TRACK_Y}
              r={3}
              className="demo3-packet"
            />
          );
        })}
      </svg>
    </div>
  );
}
