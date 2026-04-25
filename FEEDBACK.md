# Builder Feedback

Honest notes on the developer experience of each sponsor SDK while building this
project during ETHGlobal Open Agents 2026. Written as we go.

## Uniswap

### What I tried a year ago vs. what I just did

About a year ago I tried to build the exact same flow — a script that decides
on an allocation and executes the swap onchain. I gave up. The state of the
docs at the time pushed me toward stitching together SwapRouter02 ABIs,
QuoterV2 calls, Permit2 by hand, slippage math, and reading V3 pool state
manually. For a one-person hackathon project, the cost was too high relative
to the actual product I was trying to build (an autonomous agent that *uses*
swaps — not a swap engine).

This time I tried the Trading API and got an end-to-end working ETH→USDC
quote on Sepolia in under 10 minutes from scratch. One POST,
one parsed response, the route is chosen for me across V2/V3/V4, Permit2
data is returned ready to sign, slippage and `minAmount` come pre-computed.
It moved Uniswap from "I'll do this if I have time" to "this is the obvious
default" for an agent project.

### Concrete wins for an agent builder

- `swapper` field in the request → quote already includes the recipient and
  Permit2 spender bound to the agent's wallet. No extra plumbing.
- `aggregatedOutputs[].minAmount` is computed from declared slippage and
  returned alongside the quote — agents don't need to redo the math before
  posting an order.
- Same endpoint shape on mainnet and Sepolia (chainId is just a parameter),
  so I could verify the API key against mainnet and then switch to testnet
  without rewriting anything.

### Friction we hit

- Sepolia *is* supported but it isn't visible in the public chain list page
  I landed on first. I assumed it was unsupported after a single 404 and
  almost pivoted to mainnet ($$$). A "supported testnets" line on the
  landing docs page would have saved ~20 minutes.
- The 404 body for "no route found for this pair on this chain" is
  `ResourceNotFound / No quotes available`, which read identically to "this
  chain is not supported." A distinct error code (e.g. `NoRouteFound` vs
  `ChainUnsupported`) would have made the diagnosis obvious.
- The canonical Sepolia WETH I had hard-coded in my config
  (`0x7b79...`, the Aave/Compound one) is *not* the WETH the Trading API
  routes against (`0xfFf99...`). The error is the same generic 404. A
  short "common Sepolia gotchas" snippet, or returning the *expected*
  WETH address for the chain when no route is found, would unblock new
  integrators in one shot.
- For wallets generated via `ethers.Wallet.createRandom()` and funded
  only on testnet, calling `/v1/swap` with `signature: null` returns
  `"signature" must be a string`. Native-ETH input doesn't need Permit2,
  so allowing `signature` to be omitted (not just nullable) for
  `permitData == null` flows would match the docs' implication.
- On Sepolia, the same WETH→USDC quote flips between `200 OK` and
  `404 No quotes available` within seconds for an *identical* request
  body. Across one batch of swap attempts: 4/8 succeeded, 4/8 returned
  the 404. Routing API ends up bouncing
  between the 100bps and 3000bps V3 pools depending on which had
  liquidity at that instant. For agents (where retry-on-success is
  expected behavior), a documented "transient on testnets, retry with
  backoff" note — or, ideally, the API doing one internal retry against
  the next-best pool before returning 404 — would remove a layer of
  client-side resilience code that every integrator will end up
  rewriting.

### What I'd ship next if I were on the Trading API team

- Surface the four chain-detection footguns above directly in the
  `errorCode` / `detail` payload so the same string isn't reused for
  "chain unsupported," "no route," "wrong token address," and "pool
  briefly empty."
- A `/v1/canonical_tokens?chainId=...` lookup that returns the *exact*
  WETH/USDC the router treats as canonical for that chain. Right now
  you discover the right address only by issuing a successful quote
  and reading it out of the response — which is exactly the request
  that fails when you have the wrong address.

(Continuing to add observations as I wire in ENS + KeeperHub.)

## KeeperHub

### What I built with KeeperHub

The treasury agent's *outbound HTTP layer* — every call from the agent
to Uniswap (and tomorrow, anywhere else) — is wrapped with
`paymentSigner.fetch` from `@keeperhub/wallet`. Today nothing in the
stack returns 402, so the wrapper is a transparent passthrough. The
moment any provider charges per-request — premium routing, gated
endpoints, paid data — the agent pays it inline in USDC, within policy
bounds (the same `treasury.maxDailyVolumeEth` we read from ENS), with
zero human in the loop.

Module: `src/payments/keeperhub.ts`. Wallet provisioned via
`npx @keeperhub/wallet add`:

```
walletAddress: 0x588C4bD9bB2b1FceD0E5D27E5E9152d1B5f71768
```

### What worked exceptionally well

- **Account-less provisioning.** `npx @keeperhub/wallet add` returns a
  signed wallet config in under a second with no signup, no email
  verification, no wallet-connect ceremony. For a hackathon where you
  spend the first 30 minutes fighting auth flows for every sponsor, this
  is the single biggest UX win in the prize pool.
- **Drop-in `paymentSigner.fetch`.** The API surface is *exactly*
  `fetch(input, init)`. I replaced `fetch(...)` with `x402fetch(...)`
  in two lines of `src/dex/uniswap.ts` and the existing test scripts
  passed unchanged. No mental model shift: if an endpoint returns 200,
  you get 200; if it returns 402, the SDK pays and retries with the
  original body and headers preserved.
