import { Topbar } from "../components/Topbar";
import { ARTIFACTS } from "../lib/landing-data";
import { Schematic } from "./_components/Schematic";
import "./schematic.css";

export const dynamic = "force-static";

export default function Demo5Page() {
  return (
    <>
      <Topbar />

      <main className="demo5-page">
        <div className="demo5-paper">
          {/* top-left: headline + subtitle */}
          <div className="demo5-headline-block">
            <a className="demo5-back" href="/">
              <span aria-hidden>←</span> back to landing
            </a>
            <h1 className="demo5-headline">
              The books. <span className="demo5-headline-em">Wired.</span>
            </h1>
            <div className="demo5-subtitle">
              rev 0.1 · ETHGlobal Open Agents · apr 2026
            </div>
          </div>

          {/* top-right: schematic title block */}
          <div className="demo5-titleblock">
            <div className="demo5-titleblock-row">
              <span className="demo5-titleblock-k">PROJECT</span>
              <span className="demo5-titleblock-v">OPEN DEAL</span>
            </div>
            <div className="demo5-titleblock-row">
              <span className="demo5-titleblock-k">SHEET</span>
              <span className="demo5-titleblock-v">01 / 01</span>
            </div>
            <div className="demo5-titleblock-row">
              <span className="demo5-titleblock-k">SCALE</span>
              <span className="demo5-titleblock-v">1 : 1</span>
            </div>
            <div className="demo5-titleblock-row">
              <span className="demo5-titleblock-k">DRAWN</span>
              <span className="demo5-titleblock-v">openagents-treasury.eth</span>
            </div>
          </div>

          {/* schematic */}
          <div className="demo5-schematic-wrap">
            <Schematic />
          </div>

          {/* dimensioning artifacts */}
          <div className="demo5-dimline">
            <div className="demo5-dim">
              <span className="demo5-dim-tick" />
              <span className="demo5-dim-k">[A] AGENT-ENS</span>
              <span className="demo5-dim-v">{ARTIFACTS.agentEns}</span>
            </div>
            <div className="demo5-dim">
              <span className="demo5-dim-tick" />
              <span className="demo5-dim-k">[B] ESCROW · sepolia</span>
              <span className="demo5-dim-v">{ARTIFACTS.escrowShort}</span>
            </div>
            <div className="demo5-dim">
              <span className="demo5-dim-tick" />
              <span className="demo5-dim-k">[C] ANCHOR · 0g galileo</span>
              <span className="demo5-dim-v">{ARTIFACTS.anchorShort}</span>
            </div>
          </div>

          {/* CTA */}
          <div className="demo5-cta-row">
            <a className="btn btn-primary" href="/dashboard">
              see the dashboard <span className="btn-arrow">→</span>
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
