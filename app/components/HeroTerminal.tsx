"use client";

import { useEffect, useRef, useState } from "react";
import { TERMINAL_SCRIPT, type TerminalLine } from "../lib/landing-data";

export function HeroTerminal() {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let i = 0;
    function step() {
      if (cancelled) return;
      if (i >= TERMINAL_SCRIPT.length) return;
      const line = TERMINAL_SCRIPT[i];
      setLines((prev) => [...prev, line]);
      const delay = line.t === "section" ? 380 : 240;
      i++;
      setTimeout(step, delay);
    }
    step();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [lines]);

  return (
    <div className="terminal">
      <div className="terminal-head">
        <div className="terminal-head-left">
          <div className="terminal-dots">
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-dot" />
          </div>
          <span>buyer-agent ~ tick</span>
        </div>
        <div className="terminal-status">live</div>
      </div>
      <div className="terminal-body" ref={bodyRef}>
        {lines.map((l, i) => (l ? renderLine(l, i) : null))}
        <div className="term-line">
          <span className="term-cursor" />
        </div>
      </div>
      <div className="terminal-foot">
        <span>signer: 0x13aF…7AC1</span>
        <span>policy: openagents-treasury.eth</span>
      </div>
    </div>
  );
}

function renderLine(l: TerminalLine, i: number) {
  if (l.t === "prompt") {
    return (
      <div key={i} className="term-line">
        <span className="term-prompt">$ </span>
        <span className="term-cmd">{l.text.slice(2)}</span>
      </div>
    );
  }
  if (l.t === "section") {
    return (
      <div key={i} className="term-line term-section">
        {l.text}
      </div>
    );
  }
  if (l.t === "kv") {
    return (
      <div key={i} className="term-line">
        <span className="term-key">{l.k.padEnd(20, " ")}</span>
        <span className="term-faint">: </span>
        <span className="term-val">{l.v}</span>
      </div>
    );
  }
  if (l.t === "ok") {
    return (
      <div key={i} className="term-line term-ok">
        {l.text}
      </div>
    );
  }
  if (l.t === "warn") {
    return (
      <div key={i} className="term-line term-warn">
        {l.text}
      </div>
    );
  }
  return (
    <div key={i} className="term-line term-out">
      {l.text}
    </div>
  );
}
