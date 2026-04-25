import { formatEther } from "ethers";
import type { CashState } from "../sources/types.js";

export const SYSTEM = `You are an autonomous treasury agent for a small business.
Your job: decide whether to convert part of the company's onchain ETH treasury into USDC (a USD-pegged stablecoin), to lock in dollar value against ETH price swings.
Policy:
- Always keep at least 0.05 ETH on the wallet for gas headroom.
- Only convert to USDC the portion of ETH that exceeds 1.5x monthly burn (in USDC equivalent).
- If the company already has 90 days of burn covered in fiat, prefer holding ETH.
Respond ONLY with valid JSON, no prose, no markdown, no code fences.`;

export interface AgentInputs {
  state: CashState;
  walletAddress: string;
  walletEth: bigint;
}

export function userPrompt(inputs: AgentInputs): string {
  const c = inputs.state.currency;
  return `Company cash state (amounts in ${c}):
- idle: ${inputs.state.cash_idle.toLocaleString()} ${c}
- pending invoices (expected): ${inputs.state.pending_invoices.toLocaleString()} ${c}
- monthly burn: ${inputs.state.monthly_burn.toLocaleString()} ${c}

Onchain treasury (wallet ${inputs.walletAddress} on Sepolia):
- ETH balance: ${formatEther(inputs.walletEth)} ETH

Decide. Return JSON with this exact shape:
{
  "action": "swap_to_stable" | "hold",
  "amount_eth": "0.001",
  "reason": "one short sentence"
}
- If action is "swap_to_stable": amount_eth is the ETH amount to swap to USDC (string, decimal ETH).
- If action is "hold": amount_eth must be "0".`;
}
