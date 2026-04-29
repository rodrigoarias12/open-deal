import { Type } from "typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/core";
import {
  enforcePolicy,
  loadPolicy,
  type PolicyCheckInput,
} from "./policy";

const PolicyCheckSchema = Type.Object(
  {
    action: Type.Union(
      [
        Type.Literal("swap_to_stable"),
        Type.Literal("pay_carrier"),
      ],
      {
        description:
          "The onchain action the agent is about to take. Must be checked against policy before broadcast.",
      },
    ),
    amount_eth: Type.Optional(
      Type.String({
        description:
          "Required when action='swap_to_stable'. ETH amount to swap, decimal string (e.g. '0.05').",
      }),
    ),
    token: Type.Optional(
      Type.String({
        description:
          "Required when action='swap_to_stable'. Output token symbol (e.g. 'USDC').",
      }),
    ),
    wallet_eth: Type.Optional(
      Type.String({
        description:
          "Required when action='swap_to_stable'. Current ETH balance of the agent wallet, decimal string.",
      }),
    ),
    carrier_id: Type.Optional(
      Type.String({
        description:
          "Required when action='pay_carrier'. Carrier wallet address or ENS name.",
      }),
    ),
    amount_usd: Type.Optional(
      Type.String({
        description:
          "Required when action='pay_carrier'. USD amount to pay, decimal string.",
      }),
    ),
    ens_name: Type.Optional(
      Type.String({
        description:
          "ENS name that holds the policy text records. If omitted, uses POLICY_ENS_NAME env or defaults.",
      }),
    ),
    rpc_url: Type.Optional(
      Type.String({
        description:
          "Mainnet RPC URL for ENS resolution. Defaults to a public node.",
      }),
    ),
  },
  { additionalProperties: false },
);

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

function buildPolicyCheckTool() {
  return {
    name: "treasury_policy_check",
    label: "Treasury Policy Check",
    description:
      "Checks a proposed onchain action against a treasury policy stored in ENS text records. Returns allowed:true|false with a reason and the policy snapshot used. The agent MUST call this before any onchain swap, transfer, or vendor payment, and MUST NOT proceed if allowed:false.",
    parameters: PolicyCheckSchema,
    execute: async (
      _toolCallId: string,
      rawParams: unknown,
    ): Promise<ReturnType<typeof jsonResult>> => {
      const params = (rawParams ?? {}) as Record<string, string | undefined>;
      const ensName = params.ens_name || process.env.POLICY_ENS_NAME || null;
      const rpc = params.rpc_url || process.env.MAINNET_RPC_URL || undefined;

      const policy = await loadPolicy(ensName, rpc);

      let input: PolicyCheckInput;
      if (params.action === "swap_to_stable") {
        if (!params.amount_eth || !params.token || !params.wallet_eth) {
          throw new Error(
            "swap_to_stable requires amount_eth, token, wallet_eth",
          );
        }
        input = {
          action: "swap_to_stable",
          amount_eth: params.amount_eth,
          token: params.token,
          wallet_eth: params.wallet_eth,
        };
      } else if (params.action === "pay_carrier") {
        if (!params.carrier_id || !params.amount_usd) {
          throw new Error("pay_carrier requires carrier_id, amount_usd");
        }
        input = {
          action: "pay_carrier",
          carrier_id: params.carrier_id,
          amount_usd: params.amount_usd,
        };
      } else {
        throw new Error(`unknown action: ${params.action}`);
      }

      const result = enforcePolicy(input, policy);
      return jsonResult({
        allowed: result.allowed,
        reason: result.reason,
        policy: {
          source: result.policy.source,
          ensName: result.policy.ensName,
          maxSwapEth: result.policy.maxSwapEth,
          minBufferEth: result.policy.minBufferEth,
          allowedTokens: result.policy.allowedTokens,
          maxDailyVolumeEth: result.policy.maxDailyVolumeEth,
          carriers: result.policy.carriers,
          maxPerCarrierUsd: result.policy.maxPerCarrierUsd,
        },
      });
    },
  };
}

export default definePluginEntry({
  id: "policy-from-ens",
  name: "Policy from ENS",
  description:
    "Gates onchain agent actions against treasury policy stored as ENS text records. Provides a treasury_policy_check tool the agent calls before broadcast.",
  register(api) {
    api.registerTool(buildPolicyCheckTool() as never);
  },
});
