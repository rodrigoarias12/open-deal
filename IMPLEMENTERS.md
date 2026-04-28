# Open Deal · Implementers Guide

> **You are reading this because you want to make an agent — buyer, seller,
> or both — speak the Open Deal protocol.** This document is written
> AX-first: an AI agent (Claude, GPT, Gemini, Llama, etc.) can read this
> file, look at the reference implementations, and produce a conformant
> implementation in any stack without further help. Humans can read it too.

If you'd rather read the wire-level spec directly, see
[`PROTOCOL.md`](./PROTOCOL.md).

---

## TL;DR for AI agents

You implement Open Deal by:

1. Picking your **side** — buyer or seller
2. Picking your **data source** — Odoo / SAP / Excel / Shopify / your custom DB / anything
3. Writing **one adapter file** (~80–150 LOC) that maps your source to one of the two
   typed interfaces below
4. Plugging the adapter into the reference agent loop, or writing your own loop
   that follows the wire protocol in `PROTOCOL.md`

The protocol layer **never changes**. Your stack does. That's the entire point.

```
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  BUYER stack     │   │   OPEN DEAL      │   │  SELLER stack    │
│  (your ERP /     │   │   PROTOCOL       │   │  (your commerce  │
│   spreadsheet /  │ ⟶ │   v0.1           │ ⟵ │   backend)       │
│   custom)        │   │  ─────────────   │   │                  │
│                  │   │  RFQ + signed    │   │                  │
│  ↑ adapter       │   │  quote + escrow  │   │  ↑ adapter       │
│  ~80–150 LOC     │   │  + ENS discovery │   │  ~50–150 LOC     │
│                  │   │  + 0G audit      │   │                  │
└──────────────────┘   └──────────────────┘   └──────────────────┘
   stack-agnostic       the only thing            stack-agnostic
   adapter pattern      you implement against      adapter pattern
```

---

## Three conformance levels

Pick the level your implementation targets. Each one is a strict superset
of the previous.

### L1 — Discoverable

The minimum to be on the network. Your agent can be **found** and **queried**
for quotes. You implement L1 if you can:

| Requirement | What it means |
|---|---|
| Own an ENS subname | a `.eth` name on Sepolia (or any chain with the canonical ENS registry) |
| Set `procurement.endpoint` text record | full HTTPS URL where you accept `POST /rfq` |
| Set `procurement.catalog-uri` text record | where your catalog lives (`0g://<root>`, `ipfs://<cid>`, `https://…`) |
| Respond to `POST <endpoint>` | with valid `procurement.quote.v1` JSON (or 404/409 with structured error) |

**Self-test for L1 (curl, no clone needed):**

```bash
# Replace with your subname after registering
SUBNAME=your-store.openagents-treasury.eth

# 1. Resolve discovery records
# (use any ENS resolver / library — the canonical registry is at
#  0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e on Sepolia + mainnet)

# 2. Hit the endpoint
curl -X POST <your endpoint> \
  -H "Content-Type: application/json" \
  -d '{"rfq_id":"selftest","sku":"<a sku in your catalog>","quantity":1}'

# Expected: 200 with JSON containing { signature, total_usd, valid_until }
```

### L2 — Settlement

Everything in L1 + you can **lock and release real funds onchain**:

| Requirement | What it means |
|---|---|
| Use a `procurement.escrow.v1`-conformant contract | five state transitions: createOrder, confirmShipment, release, refund, dispute |
| Buyers lock funds before any goods move | onchain proof of intent |
| Release on shipment confirmation | trackingHash committed onchain |
| Honor the dispute window | buyer can dispute within N seconds of `confirmShipment` |

