import "dotenv/config";
import { getTextRecords, lookupAddress, resolveName } from "../src/ens/resolver.js";

async function main() {
  const name = process.argv[2] ?? "vitalik.eth";
  const keys = ["url", "email", "com.twitter", "com.github", "description", "avatar"];

  console.log(`resolving ${name} on mainnet ENS...`);
  const address = await resolveName(name);
  if (!address) {
    console.log(`no resolver / no address record for ${name}`);
    return;
  }
  console.log(`address:  ${address}`);

  const reverse = await lookupAddress(address);
  console.log(`reverse:  ${reverse ?? "(none)"}`);

  console.log(`text records:`);
  const records = await getTextRecords(name, keys);
  for (const [k, v] of Object.entries(records)) {
    if (v) console.log(`  ${k.padEnd(16)} ${v}`);
  }
}

main().catch((e) => {
  console.error("error:", e.message);
  process.exit(1);
});
