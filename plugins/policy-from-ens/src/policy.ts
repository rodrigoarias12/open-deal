import { JsonRpcProvider } from "ethers";

export interface TreasuryPolicy {
  maxSwapEth: string;
  minBufferEth: string;
  allowedTokens: string[];
  maxDailyVolumeEth: string;
  cooldownSeconds: number;
  carriers: string[];
  maxPerCarrierUsd: string;
  source: "ens" | "defaults";
  ensName: string | null;
  raw: Record<string, string | null>;
}

const DEFAULTS = {
  maxSwapEth: "0.01",
  minBufferEth: "0.05",
  allowedTokens: ["USDC"],
  maxDailyVolumeEth: "0.05",
  cooldownSeconds: 3600,
  carriers: [] as string[],
  maxPerCarrierUsd: "1000",
};

const KEYS = [
  "treasury.maxSwapEth",
  "treasury.minBufferEth",
  "treasury.allowedTokens",
  "treasury.maxDailyVolumeEth",
  "treasury.cooldownSeconds",
  "treasury.carriers",
  "treasury.maxPerCarrierUsd",
];

let providerCache: { url: string; provider: JsonRpcProvider } | null = null;
function provider(rpc?: string): JsonRpcProvider {
  const url = rpc || "https://ethereum-rpc.publicnode.com";
  if (providerCache && providerCache.url === url) return providerCache.provider;
  // No second arg → ethers auto-detects the chain. Works for mainnet,
  // Sepolia, or any EVM chain that has the canonical ENS contracts deployed
  // at the same registry address (ENS uses 0x00…2e1e cross-chain).
  providerCache = { url, provider: new JsonRpcProvider(url) };
  return providerCache.provider;
}

export async function loadPolicy(
  ensName: string | null,
  rpc?: string,
): Promise<TreasuryPolicy> {
  if (!ensName) {
    return { ...DEFAULTS, source: "defaults", ensName: null, raw: {} };
  }
  const resolver = await provider(rpc).getResolver(ensName);
  if (!resolver) {
    return { ...DEFAULTS, source: "defaults", ensName, raw: {} };
  }
  const entries = await Promise.all(
    KEYS.map(async (k) => [k, await resolver.getText(k)] as const),
  );
  const raw = Object.fromEntries(entries);
  const hasAny = Object.values(raw).some((v) => v !== null && v !== "");
  if (!hasAny) {
    return { ...DEFAULTS, source: "defaults", ensName, raw };
  }
  return {
    maxSwapEth: raw["treasury.maxSwapEth"] || DEFAULTS.maxSwapEth,
    minBufferEth: raw["treasury.minBufferEth"] || DEFAULTS.minBufferEth,
    allowedTokens:
      parseList(raw["treasury.allowedTokens"])?.map((s) => s.toUpperCase()) ??
      DEFAULTS.allowedTokens,
    maxDailyVolumeEth:
      raw["treasury.maxDailyVolumeEth"] || DEFAULTS.maxDailyVolumeEth,
    cooldownSeconds:
      parseInt(raw["treasury.cooldownSeconds"] || "", 10) || DEFAULTS.cooldownSeconds,
    carriers:
      parseList(raw["treasury.carriers"])?.map((s) => s.toLowerCase()) ??
      DEFAULTS.carriers,
    maxPerCarrierUsd:
      raw["treasury.maxPerCarrierUsd"] || DEFAULTS.maxPerCarrierUsd,
    source: "ens",
    ensName,
    raw,
  };
}

function parseList(value: string | null | undefined): string[] | null {
  if (!value) return null;
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export type PolicyCheckInput =
  | { action: "swap_to_stable"; amount_eth: string; token: string; wallet_eth: string }
  | { action: "pay_carrier"; carrier_id: string; amount_usd: string };

export type PolicyCheckResult = {
  allowed: boolean;
  reason: string | null;
  policy: TreasuryPolicy;
};

export function enforcePolicy(
  input: PolicyCheckInput,
  policy: TreasuryPolicy,
): PolicyCheckResult {
  if (input.action === "swap_to_stable") {
    const amount = parseFloat(input.amount_eth);
    const wallet = parseFloat(input.wallet_eth);
    const max = parseFloat(policy.maxSwapEth);
    const buffer = parseFloat(policy.minBufferEth);
    if (!policy.allowedTokens.includes(input.token.toUpperCase())) {
      return reject(policy, `${input.token} not in policy.allowedTokens`);
    }
    if (amount > max) {
      return reject(policy, `${amount} ETH > maxSwapEth ${max} ETH`);
    }
    if (wallet - amount < buffer) {
      return reject(
        policy,
        `would breach minBufferEth ${buffer} (wallet ${wallet} - swap ${amount} < buffer)`,
      );
    }
    return ok(policy);
  }
  if (input.action === "pay_carrier") {
    const amountUsd = parseFloat(input.amount_usd);
    const max = parseFloat(policy.maxPerCarrierUsd);
    if (
      policy.carriers.length > 0 &&
      !policy.carriers.includes(input.carrier_id.toLowerCase())
    ) {
      return reject(policy, `carrier ${input.carrier_id} not in policy.carriers allowlist`);
    }
    if (amountUsd > max) {
      return reject(policy, `${amountUsd} USD > maxPerCarrierUsd ${max} USD`);
    }
    return ok(policy);
  }
  return reject(policy, `unknown action: ${(input as { action: string }).action}`);
}

function ok(policy: TreasuryPolicy): PolicyCheckResult {
  return { allowed: true, reason: null, policy };
}

function reject(policy: TreasuryPolicy, reason: string): PolicyCheckResult {
  return { allowed: false, reason, policy };
}
