# @openagents/openclaw-policy-from-ens

OpenClaw plugin: gates onchain agent actions against a treasury policy
stored as ENS text records. The plugin registers a single tool —
`treasury_policy_check` — that the agent **must** call before any
onchain swap, transfer, or vendor payment.

## Why

Most onchain agents have policy bolted into the agent prompt or hard-coded
in the executor. That makes the policy invisible to third parties and
hard to update without redeploy. This plugin moves the policy onto a
**public, ENS-resolvable surface** — so changing it is a tx on the name
the operator already controls, and any third party can audit which policy
authorized an action at any block height.

## What it does

The `treasury_policy_check` tool reads these text records from an ENS name:

| Key | Meaning |
|---|---|
| `treasury.maxSwapEth` | Max single-swap ETH amount |
| `treasury.minBufferEth` | Minimum ETH to keep on the wallet |
| `treasury.allowedTokens` | Comma-separated stablecoins the agent may swap into |
| `treasury.maxDailyVolumeEth` | Daily volume cap (informational) |
| `treasury.cooldownSeconds` | Min seconds between actions (informational) |
| `treasury.carriers` | Comma-separated carrier addresses/ENS names allowed for payouts |
| `treasury.maxPerCarrierUsd` | Max USD per single carrier payout |

If the ENS name resolves no records, the tool falls back to safe defaults
and reports `policy.source = "defaults"` so the agent's caller knows.

## Usage

System prompt addition the operator should include:

> Before any onchain action (swap, transfer, vendor payment), call
> `treasury_policy_check` with the action details. If the tool returns
> `allowed: false`, you must NOT broadcast the transaction. Cite the
> returned `reason` to the user and stop.

Example call payloads:

```json
{
  "action": "swap_to_stable",
  "amount_eth": "0.05",
  "token": "USDC",
  "wallet_eth": "0.5"
}
```

```json
{
  "action": "pay_carrier",
  "carrier_id": "transnorte.openagents.eth",
  "amount_usd": "340"
}
```

## Env

- `POLICY_ENS_NAME` — default ENS name to read policy from (overridable per-call)
- `MAINNET_RPC_URL` — mainnet RPC for ENS resolution

## Status

POV plugin built for ETHGlobal Open Agents 2026. Not yet published to npm.
Reference example: `examples/treasury-agent.ts`.
