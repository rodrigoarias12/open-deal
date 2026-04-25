import Link from "next/link";
import { loadDashboardState } from "../lib/state";
import { RunTickButton } from "../RunTickButton";
import type { Tick } from "../../src/agent/core";

export const dynamic = "force-dynamic";

function shortAddr(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function shortTx(tx: string) {
  if (!tx || tx.length < 12) return tx;
  return `${tx.slice(0, 10)}…${tx.slice(-6)}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { hour12: false });
}

export default async function Dashboard() {
  const s = await loadDashboardState();

  return (
    <main className="shell">
      <header className="top">
        <div>
          <h1>openagents-treasury</h1>
          <div className="sub">Autonomous treasury agent · ETHGlobal Open Agents 2026</div>
        </div>
        <Link href="/" style={{ fontSize: 12 }}>← back to overview</Link>
      </header>

      {s.warnings.map((w, i) => (
        <div className="error" key={i}>{w}</div>
      ))}

      <div className="run-bar">
        <div className="left">
          Source: <strong>{s.recentTicks[0]?.tick.source ?? "(no ticks yet)"}</strong> · LLM: <strong>{s.llm.provider}</strong> · Chain: <strong>{s.chain.name}</strong>
        </div>
        <RunTickButton />
      </div>

      <div className="grid">
        <div className="card">
          <h2>Agent wallet</h2>
          <div className="row"><span className="k">address</span><span className="v"><a href={`${s.chain.explorer}/address/${s.agentWallet.address}`} target="_blank">{shortAddr(s.agentWallet.address)}</a></span></div>
          <div className="row"><span className="k">eth balance</span><span className="v positive">{Number(s.agentWallet.ethBalance).toFixed(6)} ETH</span></div>
          <div className="row"><span className="k">network</span><span className="v">{s.chain.name}</span></div>
        </div>

        <div className="card">
          <h2>KeeperHub wallet</h2>
          {s.keeperhubWallet ? (
            <>
              <div className="row"><span className="k">address</span><span className="v">{shortAddr(s.keeperhubWallet.address)}</span></div>
              <div className="row"><span className="k">base usdc</span><span className="v">{s.keeperhubWallet.baseUsdc}</span></div>
              <div className="row"><span className="k">tempo usdc.e</span><span className="v">{s.keeperhubWallet.tempoUsdc}</span></div>
            </>
          ) : (
            <div className="empty">not provisioned</div>
          )}
        </div>

        <div className="card">
          <h2>Treasury policy <span className={`tag ${s.policy.source === "ens" ? "live" : ""}`}>{s.policy.source}</span></h2>
          {s.policy.ensName && (
            <div className="row"><span className="k">source name</span><span className="v">{s.policy.ensName}</span></div>
          )}
          <div className="row"><span className="k">max swap</span><span className="v">{s.policy.maxSwapEth} ETH</span></div>
          <div className="row"><span className="k">min buffer</span><span className="v">{s.policy.minBufferEth} ETH</span></div>
          <div className="row"><span className="k">allowed</span><span className="v">{s.policy.allowedTokens.join(", ")}</span></div>
          <div className="row"><span className="k">daily cap</span><span className="v">{s.policy.maxDailyVolumeEth} ETH</span></div>
          <div className="row"><span className="k">cooldown</span><span className="v">{s.policy.cooldownSeconds}s</span></div>
        </div>
      </div>

      <h2 className="section-title">Recent ticks</h2>
      {s.recentTicks.length === 0 ? (
        <div className="empty">No ticks logged yet. Press <em>Run agent tick</em> to produce one.</div>
      ) : (
        <table className="audit">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Amount</th>
              <th>Tx</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {s.recentTicks.map(({ file, tick }) => (
              <TickRow key={file} tick={tick} explorer={s.chain.explorer} />
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

function TickRow({ tick, explorer }: { tick: Tick; explorer: string }) {
  const action = tick.decision.action;
  return (
    <tr>
      <td>{fmtTime(tick.at)}</td>
      <td>
        <span className={`pill ${action === "swap_to_stable" ? "swap" : "hold"}`}>
          {action === "swap_to_stable" ? "SWAP" : "HOLD"}
        </span>
      </td>
      <td>
        {tick.execution
          ? `${tick.execution.amountEth} ETH → ${Number(tick.execution.amountUsdc).toFixed(2)} USDC`
          : action === "swap_to_stable"
          ? `${tick.decision.amount_eth} ETH (planned)`
          : "—"}
      </td>
      <td>
        {tick.execution ? (
          <a href={`${explorer}/tx/${tick.execution.swapTxHash}`} target="_blank">
            {shortTx(tick.execution.swapTxHash)}
          </a>
        ) : (
          "—"
        )}
      </td>
      <td className="reason">{tick.decision.reason}</td>
    </tr>
  );
}
