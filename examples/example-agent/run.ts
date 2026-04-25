import "dotenv/config";
import { readFile } from "node:fs/promises";
import policyPlugin from "../../plugins/policy-from-ens/src/index.js";
import auditPlugin from "../../plugins/audit-to-0g/src/index.js";

type Tool = {
  name: string;
  execute: (id: string, params: unknown) => Promise<{ details: unknown }>;
};

function loadPlugin(plugin: { register?: (api: unknown) => void; id: string }): Tool[] {
  const tools: Tool[] = [];
  const fakeApi = {
    id: plugin.id,
    name: plugin.id,
    registerTool(tool: Tool) {
      tools.push(tool);
    },
    registerHook() {},
    registerHttpRoute() {},
    registerService() {},
    config: {},
    logger: { info: console.log, warn: console.warn, error: console.error },
  };
  if (typeof plugin.register === "function") plugin.register(fakeApi as never);
  return tools;
}

async function main(): Promise<void> {
  if (!process.env.ZG_AUDIT_ANCHOR) {
    const anchor = JSON.parse(
      await readFile("contracts/AuditAnchor.deployment.json", "utf8"),
    );
    process.env.ZG_AUDIT_ANCHOR = anchor.address;
  }

  const policyTools = loadPlugin(policyPlugin as never);
  const auditTools = loadPlugin(auditPlugin as never);

  const policyCheck = policyTools.find((t) => t.name === "treasury_policy_check");
  const recordAudit = auditTools.find((t) => t.name === "record_audit");
  if (!policyCheck || !recordAudit) {
    throw new Error("plugins did not register expected tools");
  }
  console.log(
    `[example] plugins loaded: policy-from-ens, audit-to-0g (tools: ${[
      policyCheck.name,
      recordAudit.name,
    ].join(", ")})`,
  );

  const cashState = {
    currency: "USD",
    cash_idle: 1200,
    pending_invoices: 1200,
    monthly_burn: 4500,
    wallet_eth: "0.2",
  };
  console.log(
    `[example] tick at ${new Date().toISOString()} — cash $${cashState.cash_idle} idle, burn $${cashState.monthly_burn}, wallet ${cashState.wallet_eth} ETH`,
  );

  const proposedSwapEth = "0.005";
  console.log(
    `[example] proposing swap: ${proposedSwapEth} ETH → USDC (idle pre-fund)`,
  );

  console.log("[example] step 1/3 — policy gate via policy-from-ens…");
  const policyResult = (await policyCheck.execute("call-policy", {
    action: "swap_to_stable",
    amount_eth: proposedSwapEth,
    token: "USDC",
    wallet_eth: cashState.wallet_eth,
    ens_name: process.env.ENS_NAME || null,
  })) as { details: { allowed: boolean; reason: string | null; policy: unknown } };

  console.log(
    `  → allowed=${policyResult.details.allowed}, reason=${policyResult.details.reason ?? "ok"}`,
  );
  if (!policyResult.details.allowed) {
    console.log("[example] policy denied — stopping.");
    return;
  }

  console.log("[example] step 2/3 — simulated swap (no real broadcast)…");
  const simulatedExecution = {
    swapTxHash: `0x${"deadbeef".repeat(8)}`,
    amountEth: proposedSwapEth,
    amountUsdc: "12.34",
    explorerUrl: "https://sepolia.etherscan.io/tx/simulated",
  };
  console.log(`  → simulated tx ${simulatedExecution.swapTxHash}`);

  console.log("[example] step 3/3 — verifiable audit via audit-to-0g…");
  const auditRecord = {
    at: new Date().toISOString(),
    case: "example-agent-tick",
    state: cashState,
    decision: {
      action: "swap_to_stable",
      amount_eth: proposedSwapEth,
      token: "USDC",
      reason: "idle USDC pre-fund for upcoming obligations",
    },
    policy: policyResult.details.policy,
    execution: simulatedExecution,
  };
  const auditResult = (await recordAudit.execute("call-audit", {
    record: auditRecord,
  })) as {
    details: {
      cidRoot: string;
      policyHash: string;
      storage: { txHash: string; explorer: string };
      chain: {
        anchorAddress: string;
        txHash: string;
        blockNumber: number | null;
        explorer: string;
        anchorIndex: string;
      };
    };
  };

  console.log("\n[example] receipt:");
  console.log(`  storage cidRoot   ${auditResult.details.cidRoot}`);
  console.log(`  policy hash       ${auditResult.details.policyHash}`);
  console.log(`  storage tx        ${auditResult.details.storage.txHash}`);
  console.log(
    `  storage explorer  ${auditResult.details.storage.explorer}`,
  );
  console.log(
    `  chain anchor      ${auditResult.details.chain.anchorAddress} (idx ${auditResult.details.chain.anchorIndex})`,
  );
  console.log(`  chain tx          ${auditResult.details.chain.txHash}`);
  console.log(`  chain explorer    ${auditResult.details.chain.explorer}`);

  console.log("\n[example] tick complete ✓");
}

main().catch((e) => {
  console.error("[example] failed:", e);
  process.exit(1);
});
