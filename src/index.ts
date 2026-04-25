import "dotenv/config";
import { formatEther } from "ethers";
import { CHAIN, env } from "./config.js";
import { getBalanceEth, getBlockNumber, getWallet } from "./chain/client.js";
import { runTick } from "./agent/core.js";
import { CsvSource } from "./sources/csv.js";
import { OdooClient, OdooSource } from "./sources/odoo.js";
import { logTick } from "./audit/logger.js";
import type { AccountingSource } from "./sources/types.js";

async function checkChain(): Promise<void> {
  console.log(`\n[chain] ${CHAIN.name} (id ${CHAIN.id}) via ${CHAIN.rpc}`);
  try {
    const block = await getBlockNumber();
    console.log(`[chain] latest block: ${block}`);
  } catch (e) {
    console.log(`[chain] RPC unreachable: ${(e as Error).message}`);
    return;
  }
  if (!env("AGENT_PRIVATE_KEY")) {
    console.log("[chain] AGENT_PRIVATE_KEY not set — run scripts/generate-wallet.ts");
    return;
  }
  const wallet = getWallet();
  const balance = await getBalanceEth(wallet.address);
  console.log(`[chain] wallet: ${wallet.address}`);
  console.log(`[chain] balance: ${formatEther(balance)} ETH`);
  if (balance === 0n) {
    console.log("[chain] wallet not funded — visit https://sepolia-faucet.pk910.de");
  }
}

function pickSource(): AccountingSource {
  if (
    env("ODOO_URL") &&
    env("ODOO_DB") &&
    env("ODOO_USERNAME") &&
    env("ODOO_PASSWORD")
  ) {
    console.log("[agent] using Odoo source");
    return new OdooSource(
      new OdooClient({
        url: env("ODOO_URL")!,
        db: env("ODOO_DB")!,
        username: env("ODOO_USERNAME")!,
        password: env("ODOO_PASSWORD")!,
      }),
    );
  }
  console.log("[agent] using CSV source (fixtures/company.csv)");
  return new CsvSource("fixtures/company.csv");
}

async function runAgentOnce(): Promise<void> {
  if (!env("ANTHROPIC_API_KEY")) {
    console.log("\n[agent] ANTHROPIC_API_KEY not set — skipping agent tick");
    return;
  }
  console.log("");
  const source = pickSource();
  try {
    const tick = await runTick(source);
    console.log(`[agent] decision: ${tick.decision.action} ${tick.decision.amount.toLocaleString()} ${tick.decision.currency}` +
      (tick.decision.protocol ? ` @ ${tick.decision.protocol}` : ""));
    console.log(`[agent] reason: ${tick.decision.reason}`);
    const path = await logTick(tick);
    console.log(`[agent] audit written: ${path}`);
  } catch (e) {
    console.log(`[agent] error: ${(e as Error).message}`);
  }
}

async function main(): Promise<void> {
  console.log("openagents-treasury — smoke test + agent tick");
  await checkChain();
  await runAgentOnce();
  console.log("\ndone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
