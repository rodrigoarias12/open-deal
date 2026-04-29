import { Topbar } from "../components/Topbar";
import { ARTIFACTS } from "../lib/landing-data";
import { AssemblyLineV2 } from "./_components/AssemblyLineV2";
import "./assembly12.css";

export const dynamic = "force-static";

export default function Demo12() {
  return (
    <>
      <Topbar />

      <section className="demo12-hero">
        <div className="container">
          <div className="demo12-meta">
            <span className="demo12-meta-dot" />
            <span>line · 12 · assembly line · v2 stamps</span>
          </div>

          <h1 className="demo12-title">
            Six systems.
            <br />
            One <span className="demo12-em">autonomous</span> loop.
          </h1>

          <p className="demo12-sub">
            Same line, friendlier stamps — they hug the edges instead of covering the manifest.
          </p>

          <AssemblyLineV2 />

          <div className="demo12-stats">
            <div>
              <div className="demo12-stat-label">agent</div>
              <div className="demo12-stat-value">{ARTIFACTS.agentEns}</div>
            </div>
            <div>
              <div className="demo12-stat-label">escrow · sepolia</div>
              <div className="demo12-stat-value">{ARTIFACTS.escrowShort}</div>
            </div>
            <div>
              <div className="demo12-stat-label">anchor · 0g galileo</div>
              <div className="demo12-stat-value">{ARTIFACTS.anchorShort}</div>
            </div>
          </div>

          <div className="demo12-cta-row">
            <a className="btn btn-primary" href="/dashboard">
              see the dashboard <span className="btn-arrow">→</span>
            </a>
          </div>
        </div>
      </section>

      <div className="demo12-back">
        <a href="/">← back to landing</a>
      </div>
    </>
  );
}
