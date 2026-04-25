import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Contract, JsonRpcProvider, Wallet, parseEther, keccak256, toUtf8Bytes, formatEther } from "ethers";
import { requireEnv } from "../src/config";

const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const CHAIN_ID = 11155111;

async function main(): Promise<void> {
  const artifact = JSON.parse(
    await readFile("contracts/ProcurementEscrow.deployment.json", "utf8"),
  );
  const provider = new JsonRpcProvider(RPC, CHAIN_ID);

  // For the demo, buyer == seller (same wallet) — keeps the test self-contained.
  // The contract logic doesn't care; only msg.sender matters per call.
  const wallet = new Wallet(requireEnv("AGENT_PRIVATE_KEY"), provider);
  const escrow = new Contract(artifact.address, artifact.abi, wallet);

  const amount = parseEther("0.001"); // 0.001 ETH stand-in for ~$3 USDC
  const skuHash = keccak256(toUtf8Bytes("PAPEL-A4-RES x10"));
  const deliveryDeadline = Math.floor(Date.now() / 1000) + 86400 * 5;
  const disputeWindow = 60; // 1 min for the demo

  console.log(`[escrow] contract ${artifact.address}`);
  console.log(`[escrow] balance before: ${formatEther(await provider.getBalance(wallet.address))} ETH`);

  console.log(`[escrow] step 1 — createOrder (buyer locks ${formatEther(amount)} ETH)`);
  const tx1 = await escrow.createOrder(wallet.address, skuHash, deliveryDeadline, disputeWindow, {
    value: amount,
  });
  const r1 = await tx1.wait();
  console.log(`  tx ${tx1.hash}, gas ${r1?.gasUsed}`);
  const orderId: bigint = await escrow.nextOrderId();
  console.log(`  orderId: ${orderId}`);
  let order = await escrow.orders(orderId);
  console.log(`  status: ${order.status} (1=Pending), amount ${formatEther(order.amount)} ETH`);

  console.log(`\n[escrow] step 2 — confirmShipment (seller marks shipped)`);
  const trackingHash = keccak256(toUtf8Bytes("TRACKING-12345"));
  const tx2 = await escrow.confirmShipment(orderId, trackingHash);
  await tx2.wait();
  console.log(`  tx ${tx2.hash}`);
  order = await escrow.orders(orderId);
  console.log(`  status: ${order.status} (2=Shipped), trackingHash ${order.trackingHash.slice(0, 16)}…`);

  console.log(`\n[escrow] step 3 — release (buyer releases funds to seller immediately)`);
  const tx3 = await escrow.release(orderId);
  await tx3.wait();
  console.log(`  tx ${tx3.hash}`);
  order = await escrow.orders(orderId);
  console.log(`  status: ${order.status} (3=Released)`);

  console.log(`\n[escrow] balance after: ${formatEther(await provider.getBalance(wallet.address))} ETH`);
  console.log(`\n[escrow] OK ✓`);
  console.log(`[escrow] explorer: https://sepolia.etherscan.io/address/${artifact.address}`);
}

main().catch((e) => {
  console.error("[escrow] failed:", e);
  process.exit(1);
});
