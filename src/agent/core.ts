import Anthropic from "@anthropic-ai/sdk";
import { parseEther } from "ethers";
import { MODEL, NATIVE_ETH, TOKENS, requireEnv } from "../config.js";
import { getBalanceEth, getWallet } from "../chain/client.js";
import { executeSwap, getQuote } from "../dex/uniswap.js";
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
  state: CashState;
  walletAddress: string;
  walletEthBefore: string;
  decision: Decision;
  execution: Execution | null;
  raw_response: string;
};

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  }
  return client;
}

function parseDecision(text: string): Decision {
  const clean = text.replace(/```json\s*|\s*```/g, "").trim();
  return JSON.parse(clean) as Decision;
}

export async function runTick(source: AccountingSource): Promise<Tick> {
  const state = await source.fetch();
  const wallet = getWallet();
  const walletEth = await getBalanceEth(wallet.address);

  const resp = await getClient().messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: userPrompt({ state, walletAddress: wallet.address, walletEth }),
      },
    ],
  });
  const first = resp.content[0];
  if (first.type !== "text") throw new Error(`Unexpected content type: ${first.type}`);

  const decision = parseDecision(first.text);
  let execution: Execution | null = null;

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
    state,
    walletAddress: wallet.address,
    walletEthBefore: walletEth.toString(),
    decision,
    execution,
    raw_response: first.text,
  };
}
