import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { formatEther } from "ethers";
import { CHAIN, env, llmProvider } from "../../src/config";
import { getBalanceEth, getWallet } from "../../src/chain/client";
import { loadPolicy, type TreasuryPolicy } from "../../src/ens/policy";
import type { Tick } from "../../src/agent/core";
import { loadOnchainActivity, type OnchainActivity } from "./onchain-activity";

export interface DashboardState {
  chain: { name: string; explorer: string };
  llm: { provider: string };
  agentWallet: { address: string; ethBalance: string };
  keeperhubWallet: { address: string; baseUsdc: string; tempoUsdc: string } | null;
  policy: TreasuryPolicy;
  recentTicks: Array<{ file: string; tick: Tick }>;
  activity: OnchainActivity;
  warnings: string[];
}

const AUDIT_DIR = "audit";

export async function loadDashboardState(): Promise<DashboardState> {
  const warnings: string[] = [];

  let agentWallet = { address: "(no AGENT_PRIVATE_KEY)", ethBalance: "—" };
  try {
    const wallet = getWallet();
    const bal = await getBalanceEth(wallet.address);
    agentWallet = { address: wallet.address, ethBalance: formatEther(bal) };
  } catch (e) {
    warnings.push(`agent wallet: ${(e as Error).message}`);
  }

  let keeperhubWallet: DashboardState["keeperhubWallet"] = null;
  try {
    const { getInfo } = await import("../../src/payments/keeperhub");
    const info = await getInfo();
    keeperhubWallet = {
      address: info.walletAddress,
      baseUsdc: info.balance.base.amount,
      tempoUsdc: info.balance.tempo.amount,
    };
  } catch {
    /* keeperhub wallet is optional — silently fall through with null */
  }

  let policy: TreasuryPolicy;
  try {
    policy = await loadPolicy(env("ENS_NAME") ?? null);
  } catch {
    policy = {
      maxSwapEth: "0.01",
      minBufferEth: "0.05",
      allowedTokens: ["USDC"],
      maxDailyVolumeEth: "0.05",
      cooldownSeconds: 3600,
      source: "defaults",
      ensName: env("ENS_NAME") ?? null,
      raw: {},
    };
  }

  const recentTicks: DashboardState["recentTicks"] = [];
  try {
    const files = (await readdir(AUDIT_DIR)).filter((f) => f.endsWith(".json")).sort().reverse().slice(0, 6);
    for (const f of files) {
      try {
        const raw = await readFile(join(AUDIT_DIR, f), "utf8");
        recentTicks.push({ file: f, tick: JSON.parse(raw) as Tick });
      } catch {
        /* skip malformed */
      }
    }
  } catch {
    /* audit dir may not exist yet */
  }

  let activity: OnchainActivity = { anchors: [], escrow: null, warnings: [] };
  try {
    activity = await loadOnchainActivity(10);
    for (const w of activity.warnings) warnings.push(w);
  } catch (e) {
    warnings.push(`onchain activity load failed: ${(e as Error).message}`);
  }

  return {
    chain: { name: CHAIN.name, explorer: CHAIN.explorer },
    llm: { provider: llmProvider() },
    agentWallet,
    keeperhubWallet,
    policy,
    recentTicks,
    activity,
    warnings,
  };
}
