# Architecture

How the OpenClaw plugins, the example agent, and the 0G integration fit together.

## High-level

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          EXAMPLE AGENT (per-tick)                        │
│                                                                          │
│   ┌──────────┐   ┌──────────────────┐   ┌────────┐   ┌────────────────┐ │
│   │ ERP /    │   │ POLICY GATE       │   │ EXECUTE│   │ VERIFIABLE      │ │
│   │ inputs   │──▶│ (pre-broadcast)   │──▶│ (sim   │──▶│ AUDIT (post)    │ │
│   │ snapshot │   │                   │   │  or    │   │                 │ │
│   └──────────┘   │ policy-from-ens   │   │  real) │   │ audit-to-0g     │ │
│                  │ plugin            │   │        │   │ plugin          │ │
│                  └──────────────────┘   └────────┘   └────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                            │                              │
            ┌───────────────┘                              │
            ▼                                              ▼
   ┌──────────────────┐                          ┌──────────────────────┐
   │  ENS (mainnet)    │                          │  0G STORAGE (Galileo) │
   │                   │                          │                       │
   │  treasury.eth     │                          │  full audit JSON      │
   │  ├ maxSwapEth     │                          │  per tick, content-   │
   │  ├ allowedTokens  │                          │  addressed by         │
   │  ├ minBufferEth   │                          │  rootHash             │
   │  ├ carriers       │                          └─────────┬─────────────┘
   │  └ maxPerCarrier  │                                    │ rootHash + policyHash
   └──────────────────┘                                     ▼
                                                  ┌──────────────────────┐
                                                  │  0G CHAIN (Galileo)   │
                                                  │                       │
                                                  │  AuditAnchor.sol      │
                                                  │  0xc4B91f01…          │
                                                  │  (cidRoot, policyHash,│
                                                  │   timestamp, agent)   │
                                                  │  + Anchored event     │
                                                  └──────────────────────┘
```

## What lives where

| Layer | Stack | Role |
|---|---|---|
| **Reasoning** | OpenClaw runtime + LLM (Anthropic / Bedrock / 0G Compute optional) | The agent decides what to do |
| **Governance** | ENS text records on the operator's name | Public, third-party-readable policy bounds |
| **Execution** | Sepolia (Uniswap swap demo), KeeperHub (production rail) | Where money actually moves |
| **Memory & Audit** | 0G Storage (full JSON) + 0G Chain (anchor) | Verifiable history |

## The two OpenClaw plugins (Track 1: framework primitives)

### `policy-from-ens`

- Registers tool: `treasury_policy_check`
- Reads ENS text records under `treasury.*` prefix
- Validates a proposed `swap_to_stable` or `pay_carrier` action
- Returns `{ allowed, reason, policy }` for the agent (and the audit
  record) to cite verbatim

### `audit-to-0g`

- Registers tool: `record_audit`
- Serialises any audit JSON, uploads to 0G Storage via
  `@0gfoundation/0g-ts-sdk` Indexer
- Hashes the policy field (or accepts an explicit hash) and posts it
  along with the storage root to the AuditAnchor contract on 0G Chain
- Returns full proof artifacts (CIDs, tx hashes, explorer URLs)

Both plugins are **standalone**: the example agent is the reference
consumer, but any OpenClaw agent can adopt them by adding two lines to
its plugin manifest.

## The example agent (Track 1: working example)

`examples/example-agent/run.ts` — under 100 lines. Loads both plugins
and runs one tick:

```
read snapshot → policy_check → (if allowed) execute → record_audit → print receipt
```

Output is a flat list of proof URLs. The same shape will be produced by
any OpenClaw agent that adopts the plugins.

## Trust property

Given a chain anchor (cidRoot, policyHash, timestamp, agent) on 0G Chain,
a third party can:

1. Fetch the audit JSON from 0G Storage by `cidRoot`
2. Recompute `keccak256(JSON.stringify(audit.policy))` and compare to
   `policyHash`
3. Verify the policy snapshot was the bytes that authorized the action
   at `timestamp`, by the wallet `agent`

No trust in the operator beyond their public ENS name.

## Why this is framework work, not an app

The plugins do **not** care what the agent is for. Treasury, payroll,
vendor payments, RFP responses, autonomous fleet operators — all share
the same property: an action onchain that should be (a) gated by public
policy and (b) recorded in a verifiable trail.

A consumer of these plugins gets both for free. That's the framework
claim, and the example agent is the proof.
