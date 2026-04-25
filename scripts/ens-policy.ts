import "dotenv/config";
import { env } from "../src/config.js";
import { loadPolicy } from "../src/ens/policy.js";

async function main() {
  const arg = process.argv[2];
  const ensName = arg ?? env("ENS_NAME") ?? null;
  console.log(`policy source: ${ensName ? `ENS '${ensName}'` : "defaults (no ENS_NAME)"}`);
  const policy = await loadPolicy(ensName);
  console.log("---");
  console.log("source:           ", policy.source);
  console.log("maxSwapEth:       ", policy.maxSwapEth);
  console.log("minBufferEth:     ", policy.minBufferEth);
  console.log("allowedTokens:    ", policy.allowedTokens.join(", "));
  console.log("maxDailyVolumeEth:", policy.maxDailyVolumeEth);
  console.log("cooldownSeconds:  ", policy.cooldownSeconds);
  if (policy.source === "ens") {
    console.log("---raw records---");
    for (const [k, v] of Object.entries(policy.raw)) {
      if (v) console.log(`  ${k.padEnd(28)} ${v}`);
    }
  }
}

main().catch((e) => {
  console.error("error:", e.message);
  process.exit(1);
});
