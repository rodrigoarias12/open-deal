import "dotenv/config";
import { formatEther } from "ethers";
import { CHAIN, env, llmProvider } from "./config";
import { getBalanceEth, getBlockNumber, getWallet } from "./chain/client";
import { runTick } from "./agent/core";
import { CsvSource } from "./sources/csv";
import { OdooClient, OdooSource } from "./sources/odoo";
import { logTick } from "./audit/logger";
import type { AccountingSource } from "./sources/types";

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
  const provider = llmProvider();
  if (provider === "anthropic" && !env("ANTHROPIC_API_KEY")) {
    console.log("\n[agent] no LLM credentials (set ANTHROPIC_API_KEY or AWS_REGION) — skipping agent tick");
    return;
  }
  console.log(`\n[agent] llm provider: ${provider}`);
  const source = pickSource();
  try {
    const tick = await runTick(source);
    console.log(`[agent] llm: ${tick.llmProvider} ${tick.llmModel}`);
    console.log(
      `[agent] policy: ${tick.policy.source}` +
        (tick.policy.ensName ? ` (${tick.policy.ensName})` : "") +
        ` — maxSwap ${tick.policy.maxSwapEth} ETH, minBuffer ${tick.policy.minBufferEth} ETH`,
    );
    if (tick.decision.action === "swap_to_stable") {
      console.log(`[agent] decision: swap ${tick.decision.amount_eth} ETH → USDC`);
    } else {
      console.log(`[agent] decision: hold`);
    }
    console.log(`[agent] reason: ${tick.decision.reason}`);
    if (tick.execution) {
      console.log(`[agent] tx: ${tick.execution.swapTxHash}`);
      console.log(`[agent] received: ~${tick.execution.amountUsdc} USDC`);
      console.log(`[agent] explorer: ${tick.execution.explorerUrl}`);
    }
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
