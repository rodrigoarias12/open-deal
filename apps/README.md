# Agentic ERP apps

Two runnable agents that demonstrate the framework end-to-end:

- **seller-agent** — HTTP server with a JSON catalog. Responds to RFQ
  posts with a price+delivery quote signed by the seller's wallet.
- **buyer-agent** — reads inventory needs, broadcasts RFQs to a registry
  of sellers, picks the best quote, runs the policy gate, and writes a
  verifiable audit to 0G.

## Run locally

Two terminals:

```bash
# terminal 1 — seller listens on port 3030
npx tsx apps/seller-agent/src/index.ts

# terminal 2 — buyer broadcasts and picks a winner
npx tsx apps/buyer-agent/src/index.ts
```

The buyer prints a per-RFQ trace and ends with the 0G anchor index for
the decision. Visit the printed explorer URLs to verify the audit
onchain.

## Configuration

| File | What |
|---|---|
| `seller-agent/catalog.json` | SKUs, prices, stock, delivery times. The seller side that "anyone can drop in". |
| `buyer-agent/needs.json` | Inventory needs the buyer is sourcing. Will be auto-populated from Odoo in the next step. |
| `buyer-agent/sellers.json` | Discovered seller endpoints. Currently a fixture; in the production flow this is resolved from ENS subnames (`seller-*.openagents-treasury.eth` → `endpoint` text record). |

## Why this shape

Two **separate processes** talking peer-to-peer over HTTP, each agent
identified by an ENS name, each transaction policy-gated and audit-anchored.
No central broker. The framework's job is to make this composition trivial.

## What's next (build order)

- ENS subname registration (`seller-acme.openagents-treasury.eth`) so
  buyer discovers sellers via `endpoint` text record instead of the
  fixture
- `ProcurementEscrow.sol` on Sepolia: buyer locks USDC after winning a
  quote, seller releases on shipment confirmation
- Telegram channel for human-in-the-loop approval before lock
- Pattern detection: buyer notices recurring need + better-deal trigger
