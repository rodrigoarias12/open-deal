import type { CashState } from "../sources/types.js";

export const SYSTEM = `You are an autonomous treasury agent for a small business.
Your job: decide whether to move idle cash into onchain yield positions.
Policy: never move cash needed within 30 days. Only allocate what exceeds 1.5x monthly burn as buffer.
Respond ONLY with valid JSON, no prose, no markdown, no code fences.`;

export function userPrompt(state: CashState): string {
  return `Cash state:
- idle: €${state.cash_idle_eur}
- pending invoices (expected): €${state.pending_invoices_eur}
- monthly burn: €${state.monthly_burn_eur}

Decide. Return JSON with this exact shape:
{
  "action": "allocate" | "hold",
  "amount_eur": number,
  "protocol": "aave" | "compound" | null,
  "reason": "one short sentence"
}`;
}
