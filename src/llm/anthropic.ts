import Anthropic from "@anthropic-ai/sdk";
import { MODEL, requireEnv } from "../config";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  }
  return client;
}

export async function ask(prompt: string, maxTokens = 512): Promise<string> {
  const resp = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  const first = resp.content[0];
  if (first.type !== "text") {
    throw new Error(`Unexpected content type: ${first.type}`);
  }
  return first.text;
}
