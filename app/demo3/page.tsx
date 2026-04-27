import { Topbar } from "../components/Topbar";
import { ARTIFACTS } from "../lib/landing-data";
import { SubwayMap } from "./_components/SubwayMap";
import "./subway.css";

export const dynamic = "force-static";

export default function Demo3() {
  return (
    <>
      <Topbar />

      <section className="demo3-hero">
        <div className="container">
          <div className="demo3-meta">
            <span className="demo3-meta-dot" />
            <span>line · 01 · the autonomous loop</span>
          </div>

          <h1 className="demo3-title">
            Six systems.
            <br />
            One <span className="demo3-em">autonomous</span> loop.
          </h1>

          <p className="demo3-sub">
            ERP → agent → human approval → agent → escrow → audit. All onchain. With receipts.
          </p>

          <SubwayMap />

          <div className="demo3-stats">
            <div>
              <div className="demo3-stat-label">agent</div>
              <div className="demo3-stat-value">{ARTIFACTS.agentEns}</div>
            </div>
            <div>
              <div className="demo3-stat-label">escrow · sepolia</div>
              <div className="demo3-stat-value">{ARTIFACTS.escrowShort}</div>
            </div>
            <div>
              <div className="demo3-stat-label">anchor · 0g galileo</div>
              <div className="demo3-stat-value">{ARTIFACTS.anchorShort}</div>
            </div>
          </div>

          <div className="demo3-cta-row">
            <a className="btn btn-primary" href="/dashboard">
              see the dashboard <span className="btn-arrow">→</span>
            </a>
          </div>
        </div>
      </section>

      <div className="demo3-back">
        <a href="/">← back to landing</a>
      </div>
    </>
  );
}
