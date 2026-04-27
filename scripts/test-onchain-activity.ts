import "dotenv/config";
import { loadOnchainActivity } from "../app/lib/onchain-activity";

const start = Date.now();
const result = await loadOnchainActivity(5);
console.log(`took ${(Date.now() - start) / 1000}s`);

console.log("\nwarnings:", result.warnings);

console.log(`\nrecent ${result.anchors.length} anchors:`);
for (const a of result.anchors) {
  console.log(`  #${a.index.padStart(3)} ${a.age.padEnd(10)} cid ${a.cidRootShort}`);
}

console.log("\nescrow stats:");
if (result.escrow) {
  const s = result.escrow;
  console.log(`  contract:      ${s.contractShort}`);
  console.log(`  next order id: ${s.nextOrderId}`);
  console.log(`  created:       ${s.ordersCreated}`);
  console.log(`  shipped:       ${s.shipmentsConfirmed}`);
  console.log(`  released:      ${s.released}`);
  console.log(`  refunded:      ${s.refunded}`);
  console.log(`  disputed:      ${s.disputed}`);
  console.log(`  total locked:  ${s.totalLockedEth} ETH`);
} else {
  console.log("  (none)");
}
