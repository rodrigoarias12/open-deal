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
> **Status: v0.1, two independent implementations interoperating against the
> same live Sepolia ENS records.**
>
> | Implementation | Lang | Path | Discovers | Trades |
> |---|---|---|---|---|
> | Reference buyer | TypeScript | `apps/buyer-agent/` | ✓ ENS + 0G catalog | ✓ |
> | Reference seller | TypeScript | `apps/seller-agent/` + `app/api/seller/` | n/a | ✓ |
> | Second buyer | Python | `apps/buyer-py/` | ✓ ENS + HTTPS mirror | ✓ |
>
> The Python buyer was written from PROTOCOL.md alone — no shared code with
> the TS implementation, raw `eth_call` for ENS resolution (no web3.py), and
> consumes the same live `*.openagents-treasury.eth` records on Sepolia. That's
> the test the spec needed to pass to graduate from "single-implementation
> draft" to "interoperable protocol."
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
| `procurement.settlement-modes` | csv | optional | Settlement modes the seller supports. Values: `escrow.v1`, `direct.v1`. Default `escrow.v1`. A seller can advertise both. See §4. |
| `procurement.skus` | csv | optional | SKU patterns or category tags the seller carries (e.g. `"PAPER,STATIONERY,PAPEL"`). Buyers MAY use this as a coarse pre-filter before fan-out: if set, the buyer SHOULD only RFQ this seller for SKUs whose name contains one of the listed substrings (case-insensitive). When unset, the seller participates in every RFQ (default). |

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

### SKU-targeted RFQ (the discovery loop)

Buyers SHOULD perform discovery in two steps before any RFQ is sent:

1. **Resolve.** For every name in the seller registry (or seller candidate
   list), read `endpoint` + `catalog-uri` from ENS.
2. **Index.** Pull each catalog (per `procurement.catalog.v1` §2), build a
   local map of `sku → [seller…]`. Sellers without a published catalog stay
   in the registry as a no-catalog fallback (only RFQ'd if their `categories`
   match, or as a last resort if the SKU index has zero hits).
3. **Targeted fan-out.** When a need arrives for SKU `X`, the buyer ONLY
   broadcasts RFQs to sellers whose catalog contains `X`. A registry of N
   sellers generates `|index[X]|` RFQs, not N.

This is what lets the protocol scale past a hardcoded sellers.json: the
RFQ surface stays linear in the number of *capable* sellers, not in the
size of the network.

The reference `apps/buyer-agent/` runs this loop on every tick. See
`src/catalog/loader.ts` for the loader + `buildSkuIndex()` helper.

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

### Optional: HTTPS mirror at `<endpoint-base>/catalog`

A seller MAY also expose its current catalog over plain HTTPS at the path
`<endpoint-base>/catalog`, where `endpoint-base` is the host portion of
the `procurement.endpoint` text record. The body is the same JSON.

Why: clients that don't natively download from `0g://<rootHash>` (e.g. the
Python reference buyer at `apps/buyer-py/`, or any non-TS implementation
that doesn't bundle the 0G TypeScript SDK) can still consume the catalog
without re-implementing the 0G download protocol.

The hosted seller endpoints at `agentic-erp-eth.vercel.app` provide this
mirror automatically by resolving the seller's ENS `catalog-uri` server-side
(see `app/api/seller/[subname]/catalog/route.ts`). Self-hosted sellers may
add their own equivalent or omit it.

This mirror is OPTIONAL — `catalog-uri` (the ENS text record) remains the
canonical source of truth. The mirror is a transport convenience.

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

## 4. `procurement.settlement.v1` — Settlement

Open Deal defines **two settlement modes**. Implementations MUST support at
least one. The mode is signaled by the seller per-quote (or per-endpoint, in
direct mode) and is observable to the buyer before any funds move.

| Mode | Identifier | Use case | Settlement | Audit |
|---|---|---|---|---|
| **Escrow** | `escrow.v1` | Physical goods, B2B procurement, non-atomic delivery, multi-day cycle. The default. | Onchain escrow contract with `createOrder → confirmShipment → release / refund / dispute` lifecycle. | Required. Every state transition anchored. |
| **Direct** | `direct.v1` | Atomic agent-to-agent purchases — the "good" IS the HTTP response (data, oracle output, API call, signed credential). Settlement and delivery happen in the same request. | x402 micropayment in the request itself. No dispute window because there is nothing to dispute: the buyer either receives the resource or doesn't. | Optional. Can still anchor for audit/replayability. |

A seller's quote (`procurement.quote.v1`) MUST include a `settlement` field
indicating which mode it offers:

