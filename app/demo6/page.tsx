import { Topbar } from "../components/Topbar";
import { ARTIFACTS } from "../lib/landing-data";
import { TradeMap } from "./_components/TradeMap";
import "./chart.css";

export const dynamic = "force-static";

export default function Demo6() {
  return (
    <>
      <Topbar />

      <section className="demo6-hero">
        <div className="container">
          <div className="demo6-meta">
            <span className="demo6-meta-dot" />
            <span>chart · 06 · the trade route</span>
          </div>

          <h1 className="demo6-title">
            Two agents. Six <span className="demo6-em">waypoints</span>.
            <br />
            Zero humans.
          </h1>

          <p className="demo6-sub">
            A trade route between autonomous parties. Discovered, executed, anchored.
          </p>

          <TradeMap />

          <div className="demo6-divider" />

          <div className="demo6-stats">
            <div>
              <div className="demo6-stat-label">agent</div>
              <div className="demo6-stat-value">{ARTIFACTS.agentEns}</div>
            </div>
            <div>
              <div className="demo6-stat-label">escrow · sepolia</div>
              <div className="demo6-stat-value">{ARTIFACTS.escrowShort}</div>
            </div>
            <div>
              <div className="demo6-stat-label">anchor · 0g galileo</div>
              <div className="demo6-stat-value">{ARTIFACTS.anchorShort}</div>
            </div>
          </div>

          <div className="demo6-cta-row">
            <a className="btn btn-primary" href="/dashboard">
              see the dashboard <span className="btn-arrow">→</span>
            </a>
          </div>
        </div>
      </section>

      <div className="demo6-back">
        <a href="/">← back to landing</a>
      </div>
    </>
  );
}
