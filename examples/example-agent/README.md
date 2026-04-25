# Example Agent — using `policy-from-ens` + `audit-to-0g`

This is the reference example agent for the OpenClaw plugins shipped in
this repo. It demonstrates the bookend pattern any onchain agent should
follow:

> **policy gate (before)** → decide → **execute** → **verifiable audit (after)**

## What it does

The agent simulates a treasury tick:

1. Reads a **cash state fixture** (in real life this would be Odoo / ERP
   / chain state).
2. Calls **`treasury_policy_check`** (from `@openagents/openclaw-policy-from-ens`)
   to validate the proposed action against an ENS-resolvable policy.
3. If the policy gates `allowed: true`, it simulates a swap (mocked tx hash).
4. Calls **`record_audit`** (from `@openagents/openclaw-audit-to-0g`) to
   upload the full snapshot to 0G Storage and anchor the storage root +
   policy hash on 0G Chain.
5. Prints a readable receipt with all proof artifacts.

The agent is intentionally minimal — under 100 lines — to make it obvious
that the OpenClaw plugins are doing the heavy lifting.

## Run

```bash
# from repo root
npx tsx examples/example-agent/run.ts
```

Required env (already in `.env.example`):

- `AGENT_PRIVATE_KEY` — wallet that signs the audit anchor on 0G Chain
- `ZG_AUDIT_ANCHOR` — address of the deployed AuditAnchor contract
  (defaults to `contracts/AuditAnchor.deployment.json` if omitted)

## Sample output

```
[example] tick at 2026-04-25T13:42:01.000Z
[example] cash state: 0.20 ETH idle, $1200 pending, $4500 burn
[example] policy check…
  → allowed=true, source=defaults
[example] simulated swap: 0.005 ETH → ~12.34 USDC
  → tx 0xfakeswap…
[example] audit to 0G…
  → storage cidRoot 0x5fa7ebb…
  → chain tx       0x250cdd5…
  → anchor index   3
[example] receipt:
  https://chainscan-galileo.0g.ai/tx/0x250cdd5…
  https://storagescan-galileo.0g.ai/tx/0x5fa7ebb…
```

## Why this is the framework story

A different agent — say a payroll agent, a vendor payment agent, a
liquidity manager — can adopt the same two plugins and inherit:

- **public, governable policy** (the operator changes ENS records, the
  agent picks up the new bounds next tick)
- **third-party-auditable history** (any observer can fetch the JSON
  from 0G Storage by root hash and verify it against the on-chain anchor)

That's framework work, not application code. The example agent below
proves the plugins compose — and any builder can copy this 90-line file
as a starting point.
