"use client";

import { useState } from "react";
import { AUDIT_FIXTURES } from "../lib/landing-data";

export function AuditList() {
  const [open, setOpen] = useState(0);
  return (
    <div className="audit-list">
      {AUDIT_FIXTURES.map((a, i) => {
        const isOpen = open === i;
        const broadcast = !!a.decision.swap;
        return (
          <div key={i} className={"audit-item " + (isOpen ? "open" : "")}>
            <button
              className="audit-item-head"
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              <span className="audit-item-time">{a.ts}</span>
              <span className="audit-item-decision">
                {a.decision.swap ? (
                  <>
                    <span className="em">swap</span> {a.decision.swap} → {a.decision.to}
                  </>
                ) : (
                  <>
                    <span className="pol">hold</span> {a.decision.hold}
                  </>
                )}
              </span>
              <span className="audit-item-tx">{a.tx}</span>
              <span className={"audit-item-status " + (broadcast ? "" : "blocked")}>
                {broadcast ? "broadcast" : "blocked"}
              </span>
              <span className="audit-item-caret">›</span>
            </button>
            {isOpen && (
              <div className="audit-item-body">
                <div className="audit-block">
                  <div className="audit-block-label">prompt → claude</div>
                  <div className="audit-block-content">{a.prompt}</div>
                </div>
                <div className="audit-block">
                  <div className="audit-block-label">model output</div>
                  <div className="audit-block-content">{a.output}</div>
                </div>
                <div className="audit-block" style={{ gridColumn: "1 / -1" }}>
                  <div className="audit-block-label">policy snapshot at decision</div>
                  <div className="audit-block-content">{a.policy}</div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
