import { formatEther } from "ethers";
import type { TreasuryPolicy } from "../ens/policy.js";
import type { CashState } from "../sources/types.js";

export const SYSTEM = `You are an autonomous treasury agent for a small business.
Your job: decide whether to convert part of the company's onchain ETH treasury into USDC (a USD-pegged stablecoin), to lock in dollar value against ETH price swings.

You operate under a Treasury Policy supplied with each tick. The policy is the law:
- NEVER produce a swap that would leave the wallet below minBufferEth.
- NEVER produce a swap larger than maxSwapEth.
- The destination token must be in allowedTokens; if USDC is not in allowedTokens, hold.
- Conservative bias: if uncertain, hold.

Respond ONLY with valid JSON, no prose, no markdown, no code fences.`;

export interface AgentInputs {
  state: CashState;
  walletAddress: string;
  walletEth: bigint;
  policy: TreasuryPolicy;
}

export function userPrompt(inputs: AgentInputs): string {
  const c = inputs.state.currency;
  const p = inputs.policy;
  const policySource = p.source === "ens"
    ? `loaded from ENS '${p.ensName}' text records`
    : `defaults (no ENS policy configured)`;

  return `Treasury Policy (${policySource}):
- maxSwapEth: ${p.maxSwapEth} ETH
- minBufferEth: ${p.minBufferEth} ETH
- allowedTokens: ${p.allowedTokens.join(", ")}
- maxDailyVolumeEth: ${p.maxDailyVolumeEth} ETH
- cooldownSeconds: ${p.cooldownSeconds}

Company cash state (amounts in ${c}):
- idle: ${inputs.state.cash_idle.toLocaleString()} ${c}
- pending invoices (expected): ${inputs.state.pending_invoices.toLocaleString()} ${c}
- monthly burn: ${inputs.state.monthly_burn.toLocaleString()} ${c}

Onchain treasury (wallet ${inputs.walletAddress} on Sepolia):
- ETH balance: ${formatEther(inputs.walletEth)} ETH

Decide. Return JSON with this exact shape:
{
  "action": "swap_to_stable" | "hold",
  "amount_eth": "0.001",
  "reason": "one short sentence (mention which policy bound, if any, was the deciding factor)"
}
- If action is "swap_to_stable": amount_eth is the ETH amount to swap to USDC (string, decimal ETH). Must be <= maxSwapEth and must leave at least minBufferEth on the wallet.
- If action is "hold": amount_eth must be "0".`;
}
