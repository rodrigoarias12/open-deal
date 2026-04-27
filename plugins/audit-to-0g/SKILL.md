---
name: "Audit to 0G"
description: "Persists an agent decision record to 0G Storage and anchors the storage root + policy hash on 0G Chain. Use AFTER any onchain action so a third party can verify the decision was authorized by the policy you cite."
---

# Audit to 0G

This skill closes the trust loop. Every action your agent takes onchain
becomes a content-addressed audit record that anyone can fetch and
verify against the same chain state the policy lives on.

## When to invoke

Call `record_audit` **after** every onchain action — successful or
not. The skill uploads the full decision JSON (input snapshot, policy
snapshot, model output, resulting tx hash, anything you want to be
recoverable) to 0G Storage. It then writes the storage root hash and a
`keccak256` of the policy bytes to the `AuditAnchor` contract on 0G
Chain.

A third party with just the chain anchor can:

1. Fetch the JSON from 0G Storage by `cidRoot`.
2. Recompute `keccak256(JSON.stringify(record.policy))`.
3. Compare to the on-chain `policyHash`.
4. Conclude — without trusting the operator — that the action was
   authorized by exactly that policy at that timestamp by that wallet.

## Inputs

```json
{
  "record": { /* the full audit JSON for this decision */ },
  "policy_hash": "0x…",       // optional, derived from record.policy if present
  "rpc_url": "https://…",     // optional, defaults to 0G Galileo
  "indexer_url": "https://…", // optional
  "anchor_address": "0x…"     // optional, defaults to deployed AuditAnchor
}
```

## Returns

```json
{
  "ok": true,
  "cidRoot": "0x…",
  "policyHash": "0x…",
  "storage": { "txHash": "0x…", "explorer": "https://storagescan-galileo.0g.ai/tx/…" },
  "chain": {
    "anchorAddress": "0xc4B91f01352cff1191eBd3d15A521D94ED081d89",
    "txHash": "0x…",
    "blockNumber": 0,
    "explorer": "https://chainscan-galileo.0g.ai/tx/…",
    "anchorIndex": "14"
  }
}
```

## Why 0G

Storage: 0G is content-addressed. The `cidRoot` is the keccak Merkle
root of the bytes; the JSON cannot be silently modified after the fact.

Chain: anchoring the cidRoot + policyHash on 0G Chain creates a
permanent, ordered, public log. No central indexer required — the chain
itself is the index.

## Implementation

Also published as the OpenClaw plugin
`@openagents/openclaw-audit-to-0g`. Source:
<https://github.com/rodrigoarias12/open-deal/tree/main/plugins/audit-to-0g>

## Skip when

Read-only operations don't need an audit anchor. The cost is the 0G gas
+ storage write; if the action doesn't move value, it's not worth
anchoring.
