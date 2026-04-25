import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { JsonRpcProvider, Wallet, ContractFactory, formatEther } from "ethers";
import solc from "solc";
import { requireEnv } from "../src/config";

const RPC_URL = process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const CHAIN_ID = 16602;
const CONTRACT_PATH = "contracts/AuditAnchor.sol";
const OUT_PATH = "contracts/AuditAnchor.deployment.json";

async function main(): Promise<void> {
  const source = await readFile(CONTRACT_PATH, "utf8");

  const input = {
    language: "Solidity",
    sources: { "AuditAnchor.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object"] },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    const fatals = output.errors.filter((e: any) => e.severity === "error");
    if (fatals.length > 0) {
      console.error(fatals);
      throw new Error("solc errors");
    }
  }

  const artifact = output.contracts["AuditAnchor.sol"]["AuditAnchor"];
  const abi = artifact.abi;
  const bytecode = "0x" + artifact.evm.bytecode.object;
  console.log(`[deploy] compiled. bytecode size: ${bytecode.length / 2 - 1} bytes`);

  const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID);
  const signer = new Wallet(requireEnv("AGENT_PRIVATE_KEY"), provider);
  const balance = await provider.getBalance(signer.address);
  console.log(`[deploy] wallet ${signer.address}`);
  console.log(`[deploy] balance ${formatEther(balance)} 0G`);

  const factory = new ContractFactory(abi, bytecode, signer);
  console.log("[deploy] deploying AuditAnchor…");
  const contract = await factory.deploy();
  const tx = contract.deploymentTransaction();
  console.log(`[deploy] tx: ${tx?.hash}`);
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`[deploy] address: ${address}`);
  console.log(
    `[deploy] explorer: https://chainscan-galileo.0g.ai/address/${address}`,
  );

  await mkdir("contracts", { recursive: true });
  await writeFile(
    OUT_PATH,
    JSON.stringify(
      {
        chainId: CHAIN_ID,
        rpc: RPC_URL,
        address,
        deployTx: tx?.hash,
        deployedAt: new Date().toISOString(),
        deployer: signer.address,
        abi,
      },
      null,
      2,
    ),
  );
  console.log(`[deploy] artifact written to ${OUT_PATH}`);

  console.log("\n[deploy] OK ✓");
}

main().catch((e) => {
  console.error("[deploy] failed:", e);
  process.exit(1);
});
