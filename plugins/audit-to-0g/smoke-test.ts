import "dotenv/config";
import { readFile } from "node:fs/promises";
import plugin from "./src/index.js";

const tools: { name: string; execute: (id: string, params: unknown) => Promise<unknown> }[] = [];

const fakeApi = {
  id: plugin.id,
  name: plugin.name,
  registerTool(tool: { name: string; execute: (id: string, params: unknown) => Promise<unknown> }) {
    tools.push(tool);
    console.log(`[smoke] registered tool: ${tool.name}`);
  },
  registerHook() {},
  registerHttpRoute() {},
  registerService() {},
  config: {},
  logger: { info: console.log, warn: console.warn, error: console.error },
};

async function main(): Promise<void> {
  if (!process.env.ZG_AUDIT_ANCHOR) {
    const anchorJson = JSON.parse(
      await readFile("contracts/AuditAnchor.deployment.json", "utf8"),
    );
    process.env.ZG_AUDIT_ANCHOR = anchorJson.address;
    console.log(`[smoke] using deployed anchor: ${anchorJson.address}`);
  }

  if (typeof plugin.register === "function") {
    plugin.register(fakeApi as never);
  }
  const tool = tools.find((t) => t.name === "record_audit");
  if (!tool) throw new Error("record_audit tool not registered");

  const sampleRecord = {
    at: new Date().toISOString(),
    case: "openclaw-plugin-smoke",
    decision: {
      action: "swap_to_stable",
      amount_eth: "0.005",
      reason: "idle USDC pre-funding for upcoming carrier payouts",
    },
    policy: {
      source: "ens",
      ensName: "openagents.eth",
      maxSwapEth: "0.01",
      allowedTokens: ["USDC"],
      minBufferEth: "0.05",
    },
    execution: {
      swapTxHash: "0xfakeswaphash",
      amountUsdc: "12.34",
    },
  };

  console.log("\n[case 1] record_audit with policy hash auto-derived");
  const r1 = await tool.execute("call-1", { record: sampleRecord });
  console.log(JSON.stringify(r1, null, 2));

  console.log("\n[smoke] OK ✓");
}

main().catch((e) => {
  console.error("[smoke] failed:", e);
  process.exit(1);
});
