import "dotenv/config";
import { formatEther } from "ethers";
import { CHAIN, env } from "./config.js";
import { getBalanceEth, getBlockNumber, getWallet } from "./chain/client.js";
import { ask } from "./llm/anthropic.js";

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

async function checkLlm(): Promise<void> {
  if (!env("ANTHROPIC_API_KEY")) {
    console.log("\n[llm] ANTHROPIC_API_KEY not set — skipping");
    return;
  }
  console.log("\n[llm] pinging Claude...");
  try {
    const answer = await ask(
      "Reply in exactly one short sentence: what's an autonomous treasury agent?"
    );
    console.log(`[llm] ${answer}`);
  } catch (e) {
    console.log(`[llm] error: ${(e as Error).message}`);
  }
}

async function main(): Promise<void> {
  console.log("openagents-treasury — smoke test");
  await checkChain();
  await checkLlm();
  console.log("\ndone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
