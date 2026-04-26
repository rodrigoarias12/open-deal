import { AuditList } from "./components/AuditList";
import { Demo } from "./components/Demo";
import { FAQ } from "./components/FAQ";
import { HeroTerminal } from "./components/HeroTerminal";
import { Loop } from "./components/Loop";
import { Topbar } from "./components/Topbar";
import {
  ARCH_DIAGRAM,
  ARTIFACTS,
  ONCHAIN_ARTIFACTS,
  PILLARS,
  PLUGINS,
  PROJECT_DEAL,
  SPONSORS,
} from "./lib/landing-data";

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
              Agents
              <br />
              that run
              <br />
              <span className="em">the books.</span>
            </h1>
            <p className="hero-sub">
              Buyer and seller agents — each with an ENS identity, an onchain policy, and an
              audit anchor on 0G. Two autonomous parties trading B2B, with receipts. The framework
              underneath: three OpenClaw plugins any agent can adopt.
            </p>
            <div className="hero-ctas">
              <a className="btn btn-primary" href="/sell">
                sell on the network <span className="btn-arrow">→</span>
              </a>
              <a className="btn" href="/dashboard">
                buyer dashboard <span className="btn-arrow">→</span>
              </a>
              <a className="btn" href="#framework">
                the framework <span className="btn-arrow">→</span>
              </a>
            </div>
            <div className="hero-stats">
              <div>
                <div className="hero-stat-label">agent</div>
                <div className="hero-stat-value">{ARTIFACTS.agentEns}</div>
              </div>
              <div>
                <div className="hero-stat-label">escrow · sepolia</div>
                <div className="hero-stat-value">{ARTIFACTS.escrowShort}</div>
              </div>
              <div>
                <div className="hero-stat-label">anchor · 0g galileo</div>
                <div className="hero-stat-value">{ARTIFACTS.anchorShort}</div>
              </div>
            </div>
          </div>
          <HeroTerminal />
        </div>
      </section>

      <section id="precedent">
        <div className="container">
          <div className="section-tag">the precedent</div>
          <h2 className="section-title">
            {PROJECT_DEAL.headline}
          </h2>
          <p className="section-lede">
            <a href={PROJECT_DEAL.url} target="_blank" rel="noreferrer">
              {PROJECT_DEAL.source} ↗
            </a>
            . {PROJECT_DEAL.punchline}
          </p>

          <div
            className="hero-stats"
            style={{ marginTop: "2rem", marginBottom: "2.5rem" }}
          >
            {PROJECT_DEAL.stats.map((s) => (
              <div key={s.label}>
                <div className="hero-stat-label">{s.label}</div>
                <div className="hero-stat-value" style={{ fontSize: "1.5rem" }}>
                  {s.num}
                </div>
              </div>
            ))}
          </div>

          <div className="precedent-table">
            <div className="precedent-row precedent-head">
              <div>Axis</div>
              <div>Anthropic Project Deal</div>
              <div>Agentic ERP</div>
            </div>
            {PROJECT_DEAL.comparison.map((row) => (
              <div className="precedent-row" key={row.axis}>
                <div className="precedent-axis">{row.axis}</div>
                <div className="precedent-cell precedent-cell-them">
                  {row.anthropic}
                </div>
                <div
                  className={
                    "precedent-cell " +
                    (row.edge === "extension"
                      ? "precedent-cell-us-edge"
                      : "precedent-cell-us-match")
                  }
                >
                  <span className="precedent-edge">
                    {row.edge === "extension" ? "+" : "="}
                  </span>
                  {row.ours}
                </div>
              </div>
            ))}
          </div>
          <p className="section-lede" style={{ marginTop: "2rem" }}>
            Same pattern, two different runtimes. Their experiment validated
            that humans accept agent-mediated trade. Ours adds the trust
            property B2B procurement actually needs:{" "}
            <span className="mono" style={{ color: "var(--accent)" }}>
              every decision verifiable from chain state alone
            </span>
            .
          </p>
        </div>
      </section>

      <section id="loop">
        <div className="container">
          <div className="section-tag">the loop</div>
          <h2 className="section-title">Six steps. Every tick. No exceptions.</h2>
          <p className="section-lede">
            Each tick is a pure function from{" "}
            <span className="mono" style={{ color: "var(--policy)" }}>
              (books, policy)
            </span>{" "}
            to{" "}
            <span className="mono" style={{ color: "var(--accent)" }}>
              (escrow, anchor)
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

      <section id="framework">
        <div className="container">
          <div className="section-tag">the framework</div>
          <h2 className="section-title">Three plugins. One manifest. Any agent.</h2>
          <p className="section-lede">
            Every plugin under <span className="mono">plugins/</span> is a standalone
            npm-publishable package: <span className="mono">openclaw.plugin.json</span>, README,
            smoke test. The same three power the buyer agent, the seller agent, and the legacy
            treasury demo. Aligned with{" "}
            <span className="mono" style={{ color: "var(--policy)" }}>
              ERC-8004
            </span>{" "}
            primitives — identity, capabilities, validation — on chains that exist today.
          </p>
          <div className="pillars">
            {PLUGINS.map((p, i) => (
              <div key={i} className="pillar">
                <div className="pillar-num">PLUGIN 0{i + 1}</div>
                <h3 className="pillar-title">{p.title}</h3>
                <div className="pillar-body">{p.body}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {p.tools.map((t) => (
                    <span key={t} className="pillar-mono">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="pillar-foot">
                  <span>npm</span>
                  <span className="src">{p.pkg}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="demo">
        <div className="container">
          <div className="section-tag">live demo</div>
          <h2 className="section-title">Run a buyer tick. Watch it think.</h2>
          <p className="section-lede">
            Replays a recorded buyer-agent run from a real fixture. No wallet required. The
            pipeline is the same code path as production — Odoo → ENS RFQ → Claude → policy gate →
            Sepolia escrow → 0G anchor.
          </p>
          <Demo />
        </div>
      </section>

      <section id="arch">
        <div className="container">
          <div className="section-tag">architecture</div>
          <h2 className="section-title">Honest boxes. Real function names.</h2>
          <p className="section-lede">
            No marchitecture. Two agents, three plugins, two onchain settlements (escrow on Sepolia,
            anchor on 0G). Every arrow corresponds to a function in{" "}
            <span className="mono">apps/</span> or <span className="mono">plugins/</span>.
          </p>
          <div className="arch">
            <pre>{ARCH_DIAGRAM}</pre>
          </div>
        </div>
      </section>

      <section id="sponsors">
        <div className="container">
          <div className="section-tag">built with</div>
          <h2 className="section-title">Three sponsors. One trust property.</h2>
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
          <h2 className="section-title">Every decision, anchored on 0G.</h2>
          <p className="section-lede">
            Three real records from agent runs during the build window. Prompt, model output,
            policy snapshot, and the 0G anchor index that makes them third-party verifiable.
          </p>
          <AuditList />
          <div className="arch" style={{ marginTop: 24 }}>
            <pre>
              {ONCHAIN_ARTIFACTS.map(
                (a) => `${a.name.padEnd(22)}  ${a.addr.padEnd(46)}  ${a.chain}`
              ).join("\n")}
            </pre>
          </div>
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
                  agentic<span className="dim"> </span>erp
                </span>
              </div>
              <p>
                Two autonomous agents trading B2B under ENS-resolved policy, with escrow on Sepolia
                and audit anchored on 0G. Three OpenClaw plugins any agent can adopt. Built solo for
                ETHGlobal Open Agents.
              </p>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">code</div>
              <ul>
                <li>
                  <a href="https://github.com" target="_blank" rel="noreferrer">
                    github ↗
                  </a>
                </li>
                <li>
                  <a href="#framework">plugins</a>
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
                  <a
                    href="https://ethglobal.com/events/openagents"
                    target="_blank"
                    rel="noreferrer"
                  >
                    ETHGlobal ↗
                  </a>
                </li>
                <li>
                  <a href="/dashboard">live dashboard</a>
                </li>
                <li>
                  <a
                    href={`${ARTIFACTS.zgExplorer}/address/${ARTIFACTS.anchor}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    0g explorer ↗
                  </a>
                </li>
                <li>
                  <a
                    href={`${ARTIFACTS.sepoliaExplorer}/address/${ARTIFACTS.escrow}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    sepolia explorer ↗
                  </a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">onchain</div>
              <ul>
                <li>
                  <span className="footer-ens">{ARTIFACTS.agentEns}</span>
                </li>
                <li>signer {ARTIFACTS.agentWalletShort}</li>
                <li>escrow {ARTIFACTS.escrowShort} · sepolia</li>
                <li>anchor {ARTIFACTS.anchorShort} · 0g galileo</li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>built solo · rodrigo · 2026</span>
            <span>v0.5.0 · sepolia + 0g galileo</span>
          </div>
        </div>
      </footer>
    </>
  );
}
