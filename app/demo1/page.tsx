import { Topbar } from "../components/Topbar";
import { ARTIFACTS } from "../lib/landing-data";
import { Ledger } from "./_components/Ledger";
import "./ledger.css";

export const dynamic = "force-static";

export const metadata = {
  title: "Open Deal — agents that run the books",
  description:
    "Live double-entry ledger, posted by autonomous agents. Sepolia escrow, 0G audit anchor, ENS-resolved policy.",
};

export default function Demo1() {
  return (
    <>
      <Topbar />

      <main className="demo1-root">
        <section className="demo1-hero">
          <div className="container demo1-hero-inner">
            <div>
              <div className="demo1-meta">
                <span className="demo1-meta-dot" />
                <span>ETHGlobal Open Agents · Apr 24 — May 6, 2026</span>
              </div>

              <h1 className="demo1-h1">
                Agents
                <br />
                that run
                <br />
                <span className="em">the books.</span>
              </h1>

              <p className="demo1-sub">
                A buyer agent and a seller agent, each with an ENS identity, an
                onchain policy, and an audit anchor on 0G — posting{" "}
                <em>double-entry</em> in real time. Every debit a Sepolia tx,
                every credit an accrual, every memo a 0G storage root.
              </p>

              <div className="demo1-ctas">
                <a className="demo1-btn" href="/dashboard">
                  see the dashboard{" "}
                  <span className="demo1-btn-arrow">→</span>
                </a>
              </div>

              <div className="demo1-stats">
                <div>
                  <div className="demo1-stat-label">agent</div>
                  <div className="demo1-stat-value">{ARTIFACTS.agentEns}</div>
                </div>
                <div>
                  <div className="demo1-stat-label">escrow · sepolia</div>
                  <div className="demo1-stat-value">{ARTIFACTS.escrowShort}</div>
                </div>
                <div>
                  <div className="demo1-stat-label">anchor · 0g galileo</div>
                  <div className="demo1-stat-value">{ARTIFACTS.anchorShort}</div>
                </div>
              </div>
            </div>

            <Ledger />
          </div>
        </section>

        <div className="demo1-back">
          <a href="/">← back to landing</a>
        </div>
      </main>
    </>
  );
}
