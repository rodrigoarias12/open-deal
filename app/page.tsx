import { AuditList } from "./components/AuditList";
import { Demo } from "./components/Demo";
import { FAQ } from "./components/FAQ";
import { HeroTerminal } from "./components/HeroTerminal";
import { Loop } from "./components/Loop";
import { Topbar } from "./components/Topbar";
import {
  ARCH_DIAGRAM,
  ARTIFACTS,
  AUTHOR,
  FOOTER_LINKS,
  ONCHAIN_ARTIFACTS,
  PILLARS,
  PLUGINS,
  PROJECT_DEAL,
  SPONSORS,
  VERTICALS,
  WAITLIST,
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
              audit anchor on 0G. Two autonomous parties trading B2B, with receipts. Powered by
              the <span className="em-link"><a href="https://github.com/rodrigoarias12/open-deal/blob/main/PROTOCOL.md" target="_blank" rel="noreferrer">Open Deal protocol</a></span> —
              the framework Anthropic&rsquo;s Project Deal said doesn&rsquo;t exist yet.
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

          <blockquote className="precedent-quote">
            <span className="precedent-quote-mark">&ldquo;</span>
            {PROJECT_DEAL.quote}
            <span className="precedent-quote-mark">&rdquo;</span>
            <footer>— {PROJECT_DEAL.quoteAttribution}</footer>
          </blockquote>

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

      <section id="verticals">
        <div className="container">
          <div className="section-tag">where this fits</div>
          <h2 className="section-title">
            Three industries. Same wedge: high SKU repetition × wide vendor universe × manual price-shopping.
          </h2>
          <p className="section-lede">
            We talked to operators in two of these and the third is the obvious
            extension. The framework is the same; only the connectors and
            policy records change per vertical.
          </p>
          <div className="verticals-grid">
            {VERTICALS.map((v, i) => (
              <div key={i} className="vertical">
                <div className="vertical-eyebrow">{v.eyebrow}</div>
                <h3 className="vertical-title">{v.title}</h3>
                <p className="vertical-body">{v.body}</p>
                <a className="vertical-cta" href={WAITLIST.url} target="_blank" rel="noreferrer">
                  {v.cta} <span className="btn-arrow">→</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="waitlist">
        <div className="container">
          <div className="waitlist-card">
            <div>
              <div className="section-tag">{WAITLIST.title.toLowerCase()}</div>
              <h2 className="section-title">{WAITLIST.title}.</h2>
              <p className="section-lede">{WAITLIST.copy}</p>
              <div className="hero-ctas" style={{ marginTop: 20 }}>
                <a
                  className="btn btn-primary"
                  href={WAITLIST.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {WAITLIST.cta} <span className="btn-arrow">→</span>
                </a>
                <a
                  className="btn"
                  href={`mailto:${AUTHOR.email}?subject=Open%20Deal`}
                >
                  email me <span className="btn-arrow">→</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="builder">
        <div className="container">
          <div className="builder-row">
            <div className="builder-meta">
              <div className="section-tag">built by</div>
              <h2 className="section-title">
                {AUTHOR.name}.
              </h2>
              <p className="section-lede">{AUTHOR.bio}</p>
              <div className="builder-links">
                <a className="builder-link" href={AUTHOR.linkedin} target="_blank" rel="noreferrer">
                  <span className="builder-link-icon">in</span>
                  <span>linkedin / rodrigogonzaloarias</span>
                </a>
                <a className="builder-link" href={AUTHOR.twitter} target="_blank" rel="noreferrer">
                  <span className="builder-link-icon">𝕏</span>
                  <span>{AUTHOR.twitterHandle}</span>
                </a>
                <a className="builder-link" href={`mailto:${AUTHOR.email}`}>
                  <span className="builder-link-icon">@</span>
                  <span>{AUTHOR.email}</span>
                </a>
                <a className="builder-link" href={AUTHOR.github} target="_blank" rel="noreferrer">
                  <span className="builder-link-icon">⌨</span>
                  <span>github / rodrigoarias12</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand-block">
              <div className="brand">
                <img
                  src="/logo.png"
                  alt="Open Deal"
                  width={28}
                  height={28}
                  style={{ display: "block", borderRadius: 6 }}
                />
                <span className="brand-name">
                  open<span className="dim"> </span>deal
                </span>
              </div>
              <p>
                Open onchain framework for trust-minimized agent-mediated
                trade. Identity on ENS, audit on 0G, escrow on Sepolia. Built
                solo for ETHGlobal Open Agents — and shipping past it.
              </p>
              <div className="footer-social">
                <a href={AUTHOR.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn">
                  <span>in</span>
                </a>
                <a href={AUTHOR.twitter} target="_blank" rel="noreferrer" aria-label="X / Twitter">
                  <span>𝕏</span>
                </a>
                <a href={`mailto:${AUTHOR.email}`} aria-label="Email">
                  <span>@</span>
                </a>
                <a href={AUTHOR.github} target="_blank" rel="noreferrer" aria-label="GitHub">
                  <span>⌨</span>
                </a>
              </div>
            </div>

            <div className="footer-col">
              <div className="footer-col-title">product</div>
              <ul>
                {FOOTER_LINKS.product.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      target={l.href.startsWith("http") ? "_blank" : undefined}
                      rel={l.href.startsWith("http") ? "noreferrer" : undefined}
                    >
                      {l.label}
                      {l.href.startsWith("http") && " ↗"}
                    </a>
                  </li>
                ))}
                <li>
                  <a href={WAITLIST.url} target="_blank" rel="noreferrer">
                    waitlist ↗
                  </a>
                </li>
              </ul>
            </div>

            <div className="footer-col">
              <div className="footer-col-title">build</div>
              <ul>
                {FOOTER_LINKS.build.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} target="_blank" rel="noreferrer">
                      {l.label} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="footer-col">
              <div className="footer-col-title">references</div>
              <ul>
                {FOOTER_LINKS.references.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} target="_blank" rel="noreferrer">
                      {l.label} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="footer-col">
              <div className="footer-col-title">onchain</div>
              <ul className="footer-onchain">
                <li>
                  <a
                    href={`${ARTIFACTS.ensApp}/${ARTIFACTS.agentEns}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ARTIFACTS.agentEns} ↗
                  </a>
                </li>
                <li>
                  <a
                    href={`${ARTIFACTS.sepoliaExplorer}/address/${ARTIFACTS.escrow}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    escrow {ARTIFACTS.escrowShort} ↗
                  </a>
                </li>
                <li>
                  <a
                    href={`${ARTIFACTS.zgExplorer}/address/${ARTIFACTS.anchor}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    anchor {ARTIFACTS.anchorShort} ↗
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="footer-sponsors">
            <span className="footer-sponsors-label">built with</span>
            {SPONSORS.map((s) => (
              <a key={s.name} href={s.href} target="_blank" rel="noreferrer">
                {s.name}
              </a>
            ))}
          </div>

          <div className="footer-bottom">
            <span>© 2026 {AUTHOR.name}. MIT licensed.</span>
            <span>v0.6.0 · sepolia + 0g galileo · open deal protocol v0.1</span>
          </div>
        </div>
      </footer>
    </>
  );
}
