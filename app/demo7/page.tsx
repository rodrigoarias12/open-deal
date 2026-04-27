import { Topbar } from "../components/Topbar";
import { ARTIFACTS } from "../lib/landing-data";
import { FlowDiagram } from "./_components/FlowDiagram";
import "./flow.css";

export const dynamic = "force-static";

export default function Demo7() {
  return (
    <>
      <Topbar />

      <section className="demo7-hero">
        <div className="container">
          <div className="demo7-meta">
            <span className="demo7-meta-dot" />
            <span>diagram · 07 · the swimlane</span>
          </div>

          <h1 className="demo7-title">
            Two humans. Six systems.
            <br />
            One <span className="demo7-em">autonomous</span> loop.
          </h1>

          <p className="demo7-sub">
            Set it once. Watch it run. Sign only the edge cases.
          </p>

          <FlowDiagram />

          <div className="demo7-divider" />

          <div className="demo7-stats">
            <div>
              <div className="demo7-stat-label">agent</div>
              <div className="demo7-stat-value">{ARTIFACTS.agentEns}</div>
            </div>
            <div>
              <div className="demo7-stat-label">escrow · sepolia</div>
              <div className="demo7-stat-value">{ARTIFACTS.escrowShort}</div>
            </div>
            <div>
              <div className="demo7-stat-label">anchor · 0g galileo</div>
              <div className="demo7-stat-value">{ARTIFACTS.anchorShort}</div>
            </div>
          </div>

          <div className="demo7-cta-row">
            <a className="btn btn-primary" href="/dashboard">
              see the dashboard <span className="btn-arrow">→</span>
            </a>
          </div>
        </div>
      </section>

      <div className="demo7-back">
        <a href="/">← back to landing</a>
      </div>
    </>
  );
}