```json
{
  "settlement": "escrow.v1",   // or "direct.v1"
  "escrow": { "chain": "sepolia", "address": "0x43b3…60b8" },  // when escrow.v1
  "direct": { "chain": "base", "token": "USDC", "rail": "x402" } // when direct.v1
}
```

A buyer agent MAY require a specific mode via the `accepted_settlement` field
in the RFQ; sellers that can't satisfy it return 409.

### 4.1 Escrow mode — `procurement.settlement.v1/escrow.v1`

After a buyer accepts a quote, settlement happens onchain via an escrow
contract. The buyer creates an order locking the agreed amount; the seller
confirms shipment; release happens on buyer release or after the dispute
window.

#### Required interface (Solidity, abstracted)

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

### 4.2 Direct mode — `procurement.settlement.v1/direct.v1`

For atomic transactions where the resource being purchased IS the HTTP
response (data, oracle reading, API call, signed credential, premium catalog
tier, model inference, sanctions check, identity attestation), the spec
allows skipping the escrow entirely. Settlement and delivery happen in the
same request via x402.

This is the **same wire format as §3.4** (paid RFQ via x402), generalized to
any seller endpoint:

```
POST /service                         ←  buyer hits a paid endpoint
HTTP/1.1 402 Payment Required         ←  seller responds with payment ask
X-Payment-Network: base
X-Payment-Token: USDC
X-Payment-Amount: 0.005
X-Payment-To: 0x… (seller wallet)
X-Payment-Nonce: <random hex>

POST /service                         ←  buyer pays + retries
X-Payment-Proof: <tx hash | x402 receipt>
…body…

HTTP/1.1 200 OK                       ←  delivery is the response itself
{ "result": …signed payload… }
```

#### When to use direct mode

Direct mode applies when **all** of the following hold:

1. The good is digital and the response is the delivery (no shipment to track).
2. The buyer can verify correctness of the response itself (signed, hashed,
   cryptographically attested, or trivially checkable).
3. The value per call is small enough that escrow overhead would dominate
   (rule of thumb: < $1 USDC).
4. There is no return / refund cycle that makes sense (you can't un-deliver
   data).

If any of these is false, use escrow mode.

#### What sellers offering direct mode MUST do

- Set `procurement.settlement-modes` ENS text record to include `direct.v1`.
- Sign the response payload with the wallet at `procurement.signature-pubkey`
  (or the wallet `addr` resolves to). The signature is the buyer's recourse
  if the response is wrong — without it, the only audit is the x402 receipt.
- Make payment per-resource idempotent: if a buyer's `X-Payment-Proof` matches
  a prior delivery, return the same response (don't double-charge).

#### What buyers offering direct mode MUST do

- Verify the response signature against the seller's public key before
  acting on the data.
- Optionally anchor `(request, payment_proof, signed_response)` to L3 audit
  storage if replayability matters for the buyer's records.

#### Disputes in direct mode

There is no protocol-level dispute. If a seller returns wrong data, the
buyer's only artifacts are: the request, the payment proof, the signed
response. Three options:

1. Stop using that seller (the cheap option).
2. Anchor the misbehavior to L3 audit and publish — reputation is the
   enforcement.
3. Off-protocol legal recourse if the value warrants it.

This is intentional. Direct mode trades dispute resolution for atomic
settlement. If you need disputes, use escrow.

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

An Open Deal-conformant agent is **L1**, **L2**, or **L3**, evaluated per
settlement mode (escrow.v1 or direct.v1) the agent supports:

| Level | What it does |
|---|---|
| **L1 — Discoverable** | Has an ENS name, sets `procurement.endpoint` + `procurement.catalog-uri` (catalog optional in direct mode). Responds to `POST /rfq` per spec, or to a paid `POST /<service>` per §4.2 if direct-only. |
| **L2 — Settlement** | All of L1 + can settle. **Escrow.v1**: uses an escrow contract conforming to §4.1. **Direct.v1**: implements x402 settlement per §4.2 with signed responses. |
| **L3 — Auditable** | All of L2 + anchors decisions per `procurement.audit.v1` so any third party can verify policy compliance from chain state alone. Optional in direct mode but encouraged for high-stakes flows. |

Reference implementations in this repo are L3 on both sides
(`apps/buyer-agent`, `apps/seller-agent`) and on the hosted endpoint at
`agentic-erp-eth.vercel.app/api/seller/<subname>/rfq` — currently only
`escrow.v1`. `direct.v1` is spec-complete; reference impl pending.

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
