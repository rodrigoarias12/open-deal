import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { formatEther } from "ethers";
import { CHAIN, env, llmProvider } from "../../src/config";
import { getBalanceEth, getWallet } from "../../src/chain/client";
import { loadPolicy, type TreasuryPolicy } from "../../src/ens/policy";
import type { Tick } from "../../src/agent/core";

export interface DashboardState {
  chain: { name: string; explorer: string };
  llm: { provider: string };
  agentWallet: { address: string; ethBalance: string };
  keeperhubWallet: { address: string; baseUsdc: string; tempoUsdc: string } | null;
  policy: TreasuryPolicy;
  recentTicks: Array<{ file: string; tick: Tick }>;
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
    warnings.push("keeperhub wallet not provisioned (run `npx @keeperhub/wallet add`)");
  }

  const policy = await loadPolicy(env("ENS_NAME") ?? null);

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

  return {
    chain: { name: CHAIN.name, explorer: CHAIN.explorer },
    llm: { provider: llmProvider() },
    agentWallet,
    keeperhubWallet,
    policy,
    recentTicks,
    warnings,
  };
}
