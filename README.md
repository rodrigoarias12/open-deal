# Open Deal — agent commerce protocol

**The open, onchain framework for trust-minimized agent-mediated trade.**
Anthropic's [Project Deal](https://www.anthropic.com/features/project-deal) (April 2026)
ran the closed, in-office, off-chain version of this idea — 69 employees, 186 deals,
$4K transacted, 46% would pay for it. Their report named the gap:

> *"Policy and legal frameworks around AI models that transact on our behalf simply
> don't exist yet."*

**Open Deal is that framework.** Three composable plugins (policy gate via ENS,
verifiable audit on 0G, autonomous x402 payments via KeeperHub) plus reference
agents on both sides of the trade.

**Agentic ERP** is the first reference application built on Open Deal — autonomous
B2B procurement: Odoo / Excel / SAP buyers discover Shopify / MercadoLibre / JSON
sellers via ENS subnames, negotiate over HTTP, settle in escrow on Sepolia, anchor
every decision on 0G Chain. Anyone can build their own app on the same framework.

Built solo for [ETHGlobal Open Agents](https://ethglobal.com/events/openagents)
(April 24 – May 6, 2026).

> The policy is the contract. The agent is the executor. The audit is the receipt.

---

## What's onchain right now

| Artifact | Address | Network |
|---|---|---|
| Agent identity (ENS) | [`openagents-treasury.eth`](https://sepolia.app.ens.domains/openagents-treasury.eth) — owner = agent wallet, 11 text records (policy + identity) | Sepolia ENS |
| Seller subname (ENS) | [`seller-acme.openagents-treasury.eth`](https://sepolia.app.ens.domains/seller-acme.openagents-treasury.eth) — `endpoint` text record drives discovery | Sepolia ENS |
| `AuditAnchor.sol` | [`0xc4B91f01352cff1191eBd3d15A521D94ED081d89`](https://chainscan-galileo.0g.ai/address/0xc4B91f01352cff1191eBd3d15A521D94ED081d89) — every audit anchored with policy hash | 0G Galileo |
| `ProcurementEscrow.sol` | [`0x43b31222B22C35D0E5134d03D3f9bb18182360b8`](https://sepolia.etherscan.io/address/0x43b31222B22C35D0E5134d03D3f9bb18182360b8) — buyer locks funds, seller releases on shipment | Sepolia |
| Agent wallet | [`0x13aF7f5B…7AC1`](https://sepolia.etherscan.io/address/0x13aF7f5B2aD2a230d364cc2484380e711fe17AC1) — same key signs swaps, ENS records, escrow, 0G storage uploads | Sepolia + 0G |

> Every demo run produces real txs on Sepolia + 0G. No mocks, no localhost-only
> magic. Anchors at index ≥ 9 on the AuditAnchor contract are from agent runs
> during the build window.

---

## Real-world demand — two operator conversations

We talked to operators in two industries while building. Both described
workflows Open Deal directly automates. Anthropic's [Project Deal](https://www.anthropic.com/features/project-deal)
report validated the *category* (46% of pilot participants would pay for
agent-mediated trade); these conversations validated the *verticals*.

**Logistics, emerging markets — two companies.** Every shipment is a
manual price hunt across a fragmented carrier base: WhatsApp groups,
Excel sheets, email round-robins. Hours per week to find a 5–15% better
quote on the same lane, in the same currency that's anyway hard to
move cross-border. With Open Deal: a buyer agent fan-outs an RFQ to N
carriers via ENS subnames, collects signed quotes, locks USDC in
escrow, releases on shipment-proof. **30 seconds per shipment instead
of an afternoon.**

**Real estate / construction materials — one developer.** A project
manager re-quotes the same shopping list (cement, rebar, drywall,
fixtures, lighting, paint) every project, often weekly across multiple
sites. The vendor universe is wide, the comparison is mechanical, the
savings compound across the portfolio. With Open Deal: the PM drops
their material list (Excel buyer connector), the agent compares against
N hosted seller catalogs published on 0G Storage, human approves only
the outliers via Telegram. **The agent does the comparison; the human
keeps the override.**

Both verticals share three properties:

1. **High SKU repetition** — same items procured over and over
2. **Wide vendor universe** — too many carriers/suppliers to compare manually
3. **Price-shopping currently done by humans** copying numbers between tabs

That's the wedge. The framework is the same for both — only the
connectors and the policy records change per industry.

---

## The framework — three OpenClaw plugins

Any OpenClaw agent can adopt these three plugins to gain governance + autonomous
payments + verifiable audit, in a single plugin manifest, no custom wiring.

| Plugin | Tools | What it gives the agent |
|---|---|---|
| **`policy-from-ens`** | `treasury_policy_check` | Reads policy text records from ENS (mainnet, Sepolia, any chain w/ canonical ENS). Returns `allowed: true \| false` with a quoteable reason. Operator updates the policy with a tx — agent picks it up next call. |
| **`keeperhub-rail`** | `kh_pay`, `kh_balance`, `kh_fund_instructions` | Autonomous x402 payment rail. Any URL the agent calls — paid oracles, sanctions checks, logistics quotes — is auto-paid in USDC by the KeeperHub wallet on Base + Tempo. No human in the loop per call. |
| **`audit-to-0g`** | `record_audit` | Uploads any decision record to 0G Storage and anchors the storage root + policy hash on 0G Chain. A third party can fetch the JSON, recompute the hash, and verify the action was authorized by exactly that policy. |

Plugins live under [`plugins/`](./plugins). Each is a standalone npm-publishable
package with its own `openclaw.plugin.json`, README, and smoke test.

---

## Reference example agents

Both examples consume the same three plugins. Different domains, identical
trust property.

### `examples/example-agent/` — autonomous treasury

A single-tick agent that:

1. fetches external context via `kh_pay` (autonomous x402 payment),
2. asks `treasury_policy_check` whether the proposed swap fits ENS-resolved
   bounds,
3. executes the swap (mocked here; real Uniswap broadcast in the legacy
   `src/agent/core.ts` flow),
4. records the full snapshot via `record_audit` to 0G Storage + 0G Chain.

Run:

```bash
npx tsx examples/example-agent/run.ts
```

### `apps/buyer-agent/` + `apps/seller-agent/` — Agentic ERP (B2B procurement)

Two **separate processes**, peer-to-peer over HTTP, each identified by an ENS
name, each transaction policy-gated and audit-anchored.

```
apps/seller-agent/  HTTP server on :3030
  GET /catalog              published SKUs, stock, prices
  POST /rfq                 returns a signed quote for a (sku, quantity) request

apps/buyer-agent/   per-tick loop
  ├─ read inventory needs from real Odoo (fallback to fixture)
  ├─ resolve seller endpoints from ENS subnames (text record `endpoint`)
  ├─ broadcast RFQ to each seller, collect signed quotes
  ├─ pattern-detect a recurring purchase + better-deal trigger
  │   "3 past purchases at avg $10.10/u → new offer $6.50/u → 36% saving"
  ├─ policy gate via @openagents/openclaw-policy-from-ens
  ├─ ProcurementEscrow.createOrder() — buyer locks funds onchain
  └─ record_audit via @openagents/openclaw-audit-to-0g
       full record (RFQ, all quotes, winner, pattern, policy, escrow tx)
       uploaded to 0G Storage, anchored on 0G Chain
```

Run:

```bash
# terminal 1
npx tsx apps/seller-agent/src/index.ts

# terminal 2
npx tsx apps/buyer-agent/src/index.ts
```

---

## Sponsor map

| Sponsor | Track / focus | What's shipped |
|---|---|---|
| **0G** | Track 1: Best Agent Framework, Tooling & Core Extensions | 3 OpenClaw plugins + working example agent + ARCHITECTURE.md + AuditAnchor on 0G Chain |
| **0G** | Track 2: Best Autonomous Agents, Swarms & iNFT Innovations | Buyer + seller multi-agent flow with shared 0G Storage memory + 0G Chain anchor per decision |
| **ENS** | Best Integration for AI Agents (Identity) | Agent owns `openagents-treasury.eth`, addr resolves to wallet, identity records (description, url, com.github, notice). Seller subnames carry `endpoint` text records used for runtime discovery — no hardcoded URLs in the buyer. |
| **ENS** | Most Creative Use of ENS | Text records under `treasury.*` are the agent's governance surface. The policy bytes that authorize an onchain action are public ENS state — operator updates the policy with one tx, agent picks it up next call. |
| **KeeperHub** | Best Use of KeeperHub | `keeperhub-rail` plugin exposes 3 tools (`kh_pay`, `kh_balance`, `kh_fund_instructions`) any OpenClaw agent can adopt for autonomous x402 payments. The example agent calls `kh_pay` on every tick. |
| **KeeperHub** | Builder Feedback Bounty | [`FEEDBACK.md`](./FEEDBACK.md) — specific UX issues, bugs, and feature requests from the build, plus a note on the npm package name confusion that cost the day-1 spike 30 minutes. |

---

## Stack

| Layer | Choice | File |
|---|---|---|
| Reasoning | Claude Sonnet 4.6 (Anthropic API or AWS Bedrock — env-selected) | `src/llm/client.ts` |
| Books / Inventory | Odoo (JSON-RPC) — accounting + product.product low-stock query | `src/sources/odoo.ts`, `src/sources/odoo-inventory.ts` |
| Identity | ENS (Sepolia) — agent name + seller subnames | `scripts/ens-register.ts`, `scripts/ens-set-subname.ts` |
| Policy | ENS text records under `treasury.*` | `plugins/policy-from-ens/` |
| Execution (legacy treasury) | Uniswap Trading API on Sepolia | `src/dex/uniswap.ts` |
| Execution (procurement) | `ProcurementEscrow.sol` on Sepolia | `contracts/ProcurementEscrow.sol` |
| x402 / paid endpoints | KeeperHub agentic wallet (Base + Tempo) | `plugins/keeperhub-rail/`, `src/payments/keeperhub.ts` |
| Memory + Audit | 0G Storage (full JSON) + AuditAnchor on 0G Chain | `plugins/audit-to-0g/`, `contracts/AuditAnchor.sol` |
| Chain (treasury, escrow) | Sepolia (chainId 11155111) | `src/chain/client.ts` |
| Chain (audit anchor) | 0G Galileo (chainId 16602) | `contracts/AuditAnchor.deployment.json` |
| UI | Next.js 16 (Turbopack) | `app/` |

---

## Run

```bash
cp .env.example .env
# fill what you have. The agent picks providers from what's set:
#   - ANTHROPIC_API_KEY        → Anthropic API directly
#   - AWS_REGION (no API key)  → AWS Bedrock
#   - LLM_PROVIDER=bedrock     → force Bedrock even if API key is set
#   - SEPOLIA_RPC_URL          → required for swaps + escrow
#   - AGENT_PRIVATE_KEY        → 0x-prefixed; keep on testnet
#   - ENS_NAME                 → defaults to openagents-treasury.eth
#   - MAINNET_RPC_URL          → defaults to Sepolia public RPC for ENS
#   - UNISWAP_API_KEY          → for legacy treasury swap demo
#   - ODOO_URL/DB/USERNAME/PASSWORD → optional; fixture if unset
#   - ZG_RPC_URL / ZG_INDEXER_URL → optional, sane defaults

npm install

# Treasury agent (legacy, single-tick)
npm run dev

# Web: landing + live dashboard
npm run web

# Agentic ERP end-to-end (two terminals)
npx tsx apps/seller-agent/src/index.ts          # term 1
npx tsx apps/buyer-agent/src/index.ts           # term 2

# Plugin smoke tests (run in isolation)
npx tsx plugins/policy-from-ens/smoke-test.ts
npx tsx plugins/audit-to-0g/smoke-test.ts
npx tsx plugins/keeperhub-rail/smoke-test.ts

# 0G + ENS scripts (already run during build)
npx tsx scripts/zg-deploy-anchor.ts             # deploy AuditAnchor to 0G
npx tsx scripts/zg-anchor-test.ts               # write a test anchor
npx tsx scripts/ens-register.ts                 # register the .eth name
npx tsx scripts/ens-set-records.ts              # set 11 text records
npx tsx scripts/ens-set-subname.ts <label> <url>  # add a seller subname
npx tsx scripts/deploy-escrow.ts                # deploy ProcurementEscrow
npx tsx scripts/escrow-test.ts                  # exercise full escrow lifecycle
```

For KeeperHub auto-pay you also need the Turnkey-custodied wallet:

```bash
npx @keeperhub/wallet add        # provisions ~/.keeperhub/wallet.json
npx @keeperhub/wallet balance    # check Base/Tempo USDC balance
npx @keeperhub/wallet fund       # funding instructions
```

Heads-up: `dotenv` truncates unquoted values at `#`. Wrap any password or RPC URL containing `#` in double quotes in `.env`.

---

## ENS policy keys

When `ENS_NAME` resolves on the configured chain, the agent loads these text
records on every tick. Update a record, the agent picks it up next tick — no
redeploy.

| Key | Type | Example | Default |
|---|---|---|---|
| `treasury.maxSwapEth` | decimal ETH | `"0.01"` | `"0.01"` |
| `treasury.minBufferEth` | decimal ETH | `"0.05"` | `"0.05"` |
| `treasury.allowedTokens` | csv | `"USDC,DAI"` | `"USDC"` |
| `treasury.maxDailyVolumeEth` | decimal ETH | `"0.05"` | `"0.05"` |
| `treasury.cooldownSeconds` | integer | `"3600"` | `3600` |
| `treasury.carriers` | csv of addrs/ENS | `"acme.eth,boxes.eth"` | `""` (empty = permissive) |
| `treasury.maxPerCarrierUsd` | USD | `"1000"` | `"1000"` |

---

## Layout

```
plugins/
  policy-from-ens/                 OpenClaw plugin: ENS text records as policy gate
  audit-to-0g/                     OpenClaw plugin: verifiable audit on 0G
  keeperhub-rail/                  OpenClaw plugin: autonomous x402 payments

apps/
  buyer-agent/                     Agentic ERP buyer (Odoo + RFQ + escrow + audit)
  seller-agent/                    Agentic ERP seller (catalog + signed quotes)

examples/
  example-agent/                   reference 90-line agent using the 3 plugins

contracts/
  AuditAnchor.sol                  on 0G Chain — anchors storage roots + policy hashes
  ProcurementEscrow.sol            on Sepolia — buyer locks, seller releases
  *.deployment.json                ABI + address artifacts

scripts/
  zg-{deploy-anchor,anchor-test,spike}.ts
  ens-{register,set-records,set-subname}.ts
  deploy-escrow.ts, escrow-test.ts
  generate-wallet.ts, quote-swap.ts, swap.ts
  ens-resolve.ts, ens-policy.ts
  keeperhub-info.ts, probe-odoo.ts, test-odoo.ts

src/                               legacy treasury agent (single-tick swap)
  agent/core.ts, ens/, dex/, payments/, sources/, audit/, llm/, chain/

app/                               Next.js 16 — landing + live dashboard

audit/<ts>.json                    one file per legacy tick (pre-0G migration)
fixtures/company.csv               CSV source when Odoo isn't configured
ARCHITECTURE.md                    layered diagram + trust property
FEEDBACK.md                        sponsor DX feedback (Uniswap, ENS, KeeperHub, 0G)
```

---

## License

MIT.
