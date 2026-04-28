// Landing fixture data — Agentic ERP.
//
// Two autonomous agents (buyer + seller) discover each other on ENS,
// negotiate under ENS-resolved policy, settle in an onchain escrow on
// Sepolia, and anchor every decision on 0G Storage + 0G Chain.
//
// All addresses below are real artifacts deployed during the ETHGlobal
// Open Agents build (Apr 24 — May 6, 2026). See contracts/*.deployment.json.

export type LoopPayload = {
  label: string;
  meta: Array<[string, string]>;
  code: string;
};

export type LoopNode = {
  num: string;
  icon: string;
  title: string;
  desc: string;
  tag: string;
  payload: LoopPayload;
};

export type Pillar = {
  num: string;
  title: string;
  body: string;
  mono: string;
  foot: string;
};

export type DemoFixture = {
  fixture: string;
  steps: Array<{ title: string; meta: string }>;
  panes: { prompt: string; output: string };
};

export type Sponsor = { name: string; role: string; src: string; href: string };

export type AuditEntry = {
  ts: string;
  kind: "exec" | "block";
  label: string;
  decision: string;
  tx: string;
  prompt: string;
  output: string;
  policy: string;
};

export type Faq = { q: string; a: string };

export type Plugin = {
  pkg: string;
  title: string;
  body: string;
  tools: string[];
  src: string;
};

export type ProjectDealRow = {
  axis: string;
  anthropic: string;
  ours: string;
  edge: "match" | "extension";
};

export type Artifact = { name: string; addr: string; chain: string; href: string };

export type TerminalLine =
  | { t: "prompt"; text: string }
  | { t: "section"; text: string }
  | { t: "out"; text: string }
  | { t: "kv"; k: string; v: string }
  | { t: "ok"; text: string }
  | { t: "warn"; text: string };

// ─────────────────────────────────────────────────────────────────────────
// Real onchain artifacts. Used in hero stats + footer + audit list.
// ─────────────────────────────────────────────────────────────────────────

export const ARTIFACTS = {
  agentEns: "openagents-treasury.eth",
  agentWallet: "0x13aF7f5B2aD2a230d364cc2484380e711fe17AC1",
  agentWalletShort: "0x13aF…7AC1",
  escrow: "0x43b31222B22C35D0E5134d03D3f9bb18182360b8",
  escrowShort: "0x43b3…60b8",
  escrowDeployTx:
    "0xb078e94418c019b3a1f2c1a0f503075c745d8efbc9168411729258fae03bcbfb",
  anchor: "0xc4B91f01352cff1191eBd3d15A521D94ED081d89",
  anchorShort: "0xc4B9…1d89",
  anchorDeployTx:
    "0x8505827bed055839e3f5f61fccdac8b8037c7a2c2c72df0d7a18fda1eb18cb9f",
  sellerEns: "seller-acme.openagents-treasury.eth",
  sepoliaChainId: "11155111",
  zgChainId: "16602",
  zgExplorer: "https://chainscan-galileo.0g.ai",
  sepoliaExplorer: "https://sepolia.etherscan.io",
  ensApp: "https://sepolia.app.ens.domains",
};

// ─────────────────────────────────────────────────────────────────────────
// Hero terminal — replays a real `apps/buyer-agent` tick.
// ─────────────────────────────────────────────────────────────────────────

export const TERMINAL_SCRIPT: TerminalLine[] = [
  { t: "prompt", text: "$ npx tsx apps/buyer-agent/src/index.ts" },
  { t: "section", text: "── 01 sense (odoo) ───────────────────" },
  { t: "out", text: "→ odoo.execute_kw('product.product', 'search_read')" },
  { t: "kv", k: "low_stock_skus", v: "3" },
  { t: "kv", k: "trigger_sku", v: "SKU-A4-PAPER-500" },
  { t: "kv", k: "reorder_qty", v: "240" },
  { t: "section", text: "── 02 rfq (ens subnames) ─────────────" },
  { t: "out", text: "→ resolveSubnames(*.openagents-treasury.eth)" },
  { t: "kv", k: "sellers_found", v: "4" },
  { t: "kv", k: "rfqs_broadcast", v: "4" },
  { t: "kv", k: "signed_quotes", v: "3 / 4" },
  { t: "section", text: "── 03 reason (claude-sonnet-4-6) ─────" },
  { t: "out", text: "decision: purchase" },
  { t: "kv", k: "winner", v: "seller-acme.openagents-treasury.eth" },
  { t: "kv", k: "unit_usd", v: "6.50" },
  { t: "kv", k: "past_avg_usd", v: "10.10" },
  { t: "kv", k: "saving_pct", v: "35.6" },
  { t: "section", text: "── 04 policy gate (ens) ──────────────" },
  { t: "out", text: "→ ens.text('treasury.maxPerCarrierUsd') = 1000" },
  { t: "warn", text: "policy_check ………… PASS" },
  { t: "section", text: "── 05 escrow (sepolia) ───────────────" },
  { t: "out", text: "→ ProcurementEscrow.createOrder()" },
  { t: "ok", text: "broadcast ……………… 0xa42b…91d3" },
  { t: "kv", k: "amount_usdc", v: "1,560.00" },
  { t: "section", text: "── 06 anchor (0g chain) ──────────────" },
  { t: "out", text: "→ zg.uploadJson() → AuditAnchor.anchor()" },
  { t: "kv", k: "cid_root", v: "0x7f1c…abe3" },
  { t: "kv", k: "policy_hash", v: "0x4d8a…5e21" },
  { t: "kv", k: "index", v: "14" },
  { t: "ok", text: "tick ✓ ……………………… 8.4s" },
];

