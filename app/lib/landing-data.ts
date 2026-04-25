// Fixture data for the landing — story/demo content. The dashboard at
// /dashboard reads the live audit log; this file is what the visitor sees
// before they click in.

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
  decision: { swap?: string; to?: string; hold?: string };
  tx: string;
  prompt: string;
  output: string;
  policy: string;
};

export type Faq = { q: string; a: string };

export type TerminalLine =
  | { t: "prompt"; text: string }
  | { t: "section"; text: string }
  | { t: "out"; text: string }
  | { t: "kv"; k: string; v: string }
  | { t: "ok"; text: string }
  | { t: "warn"; text: string };

export const TERMINAL_SCRIPT: TerminalLine[] = [
  { t: "prompt", text: "$ oat tick --policy treasury.openagents.eth" },
  { t: "section", text: "── 01 read books ─────────────────────" },
  { t: "out", text: "→ books.openagents.eth (odoo.execute_kw)" },
  { t: "kv", k: "cash.USDC_sepolia", v: "412,840.00" },
  { t: "kv", k: "burn_30d_usd", v: "184,500.00" },
  { t: "kv", k: "runway_months", v: "11.4" },
  { t: "section", text: "── 02 fetch policy ───────────────────" },
  { t: "out", text: "→ ens.resolveTextRecord('policy.v1')" },
  { t: "kv", k: "max_swap_usd", v: "50,000" },
  { t: "kv", k: "daily_cap_usd", v: "150,000" },
  { t: "kv", k: "min_runway_months", v: "9" },
  { t: "section", text: "── 03 reason (claude-sonnet-4-6) ─────" },
  { t: "out", text: "decision: swap" },
  { t: "kv", k: "from", v: "USDC" },
  { t: "kv", k: "to", v: "WETH" },
  { t: "kv", k: "amount_usd", v: "25,000" },
  { t: "kv", k: "confidence", v: "0.82" },
  { t: "section", text: "── 04 execute (uniswap.tradingApi) ───" },
  { t: "warn", text: "policy_check ………… PASS" },
  { t: "ok", text: "broadcast ……………… 0x8d3f4a…f607" },
  { t: "kv", k: "block", v: "5,884,233" },
  { t: "kv", k: "gas", v: "184,221" },
  { t: "section", text: "── 05 audit ──────────────────────────" },
  { t: "out", text: "→ audit/2026-04-25T14:02:33Z.json" },
  { t: "kv", k: "sha256", v: "a3f1…88c0" },
  { t: "ok", text: "tick ✓ ……………………… 6.2s" },
];

