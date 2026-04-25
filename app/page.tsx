import { AuditList } from "./components/AuditList";
import { Demo } from "./components/Demo";
import { FAQ } from "./components/FAQ";
import { HeroTerminal } from "./components/HeroTerminal";
import { Loop } from "./components/Loop";
import { Topbar } from "./components/Topbar";
import { ARCH_DIAGRAM, PILLARS, SPONSORS } from "./lib/landing-data";

export const dynamic = "force-static";

export default function Landing() {
  return (
    <>
      <Topbar />

      <section className="hero">
        <div className="container hero-inner">
          <div>
            <div className="hero-meta">
              <span className="hero-meta-dot" />
              <span>ETHGlobal Open Agents · Apr 24 — May 6, 2026</span>
            </div>
            <h1>
              Treasury
              <br />
              that runs
              <br />
              <span className="em">itself.</span>
            </h1>
            <p className="hero-sub">
              An autonomous agent that reads your books, follows your onchain policy, and executes
              under it. Every decision signed. Every action audited.
            </p>
            <div className="hero-ctas">
              <a className="btn btn-primary" href="/sell">
                sell on the network <span className="btn-arrow">→</span>
              </a>
              <a className="btn" href="/dashboard">
                buyer dashboard <span className="btn-arrow">→</span>
              </a>
              <a className="btn" href="#loop">
                how it works <span className="btn-arrow">→</span>
              </a>
            </div>
            <div className="hero-stats">
              <div>
                <div className="hero-stat-label">policy</div>
                <div className="hero-stat-value">treasury.openagents.eth</div>
              </div>
              <div>
                <div className="hero-stat-label">chain</div>
                <div className="hero-stat-value">sepolia · 11155111</div>
              </div>
              <div>
                <div className="hero-stat-label">last tick</div>
                <div className="hero-stat-value">2026-04-25 · 14:02 UTC</div>
              </div>
            </div>
          </div>
          <HeroTerminal />
        </div>
      </section>

      <section id="loop">
        <div className="container">
          <div className="section-tag">the loop</div>
          <h2 className="section-title">Five steps. Every tick. No exceptions.</h2>
          <p className="section-lede">
            Each tick is a pure function from{" "}
            <span className="mono" style={{ color: "var(--policy)" }}>
              (books, policy)
            </span>{" "}
            to{" "}
            <span className="mono" style={{ color: "var(--accent)" }}>
              (tx, audit)
            </span>
            . Click any step to see the payload.
          </p>
          <Loop />
        </div>
      </section>

      <section id="why">
        <div className="container">
          <div className="section-tag">why it&rsquo;s different</div>
          <h2 className="section-title">
            The policy is the contract. The agent is the executor. The audit is the receipt.
          </h2>
          <div className="pillars">
            {PILLARS.map((p, i) => (
              <div key={i} className="pillar">
                <div className="pillar-num">PILLAR {p.num}</div>
                <h3 className="pillar-title">{p.title}</h3>
                <div className="pillar-body">{p.body}</div>
                <div>
                  <span className="pillar-mono">{p.mono}</span>
                </div>
                <div className="pillar-foot">
                  <span>see</span>
                  <span className="src">{p.foot}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="demo">
        <div className="container">
          <div className="section-tag">live demo</div>
          <h2 className="section-title">Run a tick. Watch it think.</h2>
          <p className="section-lede">
            Replays a recorded run on Sepolia from a CSV fixture. No wallet required. The pipeline
            is the same code path as production.
          </p>
          <Demo />
        </div>
      </section>

      <section id="arch">
        <div className="container">
          <div className="section-tag">architecture</div>
          <h2 className="section-title">Honest boxes. Real function names.</h2>
          <p className="section-lede">
            No marchitecture. Every arrow corresponds to a function in{" "}
            <span className="mono">src/</span>. Click a sponsor below to jump to the file.
          </p>
          <div className="arch">
            <pre>{ARCH_DIAGRAM}</pre>
          </div>
        </div>
      </section>

      <section id="sponsors">
        <div className="container">
          <div className="section-tag">built with</div>
          <h2 className="section-title">Five integrations. Five files.</h2>
          <div className="sponsors">
            {SPONSORS.map((s, i) => (
              <a key={i} className="sponsor" href={s.href} target="_blank" rel="noreferrer">
                <div className="sponsor-role">{s.role}</div>
                <div className="sponsor-name">{s.name}</div>
                <div className="sponsor-src">{s.src} →</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="audit">
        <div className="container">
          <div className="section-tag">the audit trail</div>
          <h2 className="section-title">Every decision, signed and on disk.</h2>
          <p className="section-lede">
            Three real <span className="mono">audit/&lt;ts&gt;.json</span> files. Prompt, model
            output, tx hash, and policy snapshot at decision time.
          </p>
          <AuditList />
        </div>
      </section>

      <section id="faq">
        <div className="container">
          <div className="section-tag">faq</div>
          <h2 className="section-title">Five questions. Sharp answers.</h2>
          <FAQ />
        </div>
      </section>

      <footer>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand-block">
              <div className="brand">
                <span className="brand-mark" />
                <span className="brand-name">
                  openagents<span className="dim">-</span>treasury
                </span>
              </div>
              <p>
                An autonomous treasury agent. Reads your books, follows your onchain policy,
                executes under it. Built solo for ETHGlobal Open Agents.
              </p>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">code</div>
              <ul>
                <li>
                  <a href="https://github.com" target="_blank" rel="noreferrer">github ↗</a>
                </li>
                <li>
                  <a href="#loop">policy spec</a>
                </li>
                <li>
                  <a href="#audit">audit format</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">submission</div>
              <ul>
                <li>
                  <a href="https://ethglobal.com/events/openagents" target="_blank" rel="noreferrer">
                    ETHGlobal ↗
                  </a>
                </li>
                <li>
                  <a href="/dashboard">live dashboard</a>
                </li>
                <li>
                  <a
                    href="https://sepolia.etherscan.io/address/0x13aF7f5B2aD2a230d364cc2484380e711fe17AC1"
                    target="_blank"
                    rel="noreferrer"
                  >
                    sepolia explorer
                  </a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">policy</div>
              <ul>
                <li>
                  <span className="footer-ens">treasury.openagents.eth</span>
                </li>
                <li>signer 0x13aF…7AC1</li>
                <li>chain 11155111</li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>built solo · rodrigo · 2026</span>
            <span>v0.4.2 · sepolia</span>
          </div>
        </div>
      </footer>
    </>
  );
}