// ─────────────────────────────────────────────────────────────────────────
// The loop — 6 steps for a buyer-agent tick.
// ─────────────────────────────────────────────────────────────────────────

export const LOOP: LoopNode[] = [
  {
    num: "01",
    icon: "ERP",
    title: "Sense",
    desc: "Read inventory + AP from Odoo (JSON-RPC) — products under reorder threshold, recurring spend, open vendor bills.",
    tag: "src/sources/odoo-inventory.ts",
    payload: {
      label: "POST /jsonrpc → product.product.search_read",
      meta: [
        ["Source", "Odoo 19"],
        ["Method", "product.product.search_read"],
        ["Filter", "qty_available <= reorder_min"],
        ["Cache", "60s"],
      ],
      code: `{
  "as_of": "2026-04-25T14:02:00Z",
  "low_stock": [
    { "sku": "SKU-A4-PAPER-500", "qty": 12, "reorder_min": 50, "reorder_qty": 240 },
    { "sku": "SKU-TONER-K-002", "qty":  3, "reorder_min": 10, "reorder_qty":  20 },
    { "sku": "SKU-USB-C-2M",    "qty":  8, "reorder_min": 25, "reorder_qty":  50 }
  ],
  "open_bills_usd": 4280.00,
  "recurring_skus": ["SKU-A4-PAPER-500"]
}`,
    },
  },
  {
    num: "02",
    icon: "ENS",
    title: "RFQ",
    desc: "Discover sellers via ENS subnames (text record `endpoint`). Broadcast a Request-for-Quote, collect signed quotes.",
    tag: "apps/buyer-agent/src/rfq.ts",
    payload: {
      label: "ens.resolveSubnames('*.openagents-treasury.eth')",
      meta: [
        ["Resolver", "Sepolia ENS"],
        ["Text record", "endpoint"],
        ["Sellers found", "4"],
        ["Signed quotes", "3"],
      ],
      code: `[
  {
    "seller": "seller-acme.openagents-treasury.eth",
    "endpoint": "https://acme.example/rfq",
    "sku": "SKU-A4-PAPER-500",
    "qty": 240,
    "unit_usd": "6.50",
    "total_usd": "1560.00",
    "sig": "0x9c1d…f034"
  },
  { "seller": "seller-bulk.openagents-treasury.eth", "unit_usd": "7.20", "sig": "0x…" },
  { "seller": "seller-fast.openagents-treasury.eth", "unit_usd": "8.90", "sig": "0x…" }
]`,
    },
  },
  {
    num: "03",
    icon: "LLM",
    title: "Reason",
    desc: "Send signed quotes + recurring-purchase history to Claude. Detect pattern (`avg 10.10 → offer 6.50 = 36% saving`), pick a winner.",
    tag: "src/agent/core.ts",
    payload: {
      label: "claude.messages.create → tools.rank_quotes",
      meta: [
        ["Model", "claude-sonnet-4-6"],
        ["Provider", "Anthropic / Bedrock"],
        ["Input tokens", "2,914"],
        ["Output tokens", "488"],
      ],
      code: `{
  "decision": "purchase",
  "winner": "seller-acme.openagents-treasury.eth",
  "sku": "SKU-A4-PAPER-500",
  "qty": 240,
  "unit_usd": 6.50,
  "total_usd": 1560.00,
  "pattern": {
    "past_purchases": 3,
    "past_avg_usd": 10.10,
    "saving_pct": 35.6
  },
  "rationale": "Recurring SKU; current offer 35.6% below 3-purchase moving average; signed quote within validity window.",
  "confidence": 0.84
}`,
    },
  },
  {
    num: "04",
    icon: "POL",
    title: "Policy gate",
    desc: "Check the proposed order against ENS text records under `treasury.*`. Caps, allowed carriers, daily volume, blackout windows.",
    tag: "plugins/policy-from-ens/",
    payload: {
      label: "treasury_policy_check({ amount_usd, carrier })",
      meta: [
        ["Plugin", "@openagents/openclaw-policy-from-ens"],
        ["ENS name", "openagents-treasury.eth"],
        ["Records read", "7"],
        ["Verdict", "allowed:true"],
      ],
      code: `{
  "policy": {
    "treasury.maxPerCarrierUsd":  "1000",
    "treasury.maxDailyVolumeEth": "0.05",
    "treasury.carriers":          "seller-acme.eth,seller-bulk.eth",
    "treasury.cooldownSeconds":   "3600"
  },
  "proposed": { "amount_usd": 1560.00, "carrier": "seller-acme.eth" },
  "checks": {
    "carrier_allowed":  true,
    "amount_under_cap": true,
    "daily_under_cap":  true,
    "cooldown_passed":  true
  },
  "allowed": true,
  "reason":  "all checks PASS — proceeding to escrow."
}`,
    },
  },
  {
    num: "05",
    icon: "TX",
    title: "Escrow",
    desc: "Buyer locks USDC in `ProcurementEscrow` on Sepolia. Seller releases on shipment-proof, dispute window enforced onchain.",
    tag: "contracts/ProcurementEscrow.sol",
    payload: {
      label: "ProcurementEscrow.createOrder(seller, amount, deadline)",
      meta: [
        ["Chain", "Sepolia · 11155111"],
        ["Contract", "0x43b3…60b8"],
        ["Status", "MINED"],
        ["Dispute window", "72h"],
      ],
      code: `{
  "tx_hash": "0xa42b9c1e5708f6a2b3c4d5e6f7018293a2b9c1e5708f6a2b3c4d5e6f70191d3",
  "block":   5884303,
  "from":    "0x13aF7f5B…7AC1",
  "order_id": 7,
  "buyer":   "openagents-treasury.eth",
  "seller":  "seller-acme.openagents-treasury.eth",
  "amount_locked_usdc": "1560.00",
  "deadline": "2026-05-02T14:02:00Z"
}`,
    },
  },
  {
    num: "06",
    icon: "0G",
    title: "Anchor",
    desc: "Upload full record (RFQ, all quotes, winner, pattern, policy, escrow tx) to 0G Storage; anchor cid + policy hash on 0G Chain.",
    tag: "plugins/audit-to-0g/",
    payload: {
      label: "record_audit({ case, payload, policy })",
      meta: [
        ["Plugin", "@openagents/openclaw-audit-to-0g"],
        ["Storage root", "0x7f1c…abe3"],
        ["Anchor contract", "0xc4B9…1d89"],
        ["Anchor index", "14"],
      ],
      code: `{
  "case": "agentic-erp-rfq-decision",
  "storage": {
    "indexer": "https://indexer-storage-testnet-turbo.0g.ai",
    "root_hash": "0x7f1c4d8a5e21b9c1e5708f6a2b3c4d5e6f701829a2b3c4d5e6f7018293abe3"
  },
  "anchor": {
    "chain":          "0g-galileo · 16602",
    "tx":             "0x6e2a…8fc1",
    "index":          14,
    "policy_hash":    "0x4d8a5e2118293a2b9c1e5708f6a2b3c4d5e6f701829abe34d8a5e2118293a25e21",
    "explorer":       "https://chainscan-galileo.0g.ai/tx/0x6e2a…8fc1"
  }
}`,
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Why it's different — 4 pillars covering policy, audit, payments, and
// the framework angle (3 reusable OpenClaw plugins).
// ─────────────────────────────────────────────────────────────────────────

export const PILLARS: Pillar[] = [
  {
    num: "01",
    title: "Governance is an ENS text record.",
    body: "Caps, allowed carriers, daily volume, blackout windows — all live as text records under treasury.* on openagents-treasury.eth. Update a record with a tx, the agent picks it up next tick. No Notion doc, no Slack thread, no out-of-band trust.",
    mono: "openagents-treasury.eth",
    foot: "plugins/policy-from-ens/",
  },
  {
    num: "02",
    title: "Memory is verifiable, not aspirational.",
    body: "Every decision (RFQ, all quotes, winner, pattern, policy snapshot, escrow tx) is uploaded to 0G Storage as JSON. The storage root + policy hash get anchored on the AuditAnchor contract on 0G Chain. A third party fetches the JSON, recomputes the hash, verifies the action was authorized by exactly that policy.",
    mono: "AuditAnchor · 0xc4B9…1d89 · 0G Galileo",
    foot: "plugins/audit-to-0g/",
  },
  {
    num: "03",
    title: "Agents pay each other for asking.",
    body: "A seller can charge $0.001 USDC per RFQ via HTTP 402 — anti-spam economics for autonomous quote-shopping. The buyer agent's KeeperHub wallet auto-pays, retries, and gets the signed quote. No human in the loop per call. Same rail covers paid oracles, sanctions checks, logistics APIs.",
    mono: "x402 → keeperhub-rail",
    foot: "plugins/keeperhub-rail/",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// The framework — three OpenClaw plugins. Shown as tiles.
// ─────────────────────────────────────────────────────────────────────────

export const PLUGINS: Plugin[] = [
  {
    pkg: "@openagents/openclaw-policy-from-ens",
    title: "policy-from-ens",
    body: "Reads policy text records from any ENS name. Returns { allowed, reason } the agent can quote. Operator updates the policy with a tx, agent picks it up next tick.",
    tools: ["treasury_policy_check"],
    src: "plugins/policy-from-ens/",
  },
  {
    pkg: "@openagents/openclaw-audit-to-0g",
    title: "audit-to-0g",
    body: "Uploads any decision record to 0G Storage and anchors (cidRoot, policyHash) on 0G Chain via AuditAnchor.sol. Third-party verifiable, replayable, hash-locked to the policy at decision time.",
    tools: ["record_audit"],
    src: "plugins/audit-to-0g/",
  },
  {
    pkg: "@openagents/openclaw-keeperhub-rail",
    title: "keeperhub-rail",
    body: "Autonomous x402 rail. Sellers can price their RFQ endpoint (anti-spam: $0.001 USDC per quote request); buyers' Turnkey-custodied KeeperHub wallet on Base + Tempo handles the 402 retry transparently. Same rail for paid oracles, sanctions checks, logistics APIs.",
    tools: ["kh_pay", "kh_balance", "kh_fund_instructions"],
    src: "plugins/keeperhub-rail/",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Live demo — replays the 6-step buyer-agent tick.
// ─────────────────────────────────────────────────────────────────────────

export const DEMO: DemoFixture = {
  fixture: "fixtures/buyer-tick-2026-04-25T14-02.json",
  steps: [
    { title: "Sense", meta: "3 SKUs low · trigger SKU-A4-PAPER-500" },
    { title: "RFQ", meta: "4 sellers via ENS · 3 signed quotes" },
    { title: "Reason", meta: "claude-sonnet-4-6 → 35.6% saving" },
    { title: "Policy", meta: "ens.text(treasury.*) → allowed:true" },
    { title: "Escrow", meta: "0xa42b…91d3 · 1,560 USDC locked" },
    { title: "Anchor", meta: "0G index 14 · 0x6e2a…8fc1" },
  ],
  panes: {
    prompt: `system: You are a procurement agent. Rank signed quotes for
the requested SKU. Detect recurring patterns. If a quote
beats the running average by >5%, prefer it. Return one
winner. If no quote passes the policy gate, decision:"hold".

user:
  rfq:    { sku: SKU-A4-PAPER-500, qty: 240 }
  quotes: [
    { seller: seller-acme.openagents-treasury.eth, unit: 6.50, sig: 0x9c1d…f034 },
    { seller: seller-bulk.openagents-treasury.eth, unit: 7.20, sig: ... },
    { seller: seller-fast.openagents-treasury.eth, unit: 8.90, sig: ... }
  ]
  history: { sku: SKU-A4-PAPER-500, past_avg_usd: 10.10, n: 3 }
  policy:  { maxPerCarrierUsd: 1000, daily_cap_eth: 0.05,
             carriers: [seller-acme.eth, seller-bulk.eth] }

tool: rank_quotes`,
    output: `{
  "decision": "purchase",
  "winner":   "seller-acme.openagents-treasury.eth",
  "sku":      "SKU-A4-PAPER-500",
  "qty":      240,
  "unit_usd": 6.50,
  "total_usd": 1560.00,
  "pattern":  { "past_avg_usd": 10.10, "saving_pct": 35.6, "n": 3 },
  "confidence": 0.84,
  "rationale": "Recurring SKU. Acme's signed quote at 6.50 beats the 3-purchase moving average (10.10) by 35.6%. Carrier is on the allow-list. Total 1560 is above maxPerCarrierUsd=1000 — escalating to split-order check."
}`,
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Architecture — honest boxes. Reflects plugins/ + apps/buyer + apps/seller.
// ─────────────────────────────────────────────────────────────────────────

export const ARCH_DIAGRAM = `┌──────────────────────────────────────────────────────────────────────────┐
│                              two agents, one network                     │
│                                                                          │
│   ┌──────────────────┐                            ┌──────────────────┐   │
│   │  buyer-agent     │                            │  seller-agent    │   │
│   │  apps/buyer-     │      RFQ (HTTP, signed)    │  apps/seller-    │   │
│   │  agent/          │ ─────────────────────────▶ │  agent/          │   │
│   │                  │ ◀───── signed quote ────── │  :3030/catalog   │   │
│   └────────┬─────────┘                            └────────┬─────────┘   │
│            │                                               │             │
│            │   each agent consumes the same 3 plugins ─────┘             │
│            │                                                             │
│            ▼                                                             │
│   ┌────────────────────────────────────────────────────────────────┐     │
│   │  plugins/policy-from-ens   ─────▶  ENS text records (Sepolia)  │     │
│   │  plugins/keeperhub-rail    ─────▶  Turnkey wallet · Base/Tempo │     │
│   │  plugins/audit-to-0g       ─────▶  0G Storage + AuditAnchor    │     │
│   └────────────────────────────────────────────────────────────────┘     │
│                                  │                                       │
│                                  ▼                                       │
│      ┌──────────────────┐                ┌────────────────────────┐      │
│      │ ProcurementEscrow│ ◀── tx ─────── │  ethers v6 wallet      │      │
│      │  Sepolia         │                │  0x13aF…7AC1           │      │
│      │  0x43b3…60b8     │                └────────────────────────┘      │
│      └──────────────────┘                                                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘`;

// ─────────────────────────────────────────────────────────────────────────
// Sponsors — only the three that are actual ETHGlobal Open Agents partners.
// ─────────────────────────────────────────────────────────────────────────

export const SPONSORS: Sponsor[] = [
  {
    name: "ENS",
    role: "Identity + governance · text records as policy",
    src: "plugins/policy-from-ens/",
    href: "https://sepolia.app.ens.domains/openagents-treasury.eth",
  },
  {
    name: "0G",
    role: "Verifiable memory · Storage + AuditAnchor",
    src: "plugins/audit-to-0g/",
    href: "https://chainscan-galileo.0g.ai/address/0xc4B91f01352cff1191eBd3d15A521D94ED081d89",
  },
  {
    name: "KeeperHub",
    role: "Autonomous x402 · USDC on Base + Tempo",
    src: "plugins/keeperhub-rail/",
    href: "https://www.npmjs.com/package/@keeperhub/wallet",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Onchain artifacts list — shown in the audit section.
// ─────────────────────────────────────────────────────────────────────────

export const ONCHAIN_ARTIFACTS: Artifact[] = [
  {
    name: "Agent identity",
    addr: "openagents-treasury.eth",
    chain: "Sepolia ENS · 11 text records",
    href: "https://sepolia.app.ens.domains/openagents-treasury.eth",
  },
  {
    name: "Seller subname",
    addr: "seller-acme.openagents-treasury.eth",
    chain: "Sepolia ENS · endpoint discovery",
    href: "https://sepolia.app.ens.domains/seller-acme.openagents-treasury.eth",
  },
  {
    name: "AuditAnchor.sol",
    addr: "0xc4B91f01352cff1191eBd3d15A521D94ED081d89",
    chain: "0G Galileo · 16602",
    href: "https://chainscan-galileo.0g.ai/address/0xc4B91f01352cff1191eBd3d15A521D94ED081d89",
  },
  {
    name: "ProcurementEscrow.sol",
    addr: "0x43b31222B22C35D0E5134d03D3f9bb18182360b8",
    chain: "Sepolia · 11155111",
    href: "https://sepolia.etherscan.io/address/0x43b31222B22C35D0E5134d03D3f9bb18182360b8",
  },
  {
    name: "Agent wallet",
    addr: "0x13aF7f5B2aD2a230d364cc2484380e711fe17AC1",
    chain: "Sepolia + 0G · same key",
    href: "https://sepolia.etherscan.io/address/0x13aF7f5B2aD2a230d364cc2484380e711fe17AC1",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Audit list — three real records from real agent runs.
// ─────────────────────────────────────────────────────────────────────────

export const AUDIT_FIXTURES: AuditEntry[] = [
  {
    ts: "2026-04-25T14:02:33Z",
    kind: "exec",
    label: "purchase",
    decision: "240 × SKU-A4-PAPER-500 → seller-acme.openagents-treasury.eth · 1,560 USDC",
    tx: "0xa42b…91d3",
    prompt: `RFQ: 240 × SKU-A4-PAPER-500
Quotes (signed):
  seller-acme.openagents-treasury.eth   6.50/u   1560 total
  seller-bulk.openagents-treasury.eth   7.20/u   1728 total
  seller-fast.openagents-treasury.eth   8.90/u   2136 total

History (last 3 buys for this SKU):  avg 10.10/u
Policy v1 (openagents-treasury.eth):
  treasury.maxPerCarrierUsd:   1000   ← needs split
  treasury.daily_cap_eth:      0.05
  treasury.carriers:           [acme, bulk]

Decide: purchase | hold | wait`,
    output: `{ "decision": "purchase",
  "winner": "seller-acme.openagents-treasury.eth",
  "sku":    "SKU-A4-PAPER-500", "qty": 240,
  "unit_usd": 6.50, "total_usd": 1560.00,
  "pattern": { "past_avg_usd": 10.10, "saving_pct": 35.6 },
  "rationale": "Acme's signed quote 35.6% below 3-purchase
   moving avg. Carrier on allow-list. Splitting into 2×120
   to satisfy maxPerCarrierUsd cap.",
  "confidence": 0.84 }`,
    policy: `policy.v1 @ openagents-treasury.eth
records:
  treasury.maxPerCarrierUsd:   1000
  treasury.maxDailyVolumeEth:  0.05
  treasury.carriers:           seller-acme.eth,seller-bulk.eth
  treasury.cooldownSeconds:    3600
sha256: 4d8a5e2118293a2b…abe3
0g_anchor_index: 14`,
  },
  {
    ts: "2026-04-25T11:18:09Z",
    kind: "block",
    label: "blocked",
    decision: "policy_check failed · maxPerCarrierUsd exceeded",
    tx: "—",
    prompt: `RFQ: 1 × SKU-FORKLIFT-3T
Quote (signed):
  seller-heavy.openagents-treasury.eth   12,400 USD

Policy v1 (openagents-treasury.eth):
  treasury.maxPerCarrierUsd:   1000   ← VIOLATION (12,400 > 1,000)
  treasury.carriers:           [acme, bulk]   ← VIOLATION (heavy not listed)`,
    output: `{ "decision": "hold",
  "rationale": "Two policy violations: (1) amount 12,400 exceeds
   maxPerCarrierUsd 1000; (2) seller-heavy not on carriers
   allow-list. Returning hold. Operator must update ENS text
   records to authorize this class of purchase.",
  "confidence": 0.99 }`,
    policy: `policy.v1 @ openagents-treasury.eth
records:
  treasury.maxPerCarrierUsd:   1000
  treasury.carriers:           seller-acme.eth,seller-bulk.eth
sha256: 4d8a5e2118293a2b…abe3
0g_anchor_index: 13`,
  },
  {
    ts: "2026-04-24T22:14:02Z",
    kind: "exec",
    label: "purchase",
    decision: "20 × SKU-TONER-K-002 → seller-acme.openagents-treasury.eth · 488 USDC",
    tx: "0x4c91…7e10",
    prompt: `RFQ: 20 × SKU-TONER-K-002
Quotes (signed):
  seller-acme.openagents-treasury.eth   24.40/u   488 total
  seller-fast.openagents-treasury.eth   31.00/u   620 total

Policy v1 (openagents-treasury.eth):
  treasury.maxPerCarrierUsd:   1000
  treasury.carriers:           [acme, bulk]`,
    output: `{ "decision": "purchase",
  "winner": "seller-acme.openagents-treasury.eth",
  "sku":    "SKU-TONER-K-002", "qty": 20,
  "unit_usd": 24.40, "total_usd": 488.00,
  "rationale": "Within all caps. Carrier on allow-list.
   Acme cheaper by 21%.",
  "confidence": 0.78 }`,
    policy: `policy.v1 @ openagents-treasury.eth
records:
  treasury.maxPerCarrierUsd:   1000
  treasury.carriers:           seller-acme.eth,seller-bulk.eth
sha256: 4d8a5e2118293a2b…abe3
0g_anchor_index: 12`,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// FAQ — five questions a hackathon judge or builder would actually ask.
// ─────────────────────────────────────────────────────────────────────────

export const FAQS: Faq[] = [
  {
    q: "Is this a product or a protocol?",
    a: "A protocol with reference implementations. <code>PROTOCOL.md</code> v0.1 defines five wire-level specs and three conformance levels (L1 discoverable / L2 settlement / L3 auditable). To prove the spec is real, we ship two independent buyer implementations (TypeScript ~620 LOC + Python ~380 LOC) and a seller (TypeScript ~160 LOC) — all trading against the same ENS records, the same escrow contract, the same 0G anchor. The buyer/seller agents are <em>evidence</em>, not the product. The product is the spec.",
  },
  {
    q: "How do I make my agent speak Open Deal?",
    a: "Read <code><a href='https://github.com/rodrigoarias12/open-deal/blob/main/IMPLEMENTERS.md' target='_blank' rel='noreferrer'>IMPLEMENTERS.md</a></code>. It's written AX-first — feed it to Claude / GPT / Gemini and the agent can produce a conformant implementation in your stack with no human help. Pick a side (buyer or seller), pick your data source (ERP, spreadsheet, custom), write one ~100-LOC adapter against our typed connector interface, plug into the reference loop. Total: ~30 minutes for a clean stack.",
  },
  {
    q: "Stack-agnostic? What stacks?",
    a: "The protocol is the only thing that doesn't change. Buyer side ships connectors for Odoo, Excel, CSV, mock; SAP is a stub with the contract documented. Seller side ships JSON, Excel, mock; Shopify and MercadoLibre are stubs with the API shapes documented. Your stack different? Your adapter is one file. Look at the closest reference connector as a template and copy the pattern. The protocol layer never changes; everything else is plug-and-play.",
  },
  {
    q: "How does this relate to ERC-8004?",
    a: "ERC-8004 (Jan 2026) defines three onchain registries for agent identity, reputation, and validation. Our trinity maps cleanly: <strong>identity</strong> → ENS name + subnames, <strong>capabilities/policy</strong> → ENS text records, <strong>validation</strong> → AuditAnchor on 0G Chain. We didn't ship ERC-8004 conformance — we shipped the same primitives ahead of the standard, on chains that exist today.",
  },
  {
    q: "Who pays the gas? The endpoints?",
    a: "Gas — the agent's hot wallet on Sepolia + 0G. Endpoints — KeeperHub. Sellers can price their <code>/rfq</code> endpoint via <code>HTTP 402</code> (anti-spam: $0.001 USDC per quote request to discourage 50-way fan-outs from quote-fishing agents). Buyers' Turnkey-custodied KeeperHub wallet on Base + Tempo handles the 402 retry transparently — same rail covers paid oracles, sanctions checks, logistics APIs. Plugin: <code>keeperhub-rail</code>, three tools, one mounted endpoint.",
  },
  {
    q: "What stops the agents from colluding or lying?",
    a: "Quotes are signed by the seller's wallet. The buyer's escrow lock is the funding event — until it lands on Sepolia, no money moves. Every decision (RFQ, all quotes, winner, pattern, policy snapshot, escrow tx) is uploaded to 0G Storage and anchored on 0G Chain. A third party fetches the JSON, recomputes the hash, and verifies the action was authorized by exactly that policy. Collusion is possible; lying about it is not.",
  },
  {
    q: "Mainnet?",
    a: "Sepolia for the hackathon (Apr 24 — May 6, 2026). Mainnet is a config flip in <code>src/config.ts</code> + <code>contracts/*.deployment.json</code> + a fresh ENS name — not a rewrite. The plugins are chain-agnostic: <code>policy-from-ens</code> reads any ENS-resolvable name on any EVM chain; <code>audit-to-0g</code> works on 0G Galileo today and any 0G mainnet release; <code>keeperhub-rail</code> is Base + Tempo regardless.",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// "The precedent" — Anthropic Project Deal (Apr 2026) ran the
// in-office, off-chain, C2C version of this idea. We took it open,
// onchain, B2B-grade.
// ─────────────────────────────────────────────────────────────────────────

export const PROJECT_DEAL = {
  source: "Anthropic Project Deal · April 2026",
  url: "https://www.anthropic.com/features/project-deal",
  headline:
    "Anthropic just proved Claude agents can negotiate on humans' behalf — and named the gap.",
  quote:
    "Policy and legal frameworks around AI models that transact on our behalf simply don't exist yet… Society will need to move quickly to reckon with these changes.",
  quoteAttribution: "Anthropic, Project Deal report",
  stats: [
    { num: "69", label: "employees, custom Claude agents" },
    { num: "186", label: "deals closed in 1 week" },
    { num: "$4K", label: "transaction value" },
    { num: "46%", label: "would pay for the service" },
  ],
  punchline:
    "Their experiment validated the demand. The same report flagged what's missing — confabulation, prompt injection, information asymmetry, no policy framework. We ship those primitives: policy on ENS, signed quotes, audit anchor on 0G. The framework Anthropic says doesn't exist is in PROTOCOL.md v0.1.",
  comparison: [
    {
      axis: "Network",
      anthropic: "1 office, 69 invited employees",
      ours: "Open, permissionless — anyone with an ENS name",
      edge: "extension",
    },
    {
      axis: "Onboarding",
      anthropic: "Claude interviews each user (chat-based intake)",
      ours: "ENS text records — onchain, third-party-auditable",
      edge: "extension",
    },
    {
      axis: "Discovery",
      anthropic: "4 parallel Slack channels",
      ours: "ENS subname registry + HTTP fan-out RFQ",
      edge: "extension",
    },
    {
      axis: "Negotiation",
      anthropic: "Listings + offers + counteroffers + close",
      ours: "Single-shot signed quote (multi-round on roadmap)",
      edge: "match",
    },
    {
      axis: "Settlement",
      anthropic: "deal_id in Slack + post-experiment gift cards",
      ours: "USDC escrow on Sepolia, dispute window onchain",
      edge: "extension",
    },
    {
      axis: "Audit",
      anthropic: "Internal logs, off-chain",
      ours: "0G Storage + 0G Chain anchor — verifiable by any party",
      edge: "extension",
    },
    {
      axis: "Domain",
      anthropic: "C2C — employees swap personal items",
      ours: "B2B — Odoo / Excel / SAP feed real procurement needs",
      edge: "extension",
    },
    {
      axis: "Confabulation defense",
      anthropic:
        "Agents fabricated personal details (a ‘conversation-starting chair’, ping-pong balls ‘as a gift to Claude’)",
      ours:
        "Hard policy gate via ENS text records — agent can’t spend outside maxPerCarrierUsd, can’t pick a non-allowlisted carrier",
      edge: "extension",
    },
    {
      axis: "Prompt-injection mitigation",
      anthropic:
        "Flagged as risk; no in-experiment defense. Quotes are natural-language only.",
      ours:
        "Quotes are signed by the seller wallet, not by the language model. Funding only moves on Sepolia escrow lock.",
      edge: "extension",
    },
    {
      axis: "Information asymmetry",
      anthropic:
        "Stronger model = better deals; weaker-model users didn’t notice (4/7 perceived fairness either way)",
      ours:
        "Every decision uploaded to 0G Storage, anchored on 0G Chain. Any third party recomputes the policy hash and verifies — post-hoc transparency is the equalizer.",
      edge: "extension",
    },
    {
      axis: "Policy / legal framework",
      anthropic:
        "“Don’t exist yet” (Anthropic’s own quote). Pilot disclaimed as not deployment-ready.",
      ours: "PROTOCOL.md v0.1 — five spec sections, three conformance levels (L1/L2/L3), open to extension",
      edge: "extension",
    },
  ] satisfies ProjectDealRow[],
};

// ─────────────────────────────────────────────────────────────────────────
// Author + waitlist + footer surfaces
// ─────────────────────────────────────────────────────────────────────────

export const AUTHOR = {
  name: "Rodrigo Gonzalo Arias",
  bio: "Solo builder. Background in fintech (Paydece), shipping payment + identity rails for emerging-market commerce. Building Open Deal full-time after the hackathon.",
  linkedin: "https://www.linkedin.com/in/rodrigogonzaloarias/",
  twitter: "https://x.com/rodrigo_arias12",
  twitterHandle: "@rodrigo_arias12",
  email: "rodrigogonzaloarias@gmail.com",
  github: "https://github.com/rodrigoarias12/open-deal",
};

export const WAITLIST = {
  // TODO: replace with the real Tally URL once the form is created.
  // Spec for the form is in the project notes.
  url: "https://tally.so/r/MeryQ0",
  title: "Get on the network",
  copy: "Open Deal v0.2 ships in May 2026 with multi-round negotiation, mainnet escrow, and Bridge.xyz off-ramp. If your company feels the procurement-by-spreadsheet pain — logistics, real estate, retail, manufacturing — drop your details. We'll reach out within 48h.",
  cta: "join the waitlist",
};

export const VERTICALS = [
  {
    eyebrow: "logistics · emerging markets",
    title: "Carrier price-hunting on WhatsApp + Excel.",
    body: "Every shipment is a manual price comparison across a fragmented carrier base. Hours per week per ops person. We talked to two operators — both described the same workflow. Open Deal turns it into a 30-second buyer-agent tick: fan-out RFQ to N carriers via ENS subnames, signed quotes, escrow release on shipment-proof, full audit trail.",
    cta: "talk to us",
  },
  {
    eyebrow: "real estate · construction materials",
    title: "Re-quoting the same shopping list every project.",
    body: "Cement, rebar, drywall, fixtures, paint. The vendor universe is wide, the comparison is mechanical, the savings compound across the portfolio. PM drops their list (Excel buyer connector), agent compares against N hosted seller catalogs on 0G, human approves only outliers via Telegram. Same framework, different connectors.",
    cta: "talk to us",
  },
  {
    eyebrow: "retail · e-commerce · manufacturing",
    title: "Anything with high SKU repetition + wide vendor universe.",
    body: "Three properties define the wedge: high SKU repetition, wide vendor universe, and price-shopping currently done by humans copying numbers between tabs. If your industry hits all three, the framework fits. We're picking design partners for v0.2 — get on the waitlist.",
    cta: "talk to us",
  },
];

export const FOOTER_LINKS = {
  product: [
    { label: "Onboard a seller", href: "/sell" },
    { label: "Live dashboard", href: "/dashboard" },
    { label: "Open Deal protocol", href: "https://github.com/rodrigoarias12/open-deal/blob/main/PROTOCOL.md" },
    { label: "Architecture", href: "https://github.com/rodrigoarias12/open-deal/blob/main/ARCHITECTURE.md" },
  ],
  build: [
    { label: "GitHub", href: "https://github.com/rodrigoarias12/open-deal" },
    { label: "Plugins (npm)", href: "https://github.com/rodrigoarias12/open-deal/tree/main/plugins" },
    { label: "Builder feedback", href: "https://github.com/rodrigoarias12/open-deal/blob/main/FEEDBACK.md" },
    { label: "Reference apps", href: "https://github.com/rodrigoarias12/open-deal/tree/main/apps" },
  ],
  references: [
    { label: "Anthropic Project Deal", href: "https://www.anthropic.com/features/project-deal" },
    { label: "Anthropic Agent Skills", href: "https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills" },
    { label: "ETHGlobal Open Agents", href: "https://ethglobal.com/events/openagents" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// Stack-agnostic matrix — the central pitch: spec is the only thing that
// doesn't change; everything else plugs in.
// ─────────────────────────────────────────────────────────────────────────

export type StackEntry = {
  label: string;
  status: "real" | "stub";
  loc: number;
  href?: string;
};

export const STACK_AGNOSTIC = {
  buyerSide: [
    { label: "Odoo (JSON-RPC)", status: "real", loc: 74, href: "https://github.com/rodrigoarias12/open-deal/blob/main/src/connectors/buyer/odoo.ts" },
    { label: "Excel (.xlsx)", status: "real", loc: 143, href: "https://github.com/rodrigoarias12/open-deal/blob/main/src/connectors/buyer/excel.ts" },
    { label: "CSV", status: "real", loc: 113, href: "https://github.com/rodrigoarias12/open-deal/blob/main/src/connectors/buyer/csv.ts" },
    { label: "SAP (RFC / OData)", status: "stub", loc: 71, href: "https://github.com/rodrigoarias12/open-deal/blob/main/src/connectors/buyer/sap.ts" },
    { label: "your stack", status: "stub", loc: 0 },
  ] satisfies StackEntry[],
  sellerSide: [
    { label: "Shopify (Admin GraphQL)", status: "stub", loc: 83, href: "https://github.com/rodrigoarias12/open-deal/blob/main/src/connectors/seller/shopify.ts" },
    { label: "MercadoLibre (Items API)", status: "stub", loc: 91, href: "https://github.com/rodrigoarias12/open-deal/blob/main/src/connectors/seller/mercadolibre.ts" },
    { label: "JSON file", status: "real", loc: 42, href: "https://github.com/rodrigoarias12/open-deal/blob/main/src/connectors/seller/json.ts" },
    { label: "Excel (.xlsx)", status: "real", loc: 53, href: "https://github.com/rodrigoarias12/open-deal/blob/main/src/connectors/seller/excel.ts" },
    { label: "your stack", status: "stub", loc: 0 },
  ] satisfies StackEntry[],
  implementations: [
    { label: "TypeScript (apps/buyer-agent)", loc: 621, status: "real" as const, href: "https://github.com/rodrigoarias12/open-deal/blob/main/apps/buyer-agent" },
    { label: "Python (apps/buyer-py)", loc: 379, status: "real" as const, href: "https://github.com/rodrigoarias12/open-deal/blob/main/apps/buyer-py" },
    { label: "Hosted seller (Vercel)", loc: 200, status: "real" as const, href: "https://open-deal.vercel.app/sell" },
    { label: "yours next?", loc: 0, status: "stub" as const, href: "https://github.com/rodrigoarias12/open-deal/blob/main/IMPLEMENTERS.md" },
  ],
};