export const LOOP: LoopNode[] = [
  {
    num: "01",
    icon: "GET",
    title: "Read books",
    desc: "Pull cash state from Odoo via JSON-RPC, or CSV in dev. Balances, pending invoices, burn.",
    tag: "src/sources/odoo.ts",
    payload: {
      label: "POST /jsonrpc → odoo.execute_kw",
      meta: [
        ["Source", "Odoo 19"],
        ["Endpoint", "books.openagents.eth"],
        ["Method", "account.move.search_read"],
        ["Cache", "60s"],
      ],
      code: `{
  "company": "OpenAgents Inc.",
  "as_of": "2026-04-25T14:02:00Z",
  "cash": {
    "USDC_sepolia": "412840.00",
    "USD_mercury":  "180220.55",
    "ETH_sepolia":  "12.4"
  },
  "burn_30d_usd":   "184500.00",
  "runway_months":  "11.4",
  "pending_invoices": 3,
  "next_payroll_at": "2026-05-01T17:00:00Z"
}`,
    },
  },
  {
    num: "02",
    icon: "ENS",
    title: "Fetch policy",
    desc: "Resolve text records on treasury.openagents.eth. Caps, allowed tokens, blackout windows.",
    tag: "src/ens/policy.ts",
    payload: {
      label: "ens.resolveTextRecord('policy.v1')",
      meta: [
        ["Resolver", "0x231b...8b9c"],
        ["Name", "treasury.openagents.eth"],
        ["Record", "policy.v1"],
        ["Block", "5,884,221"],
      ],
      code: `{
  "version": "1.0",
  "max_swap_usd": 50000,
  "daily_cap_usd": 150000,
  "allowed_tokens": ["USDC", "WETH", "DAI"],
  "min_runway_months": 9,
  "blackout_windows": [
    "2026-05-01T16:00Z..2026-05-01T20:00Z"
  ],
  "signer": "0x9f31...02ae"
}`,
    },
  },
  {
    num: "03",
    icon: "LLM",
    title: "Reason",
    desc: "Send books + policy + market quotes to Claude. Get a structured decision: hold, swap, or wait.",
    tag: "src/agent/core.ts",
    payload: {
      label: "claude.messages.create → tools.decide_allocation",
      meta: [
        ["Model", "claude-sonnet-4-6"],
        ["Provider", "AWS Bedrock"],
        ["Input tokens", "3,841"],
        ["Output tokens", "612"],
      ],
      code: `{
  "decision": "swap",
  "from": "USDC",
  "to":   "WETH",
  "amount_usd": 25000,
  "rationale": "Idle USDC above 9-month runway threshold. Within max_swap_usd. Outside blackout. Aave WETH supply yield + duration aligns with Q3 burn projection.",
  "confidence": 0.82,
  "alternatives": ["hold", "swap_to_DAI"]
}`,
    },
  },
  {
    num: "04",
    icon: "TX",
    title: "Execute",
    desc: "Build, sign, and broadcast via Uniswap Trading API on Sepolia. Re-checks policy at broadcast time.",
    tag: "src/dex/uniswap.ts",
    payload: {
      label: "uniswap.tradingApi.executeSwap()",
      meta: [
        ["Chain", "Sepolia (11155111)"],
        ["Pool", "USDC/WETH 0.05%"],
        ["Slippage", "0.30%"],
        ["Status", "MINED"],
      ],
      code: `{
  "tx_hash": "0x8d3f4a2b9c1e5708f6a2b3c4d5e6f701829304ab5c6d7e8f90a1b2c3d4e5f607",
  "block":   5884233,
  "from":    "0x9f31...02ae",
  "swap": {
    "in":  "25000.00 USDC",
    "out": "8.4127 WETH",
    "price_usd": 2972.41
  },
  "gas_used": 184221,
  "policy_check": "PASS"
}`,
    },
  },
  {
    num: "05",
    icon: "LOG",
    title: "Audit",
    desc: "Append snapshot, full prompt, model output, tx hash, and ENS policy state to audit/<ts>.json.",
    tag: "src/audit/logger.ts",
    payload: {
      label: "fs.writeFile('audit/' + ts + '.json')",
      meta: [
        ["Path", "audit/2026-04-25T14:02:33Z.json"],
        ["Bytes", "14,221"],
        ["Hash", "sha256:a3f1...88c0"],
        ["Mirror", "ipfs://bafyb..."],
      ],
      code: `{
  "tick_id": "tick_01HW8X4...",
  "ts":      "2026-04-25T14:02:33Z",
  "input":   { "books": "...", "policy": "..." },
  "model":   { "name": "claude-sonnet-4-6", "prompt_sha": "...", "output": "..." },
  "tx":      { "hash": "0x8d3f...f607", "block": 5884233 },
  "policy_at_decision": "ipfs://bafyb..."
}`,
    },
  },
];

export const PILLARS: Pillar[] = [
  {
    num: "01",
    title: "Policy as ENS records.",
    body: "Governance lives onchain at treasury.openagents.eth — caps, allowed tokens, blackout windows. Update the text record, the agent updates its behavior on the next tick. No Notion doc, no Slack thread, no out-of-band trust.",
    mono: "treasury.openagents.eth",
    foot: "src/ens/policy.ts",
  },
  {
    num: "02",
    title: "Reasoning with receipts.",
    body: "Every decision ships with the input snapshot, the full prompt, the model output, and the policy state at decision time. Auditable by humans, not just by hash. The model can be wrong — the trail makes it provable.",
    mono: "audit/<ts>.json",
    foot: "src/audit/logger.ts",
  },
  {
    num: "03",
    title: "x402-ready outbound.",
    body: "Every fetch the agent makes routes through KeeperHub. Paying for a price feed, a chain RPC, or a vendor invoice is the same code path: HTTP 402, sign, retry. The agent doesn't distinguish data from goods.",
    mono: "x402 → keeperhub",
    foot: "src/payments/keeperhub.ts",
  },
];

