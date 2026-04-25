import "dotenv/config";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  namehash,
  keccak256,
  toUtf8Bytes,
  Interface,
} from "ethers";
import { requireEnv } from "../src/config";

const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const CHAIN_ID = 11155111;

const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const PUBLIC_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5";

const PARENT = process.env.ENS_PARENT || "openagents-treasury.eth";
const SUBNAME_LABEL = process.argv[2] || "seller-acme";
const ENDPOINT = process.argv[3] || "http://localhost:3030";

const REGISTRY_ABI = [
  "function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl) external",
  "function owner(bytes32 node) view returns (address)",
];
const RESOLVER_ABI = [
  "function setAddr(bytes32 node, uint256 coinType, bytes a) external",
  "function setText(bytes32 node, string key, string value) external",
  "function multicall(bytes[] data) external returns (bytes[] memory)",
  "function text(bytes32 node, string key) view returns (string)",
  "function addr(bytes32 node, uint256 coinType) view returns (bytes)",
];

async function main(): Promise<void> {
  const provider = new JsonRpcProvider(RPC, CHAIN_ID);
  const signer = new Wallet(requireEnv("AGENT_PRIVATE_KEY"), provider);

  const parentNode = namehash(PARENT);
  const labelHash = keccak256(toUtf8Bytes(SUBNAME_LABEL));
  const fullName = `${SUBNAME_LABEL}.${PARENT}`;
  const childNode = namehash(fullName);

  console.log(`[subname] parent: ${PARENT}`);
  console.log(`[subname] child : ${fullName}`);
  console.log(`[subname] node  : ${childNode}`);
  console.log(`[subname] signer: ${signer.address}`);

  const registry = new Contract(ENS_REGISTRY, REGISTRY_ABI, signer);
  const parentOwner: string = await registry.owner(parentNode);
  console.log(`[subname] parent owner: ${parentOwner}`);
  if (parentOwner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`signer is not the owner of ${PARENT}`);
  }

  console.log(`[subname] creating subnode (parent → owner=${signer.address}, resolver=${PUBLIC_RESOLVER})…`);
  const tx1 = await registry.setSubnodeRecord(
    parentNode,
    labelHash,
    signer.address,
    PUBLIC_RESOLVER,
    0,
  );
  console.log(`[subname] setSubnodeRecord tx: ${tx1.hash}`);
  await tx1.wait();
  console.log(`[subname] subnode created ✓`);

  const ownerAfter: string = await registry.owner(childNode);
  console.log(`[subname] child owner: ${ownerAfter}`);
  if (ownerAfter.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`unexpected owner after setSubnodeRecord: ${ownerAfter}`);
  }

  const resolver = new Contract(PUBLIC_RESOLVER, RESOLVER_ABI, signer);
  const iface = new Interface(RESOLVER_ABI);
  const calls = [
    iface.encodeFunctionData("setAddr(bytes32,uint256,bytes)", [
      childNode,
      60,
      signer.address,
    ]),
    iface.encodeFunctionData("setText(bytes32,string,string)", [
      childNode,
      "endpoint",
      ENDPOINT,
    ]),
    iface.encodeFunctionData("setText(bytes32,string,string)", [
      childNode,
      "description",
      `Seller agent endpoint for ${fullName}`,
    ]),
  ];
  console.log(`[subname] writing addr + endpoint + description via multicall…`);
  const tx2 = await resolver.multicall(calls);
  console.log(`[subname] multicall tx: ${tx2.hash}`);
  await tx2.wait();

  console.log(`\n[subname] verifying:`);
  const addr = await resolver["addr(bytes32,uint256)"](childNode, 60);
  const endpoint = await resolver["text(bytes32,string)"](childNode, "endpoint");
  const desc = await resolver["text(bytes32,string)"](childNode, "description");
  console.log(`  addr      : ${addr}`);
  console.log(`  endpoint  : ${endpoint}`);
  console.log(`  description: ${desc}`);

  console.log(`\n[subname] OK ✓`);
  console.log(`[subname] view: https://sepolia.app.ens.domains/${fullName}`);
}

main().catch((e) => {
  console.error("[subname] failed:", e);
  process.exit(1);
});
