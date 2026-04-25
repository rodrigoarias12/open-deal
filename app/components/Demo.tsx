"use client";

import { useEffect, useState } from "react";
import { DEMO } from "../lib/landing-data";

const STEP_DELAYS = [900, 700, 1400, 1100, 700];

export function Demo() {
  const [step, setStep] = useState(-1); // -1 idle, 0..4 active, 5 done
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    if (step >= 5) {
      setRunning(false);
      return;
    }
    const t = setTimeout(() => setStep(step + 1), STEP_DELAYS[step] || 600);
    return () => clearTimeout(t);
  }, [step, running]);

  const promptVisible = step >= 2;
  const outputVisible = step >= 3;
  const done = step >= 5;

  function run() {
    setStep(0);
    setRunning(true);
  }
  function reset() {
    setStep(-1);
    setRunning(false);
  }

  return (
    <div className="demo">
      <div className="demo-head">
        <div className="demo-head-left">
          <span className="demo-head-label">FIXTURE</span>
          <span className="demo-head-fixture">{DEMO.fixture}</span>
          <span className="demo-head-label">·</span>
          <span className="demo-head-label">SEPOLIA REPLAY · NO WALLET REQUIRED</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {done && (
            <button className="demo-run-btn reset" onClick={reset}>
              ↺ reset
            </button>
          )}
          <button className="demo-run-btn" onClick={run} disabled={running}>
            {running ? "running…" : done ? "run again" : "▶ run tick"}
          </button>
        </div>
      </div>
      <div className="demo-pipeline">
        {DEMO.steps.map((s, i) => {
          const status = step > i ? "done" : step === i ? "running" : "idle";
          return (
            <div key={i} className={"demo-step " + status}>
              <div className="demo-step-row">
                <span className="demo-step-num">0{i + 1}</span>
                <span className="demo-step-status">
                  {status === "idle" ? "idle" : status === "running" ? "running" : "done"}
                </span>
              </div>
              <div className="demo-step-title">{s.title}</div>
              <div className="demo-step-meta">{status === "idle" ? "—" : s.meta}</div>
            </div>
          );
        })}
      </div>
      <div className="demo-output">
        <div className="demo-pane">
          <div className="demo-pane-head">
            <span>prompt → claude-sonnet-4-6</span>
            <span>{promptVisible ? "3,841 tok" : "—"}</span>
          </div>
          <div className="demo-pane-body">
            {promptVisible ? (
              DEMO.panes.prompt
            ) : (
              <span style={{ color: "var(--ink-faint)" }}>// awaiting tick…</span>
            )}
          </div>
        </div>
        <div className="demo-pane">
          <div className="demo-pane-head">
            <span>tool output → decide_allocation</span>
            <span>{outputVisible ? "612 tok" : "—"}</span>
          </div>
          <div className="demo-pane-body">
            {outputVisible ? (
              DEMO.panes.output
            ) : (
              <span style={{ color: "var(--ink-faint)" }}>// awaiting reasoning…</span>
            )}
          </div>
        </div>
      </div>
      <div className="demo-foot">
        <span>
          {done ? "tx 0x8d3f4a…f607 · audit/2026-04-25T14-02-33Z.json" : "ready · click run tick"}
        </span>
        <span>{done ? "✓ tick complete · 6.2s" : running ? "…" : "idle"}</span>
      </div>
    </div>
  );
}
