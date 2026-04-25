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

_(will be filled in as we integrate)_

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

