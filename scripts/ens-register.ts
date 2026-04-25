import "dotenv/config";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  formatEther,
  keccak256,
  namehash,
  toUtf8Bytes,
  ZeroAddress,
} from "ethers";
import { requireEnv } from "../src/config";

const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const CHAIN_ID = 11155111;

const REGISTRAR_CONTROLLER = "0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968";
const PUBLIC_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5";

const CONTROLLER_ABI = [
  "function available(string label) view returns (bool)",
  "function rentPrice(string name, uint256 duration) view returns (tuple(uint256 base, uint256 premium))",
  "function makeCommitment((string label, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, uint8 reverseRecord, bytes32 referrer) registration) pure returns (bytes32)",
  "function commit(bytes32 commitment) external",
  "function commitments(bytes32) view returns (uint256)",
  "function minCommitmentAge() view returns (uint256)",
  "function maxCommitmentAge() view returns (uint256)",
  "function register((string label, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, uint8 reverseRecord, bytes32 referrer) registration) payable",
];

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

const NAME = process.env.ENS_LABEL || "openagents-treasury";
const FULL = `${NAME}.eth`;
const DURATION = 31536000; // 1 year
const SECRET = keccak256(toUtf8Bytes(`openagents-${NAME}-secret-2026`));

async function main(): Promise<void> {
  const provider = new JsonRpcProvider(RPC, CHAIN_ID);
  const signer = new Wallet(requireEnv("AGENT_PRIVATE_KEY"), provider);
  const balance = await provider.getBalance(signer.address);
  console.log(`[ens] wallet ${signer.address}`);
  console.log(`[ens] sepolia balance ${formatEther(balance)} ETH`);

  const controller = new Contract(REGISTRAR_CONTROLLER, CONTROLLER_ABI, signer);

  const available: boolean = await controller.available(NAME);
  console.log(`[ens] ${FULL} available? ${available}`);
  if (!available) {
    console.log(`[ens] ${FULL} is taken. Either it is already yours (skip register) or pick another label.`);
    return;
  }

  const price = await controller.rentPrice(NAME, DURATION);
  const total: bigint = price[0] + price[1];
  console.log(`[ens] rent price for 1y: ${formatEther(total)} ETH (base ${formatEther(price[0])}, premium ${formatEther(price[1])})`);

  const minAge: bigint = await controller.minCommitmentAge();
  const maxAge: bigint = await controller.maxCommitmentAge();
  console.log(`[ens] commit-reveal window: ${minAge}s - ${maxAge}s`);

  const registration = {
    label: NAME,
    owner: signer.address,
    duration: DURATION,
    secret: SECRET,
    resolver: PUBLIC_RESOLVER,
    data: [],
    reverseRecord: 0,
    referrer: ZERO_BYTES32,
  };
  const commitment: string = await controller.makeCommitment(registration);
  const existingCommit: bigint = await controller.commitments(commitment);
  if (existingCommit === 0n) {
    console.log(`[ens] submitting commitment…`);
    const tx = await controller.commit(commitment);
    console.log(`[ens] commit tx: ${tx.hash}`);
    await tx.wait();
    console.log(`[ens] commitment registered.`);
  } else {
    const elapsed = BigInt(Math.floor(Date.now() / 1000)) - existingCommit;
    console.log(`[ens] commitment already exists (${elapsed}s ago).`);
  }

  console.log(`[ens] waiting ${minAge + 5n}s for commit-reveal window…`);
  await new Promise((r) => setTimeout(r, Number(minAge + 5n) * 1000));

  console.log(`[ens] registering ${FULL} for ${DURATION}s with payment ${formatEther(total)} ETH…`);
  const regTx = await controller.register(registration, {
    value: (total * 110n) / 100n,
  });
  console.log(`[ens] register tx: ${regTx.hash}`);
  const receipt = await regTx.wait();
  console.log(`[ens] confirmed in block ${receipt?.blockNumber}`);
  console.log(`[ens] explorer: https://sepolia.etherscan.io/tx/${regTx.hash}`);
  console.log(`[ens] app: https://sepolia.app.ens.domains/${FULL}`);

  console.log(`[ens] resolving ${FULL} to confirm ownership…`);
  const node = namehash(FULL);
  console.log(`[ens] namehash: ${node}`);

  const registry = new Contract(
    "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
    ["function owner(bytes32 node) view returns (address)"],
    provider,
  );
  const owner: string = await registry.owner(node);
  console.log(`[ens] owner of ${FULL}: ${owner}`);
  if (owner === ZeroAddress) {
    console.log(`[ens] WARNING: registry returns zero address — registration may not have propagated yet.`);
  }
  console.log(`[ens] OK ✓`);
}

main().catch((e) => {
  console.error("[ens] failed:", e);
  process.exit(1);
});
