import { Topbar } from "../components/Topbar";
import { ARTIFACTS } from "../lib/landing-data";
import { AssemblyLine } from "./_components/AssemblyLine";
import "./assembly.css";

export const dynamic = "force-static";

export default function Demo4() {
  return (
    <>
      <Topbar />

      <section className="demo4-hero">
        <div className="container">
          <div className="demo4-meta">
            <span className="demo4-meta-dot" />
            <span>line · 04 · the assembly line</span>
          </div>

          <h1 className="demo4-title">
            Six systems.
            <br />
            One <span className="demo4-em">autonomous</span> loop.
          </h1>

          <p className="demo4-sub">
            Real packages. Real receipts. Zero humans on the line.
          </p>

          <AssemblyLine />

          <div className="demo4-stats">
            <div>
              <div className="demo4-stat-label">agent</div>
              <div className="demo4-stat-value">{ARTIFACTS.agentEns}</div>
            </div>
            <div>
              <div className="demo4-stat-label">escrow · sepolia</div>
              <div className="demo4-stat-value">{ARTIFACTS.escrowShort}</div>
            </div>
            <div>
              <div className="demo4-stat-label">anchor · 0g galileo</div>
              <div className="demo4-stat-value">{ARTIFACTS.anchorShort}</div>
            </div>
          </div>

          <div className="demo4-cta-row">
            <a className="btn btn-primary" href="/dashboard">
              see the dashboard <span className="btn-arrow">→</span>
            </a>
          </div>
        </div>
      </section>

      <div className="demo4-back">
        <a href="/">← back to landing</a>
      </div>
    </>
  );
}
