import Anthropic from "@anthropic-ai/sdk";
import { MODEL, requireEnv } from "../config.js";
import type { AccountingSource, CashState } from "../sources/types.js";
import { SYSTEM, userPrompt } from "./prompts.js";

export type Decision = {
  action: "allocate" | "hold";
  amount: number;
  currency: string;
  protocol: "aave" | "compound" | null;
  reason: string;
};

export type Tick = {
  at: string;
  source: string;
  state: CashState;
  decision: Decision;
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
  const resp = await getClient().messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt(state) }],
  });
  const first = resp.content[0];
  if (first.type !== "text") {
    throw new Error(`Unexpected content type: ${first.type}`);
  }
  const decision = parseDecision(first.text);
  return {
    at: new Date().toISOString(),
    source: source.name,
    state,
    decision,
    raw_response: first.text,
  };
}
