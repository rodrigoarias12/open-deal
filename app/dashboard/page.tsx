import Link from "next/link";
import { loadDashboardState } from "../lib/state";
import { RunTickButton } from "../RunTickButton";
import { LiveTerminal } from "../components/LiveTerminal";
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
    <main className="dash-shell">
      <header className="dash-header">
        <div>
          <h1>openagents-treasury · dashboard</h1>
          <div className="sub">live agent state · sepolia</div>
        </div>
        <Link href="/" className="btn">
          ← landing
        </Link>
      </header>

      {s.warnings.map((w, i) => (
        <div className="dash-error" key={i}>
          {w}
        </div>
      ))}

      <div className="dash-runbar">
        <div className="left">
          source <strong>{s.recentTicks[0]?.tick.source ?? "—"}</strong> · llm{" "}
          <strong>
            {s.recentTicks[0]?.tick.llmModel ?? s.llm.provider}
          </strong>{" "}
          · chain <strong>{s.chain.name}</strong>
        </div>
        <RunTickButton />
      </div>

      <div style={{ margin: "16px 0 24px" }}>
        <LiveTerminal />
      </div>

      <div className="dash-grid">
        <div className="dash-card">
          <h2>agent wallet</h2>
          <div className="dash-row">
            <span className="k">address</span>
            <span className="v">
              <a
                href={`${s.chain.explorer}/address/${s.agentWallet.address}`}
                target="_blank"
                rel="noreferrer"
              >
                {shortAddr(s.agentWallet.address)}
              </a>
            </span>
          </div>
          <div className="dash-row">
            <span className="k">eth balance</span>
            <span className="v accent">{Number(s.agentWallet.ethBalance).toFixed(6)} ETH</span>
          </div>
          <div className="dash-row">
            <span className="k">network</span>
            <span className="v">{s.chain.name}</span>
          </div>
        </div>

        <div className="dash-card">
          <h2>keeperhub wallet</h2>
          {s.keeperhubWallet ? (
            <>
              <div className="dash-row">
                <span className="k">address</span>
                <span className="v">{shortAddr(s.keeperhubWallet.address)}</span>
              </div>
              <div className="dash-row">
                <span className="k">base usdc</span>
                <span className="v">{s.keeperhubWallet.baseUsdc}</span>
              </div>
              <div className="dash-row">
                <span className="k">tempo usdc.e</span>
                <span className="v">{s.keeperhubWallet.tempoUsdc}</span>
              </div>
            </>
          ) : (
            <div className="dash-row">
              <span className="k">status</span>
              <span className="v">not provisioned</span>
            </div>
          )}
        </div>

        <div className="dash-card">
          <h2>
            treasury policy{" "}
            <span className={`dash-tag ${s.policy.source === "ens" ? "live" : ""}`}>
              {s.policy.source}
            </span>
          </h2>
          {s.policy.ensName ? (
            <div className="dash-row">
              <span className="k">name</span>
              <span className="v">{s.policy.ensName}</span>
            </div>
          ) : (
            <div className="dash-row">
              <span className="k">override</span>
              <span className="v" style={{ color: "var(--ink-faint)" }}>set ENS_NAME</span>
            </div>
          )}
          <div className="dash-row">
            <span className="k">max swap</span>
            <span className="v">{s.policy.maxSwapEth} ETH</span>
          </div>
          <div className="dash-row">
            <span className="k">min buffer</span>
            <span className="v">{s.policy.minBufferEth} ETH</span>
          </div>
          <div className="dash-row">
            <span className="k">allowed</span>
            <span className="v">{s.policy.allowedTokens.join(", ")}</span>
          </div>
          <div className="dash-row">
            <span className="k">daily cap</span>
            <span className="v">{s.policy.maxDailyVolumeEth} ETH</span>
          </div>
          <div className="dash-row">
            <span className="k">cooldown</span>
            <span className="v">{s.policy.cooldownSeconds}s</span>
          </div>
        </div>
      </div>

      <h2 className="dash-section-title">Live network activity</h2>
      <div className="dash-grid-2">
        <div className="dash-card">
          <div className="dash-card-eyebrow">0g audit anchor</div>
          <div className="dash-card-title">
            Last {s.activity.anchors.length} anchored decision{s.activity.anchors.length === 1 ? "" : "s"}
          </div>
          {s.activity.anchors.length === 0 ? (
            <div className="dash-empty">no anchors yet on 0G</div>
          ) : (
            <table className="dash-table dash-table-compact">
              <thead>
                <tr>
                  <th>#</th>
                  <th>age</th>
                  <th>cidRoot</th>
                  <th>policyHash</th>
                </tr>
              </thead>
              <tbody>
                {s.activity.anchors.map((a) => (
                  <tr key={a.index}>
                    <td className="mono">#{a.index}</td>
                    <td>{a.age}</td>
                    <td className="mono">
                      <a href={a.explorer} target="_blank" rel="noreferrer">
                        {a.cidRootShort}
                      </a>
                    </td>
                    <td className="mono">{a.policyHashShort}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="dash-card">
          <div className="dash-card-eyebrow">sepolia escrow</div>
          <div className="dash-card-title">
            {s.activity.escrow ? (
              <a
                href={s.activity.escrow.explorer}
                target="_blank"
                rel="noreferrer"
                className="mono"
              >
                {s.activity.escrow.contractShort} ↗
              </a>
            ) : (
              "—"
            )}
          </div>
          {s.activity.escrow ? (
            <div className="dash-stat-grid">
              <div>
                <div className="k">total orders</div>
                <div className="v">{s.activity.escrow.ordersCreated}</div>
              </div>
              <div>
                <div className="k">shipped</div>
                <div className="v">{s.activity.escrow.shipmentsConfirmed}</div>
              </div>
              <div>
                <div className="k">released</div>
                <div className="v">{s.activity.escrow.released}</div>
              </div>
              <div>
                <div className="k">refunded</div>
                <div className="v">{s.activity.escrow.refunded}</div>
              </div>
              <div>
                <div className="k">disputed</div>
                <div className="v">{s.activity.escrow.disputed}</div>
              </div>
              <div>
                <div className="k">total locked</div>
                <div className="v mono">
                  {Number(s.activity.escrow.totalLockedEth).toFixed(6)} ETH
                </div>
              </div>
            </div>
          ) : (
            <div className="dash-empty">escrow contract not reachable</div>
          )}
        </div>
      </div>

      <h2 className="dash-section-title">Recent ticks</h2>
      {s.recentTicks.length === 0 ? (
        <div className="dash-empty">
          no ticks logged yet. press <em>run agent tick</em> to produce one.
        </div>
      ) : (
        <table className="dash-table">
          <thead>
            <tr>
              <th>time</th>
              <th>action</th>
              <th>amount</th>
              <th>tx</th>
              <th>reason</th>
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
        <span className={`dash-pill ${action === "swap_to_stable" ? "swap" : "hold"}`}>
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
          <a
            href={`${explorer}/tx/${tick.execution.swapTxHash}`}
            target="_blank"
            rel="noreferrer"
          >
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
