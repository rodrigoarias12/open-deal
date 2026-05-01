import "dotenv/config";

// Builds the Open Deal Watchdog workflow JSON and POSTs it to KeeperHub.
// Idempotent-ish: deletes any existing workflow with the same name before
// re-creating, so re-running the script keeps a single canonical copy.
//
// Usage:
//   KH_API_KEY=kh_... npx tsx scripts/kh-deploy-watchdog.ts
//
// Env:
//   KH_API_KEY (required)  — Bearer key, prefix kh_
//   KH_BASE_URL (optional) — default https://app.keeperhub.com
//   WATCHDOG_BASE (optional) — default https://open-deal.vercel.app
//   WATCHDOG_PUBLIC=true   — set workflow visibility to "public"
//   WATCHDOG_CRON          — default "*/30 * * * *"

const KH_BASE = process.env.KH_BASE_URL || "https://app.keeperhub.com";
const KH_KEY = process.env.KH_API_KEY || process.env.KEEPERHUB_API_KEY;
const APP_BASE = process.env.WATCHDOG_BASE || "https://open-deal.vercel.app";
const PUBLIC = process.env.WATCHDOG_PUBLIC === "true";
const CRON = process.env.WATCHDOG_CRON || "*/30 * * * *";
const NAME = "Open Deal Watchdog — anomaly detection on 0G audit anchors";

if (!KH_KEY) {
  console.error("[kh-deploy] missing KH_API_KEY (or KEEPERHUB_API_KEY) env var");
  process.exit(1);
}

const headers: Record<string, string> = {
  Authorization: `Bearer ${KH_KEY}`,
  "Content-Type": "application/json",
};

// Stable node ids referenced from edges + template variables.
const TRIGGER = "wd-trigger";
const CHECK = "wd-check";
const CONDITION = "wd-condition";
const NOTIFY = "wd-notify";

// Workflow JSON — mirrors the shape returned by GET /api/workflows.
const WORKFLOW = {
  name: NAME,
  description: `Watchdog: every ${CRON} this workflow polls the Open Deal anomaly endpoint, which itself reads the AuditAnchor contract on 0G Galileo, downloads each new audit JSON from 0G Storage, and runs four heuristics (vendor-concentration, llm-degraded, budget-near-cap, pattern-triggered-no-approval). When anomalies are detected, the workflow POSTs to the notify endpoint which fires a Telegram alert.

This is the second-tier audit agent — anyone with a KeeperHub account can fork this workflow, point it at any AuditAnchor contract on 0G, and get the same monitoring without permission. That is the whole point of putting agent decisions on-chain in the first place.

Source code + spec: https://github.com/rodrigoarias12/open-deal`,
  visibility: PUBLIC ? "public" : "private",
  enabled: true,
  workflowType: "automation",
  nodes: [
    {
      id: TRIGGER,
      type: "trigger",
      position: { x: 0, y: 200 },
      data: {
        type: "trigger",
        label: "Every 30 minutes",
        config: {
          triggerType: "Schedule",
          scheduleCron: CRON,
        },
        status: "idle",
        description: `Poll the Open Deal anomaly endpoint on schedule (${CRON}).`,
      },
    },
    {
      id: CHECK,
      type: "action",
      position: { x: 320, y: 200 },
      data: {
        type: "action",
        label: "Check 0G anchors for anomalies",
        config: {
          actionType: "webhook/send",
          webhookMethod: "GET",
          webhookUrl: `${APP_BASE}/api/anomaly/check`,
        },
        status: "idle",
        description:
          "GET against the watchdog endpoint. Internally reads AuditAnchor on 0G Galileo + downloads each new audit JSON from 0G Storage + runs heuristics.",
      },
    },
    {
      id: CONDITION,
      type: "action",
      position: { x: 640, y: 200 },
      data: {
        type: "action",
        label: "Anomalies detected?",
        config: {
          actionType: "Condition",
          condition: `{{@${CHECK}:Check 0G anchors for anomalies.summary.anomalies_detected}} > 0`,
          conditionConfig: {
            group: {
              id: "wd-cond-group",
              logic: "AND",
              rules: [
                {
                  id: "wd-cond-rule-1",
                  operator: ">",
                  leftOperand: `{{@${CHECK}:Check 0G anchors for anomalies.summary.anomalies_detected}}`,
                  rightOperand: "0",
                },
              ],
            },
          },
        },
        status: "idle",
        description: "True branch fires only when at least one anomaly was found.",
      },
    },
    {
      id: NOTIFY,
      type: "action",
      position: { x: 960, y: 160 },
      data: {
        type: "action",
        label: "Telegram alert via Open Deal",
        config: {
          actionType: "webhook/send",
          webhookMethod: "POST",
          webhookUrl: `${APP_BASE}/api/anomaly/notify`,
          webhookBody: `{{@${CHECK}:Check 0G anchors for anomalies}}`,
          webhookHeaders: { "Content-Type": "application/json" },
        },
        status: "idle",
        description:
          "Forward the anomaly payload to the Open Deal notify endpoint, which formats a Markdown message and dispatches a Telegram alert from the server-side bot token (no secrets in this workflow).",
      },
    },
  ],
  edges: [
    {
      id: "wd-edge-1",
      type: "animated",
      source: TRIGGER,
      target: CHECK,
    },
    {
      id: "wd-edge-2",
      type: "animated",
      source: CHECK,
      target: CONDITION,
    },
    {
      id: "wd-edge-3",
      type: "animated",
      source: CONDITION,
      target: NOTIFY,
      sourceHandle: "true",
    },
  ],
};

