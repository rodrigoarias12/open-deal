/**
 * Re-points the `endpoint` text record on each of the 5 marketplace
 * sellers to the canonical Vercel alias (agentic-erp-eth.vercel.app).
 *
 * Background: when /api/seller/onboard runs on Vercel, the previous
 * implementation wrote VERCEL_URL (deployment-specific) into the text
 * record. Deployment-specific Vercel URLs are gated by Deployment
 * Protection — agents POSTing to them get an HTML auth wall instead of
 * the JSON quote. The canonical alias bypasses the wall.
 *
 * One-shot fix; the onboarding route is now patched to write the
 * canonical alias by default for all future onboardings.
 */
import "dotenv/config";
import {
  Contract,
  Interface,
  JsonRpcProvider,
  Wallet,
  namehash,
} from "ethers";
import { requireEnv } from "../src/config";

const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const CHAIN_ID = 11155111;
const PUBLIC_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5";

const SUBNAMES = [
  "acme-cartoneria.openagents-treasury.eth",
  "seller-acme.openagents-treasury.eth",
  "distri-norte-srl.openagents-treasury.eth",
  "papelera-del-sur.openagents-treasury.eth",
  "box-master.openagents-treasury.eth",
  "techsupply-mx.openagents-treasury.eth",
];

const HOST = "open-deal.vercel.app";

const ABI = [
  "function setText(bytes32 node, string key, string value) external",
  "function multicall(bytes[] data) external returns (bytes[] memory)",
  "function text(bytes32 node, string key) view returns (string)",
];

async function main(): Promise<void> {
  const provider = new JsonRpcProvider(RPC, CHAIN_ID);
  const signer = new Wallet(requireEnv("AGENT_PRIVATE_KEY"), provider);
  const resolver = new Contract(PUBLIC_RESOLVER, ABI, signer);
  const iface = new Interface(ABI);

  console.log(`[fix-ep] signer: ${signer.address}`);
  console.log(`[fix-ep] target host: ${HOST}`);

  const calls: string[] = [];
  for (const sub of SUBNAMES) {
    const label = sub.split(".")[0];
    const node = namehash(sub);
    const newEndpoint = `https://${HOST}/api/seller/${label}/rfq`;
    const current: string = await resolver.text(node, "endpoint");
    if (current === newEndpoint) {
      console.log(`  · ${sub} already canonical, skip`);
      continue;
    }
    console.log(`  ↻ ${sub}`);
    console.log(`      from: ${current.slice(0, 80)}…`);
    console.log(`      to:   ${newEndpoint}`);
    calls.push(
      iface.encodeFunctionData("setText(bytes32,string,string)", [
        node,
        "endpoint",
        newEndpoint,
      ]),
    );
  }

  if (calls.length === 0) {
    console.log("[fix-ep] nothing to update");
    return;
  }

  console.log(`\n[fix-ep] sending multicall with ${calls.length} setText calls…`);
  const tx = await resolver.multicall(calls);
  console.log(`[fix-ep] tx: ${tx.hash}`);
  await tx.wait();
  console.log(`[fix-ep] confirmed`);
  console.log(`[fix-ep] explorer: https://sepolia.etherscan.io/tx/${tx.hash}`);

  console.log(`\n[fix-ep] verify reads:`);
  for (const sub of SUBNAMES) {
    const node = namehash(sub);
    const ep: string = await resolver.text(node, "endpoint");
    console.log(`  ${sub}\n    ${ep}`);
  }
  console.log(`\n[fix-ep] OK ✓`);
}

main().catch((e) => {
  console.error("[fix-ep] failed:", e);
  process.exit(1);
});
