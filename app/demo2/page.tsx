import { Topbar } from "../components/Topbar";
import { Handshake } from "./_components/Handshake";
import "./handshake.css";

export const dynamic = "force-static";

export default function Demo2() {
  return (
    <>
      <Topbar />

      <section className="d2-hero">
        <div className="container">
          <div className="d2-hero-head">
            <div className="d2-meta">
              <span className="d2-meta-dot" />
              <span>two agents · one network · onchain receipts</span>
            </div>
            <h1 className="d2-title">
              Two agents. One <span className="d2-em">handshake.</span>
              <br />
              Zero humans.
            </h1>
            <p className="d2-sub">
              ENS-identified agents trade B2B with onchain receipts. No middleman.
              No portal. No login.
            </p>
            <div className="d2-cta-row">
              <a className="btn btn-primary" href="/dashboard">
                see the dashboard <span className="btn-arrow">→</span>
              </a>
            </div>
          </div>

          <Handshake />
        </div>
      </section>

      <div className="d2-back">
        <a href="/">← back to landing</a>
      </div>
    </>
  );
}
