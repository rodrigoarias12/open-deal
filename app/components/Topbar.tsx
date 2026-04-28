"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "agentic-erp-theme";

export function Topbar() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) as
      | "light"
      | "dark"
      | null;
    if (saved === "light" || saved === "dark") setTheme(saved);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, mounted]);

  function toggle() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  return (
    <div className="topbar">
      <div className="container topbar-inner">
        <a href="#" className="brand">
          <img
            src="/logo.png"
            alt="Open Deal"
            width={36}
            height={36}
            style={{ display: "block" }}
          />
          <span className="brand-name">
            open<span className="dim"> </span>deal
          </span>
        </a>
        <nav className="topbar-nav">
          <a href="#precedent">precedent</a>
          <a href="#loop">the loop</a>
          <a href="#framework">framework</a>
          <a href="#settlement">settlement</a>
          <a href="#demo">demo</a>
          <a href="#audit">audit</a>
          <a href="#faq">faq</a>
        </nav>
        <div className="topbar-cta">
          <button className="theme-toggle" onClick={toggle} aria-label="toggle theme">
            {theme === "dark" ? "☾" : "☀"}
          </button>
          <a className="btn" href="/dashboard">
            dashboard ↗
          </a>
        </div>
      </div>
    </div>
  );
}
