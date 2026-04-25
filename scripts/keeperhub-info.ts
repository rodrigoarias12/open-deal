import "dotenv/config";
import { getInfo } from "../src/payments/keeperhub";

async function main() {
  const info = await getInfo();
  console.log("KeeperHub agentic wallet");
  console.log("------------------------");
  console.log("subOrgId:        ", info.subOrgId);
  console.log("walletAddress:   ", info.walletAddress);
  console.log("Base USDC:       ", info.balance.base.amount);
  console.log("Tempo USDC.e:    ", info.balance.tempo.amount);
  if (info.balance.base.amount === "0" && info.balance.tempo.amount === "0") {
    console.log("");
    console.log("wallet is unfunded — fund it before running x402 paid flows:");
    console.log("  npx @keeperhub/wallet fund");
  }
}

main().catch((e) => {
  console.error("error:", e.message);
  process.exit(1);
});
