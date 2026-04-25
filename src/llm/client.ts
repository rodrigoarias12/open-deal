import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import { BEDROCK_MODEL, MODEL, llmProvider, requireEnv } from "../config.js";

export interface LlmAskParams {
  system: string;
  user: string;
  maxTokens?: number;
  prefill?: string;
}

export interface LlmAnswer {
  text: string;
  provider: "anthropic" | "bedrock";
  model: string;
}

let cached: Anthropic | AnthropicBedrock | null = null;
let cachedProvider: "anthropic" | "bedrock" | null = null;

function getClient(): { client: Anthropic | AnthropicBedrock; provider: "anthropic" | "bedrock"; model: string } {
  const provider = llmProvider();
  if (cached && cachedProvider === provider) {
    return { client: cached, provider, model: provider === "bedrock" ? BEDROCK_MODEL : MODEL };
  }
  if (provider === "bedrock") {
    cached = new AnthropicBedrock({
      awsRegion: process.env.AWS_REGION ?? "us-east-1",
    });
  } else {
    cached = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  }
  cachedProvider = provider;
  return { client: cached, provider, model: provider === "bedrock" ? BEDROCK_MODEL : MODEL };
}

export async function llmAsk(params: LlmAskParams): Promise<LlmAnswer> {
  const { client, provider, model } = getClient();
  const messages: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: params.user },
  ];
  if (params.prefill) messages.push({ role: "assistant", content: params.prefill });

  const resp = await client.messages.create({
    model,
    max_tokens: params.maxTokens ?? 512,
    system: params.system,
    messages,
  });
  const first = resp.content[0];
  if (first.type !== "text") {
    throw new Error(`Unexpected content type: ${first.type}`);
  }
  const text = params.prefill ? params.prefill + first.text : first.text;
  return { text, provider, model };
}
