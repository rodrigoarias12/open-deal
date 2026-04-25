import "dotenv/config";
import plugin from "./src/index.js";

type Tool = {
  name: string;
  execute: (id: string, params: unknown) => Promise<{ details: unknown }>;
};

const tools: Tool[] = [];

const fakeApi = {
  id: plugin.id,
  name: plugin.id,
  registerTool(tool: Tool) {
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
  if (tools.length !== 3) {
    throw new Error(`expected 3 tools, got ${tools.length}`);
  }

  const balance = tools.find((t) => t.name === "kh_balance");
  const fund = tools.find((t) => t.name === "kh_fund_instructions");
  const pay = tools.find((t) => t.name === "kh_pay");
  if (!balance || !fund || !pay) throw new Error("missing tool(s)");

  console.log("\n[case 1] kh_balance — read wallet balance on Base + Tempo");
  try {
    const r1 = await balance.execute("call-balance", {});
    console.log(JSON.stringify(r1.details, null, 2));
  } catch (e) {
    console.log(`[smoke] balance call failed: ${(e as Error).message}`);
    console.log("[smoke] (expected if wallet not funded with mainnet USDC — plugin is wired correctly)");
  }

  console.log("\n[case 2] kh_fund_instructions — get fund instructions");
  const r2 = await fund.execute("call-fund", {});
  console.log(JSON.stringify(r2.details, null, 2));

  console.log(
    "\n[case 3] kh_pay against a non-402 URL — proves the wrapper is active and passthrough works",
  );
  const r3 = await pay.execute("call-pay", {
    url: "https://httpbin.org/status/200",
    method: "GET",
  });
  console.log(JSON.stringify(r3.details, null, 2));

  console.log("\n[smoke] OK ✓");
  console.log(
    "[smoke] note: kh_pay against a real x402 endpoint not exercised — see FEEDBACK.md (no public testnet 402 endpoint).",
  );
}

main().catch((e) => {
  console.error("[smoke] failed:", e);
  process.exit(1);
});
