"use client";

import { useState } from "react";
import { LOOP } from "../lib/landing-data";

function highlightJson(code: string): string {
  return code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/("(?:\\.|[^"\\])*")(\s*:)/g, '<span class="j-key">$1</span><span class="j-punct">$2</span>')
    .replace(/: ("(?:\\.|[^"\\])*")/g, ': <span class="j-str">$1</span>')
    .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="j-num">$1</span>')
    .replace(/\b(true|false)\b/g, '<span class="j-bool">$1</span>')
    .replace(/\bnull\b/g, '<span class="j-null">null</span>');
}

export function Loop() {
  const [active, setActive] = useState(0);
  const node = LOOP[active];
  return (
    <div>
      <div className="loop">
        {LOOP.map((n, i) => (
          <button
            key={i}
            className={"loop-node " + (i === active ? "active" : "")}
            onClick={() => setActive(i)}
          >
            <div className="loop-num">{n.num}</div>
            <div className="loop-icon">{n.icon}</div>
            <div className="loop-title">{n.title}</div>
            <div className="loop-desc">{n.desc}</div>
            <div className="loop-tag">{n.tag}</div>
            <div className="loop-arrow" />
          </button>
        ))}
      </div>
      <div className="loop-payload">
        <div className="loop-payload-meta">
          <div>
            <div className="loop-payload-label">Step</div>
            <div className="loop-payload-value">
              {node.num} · {node.title}
            </div>
          </div>
          <div>
            <div className="loop-payload-label">Call</div>
            <div className="loop-payload-value" style={{ fontSize: 11 }}>
              {node.payload.label}
            </div>
          </div>
          {node.payload.meta.map(([k, v], i) => (
            <div key={i}>
              <div className="loop-payload-label">{k}</div>
              <div className="loop-payload-value" style={{ fontSize: 11 }}>
                {v}
              </div>
            </div>
          ))}
        </div>
        <pre
          className="loop-payload-code"
          dangerouslySetInnerHTML={{ __html: highlightJson(node.payload.code) }}
        />
      </div>
    </div>
  );
}
