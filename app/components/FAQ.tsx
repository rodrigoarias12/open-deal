"use client";

import { useState } from "react";
import { FAQS } from "../lib/landing-data";

export function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <div className="faq-list">
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className={"faq-item " + (isOpen ? "open" : "")}>
            <button className="faq-q" onClick={() => setOpen(isOpen ? -1 : i)}>
              <span style={{ display: "flex", alignItems: "baseline" }}>
                <span className="faq-q-num">{String(i + 1).padStart(2, "0")}</span>
                {f.q}
              </span>
              <span className="faq-q-caret">+</span>
            </button>
            {isOpen && <div className="faq-a" dangerouslySetInnerHTML={{ __html: f.a }} />}
          </div>
        );
      })}
    </div>
  );
}
