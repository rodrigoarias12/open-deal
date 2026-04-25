"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RunTickButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/tick", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
      <button className="primary" onClick={onClick} disabled={running || pending}>
        {running ? "Running tick…" : pending ? "Refreshing…" : "Run agent tick"}
      </button>
      {error && <div className="error" style={{ marginBottom: 0, marginTop: 8 }}>tick failed: {error}</div>}
    </div>
  );
}
