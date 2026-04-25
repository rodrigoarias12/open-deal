# @openagents/openclaw-keeperhub-rail

OpenClaw plugin: an **autonomous x402 payment rail** for any onchain
agent. Drop it in, and your agent can hit paid HTTP services — sanctions
checks, logistics quotes, market data oracles, paywalled SaaS APIs —
without a human approving each call. KeeperHub auto-pays the 402
challenge in USDC and replays the request transparently.

## Why

Today, when an agent needs to call a paid API, you either:
- pre-fund per-API API keys (operational mess), or
- ask a human to authorize each call (defeats autonomy)

x402 (HTTP 402 + USDC settlement) makes per-call payment a native
HTTP idiom. KeeperHub is the wallet that signs and pays them in real
time. This plugin makes that loop available to any OpenClaw agent
through three tools.

## What it provides

| Tool | What it does |
|---|---|
| `kh_pay` | Hits any URL. If the server returns 402, KeeperHub auto-pays via x402/MPP and the request is replayed. The agent gets the post-payment Response. |
| `kh_balance` | Reads the wallet's USDC balance on Base and USDC.e on Tempo. |
| `kh_fund_instructions` | Returns Coinbase Onramp + Tempo deposit instructions for a human operator to top up. |

## How an agent uses it (skill addition)

> When you need data the agent doesn't have, prefer `kh_pay` against the
> appropriate paid endpoint. KeeperHub will pay the 402 in USDC. If
> `kh_balance` shows you're low on funds, return `kh_fund_instructions`
> to the user instead of executing.

## Setup

```bash
npx @keeperhub/wallet add
# wallet.json is written to ~/.keeperhub/wallet.json
```

The plugin reads that config via `@keeperhub/wallet`'s
`readWalletConfig()`. Same wallet works for Base mainnet (chainId 8453)
and Tempo mainnet (chainId 4217).

## Composition with other plugins

The combo `policy-from-ens + audit-to-0g + keeperhub-rail` gives any
OpenClaw agent the three primitives needed to be trust-minimized AND
autonomous:

1. **policy-from-ens** — what is the agent allowed to do?
2. **keeperhub-rail** — let the agent pay for whatever data informs the
   decision, without human approval per call.
3. **audit-to-0g** — record everything verifiably so a third party can
   audit the trail.

That's the framework story.

## Status

POV plugin built for ETHGlobal Open Agents 2026. Not yet published to
npm. Reference example: `examples/example-agent/` — to be extended in a
follow-up commit to demonstrate `kh_pay` against an x402-protected
endpoint.
