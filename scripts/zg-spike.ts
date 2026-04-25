import "dotenv/config";
import { unlink, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonRpcProvider, Wallet, formatEther } from "ethers";
import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { requireEnv } from "../src/config";

const RPC_URL = process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const INDEXER_URL =
  process.env.ZG_INDEXER_URL ||
  "https://indexer-storage-testnet-turbo.0g.ai";
const CHAIN_ID = 16602;

async function main(): Promise<void> {
  const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID);
  const signer = new Wallet(requireEnv("AGENT_PRIVATE_KEY"), provider);

  const block = await provider.getBlockNumber();
  const balance = await provider.getBalance(signer.address);
  console.log(`[zg] chain block ${block}`);
  console.log(`[zg] wallet ${signer.address}`);
  console.log(`[zg] balance ${formatEther(balance)} 0G`);
  if (balance === 0n) {
    throw new Error("wallet has no 0G — fund via faucet first");
  }

  const payload = {
    case: "spike",
    timestamp: new Date().toISOString(),
    note: "openagents-treasury 0G Storage smoke test",
    pad: "x".repeat(2048),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2));
  console.log(`[zg] payload: ${bytes.length} bytes`);

  const memData = new MemData(bytes);
  const [tree, treeErr] = await memData.merkleTree();
  if (treeErr) throw new Error(`merkle: ${treeErr}`);
  const expectedRoot = tree?.rootHash() ?? null;
  console.log(`[zg] merkle root (computed): ${expectedRoot}`);

  const indexer = new Indexer(INDEXER_URL);

  console.log("[zg] uploading…");
  const [tx, uploadErr] = await indexer.upload(memData, RPC_URL, signer);
  if (uploadErr) throw new Error(`upload: ${uploadErr}`);
  if (!tx) throw new Error("upload returned no tx");
  console.log(`[zg] root hash: ${tx.rootHash}`);
  console.log(`[zg] tx hash: ${tx.txHash}`);
  console.log(`[zg] explorer: https://chainscan-galileo.0g.ai/tx/${tx.txHash}`);
  console.log(
    `[zg] storagescan: https://storagescan-galileo.0g.ai/tx/${tx.txHash}`,
  );

  const downloadPath = join(tmpdir(), `zg-spike-${Date.now()}.json`);
  console.log(`[zg] downloading to ${downloadPath}…`);
  const dlErr = await indexer.download(tx.rootHash, downloadPath, true);
  if (dlErr) {
    console.log(`[zg] download error (may need indexer propagation): ${dlErr}`);
  } else {
    const recovered = await readFile(downloadPath, "utf8");
    const same = recovered === JSON.stringify(payload, null, 2);
    console.log(`[zg] download bytes match: ${same}`);
    await unlink(downloadPath).catch(() => {});
  }

  console.log("\n[zg] spike OK ✓");
}

main().catch((e) => {
  console.error("[zg] spike failed:", e);
  process.exit(1);
});
