import "dotenv/config";
import { Contract, JsonRpcProvider, Wallet, namehash } from "ethers";
import { requireEnv } from "../src/config";

// Sets the procurement.rfq-price text record on a seller subname so the
// /api/seller/[subname]/rfq endpoint starts charging via x402 (PROTOCOL.md §3.4).
//
// Usage:
//   SUBNAME=seller-acme PRICE=0.001 npx tsx scripts/ens-set-rfq-price.ts
//   SUBNAME=acme-cartoneria PRICE=0.002 npx tsx scripts/ens-set-rfq-price.ts
//
// The agent wallet (AGENT_PRIVATE_KEY) must be the owner of the subname,
// which it is for everything under openagents-treasury.eth.

const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const CHAIN_ID = 11155111;
const PUBLIC_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5";
const PARENT = process.env.ENS_PARENT || "openagents-treasury.eth";

const SUBNAME = process.env.SUBNAME || "seller-acme";
const PRICE = process.env.PRICE || "0.001";

const RESOLVER_ABI = [
  "function setText(bytes32 node, string calldata key, string calldata value) external",
  "function text(bytes32 node, string calldata key) view returns (string)",
];

async function main(): Promise<void> {
  const provider = new JsonRpcProvider(RPC, CHAIN_ID);
  const signer = new Wallet(requireEnv("AGENT_PRIVATE_KEY"), provider);

  const fullName = `${SUBNAME}.${PARENT}`;
  const node = namehash(fullName);
  console.log(`[rfq-price] name: ${fullName}`);
  console.log(`[rfq-price] node: ${node}`);
  console.log(`[rfq-price] target value: ${PRICE} USDC per RFQ`);

  const resolver = new Contract(PUBLIC_RESOLVER, RESOLVER_ABI, signer);

  const before = (await resolver.text(node, "procurement.rfq-price")) as string;
  console.log(`[rfq-price] current value: '${before}'`);

  if (before === PRICE) {
    console.log(`[rfq-price] already set to ${PRICE} — no tx needed.`);
    return;
  }

  console.log(`[rfq-price] sending setText…`);
  const tx = await resolver.setText(node, "procurement.rfq-price", PRICE);
  console.log(`[rfq-price] tx: ${tx.hash}`);
  console.log(`[rfq-price] explorer: https://sepolia.etherscan.io/tx/${tx.hash}`);
  await tx.wait();
  console.log(`[rfq-price] confirmed.`);

  const after = (await resolver.text(node, "procurement.rfq-price")) as string;
  console.log(`[rfq-price] new value: '${after}'`);
  console.log(`[rfq-price] ENS app: https://sepolia.app.ens.domains/${fullName}`);
}

main().catch((e) => {
  console.error("[rfq-price] failed:", e);
  process.exit(1);
});
