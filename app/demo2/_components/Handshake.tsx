"use client";

import { useEffect, useRef, useState } from "react";
import { ARTIFACTS } from "../../lib/landing-data";

// Each step in the handshake script. `side` says where the message lands.
// `dot` says which direction (if any) a traveling dot should fly *after*
// this line is rendered. `tick` marks the final step that flashes the center
// marker green.
type Side = "buyer" | "seller";
type Dir = "ltr" | "rtl" | null;

type Step = {
  side: Side;
  text: string;
  arrow: "out" | "in"; // → outgoing, ← incoming (relative to this side)
  dot: Dir;
  tick?: boolean;
};

const SCRIPT: Step[] = [
  {
    side: "buyer",
    text: "→ RFQ broadcast · 240 × SKU-A4-PAPER-500",
    arrow: "out",
    dot: "ltr",
  },
  {
    side: "seller",
    text: "← RFQ received · evaluating",
    arrow: "in",
    dot: null,
  },
  {
    side: "seller",
    text: "→ signed quote · $6.50/unit · sig 0x9c1d…f034",
    arrow: "out",
    dot: "rtl",
  },
  {
    side: "buyer",
    text: "← quote accepted · escrow funding",
    arrow: "in",
    dot: null,
  },
  {
    side: "buyer",
    text: "→ escrow.createOrder() · tx 0xa42b…91d3",
    arrow: "out",
    dot: "ltr",
  },
  {
    side: "seller",
    text: "← order received · shipping",
    arrow: "in",
    dot: null,
  },
  {
    side: "buyer",
    text: "✓ tick anchored · 0G CID 0x7f1c…abe3",
    arrow: "out",
    dot: null,
    tick: true,
  },
  {
    side: "seller",
    text: "✓ tick anchored · 0G CID 0x7f1c…abe3",
    arrow: "out",
    dot: null,
    tick: true,
  },
];

const STEP_MS = 700; // pacing per step (matches dot travel duration)
const PAUSE_MS = 2000; // pause at end of loop before clearing
const TRAVEL_MS = 700;

type Travel = { id: number; dir: Exclude<Dir, null>; start: number };

