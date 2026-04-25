# @openagents/openclaw-audit-to-0g

OpenClaw plugin: persists agent audit records to **0G Storage** and
anchors the storage root on **0G Chain**. Verifiable history for
autonomous agents.

## Why

Most agents log decisions to a local JSON file. That's fine until you
need a third party to verify "the agent took action X under policy Y at
time T" — at which point local logs are worthless.

This plugin closes that loop:

1. The full audit JSON (input snapshot + policy + model output + tx hash)
   goes to 0G Storage. Returns a content-addressed root hash.
2. The root hash + a hash of the policy used go to a small `AuditAnchor`
   contract on 0G Chain. Public, indexable, ordered.

A third party with the chain anchor can:
- Fetch the JSON from 0G Storage by root hash
- Recompute keccak256 of the policy field, compare to the on-chain `policyHash`
- Verify the action was authorized by exactly that policy at that block

## What it does

Registers one tool: `record_audit`.

```json
{
  "record": {
    "at": "2026-04-25T13:00:00Z",
    "decision": { "action": "swap_to_stable", "amount_eth": "0.005" },
    "execution": { "swapTxHash": "0x...", "amountUsdc": "12.34" },
    "policy": { "maxSwapEth": "0.01", "allowedTokens": ["USDC"] }
  }
}
```

Returns:

```json
{
  "ok": true,
  "cidRoot": "0x5fa7ebb4...",
  "policyHash": "0x2f33fc66...",
  "storage": {
    "txHash": "0x67b7cda9...",
    "explorer": "https://storagescan-galileo.0g.ai/tx/..."
  },
  "chain": {
    "anchorAddress": "0xc4B91f01352cff1191eBd3d15A521D94ED081d89",
    "txHash": "0x250cdd56...",
    "blockNumber": 29734390,
    "explorer": "https://chainscan-galileo.0g.ai/tx/...",
    "anchorIndex": "2"
  }
}
```

## Env

- `AGENT_PRIVATE_KEY` — same wallet that signs onchain ops; needs 0G testnet balance
- `ZG_RPC_URL` (default `https://evmrpc-testnet.0g.ai`)
- `ZG_INDEXER_URL` (default `https://indexer-storage-testnet-turbo.0g.ai`)
- `ZG_AUDIT_ANCHOR` — address of the deployed AuditAnchor contract

## Status

POV plugin built for ETHGlobal Open Agents 2026. Anchored against an
AuditAnchor reference implementation deployed on 0G Galileo testnet.