- **Type safety end-to-end.** `WalletConfig`, `BalanceSnapshot`,
  `X402Challenge`, `MppChallenge` — all exported, all narrow. The
  Turnkey custody / HMAC plumbing is completely opaque, which is
  exactly what an integrator wants.

### Friction

- **No public x402 testnet endpoint.** This is the *one* thing missing
  for hackathon UX. To prove the auto-pay loop end-to-end I need (a)
  to fund a Base mainnet wallet with real USDC, and (b) find a public
  endpoint that returns 402. I can do (a) cheaply but I'd rather not
  for a smoke test. Even a single demo endpoint at e.g.
  `x402-demo.keeperhub.com/echo` that charges 0.001 USDC on Tempo
  testnet would let every builder land a real "agent paid for this
  call" tx in their first 10 minutes. (Without it, the auto-pay code
  path is exercised on every request in this build but only fires
  hypothetically — the demo can't show a paid 402 yet.)
- **`docs.keeperhub.com`, `keeperhub.com`, and `app.keeperhub.com`
  all return 403** to automated fetches (Cloudflare bot mitigation).
  My agent — which is the literal target audience for the docs —
  cannot read them. The package README.md is excellent and salvaged
  the integration; docs being unreachable to bots is a small
  configuration change away (allow common UA strings, or flag the docs
  origin as bot-friendly).
- **`add` overwrites silently.** Running `npx @keeperhub/wallet add`
  twice generates a fresh wallet and overwrites `~/.keeperhub/wallet.json`
  with no warning. For a developer iterating, this destroys access to
  whatever balance was on the previous wallet. Either prompt before
  overwriting, or have `add` no-op when a config already exists and
  expose `add --force` for the recreate case.
- **No payment proof surfaced in the retry Response.** When
  `paymentSigner.fetch` pays a 402 and returns the post-payment retry
  Response, there's no obvious way for the caller to *audit* what was
  paid (amount, tx hash, network) without reaching back into the SDK.
  For an autonomous agent that has to write everything to an audit
  log, exposing the payment receipt — e.g. as a `x-keeperhub-receipt`
  header on the returned Response or via an event hook — would close
  the loop.

### What I'd ship next if I were on the KeeperHub team

A `npx @keeperhub/wallet pay <url>` CLI that does a full round-trip
against a sample 402 endpoint and prints the receipt. Builders would
have proof of working auto-pay before they write a single line of
integration code. Pair it with the public testnet endpoint above and
"first agent payment" becomes a sub-five-minute experience.

## ENS

### What I built with ENS

I used ENS text records as the *policy layer* for the autonomous agent —
not as identity (which is the obvious use), and not as recipient
resolution (also obvious), but as a **public, on-chain governance
surface** that the agent reads before each tick. Records under the
keys `treasury.maxSwapEth`, `treasury.minBufferEth`,
`treasury.allowedTokens`, `treasury.maxDailyVolumeEth`,
`treasury.cooldownSeconds` define what the agent is *allowed* to do.
A human owns the ENS name; the agent owns the wallet. To change the
policy the human posts a tx on a name they already control — no
contract redeploy, no admin endpoint, no "trust me bro" YAML.

The shipped flow is:

```
runTick →
  loadPolicy(ENS_NAME)        // ethers' built-in mainnet ENS resolution
  pass policy into prompt      // claude on bedrock cites it back to me
  enforcePolicy(decision)      // hard reject if model strayed
  if allowed → executeSwap     // onchain, on Sepolia
  audit JSON includes the full policy snapshot used
```

This gave me a property I genuinely care about: every onchain action
the agent took is traceable to *exactly the policy bytes that
authorized it at that timestamp*, and those bytes are public ENS state.
Nice fit for "trustless agent."

### What worked well

- ethers v6's built-in ENS resolution is very nice. `provider.resolveName`,
  `provider.lookupAddress`, `resolver.getText(key)` are all one-liners,
  no extra package. Verified against `vitalik.eth` in seconds.
- Custom keys "just work." I picked `treasury.maxSwapEth` (no convention,
  no namespace registration) and ENS happily stores and serves it.
- Graceful degradation is easy: when the resolver returns no records,
  fall back to safe defaults so the agent never crashes from a missing
  ENS name. (Important for the local dev loop where you don't always
  have a registered name handy.)

### Friction

- A non-Sepolia mainnet RPC is required even for an agent that
  transacts only on Sepolia, because the names that actually have value
  in this ecosystem live on mainnet. Not a bug, just a docs/UX point:
  every "agent reads ENS" example I'd love to see in the docs is
  cross-chain by definition. A short snippet like
  *"reading ENS from a different-chain agent: instantiate a separate
  mainnet provider only for resolution"* would shortcut this for
  every agent builder.
- I'd love a sponsored/recommended *namespace registry* for app-level
  text-record keys (the EIPs cover identity records like
  `com.twitter`, `email`, `url`, but say nothing about app-defined
  keys). Without one, every project will reinvent "treasury.foo" and
  collisions are inevitable. A page like "if you publish text records
  for your app, register your namespace prefix here" would prevent
  the squatting that's about to start.
- Setting text records via the official UI is one tx per record,
  which is fine for the demo but expensive for any real-world policy
  with 5-10 records. A "set multiple text records in one tx" UX —
  via multicall — would matter a lot for agent operators in
  production.

(Continuing observations as I wire in KeeperHub.)

