# openagents-treasury

Autonomous treasury agent. Reads your books, follows your onchain policy, executes under it. Every decision signed. Every action audited.

Built solo for [ETHGlobal Open Agents](https://ethglobal.com/events/openagents) (April 24 – May 6, 2026). Single chain: Sepolia.

> The policy is the contract. The agent is the executor. The audit is the receipt.

## What it does

Each tick is a pure function from `(books, policy)` to `(tx, audit)`:

1. **Read books.** Pull cash state from Odoo via JSON-RPC, or from a CSV fixture in dev. Balances, pending invoices, burn rate.
2. **Fetch policy.** Resolve ENS text records under a configured name (defaults `treasury.*`) — `maxSwapEth`, `minBufferEth`, `allowedTokens`, `maxDailyVolumeEth`, `cooldownSeconds`.
3. **Reason.** Send books + policy + wallet balance to Claude (`claude-sonnet-4-6` via Anthropic API or AWS Bedrock). Get a structured decision: `swap_to_stable | hold`, with a one-line rationale.
4. **Execute.** If the decision is a swap, the policy is re-checked, then the tx is built and broadcast through the Uniswap Trading API on Sepolia. Out-of-bounds decisions are downgraded to `hold` with the reason recorded.
5. **Audit.** Every tick — input snapshot, prompt, model output, decision, policy used, tx hash — appended to `audit/<timestamp>.json`.

Outbound HTTP (currently Uniswap, soon any premium endpoint) is wrapped through KeeperHub's `paymentSigner.fetch`, so HTTP 402 / x402 / MPP responses are auto-paid in USDC by a Turnkey-custodied agent wallet — within the same policy.

## Live proof (Sepolia)

Six successful swaps from the agent wallet `0x13aF7f5B2aD2a230d364cc2484380e711fe17AC1`:

- [`0x5bbb43e5…40ada4`](https://sepolia.etherscan.io/tx/0x5bbb43e5b6488a10cb8c6e5055c826dbce6531a0f4ee0ee258e76cf49640ada4) — agent decided + executed via the dashboard
- [`0xff7558b1…ffe2ce`](https://sepolia.etherscan.io/tx/0xff7558b1ebb233d9d3bf72202176b726a8ec996f5a61d9c948e60298caffe2ce) — agent decided + executed via the CLI
- [`0x9730fcd8…e5c1c8`](https://sepolia.etherscan.io/tx/0x9730fcd8a9527ffcaa6d4aeb26fbe94a728c3afed5b1b97a72e2cb5e2ae5c1c8), [`0x0bde27b4…3fa9beb`](https://sepolia.etherscan.io/tx/0x0bde27b48d27550c858f62c1c40bfc77825df2df064f1066f0b8c15063fa9beb), [`0xf0e7ed11…3ff2e24e0b`](https://sepolia.etherscan.io/tx/0xf0e7ed115b5fa15bb78e774bc9f3c9d452348f283289e9cb2b18da3ff2e24e0b), [`0x48701e0d…ef751a7b`](https://sepolia.etherscan.io/tx/0x48701e0d481d276df285b9f194cac3bcb6d5a0231174dcfa41f43c26ef751a7b) — earlier validation runs

Audit JSONs for each are in `audit/`.

## Stack

| Layer | Choice | File |
|---|---|---|
| Reasoning | Claude Sonnet 4.6 (Anthropic API **or** AWS Bedrock — selected by env precedence) | `src/llm/client.ts` |
| Books | Odoo (JSON-RPC) or CSV fixture | `src/sources/odoo.ts`, `src/sources/csv.ts` |
| Policy | ENS text records, `treasury.*` keys | `src/ens/policy.ts` |
| Execution | Uniswap Trading API (V2/V3/V4 routing) | `src/dex/uniswap.ts` |
| x402 / paid endpoints | KeeperHub agentic wallet | `src/payments/keeperhub.ts` |
| Chain | Sepolia (chainId 11155111) via Alchemy or any RPC | `src/chain/client.ts` |
| Audit | Append-only JSON files in `audit/` | `src/audit/logger.ts` |
| UI | Next.js 16 (Turbopack) — landing + live dashboard | `app/` |

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       src/agent/core.ts (entry: runTick)                 │
│                                                                          │
│   ▸ source.fetch()      ▸ loadPolicy(ens)      ▸ llmAsk(claude)          │
│         │                       │                    │                   │
│         ▼                       ▼                    ▼                   │
│   ┌──────────┐           ┌──────────────┐     ┌──────────────┐           │
│   │ sources/ │           │  ens/policy  │     │ llm/client   │           │
│   │  odoo.ts │           │   .ts        │     │   .ts        │           │
│   │  csv.ts  │           └──────┬───────┘     └──────┬───────┘           │
│   └──────────┘                  │                    │                   │
│        │                        │                    │                   │
│        └────────────► state ◄───┴───── prompt ◄──────┘                   │
│                         │                                                │
│                         ▼                                                │
│                 ┌─────────────────┐         ┌────────────────────┐       │
│                 │ dex/uniswap.ts  │ ──tx──▶ │  ethers v6 wallet  │       │
│                 │  (Trading API)  │         │   sepolia.signer   │       │
│                 └────────┬────────┘         └─────────┬──────────┘       │
│                          │                            │                  │
│                          ▼                            ▼                  │
│                 ┌─────────────────┐         ┌────────────────────┐       │
│                 │  audit/logger   │         │ payments/keeperhub │       │
│                 │   audit/*.json  │         │   x402 outbound    │       │
│                 └─────────────────┘         └────────────────────┘       │
└──────────────────────────────────────────────────────────────────────────┘
```

## Run

```bash
cp .env.example .env
# fill what you have. The agent picks its providers from what's set:
#   - ANTHROPIC_API_KEY        → use Anthropic API directly
#   - AWS_REGION (no API key)  → use AWS Bedrock
#   - LLM_PROVIDER=bedrock     → force Bedrock even if API key is set
#   - UNISWAP_API_KEY          → required (free at developers.uniswap.org)
#   - SEPOLIA_RPC_URL          → required for swaps
#   - AGENT_PRIVATE_KEY        → 0x-prefixed; keep on testnet
#   - ENS_NAME                 → optional; loads policy from ENS records,
#                                falls back to safe defaults if unset
#   - ODOO_URL/DB/USERNAME/PASSWORD → optional; CSV fixture if unset

npm install

# CLI: one tick from terminal
npm run dev

# Web: landing + live dashboard at http://localhost:3000
npm run web

# Smoke tests
npm run typecheck
npx tsx scripts/quote-swap.ts        # Uniswap Trading API quote
npx tsx scripts/swap.ts              # one real swap on Sepolia
npx tsx scripts/ens-resolve.ts vitalik.eth   # ENS sanity
npx tsx scripts/ens-policy.ts <ens-name>     # show effective policy
npx tsx scripts/keeperhub-info.ts            # KH wallet info + balance
```

For KeeperHub auto-pay you also need the Turnkey-custodied wallet:

```bash
npx @keeperhub/wallet add        # provisions ~/.keeperhub/wallet.json
npx @keeperhub/wallet balance    # check Base/Tempo USDC balance
npx @keeperhub/wallet fund       # funding instructions
```

Heads-up: `dotenv` truncates unquoted values at `#`. Wrap any password or RPC URL containing `#` in double quotes in `.env`.

## ENS policy keys

When `ENS_NAME` is set in `.env`, the agent loads these text records on every tick (mainnet ENS — works even though execution is on Sepolia):

| Key | Type | Example | Default |
|---|---|---|---|
| `treasury.maxSwapEth` | decimal ETH | `"0.01"` | `"0.01"` |
| `treasury.minBufferEth` | decimal ETH | `"0.05"` | `"0.05"` |
| `treasury.allowedTokens` | csv | `"USDC,DAI"` | `"USDC"` |
| `treasury.maxDailyVolumeEth` | decimal ETH | `"0.05"` | `"0.05"` |
| `treasury.cooldownSeconds` | integer | `"3600"` | `3600` |

Update a record, the agent picks it up next tick. No redeploy.

## Sponsors

- **Uniswap** — Trading API for routing + swap execution. Builder feedback (DX comparison + actionable friction list) in [`FEEDBACK.md`](./FEEDBACK.md#uniswap).
- **ENS** — text records as the agent's policy surface. Notes in [`FEEDBACK.md`](./FEEDBACK.md#ens).
- **KeeperHub** — `paymentSigner.fetch` wraps every outbound HTTP call so HTTP 402 / x402 / MPP responses are auto-paid in USDC. Notes in [`FEEDBACK.md`](./FEEDBACK.md#keeperhub).

## Layout

```
src/
  config.ts                  constants (chain, tokens, model ids), env helpers
  chain/client.ts            ethers v6 provider + wallet
  llm/client.ts              unified Claude client (Anthropic API or Bedrock)
  sources/
    types.ts                 AccountingSource interface, CashState
    csv.ts                   CSV fixture source
    odoo.ts                  JSON-RPC Odoo client + OdooSource
  ens/
    resolver.ts              mainnet ENS lookups
    policy.ts                TreasuryPolicy + loadPolicy()
  dex/uniswap.ts             Trading API getQuote() + executeSwap()
  payments/keeperhub.ts      x402 fetch wrapper + getInfo()
  agent/
    prompts.ts               system + user prompts (policy as law)
    core.ts                  runTick() — fetch, decide, enforce, execute, audit
  audit/logger.ts            append audit/<ts>.json
  index.ts                   CLI entrypoint (smoke test + one tick)

app/                         Next.js 16 (Turbopack)
  page.tsx                   landing
  dashboard/page.tsx         live agent state + Run-tick button
  api/state/route.ts         GET dashboard state
  api/tick/route.ts          POST run a tick from the UI
  components/                Topbar, HeroTerminal, Loop, Demo, AuditList, FAQ
  lib/                       state loader, landing fixtures
  globals.css                token system (light + midnight-green default)

scripts/
  generate-wallet.ts         fresh dev wallet
  quote-swap.ts              Uniswap quote
  swap.ts                    one-shot manual swap on Sepolia
  ens-resolve.ts             resolve a name + read text records
  ens-policy.ts              show the effective TreasuryPolicy
  keeperhub-info.ts          KH wallet info + balance
  probe-odoo.ts              Odoo db-name + auth probe
  test-odoo.ts               live integration check

audit/<ts>.json              one file per tick, immutable
fixtures/company.csv         dev source when Odoo isn't configured
```

## License

MIT.
