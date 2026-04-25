"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "oat-theme";

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
          <span className="brand-mark" />
          <span className="brand-name">
            openagents<span className="dim">-</span>treasury
          </span>
        </a>
        <nav className="topbar-nav">
          <a href="#loop">the loop</a>
          <a href="#why">why</a>
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