export function Handshake() {
  const [buyerLines, setBuyerLines] = useState<Step[]>([]);
  const [sellerLines, setSellerLines] = useState<Step[]>([]);
  const [travels, setTravels] = useState<Travel[]>([]);
  const [loopNum, setLoopNum] = useState(1);
  const [tickGlow, setTickGlow] = useState(false);

  // Trail dots that linger briefly behind a traveling node.
  const [trails, setTrails] = useState<
    Array<{ id: number; dir: "ltr" | "rtl"; offset: number }>
  >([]);
  const travelIdRef = useRef(0);
  const trailIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timers: ReturnType<typeof setTimeout>[] = [];

    function clearTimers() {
      timers.forEach(clearTimeout);
      timers = [];
    }

    function spawnTravel(dir: "ltr" | "rtl") {
      const id = ++travelIdRef.current;
      setTravels((prev) => [...prev, { id, dir, start: Date.now() }]);
      // Drop a few trail dots along the path while the traveler is in flight.
      const TRAIL_COUNT = 4;
      for (let i = 0; i < TRAIL_COUNT; i++) {
        const at = ((i + 1) / (TRAIL_COUNT + 1)) * TRAVEL_MS;
        const t = setTimeout(() => {
          if (cancelled) return;
          const tid = ++trailIdRef.current;
          // offset is the percent along the rail at spawn time
          const offset =
            dir === "ltr" ? (i + 1) / (TRAIL_COUNT + 1) : 1 - (i + 1) / (TRAIL_COUNT + 1);
          setTrails((prev) => [...prev, { id: tid, dir, offset }]);
          const t2 = setTimeout(() => {
            if (cancelled) return;
            setTrails((prev) => prev.filter((x) => x.id !== tid));
          }, TRAVEL_MS);
          timers.push(t2);
        }, at);
        timers.push(t);
      }
      // Clean up the traveler itself when its animation ends.
      const t3 = setTimeout(() => {
        if (cancelled) return;
        setTravels((prev) => prev.filter((x) => x.id !== id));
      }, TRAVEL_MS + 40);
      timers.push(t3);
    }

    function runLoop() {
      if (cancelled) return;
      // reset
      setBuyerLines([]);
      setSellerLines([]);
      setTickGlow(false);
      setTravels([]);
      setTrails([]);

      SCRIPT.forEach((step, i) => {
        const at = i * STEP_MS;
        const t = setTimeout(() => {
          if (cancelled) return;
          if (step.side === "buyer") {
            setBuyerLines((prev) => [...prev, step]);
          } else {
            setSellerLines((prev) => [...prev, step]);
          }
          if (step.dot) spawnTravel(step.dot);
          if (step.tick) {
            setTickGlow(true);
          }
        }, at);
        timers.push(t);
      });

      const totalMs = SCRIPT.length * STEP_MS + PAUSE_MS;
      const end = setTimeout(() => {
        if (cancelled) return;
        setLoopNum((n) => n + 1);
        runLoop();
      }, totalMs);
      timers.push(end);
    }

    runLoop();

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, []);

  return (
    <div>
      <div className="d2-stage">
        <Terminal
          name="buyer-agent"
          ens={ARTIFACTS.agentEns}
          status="negotiating"
          lines={buyerLines}
          foot={`signer ${ARTIFACTS.agentWalletShort}`}
        />

        <div className="d2-conduit" aria-hidden>
          <div className="d2-rail">
            <div className="d2-track">
              <div className="d2-track-line" />
              {trails.map((t) => (
                <span
                  key={t.id}
                  className="d2-trail"
                  style={{ left: `${t.offset * 100}%` }}
                />
              ))}
              {travels.map((t) => (
                <span
                  key={t.id}
                  className={`d2-dot-travel is-${t.dir}`}
                />
              ))}
            </div>
            <div className={`d2-marker${tickGlow ? " is-tick" : ""}`} />
          </div>
        </div>

        <Terminal
          name="seller-agent"
          ens={ARTIFACTS.sellerEns}
          status="online"
          lines={sellerLines}
          foot={`endpoint /rfq · :3030`}
        />
      </div>

      <div className="d2-below">
        <span className="d2-loop-pill">
          <span className="d2-loop-bullet" />
          <span>
            live dialog · loop <span className="d2-loop-num">{loopNum}</span> of ∞
          </span>
        </span>
        <div className="d2-stats">
          <div>
            <div className="d2-stat-label">ens · sepolia</div>
            <div className="d2-stat-value">{ARTIFACTS.agentEns}</div>
          </div>
          <div>
            <div className="d2-stat-label">escrow · sepolia</div>
            <div className="d2-stat-value">{ARTIFACTS.escrowShort}</div>
          </div>
          <div>
            <div className="d2-stat-label">anchor · 0g galileo</div>
            <div className="d2-stat-value">{ARTIFACTS.anchorShort}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Terminal(props: {
  name: string;
  ens: string;
  status: string;
  lines: Step[];
  foot: string;
}) {
  return (
    <div className="d2-side">
      <div className="d2-side-label">
        <span>
          <span className="d2-side-name">{props.name}</span>
          <span className="d2-side-role"> · {props.ens}</span>
        </span>
        <span>{props.status}</span>
      </div>
      <div className="d2-term">
        <div className="d2-term-head">
          <div className="d2-term-head-left">
            <div className="d2-dots">
              <span className="d2-dot" />
              <span className="d2-dot" />
              <span className="d2-dot" />
            </div>
            <span>{props.name} ~ handshake</span>
          </div>
          <div className="d2-term-status">live</div>
        </div>
        <div className="d2-term-body">
          {props.lines.map((line, i) => (
            <div
              key={i}
              className={`d2-line${line.tick ? " is-tick" : ""}`}
            >
              {renderLine(line)}
            </div>
          ))}
        </div>
        <div className="d2-term-foot">
          <span>{props.foot}</span>
          <span>policy: openagents-treasury.eth</span>
        </div>
      </div>
    </div>
  );
}

function renderLine(line: Step) {
  if (line.tick) {
    // strip the leading "✓ " — the CSS adds its own glyph
    return <span>{line.text.replace(/^✓\s*/, "")}</span>;
  }
  // Color the leading arrow tag (→ or ←) and the trailing tx/sig hash if present.
  const arrowMatch = line.text.match(/^(→|←)\s+(.*)$/);
  if (!arrowMatch) return <span>{line.text}</span>;
  const [, arrow, rest] = arrowMatch;
  const arrowClass = arrow === "→" ? "d2-arr-out" : "d2-arr-in";
  // Highlight the last "tx 0x…" or "sig 0x…" or "CID 0x…" token, if any.
  const hashMatch = rest.match(/(.*?\s)(tx|sig|CID)\s(0x[0-9a-fA-F…]+)$/);
  if (hashMatch) {
    const [, head, kind, hash] = hashMatch;
    return (
      <>
        <span className={arrowClass}>{arrow} </span>
        <span>{head}</span>
        <span className="d2-faint">{kind} </span>
        <span className="d2-tx">{hash}</span>
      </>
    );
  }
  return (
    <>
      <span className={arrowClass}>{arrow} </span>
      <span>{rest}</span>
    </>
  );
}
