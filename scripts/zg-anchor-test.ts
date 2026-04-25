import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Contract, JsonRpcProvider, Wallet, keccak256, toUtf8Bytes } from "ethers";
import { requireEnv } from "../src/config";

const RPC_URL = process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const CHAIN_ID = 16602;

async function main(): Promise<void> {
  const artifact = JSON.parse(
    await readFile("contracts/AuditAnchor.deployment.json", "utf8"),
  );
  const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID);
  const signer = new Wallet(requireEnv("AGENT_PRIVATE_KEY"), provider);
  const contract = new Contract(artifact.address, artifact.abi, signer);

  const cidRoot = keccak256(toUtf8Bytes("fake-cid-for-spike-" + Date.now()));
  const policyHash = keccak256(toUtf8Bytes(JSON.stringify({
    maxSwapEth: "0.01",
    minBufferEth: "0.05",
    allowedTokens: ["USDC"],
  })));

  console.log(`[anchor] contract: ${artifact.address}`);
  console.log(`[anchor] cidRoot: ${cidRoot}`);
  console.log(`[anchor] policyHash: ${policyHash}`);

  const tx = await contract.anchor(cidRoot, policyHash);
  console.log(`[anchor] tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`[anchor] confirmed in block ${receipt.blockNumber}`);
  console.log(`[anchor] explorer: https://chainscan-galileo.0g.ai/tx/${tx.hash}`);

  const count = await contract.count();
  console.log(`[anchor] count: ${count}`);
  const last = await contract.get(count - 1n);
  console.log(`[anchor] last anchor:`, {
    cidRoot: last[0],
    policyHash: last[1],
    timestamp: last[2].toString(),
    agent: last[3],
  });

  console.log("\n[anchor] OK ✓");
}

main().catch((e) => {
  console.error("[anchor] failed:", e);
  process.exit(1);
});
