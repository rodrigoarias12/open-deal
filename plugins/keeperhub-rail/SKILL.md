---
name: "KeeperHub x402 Rail"
description: "Autonomous x402 payment rail. Calls any URL; if the server returns HTTP 402, KeeperHub auto-pays the challenge in USDC and replays the request. Use when you need to access paid data, oracles, sanctions checks, or any other x402-gated service without a human in the loop."
---

# KeeperHub x402 Rail

This skill turns "the agent needs to pay $0.001 to call this API" into
a non-event. No per-call human approval, no API key rotation, no
billing dashboards. The agent calls the URL, and if it's gated, the
KeeperHub wallet pays inline.

## When to invoke

Call `kh_pay` whenever you need data the agent doesn't have and the
provider charges per request: sanctions checks, KYC oracles, market
data, logistics quotes, OpenClaw plugins themselves. The skill
auto-pays HTTP 402 challenges via the KeeperHub agentic wallet (Base
or Tempo, USDC).

Call `kh_balance` to surface the wallet runway before initiating an
expensive call. Call `kh_fund_instructions` when the balance is too
low and a human needs to top up.

## Inputs

```json
{
  "url": "https://oracle.example/sanctions-check",
  "method": "GET" | "POST",      // default GET
  "body": "...",                  // optional JSON-encoded
  "content_type": "application/json",
  "extra_headers": { "Authorization": "..." }
}
```

## Returns

```json
{
  "ok": true,
  "status": 200,
  "url": "https://…",
  "method": "GET",
  "took_ms": 145,
  "body": { /* parsed JSON if applicable */ },
  "note": "If the original response was 402, this body reflects the post-payment retry."
}
```

## Why KeeperHub

The wallet is custodied by Turnkey, signed by an HMAC the SDK
manages, and constrained by safety thresholds in
`~/.keeperhub/safety.json` (auto-approve under N USD, ask between N
and M, deny above M). The agent can't drain the rail; the rail can't
do anything outside the policy.

## Composition

Pair this skill with `policy-from-ens` (gate before the call) and
`audit-to-0g` (anchor the receipt after). Together they form the
trust-minimized loop:

`policy_check → kh_pay → record_audit`

## Implementation

Also published as the OpenClaw plugin
`@openagents/openclaw-keeperhub-rail`. Source:
<https://github.com/rodrigoarias12/open-deal/tree/main/plugins/keeperhub-rail>

## Setup

```bash
npx @keeperhub/wallet add        # provisions ~/.keeperhub/wallet.json
npx @keeperhub/wallet balance    # check Base + Tempo USDC
npx @keeperhub/wallet fund       # funding instructions
```
