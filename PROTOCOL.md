# Open Deal Protocol — v0.1

> **Open standard for autonomous, trust-minimized agent-mediated trade.** Anyone
> can implement either side of this protocol — buyer or seller — in any
> language, on any commerce backend, on any chain that has the canonical ENS
> registry.
>
> **Stack-agnostic by design.** The protocol normalizes 5 wire shapes; the
> mapping from your ERP / catalog / accounting stack to those shapes is a
> typed adapter you write in ~100 lines. Reference adapters ship for Odoo,
> Excel, CSV, JSON, Shopify (stub), MercadoLibre (stub), and SAP (stub).
> See [`IMPLEMENTERS.md`](./IMPLEMENTERS.md).
>
> **AX-first documentation.** This file and `IMPLEMENTERS.md` are designed to
> be fed to an LLM coding agent (Claude / GPT / Cursor / etc.). Drop the docs
> into the context, point at your stack, and the agent emits a conformant
> adapter and policy file. No human integration handholding needed — the spec
> is the integration spec.
>
> Anthropic's Project Deal (Apr 2026) validated demand for agent-mediated
> commerce; their own report named the gap: *"Policy and legal frameworks
> around AI models that transact on our behalf simply don't exist yet."* Open
> Deal is that framework.
>
> The hosted endpoints at `open-deal.vercel.app` (alias
> `agentic-erp-eth.vercel.app` — *Agentic ERP* is the first reference B2B app
> built on Open Deal) are *one* implementation, not the only one.

The protocol normalizes 5 things so a buyer agent built by team A can find,
quote, settle, and audit a transaction with a seller agent built by team B
without any prior coordination.

