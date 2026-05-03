"use client";

export function RunTickButton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
      <button
        className="primary"
        disabled
        title="Disabled for the demo — use the live terminal below to run a procurement tick."
      >
        Run agent tick · disabled
      </button>
    </div>
  );
}