export const DEMO: DemoFixture = {
  fixture: "fixtures/run-2026-04-25T14-02.csv",
  steps: [
    { title: "Read books", meta: "412,840.00 USDC · runway 11.4mo" },
    { title: "Fetch policy", meta: "policy.v1 @ blk 5,884,221" },
    { title: "Reason", meta: "claude-sonnet-4-6 → swap 25k" },
    { title: "Execute", meta: "0x8d3f…f607 · block 5,884,233" },
    { title: "Audit", meta: "audit/2026-04-25T14-02-33Z.json" },
  ],
  panes: {
    prompt: `system: You are a treasury allocation agent. Follow the
policy strictly. If any check fails, return decision:"hold".

user:
  books: { cash: { USDC_sepolia: 412840.00, ETH: 12.4 },
           burn_30d_usd: 184500, runway_months: 11.4,
           next_payroll_at: 2026-05-01T17:00Z }
  policy: { max_swap_usd: 50000, daily_cap_usd: 150000,
            allowed_tokens: [USDC, WETH, DAI],
            min_runway_months: 9 }
  quotes: { USDC/WETH: 2972.41, USDC/DAI: 1.0001 }

tool: decide_allocation`,
    output: `{
  "decision": "swap",
  "from": "USDC",
  "to":   "WETH",
  "amount_usd": 25000,
  "rationale": "Idle USDC well above 9-month runway threshold (11.4mo > 9). Swap of 25k is within max_swap_usd=50k and daily_cap=150k. Outside next blackout window (2026-05-01 payroll). Diversification into WETH reduces stable-only concentration risk.",
  "confidence": 0.82,
  "alternatives": ["hold", "swap_to_DAI"]
}`,
  },
};

export const ARCH_DIAGRAM = `┌──────────────────────────────────────────────────────────────────────────┐
│                         agent/core.ts  (entry: runTick)                  │
│                                                                          │
│   ▸ source.fetch()      ▸ loadPolicy(ens)      ▸ llmAsk(claude)          │
│         │                       │                    │                   │
│         ▼                       ▼                    ▼                   │
│   ┌──────────┐           ┌──────────────┐     ┌──────────────┐           │
│   │ sources/ │           │  ens/policy  │     │ llm/client   │           │
│   │  odoo.ts │           │   .ts        │     │   .ts        │           │
│   │  csv.ts  │           └──────┬───────┘     └──────┬───────┘           │
│   └──────────┘                  │                    │                   │
│        │                        │                    │                   │
│        └────────────► state ◄───┴───── prompt ◄──────┘                   │
│                         │                                                │
│                         ▼                                                │
│                 ┌─────────────────┐         ┌────────────────────┐       │
│                 │ dex/uniswap.ts  │ ──tx──▶ │  ethers v6 wallet  │       │
│                 │  (Trading API)  │         │   sepolia.signer   │       │
│                 └────────┬────────┘         └─────────┬──────────┘       │
│                          │                            │                  │
│                          ▼                            ▼                  │
│                 ┌─────────────────┐         ┌────────────────────┐       │
│                 │  audit/logger   │         │  payments/keeper-  │       │
│                 │   audit/*.json  │         │   hub (x402)       │       │
│                 └─────────────────┘         └────────────────────┘       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘`;

export const SPONSORS: Sponsor[] = [
  { name: "ENS", role: "Policy registry", src: "src/ens/policy.ts", href: "https://github.com" },
  { name: "Uniswap", role: "Trading API", src: "src/dex/uniswap.ts", href: "https://github.com" },
  { name: "KeeperHub", role: "x402 outbound", src: "src/payments/keeperhub.ts", href: "https://github.com" },
  { name: "Anthropic", role: "Reasoning · Claude", src: "src/llm/client.ts", href: "https://github.com" },
  { name: "Sepolia", role: "Settlement", src: "src/chain/client.ts", href: "https://github.com" },
];