The reference contract is at `0x43b31222B22C35D0E5134d03D3f9bb18182360b8` on
Sepolia. Anyone can deploy a compatible escrow on any EVM chain — the
interface is documented in
[PROTOCOL.md §4](./PROTOCOL.md#4-procurementescrowv1--settlement).

### L3 — Auditable

Everything in L2 + every decision is **verifiable from chain state alone**:

| Requirement | What it means |
|---|---|
| Upload full decision record to content-addressed storage | 0G Storage, IPFS, Arweave — anything with content addressing |
| Anchor `keccak256(JSON.stringify(record.policy))` onchain | so a third party can verify the policy bytes that authorized the action |
| Include in the record: RFQ, all quotes received, winner, pattern detection, policy snapshot, escrow tx | enough to reconstruct the decision off-chain |

The reference `AuditAnchor` contract is at
`0xc4B91f01352cff1191eBd3d15A521D94ED081d89` on 0G Galileo. Any chain works
— the schema is in
[PROTOCOL.md §5](./PROTOCOL.md#5-procurementauditv1--verifiable-history).

---

## Stack-agnostic — pick your side, pick your stack

### If you're a BUYER

Your agent needs to know **what to buy**. That data lives somewhere — your ERP,
a spreadsheet, a custom database. Implement
[`BuyerInventoryConnector`](./src/connectors/buyer/types.ts) for that source:

```typescript
export interface BuyerInventoryConnector {
  readonly id: string;
  readonly name: string;
  readNeeds(): Promise<InventoryNeed[]>;
  healthCheck?(): Promise<boolean>;
}

export interface InventoryNeed {
  sku: string;
  name?: string;
  quantity: number;
  current_stock?: number;
  max_unit_price_usd?: number;
  deadline_days: number;
  reason: string;
  source: string; // your connector id, for audit metadata
}
```

**That's the entire interface.** One required method.

#### Reference buyer connectors shipped in this repo

| Connector | Source | Status | LOC | File |
|---|---|---|---|---|
| `OdooBuyerConnector` | Odoo via JSON-RPC | ✓ real | 74 | [`src/connectors/buyer/odoo.ts`](./src/connectors/buyer/odoo.ts) |
| `ExcelBuyerConnector` | local `.xlsx` | ✓ real | 143 | [`src/connectors/buyer/excel.ts`](./src/connectors/buyer/excel.ts) |
| `CsvBuyerConnector` | local `.csv` | ✓ real | 113 | [`src/connectors/buyer/csv.ts`](./src/connectors/buyer/csv.ts) |
| `SapBuyerConnector` | SAP via OData / RFC | ⏳ stub (env-gated, contract documented) | 71 | [`src/connectors/buyer/sap.ts`](./src/connectors/buyer/sap.ts) |
| `MockBuyerConnector` | synthetic | ✓ for tests | 40 | [`src/connectors/buyer/mock.ts`](./src/connectors/buyer/mock.ts) |

**Your stack different?** Pick the closest existing connector as a template.
Replace `readNeeds()` body with a call to your system. Done. ~100 LOC.

The factory at [`src/connectors/buyer/factory.ts`](./src/connectors/buyer/factory.ts)
picks one based on env vars at runtime. Add yours to the switch and you're in.

### If you're a SELLER

Your agent needs a **catalog**. Implement
[`SellerCatalogConnector`](./src/connectors/seller/types.ts):

```typescript
export interface SellerCatalogConnector {
  readonly id: string;
  readonly name: string;
  loadCatalog(): Promise<Catalog>;
  healthCheck?(): Promise<boolean>;
  recordSale?(sale: RecordedSale): Promise<{ id: string; url?: string }>;
}

export interface Catalog {
  seller: string;
  address?: string;
  currency: string;
  items: CatalogItem[];
}

export interface CatalogItem {
  sku: string;
  name: string;
  unit_price_usd: number;
  stock: number;
  delivery_days: number;
}
```

**One required method.** `recordSale` is optional — write back to your
source system if you want.

#### Reference seller connectors shipped in this repo

| Connector | Source | Status | LOC | File |
|---|---|---|---|---|
| `JsonSellerConnector` | local `.json` | ✓ real | 42 | [`src/connectors/seller/json.ts`](./src/connectors/seller/json.ts) |
| `ExcelSellerConnector` | local `.xlsx` | ✓ real (5 layout variants tested) | 53 | [`src/connectors/seller/excel.ts`](./src/connectors/seller/excel.ts) |
| `ShopifySellerConnector` | Shopify Admin GraphQL | ⏳ stub (env-gated, query documented) | 83 | [`src/connectors/seller/shopify.ts`](./src/connectors/seller/shopify.ts) |
| `MercadoLibreSellerConnector` | MercadoLibre Items API | ⏳ stub (env-gated, endpoints documented) | 91 | [`src/connectors/seller/mercadolibre.ts`](./src/connectors/seller/mercadolibre.ts) |
| `MockSellerConnector` | synthetic | ✓ for tests | 25 | [`src/connectors/seller/mock.ts`](./src/connectors/seller/mock.ts) |

Same pattern as the buyer side. Pick the closest connector as a template,
replace the body, register in the factory. ~50–100 LOC.

---

## Chain-side plugins — the *other* adapter layer

The protocol is the contract between two sides, both pluggable:

```
TUS LIBROS (Odoo, Excel, Shopify…)            ← STACK CONNECTORS
       │                                         src/connectors/
       ▼ BuyerInventoryConnector / SellerCatalogConnector
┌──────────────────────────────────────┐
│ OPEN DEAL PROTOCOL v0.1 — never changes │
└──────────────────────────────────────┘
       │ wire JSON + onchain calls
       ▼
PRIMITIVAS ONCHAIN (ENS, 0G, KeeperHub)        ← OPENCLAW PLUGINS
                                                 plugins/
```

The repo ships **3 reference plugins** that cover the chain side of the spec.
Each is an `npm`-publishable package with `openclaw.plugin.json`, `SKILL.md`
(AX-readable), README and smoke test. Same adapter pattern as the connectors,
just on the other side of the protocol.

| Plugin | Spec section it covers | What it does |
|---|---|---|
| [`policy-from-ens`](./plugins/policy-from-ens/) | §1 discovery + §5 audit policyHash | Reads policy + identity from ENS text records. Gates every onchain action against the policy and emits the policy hash that ends up in the audit record. |
| [`audit-to-0g`](./plugins/audit-to-0g/) | §5 verifiable history | Uploads each audit JSON to 0G Storage, anchors the `cidRoot` on 0G Chain via the `AuditAnchor` contract. Returns proof artifacts (storage root + anchor index). |
| [`keeperhub-rail`](./plugins/keeperhub-rail/) | §4 settlement (alt rail) | Optional x402 payment rail. When a counterparty exposes a paid HTTP endpoint (`HTTP 402 Payment Required`), the buyer auto-pays through KeeperHub's hosted agentic wallet and retries — no human in the loop. |

### Why three, and why npm-publishable

Same reason the connectors are pluggable: a different team can ship
`audit-to-arweave`, `policy-from-erc8004`, or `keeperhub-on-base` without
touching the spec or the connectors. As long as the new plugin emits the same
artifacts the protocol expects, it's a drop-in.

### When to use `keeperhub-rail` vs direct escrow

The two are not redundant — they cover different value transfers:

| Use direct `ProcurementEscrow` (Sepolia / mainnet equivalent) when… | Use `keeperhub-rail` (x402) when… |
|---|---|
| The transfer is **the order itself** — large, structured, multi-state (created → locked → released → confirmed). State must be onchain and disputable. | The transfer is a **per-call API fee** — small, atomic, machine-to-machine: paying the seller's RFQ endpoint per quote, paying for premium catalog tier, paying for a verification oracle. |
| You need full audit + dispute resolution. | You need transparent micropayment between agents — the agent never sees a 402, the rail handles it. |
| One transaction per order. | One transaction per HTTP call. |

**Today**, the reference flow uses direct escrow for the order value (correct
for B2B procurement) and KeeperHub is wired as the optional rail for paid
sub-services. A future seller can charge a tiny USDC fee per RFQ to discourage
spam fan-outs; the buyer plugin auto-pays without exposing the payment to
agent logic. That's the x402 promise: paid HTTP becomes ambient.

### Pattern: pay-per-RFQ (anti-spam quote pricing)

Canonical use of `keeperhub-rail` in B2B procurement. Defined in the spec at
[`PROTOCOL.md` §3.4](./PROTOCOL.md#34-optional-anti-spam-paid-rfq-via-x402).

**Seller side** — set the ENS text record once:

```
procurement.rfq-price = "0.001"        // USDC per RFQ
```

The seller's `/rfq` endpoint returns `HTTP 402` with payment instructions on
the first request, then processes the RFQ once an `X-Payment-Proof` header is
attached.

**Buyer side** — no agent-logic change. The buyer's HTTP wrapper detects 402,
calls `kh_pay()` from `keeperhub-rail`, retries with the proof. The agent's
RFQ loop never sees the 402.

**Why it's the right shape.**
- A real procurement run touches ~5–20 sellers per tick. At $0.001/RFQ, a
  full fan-out costs $0.005–$0.02. Negligible for a real buyer.
- A scraping bot doing 10K RFQs/day to harvest pricing now pays $10/day per
  seller it scrapes. Still cheap, but enough to make the math hostile at
  scale.
- The cost is asymmetric in the right direction: real B2B activity is
  bounded, harvesting is unbounded.

### How an LLM extends this layer

The same AX-first pattern: drop `PROTOCOL.md` + the spec section you're
adapting + an existing plugin folder into the LLM's context, and ask:

> "Write me a plugin called `audit-to-arweave` that emits the same shape as
> `audit-to-0g/src/index.ts` but writes to Arweave. Keep the
> `openclaw.plugin.json` manifest and SKILL.md format identical."

Out comes a conformant plugin. That's the bet — the protocol is small enough
and explicit enough that conformance is mechanical.

---

## Step-by-step: from zero to conformant in ~30 minutes

### Step 1 — Decide which side(s)

You can implement only the buyer, only the seller, or both. The reference
implementations under `apps/` ship one of each.

### Step 2 — Pick or write your adapter

If your data source matches one of the existing connectors, you're done at
Step 2 — just configure it via env vars. Otherwise, copy the closest
existing connector to a new file and edit the body.

### Step 3 — Plug in to a reference agent (or write your own)

You have three options here:

**(a) Use the reference agent loop and your adapter:**

```bash
# Your buyer adapter
BUYER_CONNECTOR=your-id \
YOUR_ENV_VAR=... \
npx tsx apps/buyer-agent/src/index.ts
```

**(b) Use the hosted seller endpoint** (you don't even write code on the seller side — the
hosted `/api/seller/[subname]/rfq` reads your catalog from 0G Storage and
signs quotes on your behalf). Drop your catalog at https://open-deal.vercel.app/sell.

**(c) Implement from scratch in your stack.** The Python buyer at
[`apps/buyer-py/`](./apps/buyer-py/) is a 379-LOC single-file reference. It
talks to the same ENS records, the same escrow contract, the same 0G
anchor — just with no shared TS code. Use that as a template if you're not
on JavaScript.

### Step 4 — Self-test

Run a tick locally. Watch the trace. Verify:

```bash
# Buyer-side smoke
npx tsx apps/buyer-agent/src/index.ts

# What you should see:
#   [buyer] connector: <your id> — <your name>
#   [buyer]   ✓ <your id> returned N need(s)
#   [buyer] resolving sellers from ENS…
#   [buyer]   ✓ <subname> → endpoint=…
#   [buyer] need: <sku> x<qty>
#   [buyer] broadcasting rfq-…
#   [buyer]     ✓ <seller> → $<price> USDC, <days>d, sig 0x…
#   [buyer] winner: <seller>
#   [buyer] policy gate via policy-from-ens…
#   [buyer]   → allowed=true
#   [buyer] locking funds in ProcurementEscrow…
#   [buyer]   → order #N, tx 0x…
#   [buyer] audit to 0G…
#   [buyer]   → audit anchor #M
#   [buyer] tick complete ✓
```

If any line fails, that's where conformance is broken.

---

## Wire protocol summary (for those skipping PROTOCOL.md)

### Discovery (`procurement.discovery.v1`)

ENS text records under any `.eth` name. Reserved keys:

| Key | Type | Required for | Meaning |
|---|---|---|---|
| `procurement.endpoint` | URL | seller L1 | where to POST RFQs |
| `procurement.catalog-uri` | URI | seller L1 | content-addressed catalog location |
| `procurement.currencies` | csv | optional | settlement currencies (default `USDC`) |
| `procurement.lanes` | csv | optional | geographic lanes (ISO-3166-1) |
| `procurement.allowlist` | csv of ENS | optional | counterparties allowed to transact |

### RFQ (`procurement.rfq.v1`)

```json
{
  "rfq_id": "rfq-1777152400521-PAPEL-A4-RES",
  "sku": "PAPEL-A4-RES",
  "quantity": 10,
  "buyer_ens": "openagents-treasury.eth",
  "buyer_address": "0x13aF7f5B…",
  "deadline": "2026-04-30T12:00:00Z"
}
```

### Quote (`procurement.quote.v1`)

```json
{
  "rfq_id": "rfq-…",
  "seller": "Acme Cartonería S.A.",
  "seller_address": "0x13aF…",
  "sku": "PAPEL-A4-RES",
  "unit_price_usd": 6.5,
  "total_usd": 65.0,
  "quantity": 10,
  "delivery_days": 2,
  "currency": "USDC",
  "valid_until": "2026-04-25T21:30:36.386Z",
  "signature": "0x98db869d…"
}
```

The `signature` is `personal_sign(JSON.stringify({ rfq_id, seller_address,
sku, total_usd, valid_until }))` by the wallet at the seller's `addr` (or
`procurement.signature-pubkey` if set).

### Errors

| HTTP | When | Body |
|---|---|---|
| 400 | malformed RFQ | `{"error": "rfq requires { sku, quantity }"}` |
| 404 | sku not in catalog | `{"error": "sku X not in catalog", "available_skus": [...]}` |
| 409 | insufficient stock | `{"error": "insufficient stock for X: have Y, want Z"}` |

---

## Reference deployments (for testing your implementation)

| Artifact | Address | Network | Where |
|---|---|---|---|
| Agent ENS | `openagents-treasury.eth` | Sepolia | https://sepolia.app.ens.domains/openagents-treasury.eth |
| Hosted seller endpoint | `https://open-deal.vercel.app/api/seller/<slug>/rfq` | — | live |
| `ProcurementEscrow.sol` | `0x43b31222B22C35D0E5134d03D3f9bb18182360b8` | Sepolia | https://sepolia.etherscan.io/address/0x43b31222B22C35D0E5134d03D3f9bb18182360b8 |
| `AuditAnchor.sol` | `0xc4B91f01352cff1191eBd3d15A521D94ED081d89` | 0G Galileo | https://chainscan-galileo.0g.ai/address/0xc4B91f01352cff1191eBd3d15A521D94ED081d89 |

Faucets you'll need (testnet, free):
- Sepolia ETH: https://sepolia-faucet.pk910.de
- 0G token: https://faucet.0g.ai

---

## Questions, issues, PRs

This is a v0.1 spec. Edges will be rough. If your implementation hits a
case the spec doesn't cover cleanly, **file an issue** — that's how the
spec becomes v0.2.

Repo: https://github.com/rodrigoarias12/open-deal

If you ship a conformant implementation in a stack we don't have yet (Rust?
Go? Solidity-only?), open a PR adding it to the connector list above. The
ecosystem is the proof.
