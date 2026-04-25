import "dotenv/config";
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
  if (typeof plugin.register === "function") {
    plugin.register(fakeApi as never);
  }
  if (tools.length === 0) {
    throw new Error("plugin registered no tools");
  }
  const tool = tools.find((t) => t.name === "treasury_policy_check");
  if (!tool) throw new Error("treasury_policy_check tool not registered");

  console.log(`\n[case 1] swap under cap, allowed token`);
  const r1 = await tool.execute("call-1", {
    action: "swap_to_stable",
    amount_eth: "0.005",
    token: "USDC",
    wallet_eth: "0.2",
    ens_name: process.env.ENS_NAME || null,
  });
  console.log(JSON.stringify(r1, null, 2));

  console.log(`\n[case 2] swap above maxSwapEth — should reject`);
  const r2 = await tool.execute("call-2", {
    action: "swap_to_stable",
    amount_eth: "5",
    token: "USDC",
    wallet_eth: "10",
    ens_name: process.env.ENS_NAME || null,
  });
  console.log(JSON.stringify(r2, null, 2));

  console.log(`\n[case 3] swap into disallowed token — should reject`);
  const r3 = await tool.execute("call-3", {
    action: "swap_to_stable",
    amount_eth: "0.005",
    token: "DAI",
    wallet_eth: "0.2",
    ens_name: process.env.ENS_NAME || null,
  });
  console.log(JSON.stringify(r3, null, 2));

  console.log(`\n[case 4] carrier payment when allowlist empty — allowed (loose policy)`);
  const r4 = await tool.execute("call-4", {
    action: "pay_carrier",
    carrier_id: "0x000000000000000000000000000000000000dead",
    amount_usd: "340",
    ens_name: process.env.ENS_NAME || null,
  });
  console.log(JSON.stringify(r4, null, 2));

  console.log("\n[smoke] OK ✓");
}

main().catch((e) => {
  console.error("[smoke] failed:", e);
  process.exit(1);
});
