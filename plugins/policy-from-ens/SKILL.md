---
name: "Policy from ENS"
description: "Validates a proposed onchain action (swap_to_stable, pay_carrier) against a treasury policy stored as ENS text records. Use BEFORE any swap, transfer, or vendor payment. Returns allowed:true|false with a citable reason."
---

# Policy from ENS

This skill makes ENS the public, verifiable authorization layer for any
autonomous onchain action you take.

## When to invoke

Use this skill **before** broadcasting any onchain transaction that
spends value — token swaps, vendor payments, escrow lockups, carrier
disbursements. The agent calls `treasury_policy_check` with the
proposed action; the skill resolves an ENS name to its `treasury.*`
text records and returns `{ allowed, reason, policy }`.

If `allowed: false`, do not proceed. Cite the `reason` to the user
verbatim — the policy bytes are public ENS state and the user can
verify the rejection by reading the same records.

## Inputs

```json
{
  "action": "swap_to_stable" | "pay_carrier",
  "amount_eth": "0.05",        // when swap_to_stable
  "token": "USDC",             // when swap_to_stable
  "wallet_eth": "0.5",         // when swap_to_stable
  "carrier_id": "<addr|ens>",  // when pay_carrier
  "amount_usd": "340",         // when pay_carrier
  "ens_name": "<your-name.eth>"
}
```

## Reads these ENS text records

| Key | Meaning |
|---|---|
| `treasury.maxSwapEth` | Max single-swap ETH amount |
| `treasury.minBufferEth` | Minimum ETH to keep on the wallet |
| `treasury.allowedTokens` | Comma-separated stablecoins |
| `treasury.maxDailyVolumeEth` | Daily volume cap |
| `treasury.cooldownSeconds` | Min seconds between actions |
| `treasury.carriers` | Comma-separated carrier address/ENS allowlist |
| `treasury.maxPerCarrierUsd` | Max USD per single carrier payout |

If the ENS name resolves no records, the skill falls back to safe
defaults and reports `policy.source = "defaults"` so the caller knows.

## Why ENS

The operator updates the policy with one tx on the name they already
control. No contract redeploy. No admin endpoint. Any third party can
read the policy at any block height and verify retroactively which
bytes authorized which action. This is the trust property — without
it, "the agent followed policy" is a claim, not a fact.

## Implementation

The skill is also published as an OpenClaw plugin:
`@openagents/openclaw-policy-from-ens`. Same TypeScript code, two
runtimes (Anthropic Agent Skills + OpenClaw plugin SDK).

Source: <https://github.com/rodrigoarias12/open-deal/tree/main/plugins/policy-from-ens>

## Skip when

This skill is for **outbound onchain actions**. Reads, balance lookups,
quote requests, and other read-only operations don't need to be gated.
