# openagents-treasury

Autonomous treasury agent. Allocates idle capital onchain under signed policies, with a full audit trail.

Built for [ETHGlobal Open Agents](https://ethglobal.com/events/openagents) (April 24 – May 6, 2026). Single chain: Sepolia.

## What it does

Each tick the agent:

1. Reads cash state from the company's ERP (Odoo via JSON-RPC, or a CSV source for dev).
2. Fetches the active policy from an ENS text record (max swap size, allowed tokens, blackout windows, daily caps).
3. Asks Claude what to do with the idle balance, given runway, pending invoices, and burn.
4. If the decision is a swap, executes it via the Uniswap Trading API on Sepolia.
5. Appends the input snapshot, prompt, model output, and resulting tx hash to `audit/<timestamp>.json`.

The policy is the contract. The agent is the executor. The audit is the receipt.

## Stack

- TypeScript end to end (no Python bridge)
- `ethers` v6 for signing and reading chain state
- Anthropic Claude (Sonnet 4.6) as the reasoning layer
- Native Odoo JSON-RPC client over `fetch`
- Uniswap Trading API for quote + swap routing
- Sepolia for all onchain execution

ENS for policy storage and KeeperHub for recurring payments are next.

## Run

```
cp .env.example .env
# fill ANTHROPIC_API_KEY, SEPOLIA_RPC_URL, AGENT_PRIVATE_KEY,
# UNISWAP_API_KEY, and (optionally) the four ODOO_* vars

npm install
npm run dev
```

Without ODOO_* set, the agent uses `fixtures/company.csv` as the source. Without `ANTHROPIC_API_KEY` it runs the smoke tests but skips the LLM tick.

Heads-up: `dotenv` truncates unquoted values at `#`. Wrap any password or RPC URL containing `#` in double quotes in `.env`.

## Sponsors

- **Uniswap** — Trading API for routing + swap execution. See `FEEDBACK.md` for the builder feedback writeup.
- **ENS** — policy registry on a project subdomain.
- **KeeperHub** — scheduled payroll and vendor payments.

## Layout

```
src/
  config.ts            constants + env helpers
  chain/client.ts      ethers provider + wallet
  llm/anthropic.ts     lazy Claude client
  sources/             AccountingSource interface, CsvSource, OdooSource
  dex/uniswap.ts       Uniswap Trading API client
  agent/               prompts + runTick()
  audit/logger.ts      JSON audit trail
  index.ts             smoke test + tick

scripts/
  generate-wallet.ts   prints a fresh dev wallet
  probe-odoo.ts        DB name + auth probe
  test-odoo.ts         live integration check
  quote-swap.ts        Uniswap quote smoke test
  swap.ts              one-shot manual swap
```
