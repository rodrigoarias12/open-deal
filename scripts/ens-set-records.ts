import "dotenv/config";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  namehash,
  Interface,
} from "ethers";
import { requireEnv } from "../src/config";

const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const CHAIN_ID = 11155111;
const PUBLIC_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5";

const NAME = process.env.ENS_LABEL || "openagents-treasury";
const FULL = `${NAME}.eth`;
const COIN_TYPE_ETH = 60;

const RESOLVER_ABI = [
  "function setAddr(bytes32 node, uint256 coinType, bytes a) external",
  "function setText(bytes32 node, string calldata key, string calldata value) external",
  "function multicall(bytes[] calldata data) external returns (bytes[] memory)",
  "function addr(bytes32 node, uint256 coinType) view returns (bytes)",
  "function text(bytes32 node, string calldata key) view returns (string)",
];

const RECORDS: Record<string, string> = {
  // Identity track (ENS Best Integration for AI Agents)
  description: "Autonomous treasury + procurement agent. Built for ETHGlobal Open Agents 2026.",
  url: "https://github.com/openagents/treasury",
  "com.github": "openagents/treasury",
  notice: "I am an autonomous agent. Read my policy at the treasury.* keys before counterparty interaction.",

  // Most Creative track (policy as governance surface)
  "treasury.maxSwapEth": "0.01",
  "treasury.minBufferEth": "0.05",
  "treasury.allowedTokens": "USDC",
  "treasury.maxDailyVolumeEth": "0.05",
  "treasury.cooldownSeconds": "3600",
  "treasury.carriers": "",
  "treasury.maxPerCarrierUsd": "1000",
};

async function main(): Promise<void> {
  const provider = new JsonRpcProvider(RPC, CHAIN_ID);
  const signer = new Wallet(requireEnv("AGENT_PRIVATE_KEY"), provider);

  const node = namehash(FULL);
  console.log(`[records] name: ${FULL}`);
  console.log(`[records] node: ${node}`);
  console.log(`[records] resolver: ${PUBLIC_RESOLVER}`);
  console.log(`[records] signer: ${signer.address}`);

  const resolver = new Contract(PUBLIC_RESOLVER, RESOLVER_ABI, signer);
  const iface = new Interface(RESOLVER_ABI);

  const calls: string[] = [];

  // setAddr (ETH coinType 60) — points the name at the agent's wallet
  calls.push(
    iface.encodeFunctionData("setAddr(bytes32,uint256,bytes)", [
      node,
      COIN_TYPE_ETH,
      signer.address,
    ]),
  );

  // setText — every record
  for (const [key, value] of Object.entries(RECORDS)) {
    calls.push(
      iface.encodeFunctionData("setText(bytes32,string,string)", [node, key, value]),
    );
  }

  console.log(`[records] bundling ${calls.length} calls into a single multicall…`);
  const tx = await resolver.multicall(calls);
  console.log(`[records] tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`[records] confirmed in block ${receipt?.blockNumber}`);
  console.log(`[records] explorer: https://sepolia.etherscan.io/tx/${tx.hash}`);

  console.log(`\n[records] verifying writes…`);
  const addr = await resolver["addr(bytes32,uint256)"](node, COIN_TYPE_ETH);
  console.log(`  addr (ETH): ${addr}`);
  for (const key of Object.keys(RECORDS)) {
    const value = await resolver["text(bytes32,string)"](node, key);
    const display = value.length > 60 ? value.slice(0, 57) + "…" : value;
    console.log(`  ${key.padEnd(30)} = ${display || "(empty)"}`);
  }

  console.log(`\n[records] OK ✓`);
  console.log(`[records] view on app: https://sepolia.app.ens.domains/${FULL}`);
}

main().catch((e) => {
  console.error("[records] failed:", e);
  process.exit(1);
});
