import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { JsonRpcProvider, Wallet, ContractFactory, formatEther } from "ethers";
import solc from "solc";
import { requireEnv } from "../src/config";

const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const CHAIN_ID = 11155111;
const SOURCE = "contracts/ProcurementEscrow.sol";
const OUT = "contracts/ProcurementEscrow.deployment.json";

async function main(): Promise<void> {
  const source = await readFile(SOURCE, "utf8");
  const input = {
    language: "Solidity",
    sources: { "ProcurementEscrow.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    const fatal = output.errors.filter((e: { severity: string }) => e.severity === "error");
    if (fatal.length > 0) {
      console.error(fatal);
      throw new Error("solc errors");
    }
  }
  const artifact = output.contracts["ProcurementEscrow.sol"]["ProcurementEscrow"];
  const abi = artifact.abi;
  const bytecode = "0x" + artifact.evm.bytecode.object;
  console.log(`[escrow] compiled. bytecode size: ${bytecode.length / 2 - 1} bytes`);

  const provider = new JsonRpcProvider(RPC, CHAIN_ID);
  const signer = new Wallet(requireEnv("AGENT_PRIVATE_KEY"), provider);
  console.log(`[escrow] deployer ${signer.address}`);
  console.log(`[escrow] balance ${formatEther(await provider.getBalance(signer.address))} ETH`);

  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy();
  const tx = contract.deploymentTransaction();
  console.log(`[escrow] tx: ${tx?.hash}`);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`[escrow] address: ${address}`);
  console.log(`[escrow] explorer: https://sepolia.etherscan.io/address/${address}`);

  await mkdir("contracts", { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        chainId: CHAIN_ID,
        rpc: RPC,
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
  console.log(`[escrow] artifact: ${OUT}`);
  console.log(`\n[escrow] OK ✓`);
}

main().catch((e) => {
  console.error("[escrow] failed:", e);
  process.exit(1);
});