async function main(): Promise<void> {
  // 1. List existing workflows; delete duplicates by name.
  const listRes = await fetch(`${KH_BASE}/api/workflows`, { headers });
  if (!listRes.ok) {
    console.error(`[kh-deploy] list failed: HTTP ${listRes.status}`);
    console.error(await listRes.text());
    process.exit(1);
  }
  const existing = (await listRes.json()) as Array<{ id: string; name: string }>;
  const stale = existing.filter((w) => w.name === NAME);
  for (const w of stale) {
    console.log(`[kh-deploy] deleting stale workflow id=${w.id}`);
    const del = await fetch(`${KH_BASE}/api/workflows/${w.id}`, {
      method: "DELETE",
      headers,
    });
    if (!del.ok) console.error(`  delete failed: HTTP ${del.status}`, await del.text());
  }

  // 2. Create the new workflow via the import endpoint (the documented
  //    way — POST /api/workflows itself is GET-only). The schema is FLAT:
  //    { version, exportedAt, nodes, edges, integrationBindings, ... }.
  // Schema is BOTH: metadata under `workflow` + nodes/edges/integrationBindings at top level.
  const exportEnvelope = {
    version: 1,
    exportedAt: new Date().toISOString(),
    workflow: {
      name: WORKFLOW.name,
      description: WORKFLOW.description,
      visibility: WORKFLOW.visibility,
      enabled: WORKFLOW.enabled,
      workflowType: WORKFLOW.workflowType,
    },
    nodes: WORKFLOW.nodes,
    edges: WORKFLOW.edges,
    integrationBindings: [],
  };
  console.log(`[kh-deploy] POSTing workflow "${NAME}" via /import (visibility=${WORKFLOW.visibility})…`);
  const createRes = await fetch(`${KH_BASE}/api/workflows/import`, {
    method: "POST",
    headers,
    body: JSON.stringify(exportEnvelope),
  });
  const createBody = await createRes.text();
  if (!createRes.ok) {
    console.error(`[kh-deploy] create failed: HTTP ${createRes.status}`);
    console.error(createBody);
    process.exit(1);
  }
  const created = JSON.parse(createBody) as { id: string; name: string; visibility: string };
  console.log(`[kh-deploy] ✓ created id=${created.id}`);
  console.log(`[kh-deploy]   name: ${created.name}`);
  console.log(`[kh-deploy]   visibility: ${created.visibility}`);

  // 3. Import always lands as { visibility: private, enabled: false }.
  //    Patch to flip both flags so the cron actually fires AND the
  //    workflow is shareable/forkable.
  console.log(`[kh-deploy] PATCHing visibility=${PUBLIC ? "public" : "private"} + enabled=true…`);
  const patchRes = await fetch(`${KH_BASE}/api/workflows/${created.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      visibility: PUBLIC ? "public" : "private",
      enabled: true,
      isListed: PUBLIC,
      // Listed workflows in the marketplace need a JSON Schema describing
      // their inputs. The watchdog takes no caller-provided inputs (it's
      // self-contained — endpoints are baked in), so an empty object schema
      // satisfies the requirement.
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    }),
  });
  if (!patchRes.ok) {
    console.error(`[kh-deploy] patch failed: HTTP ${patchRes.status}`);
    console.error(await patchRes.text());
  } else {
    const patched = (await patchRes.json()) as { visibility: string; enabled: boolean; isListed: boolean };
    console.log(`[kh-deploy]   visibility: ${patched.visibility}`);
    console.log(`[kh-deploy]   enabled:    ${patched.enabled}`);
    console.log(`[kh-deploy]   isListed:   ${patched.isListed}`);
  }
  console.log(`[kh-deploy]   dashboard:  ${KH_BASE}/workflows/${created.id}`);
}

main().catch((e) => {
  console.error("[kh-deploy] failed:", e);
  process.exit(1);
});
