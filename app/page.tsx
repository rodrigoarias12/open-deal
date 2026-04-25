import Link from "next/link";
import { loadDashboardState } from "./lib/state";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const s = await loadDashboardState();
  const swapTicks = s.recentTicks.filter((t) => t.tick.execution).length;
  const totalTicks = s.recentTicks.length;
  const ethBalance = Number(s.agentWallet.ethBalance || "0");

  return (
    <main className="landing">
      <nav className="brand">
        <span className="logo">openagents-treasury</span>
        <span>
          <a href="https://github.com" target="_blank">github</a>
          <Link href="/dashboard">dashboard</Link>
        </span>
      </nav>

      <section className="hero">
        <div className="eyebrow">ETHGlobal Open Agents 2026</div>
        <h1>
          An autonomous treasury agent that <em>actually</em> moves money.
        </h1>
        <p className="lede">
          Reads the company's books from Odoo. Reads its policy from ENS text records.
          Decides on Claude (via AWS Bedrock). Executes onchain through Uniswap.
          Pays for premium APIs through KeeperHub auto-pay. Every tick is signed,
          audited, and reproducible.
        </p>
        <div className="cta-row">
          <Link href="/dashboard">
            <button className="primary">Open the live dashboard →</button>
          </Link>
          <a href="https://sepolia.etherscan.io/address/0x13aF7f5B2aD2a230d364cc2484380e711fe17AC1" target="_blank">
            <button className="cta-secondary">View onchain history</button>
          </a>
        </div>
      </section>

      <div className="feature-grid">
        <div className="feature">
          <div className="num">01 / Books</div>
          <h3>Live ERP, not a CSV.</h3>
          <p>
            Connects to Odoo via JSON-RPC. The agent sees real cash flow,
            pending invoices, and burn rate the same way the CFO does — currency
            auto-detected per company.
          </p>
        </div>
        <div className="feature">
          <div className="num">02 / Policy</div>
          <h3>Governed by ENS.</h3>
          <p>
            Treasury limits live in ENS text records under a name you own:
            <code> treasury.maxSwapEth</code>, <code>treasury.minBufferEth</code>,
            <code> treasury.allowedTokens</code>. Update policy with a tx, no
            redeploy.
          </p>
        </div>
        <div className="feature">
          <div className="num">03 / Action</div>
          <h3>Onchain by default.</h3>
          <p>
            Claude decides. The Uniswap Trading API picks the route across V2/V3/V4.
            The agent signs and broadcasts. Every action is policy-checked before
            it leaves the wallet.
          </p>
        </div>
      </div>

      <section className="flow">
        <h2>Each tick, end to end</h2>
        <div className="flow-diagram">
          <div className="flow-step">
            <div className="label">Inputs</div>
            <div className="name">Odoo + ENS</div>
            <div className="detail">cash state, policy bounds, wallet balance</div>
          </div>
          <div className="arrow">→</div>
          <div className="flow-step">
            <div className="label">Reasoning</div>
            <div className="name">Claude · Bedrock</div>
            <div className="detail">claude-sonnet-4-6 returns swap or hold + reason</div>
          </div>
          <div className="arrow">→</div>
          <div className="flow-step">
            <div className="label">Execution</div>
            <div className="name">Uniswap + KH</div>
            <div className="detail">policy-checked, broadcast, audit JSON written</div>
          </div>
        </div>
        <div className="flow-note">
          <div>
            <div className="label">No new code at decision time</div>
            <div className="text">
              Tweak the policy in ENS — the agent picks it up next tick. No redeploy.
            </div>
          </div>
          <div>
            <div className="label">Auditable by anyone</div>
            <div className="text">
              The policy that authorized a tx is public ENS state at the tx's
              block height.
            </div>
          </div>
          <div>
            <div className="label">Pays its own way</div>
            <div className="text">
              KeeperHub auto-pays HTTP 402 in USDC, scoped by the same policy.
            </div>
          </div>
        </div>
      </section>

      <section className="proof">
        <div className="stat">
          <div className="num accent">{swapTicks}</div>
          <div className="label">Live ticks logged</div>
        </div>
        <div className="stat">
          <div className="num">{ethBalance.toFixed(3)}</div>
          <div className="label">ETH on agent wallet</div>
        </div>
        <div className="stat">
          <div className="num">{s.policy.maxSwapEth}</div>
          <div className="label">Policy maxSwapEth</div>
        </div>
        <div className="stat">
          <div className="num">{s.llm.provider}</div>
          <div className="label">LLM provider</div>
        </div>
      </section>

      <footer>
        <div>built for ETHGlobal Open Agents 2026 · sepolia</div>
        <div className="right">
          <Link href="/dashboard">dashboard</Link>
          <a href="https://sepolia.etherscan.io" target="_blank">explorer</a>
        </div>
      </footer>
    </main>
  );
}