export const AUDIT_FIXTURES: AuditEntry[] = [
  {
    ts: "2026-04-25T14:02:33Z",
    decision: { swap: "25,000.00 USDC", to: "8.4127 WETH" },
    tx: "0x8d3f4a2b…d4e5f607",
    prompt: `Idle USDC: 412,840 · runway 11.4mo · next payroll 2026-05-01

Policy v1 (treasury.openagents.eth):
  max_swap_usd:        50,000
  daily_cap_usd:       150,000
  min_runway_months:   9
  allowed_tokens:      [USDC, WETH, DAI]
  blackout_windows:    [2026-05-01T16:00Z..20:00Z]

Quotes:
  USDC/WETH = 2,972.41
  USDC/DAI  = 1.0001

Decide: hold | swap | wait`,
    output: `{ "decision": "swap", "from": "USDC", "to": "WETH",
  "amount_usd": 25000, "confidence": 0.82,
  "rationale": "Idle USDC above 9-mo runway threshold; within
   per-tx and daily caps; outside blackout; reduces stable-
   concentration risk." }`,
    policy: `policy.v1 @ block 5,884,221
sha256: a3f1c0e9b428...88c0
ipfs:   bafybeigd...zq`,
  },
  {
    ts: "2026-04-25T10:48:11Z",
    decision: { hold: "policy_check failed" },
    tx: "—",
    prompt: `Idle USDC: 412,840 · runway 11.4mo · next payroll 2026-05-01

Proposed: swap 60,000 USDC → DAI

Policy v1 (treasury.openagents.eth):
  max_swap_usd:        50,000   ← VIOLATION
  daily_cap_usd:       150,000
  allowed_tokens:      [USDC, WETH, DAI]`,
    output: `{ "decision": "hold",
  "rationale": "Proposed amount 60,000 exceeds max_swap_usd
   of 50,000. Returning hold per policy. Suggest splitting
   into 2 ticks of 30,000 across separate days.",
  "confidence": 0.99 }`,
    policy: `policy.v1 @ block 5,884,142
sha256: a3f1c0e9b428...88c0`,
  },
  {
    ts: "2026-04-24T22:14:02Z",
    decision: { swap: "12,000.00 USDC", to: "12,001.20 DAI" },
    tx: "0x4c91ab73…77e10c2a",
    prompt: `Idle USDC: 437,840 · runway 12.1mo

Policy v1 (treasury.openagents.eth):
  max_swap_usd:        50,000
  allowed_tokens:      [USDC, WETH, DAI]
  min_runway_months:   9

Quotes: USDC/DAI = 1.0001`,
    output: `{ "decision": "swap", "from": "USDC", "to": "DAI",
  "amount_usd": 12000, "confidence": 0.71,
  "rationale": "Light diversification into DAI. Within all
   caps. Runway comfortable. Quote within 5bps of peg." }`,
    policy: `policy.v1 @ block 5,883,907
sha256: a3f1c0e9b428...88c0`,
  },
];

export const FAQS: Faq[] = [
  {
    q: "Is the agent custodial?",
    a: "No. It signs from a hot wallet whose policy is published at <code>treasury.openagents.eth</code>. You change the text record, the agent changes behavior on the next tick. No third party can alter the policy on your behalf.",
  },
  {
    q: "What stops it from going rogue?",
    a: "The ENS policy is checked twice — once before reasoning, once before broadcast. If <code>max_swap_usd</code> is $1,000, the agent cannot execute $1,001. The check is in <code>agent/core.ts → enforcePolicy()</code>. If you don't trust the check, read it.",
  },
  {
    q: "Mainnet?",
    a: "Sepolia for the hackathon. Mainnet is a config flip in <code>src/config.ts</code>, not a rewrite. ENS, Uniswap Trading API, and the audit format are chain-agnostic.",
  },
  {
    q: "Why Claude?",
    a: "Reasoning, structured tool output, and a prompt that fits in the audit log. The full input and output are human-auditable. No black-box ML, no hidden state — every tick is a function of state you can read.",
  },
  {
    q: "What if the model is wrong?",
    a: "The policy is the contract. The model is the executor. The model can suggest something stupid; the policy check rejects it. You build trust by tightening caps over time, not by trusting the model.",
  },
];
