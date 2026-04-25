import { Type } from "typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/core";
import {
  paymentSigner,
  checkBalance,
  fund,
  readWalletConfig,
} from "@keeperhub/wallet";

function jsonResult(payload: unknown): {
  type: "tool_result";
  toolResultMessage: { content: { type: "text"; text: string }[] };
  details: unknown;
} {
  return {
    type: "tool_result",
    toolResultMessage: {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    },
    details: payload,
  };
}

const PaySchema = Type.Object(
  {
    url: Type.String({ description: "Target URL. If it returns 402, KeeperHub auto-pays via x402/MPP and replays the request." }),
    method: Type.Optional(
      Type.String({
        description: "HTTP method. Defaults to GET. Use POST for paid actions that require a body.",
      }),
    ),
    body: Type.Optional(
      Type.String({
        description: "Request body (already JSON-encoded if applicable). Forwarded both on initial request and on the post-payment retry.",
      }),
    ),
    content_type: Type.Optional(
      Type.String({ description: "Content-Type header for the body. Defaults to application/json when body is set." }),
    ),
    extra_headers: Type.Optional(
      Type.Record(Type.String(), Type.String(), {
        description: "Extra headers to forward (e.g. Authorization for the underlying service).",
      }),
    ),
  },
  { additionalProperties: false },
);

function buildPayTool() {
  return {
    name: "kh_pay",
    label: "KeeperHub x402 Pay",
    description:
      "Calls a paid HTTP service. If the service returns HTTP 402 (x402 or MPP), the agent's KeeperHub wallet auto-pays the challenge and the request is replayed transparently. Use this whenever the agent needs to access paid data, oracles, sanctions checks, logistics quotes, or any other x402-gated API as part of its decision-making — no human approval required for amounts under the wallet's policy cap.",
    parameters: PaySchema,
    execute: async (
      _toolCallId: string,
      rawParams: unknown,
    ): Promise<ReturnType<typeof jsonResult>> => {
      const p = (rawParams ?? {}) as {
        url: string;
        method?: string;
        body?: string;
        content_type?: string;
        extra_headers?: Record<string, string>;
      };
      if (!p.url) throw new Error("kh_pay: url is required");
      const method = (p.method ?? "GET").toUpperCase();
      const headers: Record<string, string> = { ...(p.extra_headers ?? {}) };
      if (p.body && !headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = p.content_type ?? "application/json";
      }
      const init: RequestInit = { method, headers };
      if (p.body !== undefined) init.body = p.body;

      const start = Date.now();
      const resp = await paymentSigner.fetch(p.url, init);
      const took = Date.now() - start;

      const text = await resp.text();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
      return jsonResult({
        ok: resp.ok,
        status: resp.status,
        url: p.url,
        method,
        took_ms: took,
        body: parsed,
        note:
          resp.status === 402
            ? "KeeperHub did not auto-pay (provider returned 402 after retry)."
            : "If the original response was 402, the body above reflects the post-payment retry.",
      });
    },
  };
}

function buildBalanceTool() {
  return {
    name: "kh_balance",
    label: "KeeperHub Wallet Balance",
    description:
      "Reads the agent's KeeperHub wallet balance across Base + Tempo (USDC + USDC.e). Use before initiating an x402 paid call to confirm the wallet has runway, or to surface low-balance warnings to the operator.",
    parameters: Type.Object({}, { additionalProperties: false }),
    execute: async (): Promise<ReturnType<typeof jsonResult>> => {
      const wallet = await readWalletConfig();
      const snap = await checkBalance(wallet);
      return jsonResult({
        walletAddress: wallet.walletAddress,
        base: snap.base,
        tempo: snap.tempo,
      });
    },
  };
}

function buildFundTool() {
  return {
    name: "kh_fund_instructions",
    label: "KeeperHub Fund Instructions",
    description:
      "Returns instructions for a human operator to fund the agent's KeeperHub wallet (Coinbase Onramp deeplink + Tempo deposit address). Call this when the wallet balance is too low for the next planned x402 call.",
    parameters: Type.Object({}, { additionalProperties: false }),
    execute: async (): Promise<ReturnType<typeof jsonResult>> => {
      const wallet = await readWalletConfig();
      const f = fund(wallet.walletAddress);
      return jsonResult({
        walletAddress: wallet.walletAddress,
        coinbaseOnrampUrl: f.coinbaseOnrampUrl,
        tempoAddress: f.tempoAddress,
        disclaimer: f.disclaimer,
      });
    },
  };
}

export default definePluginEntry({
  id: "keeperhub-rail",
  name: "KeeperHub x402 Rail",
  description:
    "OpenClaw plugin: autonomous x402 payment rail. Any agent tool call to a paid endpoint auto-pays via the KeeperHub agentic wallet (Base + Tempo). Three tools: kh_pay, kh_balance, kh_fund_instructions.",
  register(api) {
    api.registerTool(buildPayTool() as never);
    api.registerTool(buildBalanceTool() as never);
    api.registerTool(buildFundTool() as never);
  },
});