| Spec | Defines | Section |
|---|---|---|
| `procurement.discovery.v1` | how agents find each other | [§1](#1-procurementdiscoveryv1--discovery) |
| `procurement.catalog.v1` | how a seller publishes their products | [§2](#2-procurementcatalogv1--catalog) |
| `procurement.rfq.v1` + `procurement.quote.v1` | the over-the-wire negotiation | [§3](#3-procurementrfqv1--procurementquotev1--negotiation) |
| `procurement.escrow.v1` | onchain settlement interface | [§4](#4-procurementescrowv1--settlement) |
| `procurement.audit.v1` | what every party records, where | [§5](#5-procurementauditv1--verifiable-history) |

---

## 1. `procurement.discovery.v1` — Discovery

Identity and discovery are ENS. An agent (buyer or seller) is a name on ENS,
and the text records under that name describe what the agent does and where
to reach it.

### Reserved ENS namespace

| Key | Type | Required | Meaning |
|---|---|---|---|
| `procurement.endpoint` | URL (https or http) | ✓ for sellers | The HTTPS endpoint that accepts `POST /rfq` per `procurement.rfq.v1`. |
| `procurement.catalog-uri` | URI | ✓ for sellers | Where the catalog JSON lives. Schemes: `0g://<rootHash>` (0G Storage), `ipfs://<cid>`, or `https://…`. |
| `procurement.currencies` | csv | optional | Currencies the agent settles in. e.g. `"USDC,USDT"`. Default `"USDC"`. |
| `procurement.lanes` | csv | optional | Geographic lanes accepted. e.g. `"AR,BR,UY"` (ISO-3166-1). Empty = global. |
| `procurement.allowlist` | csv of ENS names | optional | If set, only counterparties in this list may transact. |
| `procurement.policy-uri` | URI | optional | Pointer to a richer policy document (JSON Schema TBD in v0.2). |
| `procurement.signature-pubkey` | 0x-hex | optional | Override which key signs quotes (defaults to the wallet `addr` resolves to). |
| `procurement.rfq-price` | decimal USDC | optional | Price the seller charges per RFQ via x402. Default `0` (free). When set, `POST /rfq` returns `HTTP 402 Payment Required` until the buyer pays. See §3.4. |

Existing ENS keys still apply: `addr` (coinType 60) MUST resolve to the agent
wallet that signs quotes and onchain actions; `description`, `url`, `email`
are surfaced to humans.

### Reserved text records for buyers (informational)

| Key | Type | Meaning |
|---|---|---|
| `procurement.role` | `buyer` \| `seller` \| `both` | Agent role. Default `seller`. |
| `treasury.maxSwapEth`, `treasury.minBufferEth`, `treasury.allowedTokens`, `treasury.maxPerCarrierUsd`, `treasury.carriers`, `treasury.maxDailyVolumeEth`, `treasury.cooldownSeconds` | (legacy) | The treasury policy used to authorize buyer-side onchain actions. Same shape as the existing `treasury.*` plugin namespace. |

### Resolution

A counterparty resolves a discovered ENS name `<name>.<root>.eth` and reads:
1. `addr` (coinType 60) → wallet
2. `procurement.endpoint` → URL
3. `procurement.catalog-uri` → catalog source

If `endpoint` is missing, the seller is not currently online. Skip.

---

## 2. `procurement.catalog.v1` — Catalog

A catalog is a JSON document. Sellers publish it once at `catalog-uri` and
update it by re-uploading + setting a new `catalog-uri` text record (cheap if
the URI scheme is content-addressed).

```json
{
  "$schema": "procurement.catalog.v1",
  "seller": "Acme Cartonería S.A.",
  "address": "0x13aF7f5B…7AC1",
  "currency": "USDC",
  "items": [
    {
      "sku": "PAPEL-A4-RES",
      "name": "Papel A4 (resma 500h, 75g)",
      "unit_price_usd": 6.5,
      "stock": 240,
      "delivery_days": 2
    }
  ]
}
```

Required item fields: `sku` (string), `unit_price_usd` (number),
`stock` (integer ≥ 0), `delivery_days` (integer ≥ 0). `name` recommended.

A discovery client SHOULD cache the catalog by `catalog-uri` and revalidate
when the ENS text record changes.

---

## 3. `procurement.rfq.v1` + `procurement.quote.v1` — Negotiation

The seller exposes one HTTP endpoint:

```
POST <procurement.endpoint>/rfq
Content-Type: application/json
```

### Request body — `procurement.rfq.v1`

```json
{
  "$schema": "procurement.rfq.v1",
  "rfq_id": "rfq-1777152400521-PAPEL-A4-RES",
  "sku": "PAPEL-A4-RES",
  "quantity": 10,
  "buyer_ens": "openagents-treasury.eth",
  "buyer_address": "0x13aF7f5B…7AC1",
  "deadline": "2026-04-30T12:00:00Z"
}
```

### Response body — `procurement.quote.v1` (HTTP 200)

```json
{
  "$schema": "procurement.quote.v1",
  "rfq_id": "rfq-1777152400521-PAPEL-A4-RES",
  "seller": "Acme Cartonería S.A.",
  "seller_address": "0x13aF7f5B…7AC1",
  "sku": "PAPEL-A4-RES",
  "unit_price_usd": 6.5,
  "total_usd": 65.0,
  "quantity": 10,
  "delivery_days": 2,
  "currency": "USDC",
  "valid_until": "2026-04-25T21:30:36.386Z",
  "signature": "0x98db869d…dbc3171c"
}
```

The `signature` is `personal_sign(JSON.stringify({rfq_id, seller_address, sku, total_usd, valid_until}))` by the wallet at the seller's `procurement.signature-pubkey` (or, by default, the wallet at `addr`).

### Error responses

| HTTP | Body shape | Meaning |
|---|---|---|
| 400 | `{"error": "rfq requires { sku, quantity }"}` | malformed RFQ |
| 402 | (see §3.4) | seller charges for quotes; pay and retry |
| 404 | `{"error": "sku NOPE not in catalog", "available_skus": [...]}` | unknown SKU |
| 409 | `{"error": "insufficient stock for X: have Y, want Z"}` | low stock |

### 3.4 Optional anti-spam: paid RFQ via x402

A seller MAY price its `/rfq` endpoint by setting the `procurement.rfq-price`
ENS text record (decimal USDC, e.g. `0.001`). When set:

1. First request without payment proof returns:
   ```
   HTTP/1.1 402 Payment Required
   X-Payment-Network: base
   X-Payment-Token: USDC
   X-Payment-Amount: 0.001
   X-Payment-To: 0x… (seller wallet at procurement.signature-pubkey or addr)
   X-Payment-Nonce: <random hex>
   {"error": "rfq requires payment", "amount_usdc": "0.001", "rail": "x402"}
   ```
2. Buyer agent pays via any x402-compatible rail (e.g. KeeperHub, Coinbase
   x402, direct USDC transfer). Buyer retries with:
   ```
   POST /rfq
   X-Payment-Proof: <tx hash or x402 receipt>
   ```
3. Seller verifies the proof matches the nonce + amount + recipient and
   processes the RFQ normally.

**Rationale.** Without a per-RFQ cost, a seller exposing a public catalog +
`/rfq` endpoint is rate-spammable by any agent doing 50-way quote fan-outs.
A nominal fee ($0.001 USDC) is irrelevant for a real procurement run but
deters automated fishing. Buyers are expected to handle 402 transparently
through their payment plugin (`keeperhub-rail`, Coinbase x402, etc.) — agent
logic never sees the 402.

**Conformance.** This is OPTIONAL. A buyer that receives a 402 from a seller
priced beyond the buyer's per-call budget MUST skip that seller and continue
to the next (do not error the whole tick). A seller MUST NOT charge for
discovery (catalog reads, ENS resolution).

---

## 4. `procurement.escrow.v1` — Settlement

After a buyer accepts a quote, settlement happens onchain via an escrow
contract. The buyer creates an order locking the agreed amount; the seller
confirms shipment; release happens on buyer release or after the dispute
window.

### Required interface (Solidity, abstracted)

```solidity
function createOrder(
    address seller,
    bytes32 skuHash,
    uint64  deliveryDeadline,
    uint64  disputeWindow
) external payable returns (uint256 orderId);

function confirmShipment(uint256 orderId, bytes32 trackingHash) external;
function release(uint256 orderId) external;     // buyer or anyone after window
function refund(uint256 orderId) external;       // anyone after deadline if !shipped
function dispute(uint256 orderId, string calldata reason) external;
```

States: `None → Pending → Shipped → (Released | Disputed) | Refunded`.

Events MUST be emitted at every state transition so any indexer can
reconstruct order history.

The reference contract is at
`0x43b31222B22C35D0E5134d03D3f9bb18182360b8` on Sepolia
([source](contracts/ProcurementEscrow.sol)). Anyone can deploy a compatible
escrow on any EVM chain; clients SHOULD allow the escrow address to be
configured per-chain.

---

## 5. `procurement.audit.v1` — Verifiable history

Every meaningful agent decision (RFQ, quote ranking, escrow create, escrow
release, dispute) is recorded as a JSON document on content-addressed
storage, then anchored on a chain.

### Recommended record shape (buyer side)

```json
{
  "$schema": "procurement.audit.v1",
  "case": "agentic-erp-rfq-decision",
  "at": "2026-04-25T18:31:00.000Z",
  "buyer": "Paydece S.A. (demo)",
  "rfq_id": "rfq-…",
  "need": { "sku": "PAPEL-A4-RES", "quantity": 10, "max_unit_price_usd": 8.0, "deadline_days": 5 },
  "quotes": [ /* every quote received */ ],
  "winner": { "ens": "seller-acme.…eth", "total_usd": 65 },
  "pattern": { /* output of pattern detector */ },
  "approval": { /* human-in-the-loop result, if asked */ },
  "policy": { /* full policy snapshot used at decision time */ },
  "escrow": { "contract": "0x43b…", "orderId": "5", "amountEth": "0.00065", "txHash": "0x99f…", "chain": "sepolia" }
}
```

### Anchoring

Storage: 0G Storage (preferred), IPFS, Arweave — anything content-addressed.

Chain anchor (recommended contract — can be deployed on any chain):

```solidity
function anchor(bytes32 cidRoot, bytes32 policyHash) external returns (uint256 index);
event Anchored(uint256 indexed index, bytes32 indexed cidRoot, bytes32 indexed policyHash, address agent, uint64 timestamp);
```

The reference deployment is on 0G Galileo at
`0xc4B91f01352cff1191eBd3d15A521D94ED081d89`.

### Trust property

Given a chain anchor `(cidRoot, policyHash, timestamp, agent)`, a third party can:
1. Fetch the JSON from the storage layer using `cidRoot`
2. Recompute `keccak256(JSON.stringify(record.policy))` and compare to `policyHash`
3. Conclude that the action was authorized by exactly that policy at that timestamp by that wallet — without trusting the agent operator.

---

## 6. `procurement.connector.v1` — Source-system adapters

The agents are data-source-agnostic. Buyers can read needs from any
ERP, spreadsheet, or custom system; sellers can publish catalogs from
any commerce backend. The shape of the data is what matters; the
transport is plug-and-play.

### Buyer-side: `BuyerInventoryConnector`

```ts
interface BuyerInventoryConnector {
  readonly id: string;
  readonly name: string;
  readNeeds(): Promise<InventoryNeed[]>;
  healthCheck?(): Promise<boolean>;
  pushOrder?(order: PlacedOrder): Promise<{ id: string; url?: string }>;
}

interface InventoryNeed {
  sku: string;
  name?: string;
  quantity: number;
  current_stock?: number;
  max_unit_price_usd?: number;
  deadline_days: number;
  reason: string;
  source: string;     // connector id, surfaced in audit
}
```

Reference implementations under `src/connectors/buyer/`:

| `id` | What it reads | Status |
|---|---|---|
| `odoo` | Odoo `product.product` via JSON-RPC, filtered by `qty_available` | Real |
| `excel` | local `.xlsx` with reorder thresholds | Real |
| `csv` | local `.csv` with same column conventions | Real |
| `sap` | SAP MARA/MARC via OData / RFC | Stub — set `SAP_HOST` to enable |
| `mock` | synthetic data | Real (testing) |

The factory at `src/connectors/buyer/factory.ts` picks via env precedence:
`BUYER_CONNECTOR` > `SAP_HOST` > `ODOO_URL` > `BUYER_NEEDS_XLSX` > `BUYER_NEEDS_CSV` > `mock`.

### Seller-side: `SellerCatalogConnector`

```ts
interface SellerCatalogConnector {
  readonly id: string;
  readonly name: string;
  loadCatalog(): Promise<Catalog>;
  healthCheck?(): Promise<boolean>;
  recordSale?(sale: RecordedSale): Promise<{ id: string; url?: string }>;
}
```

Reference implementations under `src/connectors/seller/`:

| `id` | What it loads | Status |
|---|---|---|
| `json` | local `.json` catalog (the original demo seller) | Real |
| `excel` | local `.xlsx` with column auto-detection | Real |
| `shopify` | Shopify Admin GraphQL (`products.edges.node.variants`) | Stub — set `SHOPIFY_STORE` + `SHOPIFY_TOKEN` |
| `mercadolibre` | ML Items API (`/users/{id}/items/search`) | Stub — set `ML_USER_ID` + `ML_TOKEN` |
| `mock` | synthetic catalog | Real (testing) |

Stubs return shape-correct fixture data with `source_ref` flagged so
audit logs make the provenance explicit. Replace the body of
`loadCatalog()` with the live API call to upgrade.

### Why two connectors per side?

A buyer agent that reads from Odoo trades with a seller agent backed by
Shopify, and the buyer never knows. Both sides converge on the same
`procurement.rfq.v1` / `procurement.quote.v1` over HTTP. The connector
pattern is the **only** place where source-system specificity lives —
the rest of the framework is stack-agnostic.

This is what makes "anyone can join the network" real:

- a small distributor with an Excel exports → use `excel` seller connector
- a Shopify store → use `shopify` seller connector (when implemented)
- a SAP-running enterprise as buyer → use `sap` buyer connector
- an Odoo-running SME as buyer → use `odoo` buyer connector

All four interoperate, because the over-the-wire protocol is invariant.

---

## Conformance levels

A Agentic ERP-conformant agent is **L1**, **L2**, or **L3**:

| Level | What it does |
|---|---|
| **L1 — Discoverable** | Has an ENS name, sets `procurement.endpoint` + `procurement.catalog-uri`. Catalog is published at `catalog-uri`. Responds to `POST /rfq` per spec. |
| **L2 — Settlement** | All of L1 + uses an escrow contract conforming to `procurement.escrow.v1` for the value transfer. |
| **L3 — Auditable** | All of L2 + every decision is anchored per `procurement.audit.v1` so any third party can verify policy compliance from chain state alone. |

Reference implementations in this repo are L3 on both sides
(`apps/buyer-agent`, `apps/seller-agent`) and on the hosted endpoint at
`agentic-erp-eth.vercel.app/api/seller/<subname>/rfq`.

---

## Versioning

`v0.1` is the bootstrap spec — narrowly scoped to the demo scenarios. Pre-1.0
the spec may break. Once we ship `v1.0` we commit to backwards-compatible
changes only.

Spec changes are proposed as PRs to this file. Reference implementations
(this repo) MUST stay in sync with the spec they declare in `$schema` fields.

---

## Open questions for v0.2

- Multi-vendor RFQ broadcast format (today: buyer N-fan-out per seller)
- Counter-quote / multi-round negotiation
- iNFT-bound agent identity (extending discovery for ERC-7857 agents)
- Off-ramp specification (USDC → local fiat after release)
- Governance for the reserved ENS namespace (who arbitrates `procurement.*`)
