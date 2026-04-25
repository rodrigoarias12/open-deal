import { getTextRecords } from "./resolver.js";

export interface TreasuryPolicy {
  maxSwapEth: string;
  minBufferEth: string;
  allowedTokens: string[];
  maxDailyVolumeEth: string;
  cooldownSeconds: number;
  source: "ens" | "defaults";
  ensName: string | null;
  raw: Record<string, string | null>;
}

export const DEFAULT_POLICY: Omit<TreasuryPolicy, "source" | "ensName" | "raw"> = {
  maxSwapEth: "0.01",
  minBufferEth: "0.05",
  allowedTokens: ["USDC"],
  maxDailyVolumeEth: "0.05",
  cooldownSeconds: 3600,
};

const KEYS = [
  "treasury.maxSwapEth",
  "treasury.minBufferEth",
  "treasury.allowedTokens",
  "treasury.maxDailyVolumeEth",
  "treasury.cooldownSeconds",
];

export async function loadPolicy(ensName: string | null): Promise<TreasuryPolicy> {
  if (!ensName) {
    return {
      ...DEFAULT_POLICY,
      source: "defaults",
      ensName: null,
      raw: {},
    };
  }
  const raw = await getTextRecords(ensName, KEYS);
  const hasAny = Object.values(raw).some((v) => v !== null && v !== "");
  if (!hasAny) {
    return { ...DEFAULT_POLICY, source: "defaults", ensName, raw };
  }
  return {
    maxSwapEth: raw["treasury.maxSwapEth"] || DEFAULT_POLICY.maxSwapEth,
    minBufferEth: raw["treasury.minBufferEth"] || DEFAULT_POLICY.minBufferEth,
    allowedTokens: parseTokens(raw["treasury.allowedTokens"]) ?? DEFAULT_POLICY.allowedTokens,
    maxDailyVolumeEth:
      raw["treasury.maxDailyVolumeEth"] || DEFAULT_POLICY.maxDailyVolumeEth,
    cooldownSeconds: parseInt(raw["treasury.cooldownSeconds"] || "", 10) ||
      DEFAULT_POLICY.cooldownSeconds,
    source: "ens",
    ensName,
    raw,
  };
}

function parseTokens(value: string | null | undefined): string[] | null {
  if (!value) return null;
  return value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
}
