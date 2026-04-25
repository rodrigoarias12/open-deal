import { parseEther } from "ethers";
import { NATIVE_ETH, TOKENS, env } from "../config.js";
import { getBalanceEth, getWallet } from "../chain/client.js";
import { executeSwap, getQuote } from "../dex/uniswap.js";
import { loadPolicy, type TreasuryPolicy } from "../ens/policy.js";
import { llmAsk } from "../llm/client.js";
import type { AccountingSource, CashState } from "../sources/types.js";
import { SYSTEM, userPrompt } from "./prompts.js";

export type Decision = {
  action: "swap_to_stable" | "hold";
  amount_eth: string;
  reason: string;
};

export type Execution = {
  swapTxHash: string;
  amountEth: string;
  amountUsdc: string;
  explorerUrl: string;
};

export type Tick = {
  at: string;
  source: string;
  llmProvider: "anthropic" | "bedrock";
  llmModel: string;
  policy: TreasuryPolicy;
  state: CashState;
  walletAddress: string;
  walletEthBefore: string;
  decision: Decision;
  execution: Execution | null;
  raw_response: string;
};

function parseDecision(text: string): Decision {
  const stripped = text.replace(/```json\s*|\s*```/g, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No JSON object in LLM output: ${stripped.slice(0, 200)}`);
  }
  return JSON.parse(stripped.slice(start, end + 1)) as Decision;
}

function enforcePolicy(
  decision: Decision,
  policy: TreasuryPolicy,
  walletEth: bigint,
): { allowed: boolean; reason?: string } {
  if (decision.action !== "swap_to_stable") return { allowed: true };
  if (!policy.allowedTokens.includes("USDC")) {
    return { allowed: false, reason: "USDC is not in policy.allowedTokens" };
  }
  let requested: bigint;
  try {
    requested = parseEther(decision.amount_eth);
  } catch {
    return { allowed: false, reason: `invalid amount_eth ${decision.amount_eth}` };
  }
  if (requested > parseEther(policy.maxSwapEth)) {
    return { allowed: false, reason: `amount ${decision.amount_eth} > maxSwapEth ${policy.maxSwapEth}` };
  }
  const buffer = parseEther(policy.minBufferEth);
  if (walletEth - requested < buffer) {
    return {
      allowed: false,
      reason: `would breach minBufferEth ${policy.minBufferEth} (wallet ${walletEth} - swap ${requested} < buffer ${buffer})`,
    };
  }
  return { allowed: true };
}

export async function runTick(source: AccountingSource): Promise<Tick> {
  const state = await source.fetch();
  const wallet = getWallet();
  const walletEth = await getBalanceEth(wallet.address);
  const policy = await loadPolicy(env("ENS_NAME") ?? null);

  const answer = await llmAsk({
    system: SYSTEM,
    user: userPrompt({ state, walletAddress: wallet.address, walletEth, policy }),
  });

  let decision = parseDecision(answer.text);
  let execution: Execution | null = null;

  const enforcement = enforcePolicy(decision, policy, walletEth);
  if (!enforcement.allowed) {
    decision = {
      action: "hold",
      amount_eth: "0",
      reason: `policy override: ${enforcement.reason} (LLM said: ${decision.reason})`,
    };
  }

  if (decision.action === "swap_to_stable") {
    const amount = parseEther(decision.amount_eth);
    const quote = await getQuote({
      tokenIn: NATIVE_ETH,
      tokenOut: TOKENS.USDC,
      amount,
      swapper: wallet.address,
    });
    const result = await executeSwap(quote, wallet);
    execution = {
      swapTxHash: result.hash,
      amountEth: decision.amount_eth,
      amountUsdc: (Number(quote.output.amount) / 1e6).toString(),
      explorerUrl: result.explorerUrl,
    };
  }

  return {
    at: new Date().toISOString(),
    source: source.name,
    llmProvider: answer.provider,
    llmModel: answer.model,
    policy,
    state,
    walletAddress: wallet.address,
    walletEthBefore: walletEth.toString(),
    decision,
    execution,
    raw_response: answer.text,
  };
}
