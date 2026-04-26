import { NextResponse } from "next/server";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  keccak256,
  toUtf8Bytes,
  namehash,
  Interface,
} from "ethers";
import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SEPOLIA_RPC =
  process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const SEPOLIA_ID = 11155111;
const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const PUBLIC_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5";
const PARENT = process.env.ENS_PARENT || "openagents-treasury.eth";

const ZG_RPC = process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const ZG_INDEXER =
  process.env.ZG_INDEXER_URL ||
  "https://indexer-storage-testnet-turbo.0g.ai";
const ZG_ID = 16602;

const REGISTRY_ABI = [
  "function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl) external",
  "function owner(bytes32 node) view returns (address)",
];
const RESOLVER_ABI = [
  "function setAddr(bytes32 node, uint256 coinType, bytes a) external",
  "function setText(bytes32 node, string key, string value) external",
  "function multicall(bytes[] data) external returns (bytes[] memory)",
];

interface OnboardingPayload {
  storeName: string;
  email: string;
  endpoint: string;
  catalog: unknown;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: OnboardingPayload;
  try {
    body = (await req.json()) as OnboardingPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  if (!body.storeName || !body.email || !body.catalog) {
    return NextResponse.json(
      { ok: false, error: "storeName, email, catalog required" },
      { status: 400 },
    );
  }

  const label = slugify(body.storeName);
  if (!label || label.length < 3) {
    return NextResponse.json(
      { ok: false, error: "store name produced an invalid subname label" },
      { status: 400 },
    );
  }
  const subname = `${label}.${PARENT}`;
  // If the form left the default __SUBNAME__ placeholder, expand it to the
  // hosted endpoint for this specific seller. Otherwise use whatever the
  // operator typed (self-hosted seller).
  let endpoint = body.endpoint || "";
  if (!endpoint || endpoint.includes("__SUBNAME__")) {
    const proto =
      process.env.VERCEL_URL || process.env.NEXT_PUBLIC_BASE_URL
        ? "https"
        : new URL(req.url).protocol.replace(":", "");
    const host =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? process.env.VERCEL_URL : new URL(req.url).host);
    endpoint = `${proto}://${host}/api/seller/${label}/rfq`;
  }

  const pk = process.env.AGENT_PRIVATE_KEY;
  if (!pk) {
    return NextResponse.json(
      { ok: false, error: "AGENT_PRIVATE_KEY not configured server-side" },
      { status: 500 },
    );
  }

  const events: Array<{ step: string; status: string; detail?: string }> = [];
  const result = {
    ok: false as boolean,
    subname,
    parent: PARENT,
    endpoint,
    storeName: body.storeName,
    catalog_cid: null as string | null,
    catalog_storage_tx: null as string | null,
    subname_tx: null as string | null,
    records_tx: null as string | null,
    explorer: {
      ens: `https://sepolia.app.ens.domains/${subname}`,
      catalog_storage: null as string | null,
      subname: null as string | null,
    },
    events,
  };

  try {
    const sepProvider = new JsonRpcProvider(SEPOLIA_RPC, SEPOLIA_ID);
    const sepSigner = new Wallet(pk, sepProvider);

    events.push({ step: "validate-parent", status: "running" });
    const registry = new Contract(ENS_REGISTRY, REGISTRY_ABI, sepSigner);
    const parentNode = namehash(PARENT);
    const childNode = namehash(subname);
    const parentOwner: string = await registry.owner(parentNode);
    if (parentOwner.toLowerCase() !== sepSigner.address.toLowerCase()) {
      throw new Error(`parent ${PARENT} not owned by server agent wallet`);
    }
    const childOwner: string = await registry.owner(childNode);
    if (
      childOwner !== "0x0000000000000000000000000000000000000000" &&
      childOwner.toLowerCase() !== sepSigner.address.toLowerCase()
    ) {
      throw new Error(
        `subname ${subname} already exists with a different owner — pick a different store name`,
      );
    }
    events.push({ step: "validate-parent", status: "ok" });

    events.push({ step: "upload-catalog-to-0g", status: "running" });
    const zgProvider = new JsonRpcProvider(ZG_RPC, ZG_ID);
    const zgSigner = new Wallet(pk, zgProvider);
    const catalogJson = JSON.stringify(body.catalog, null, 2);
    const catalogBytes = new TextEncoder().encode(catalogJson);
    const memData = new MemData(catalogBytes);
    const indexer = new Indexer(ZG_INDEXER);
    const [zgTx, zgErr] = await indexer.upload(memData, ZG_RPC, zgSigner);
    if (zgErr) throw new Error(`0G upload failed: ${zgErr}`);
    if (!zgTx) throw new Error("0G upload returned no tx");
    const zgSingle = zgTx as { txHash?: string; rootHash?: string };
    if (!zgSingle.rootHash || !zgSingle.txHash) {
      throw new Error("0G upload returned multi-segment result; expected single");
    }
    result.catalog_cid = zgSingle.rootHash.startsWith("0x")
      ? zgSingle.rootHash
      : `0x${zgSingle.rootHash}`;
    result.catalog_storage_tx = zgSingle.txHash;
    result.explorer.catalog_storage = `https://storagescan-galileo.0g.ai/tx/${zgSingle.txHash}`;
    events.push({
      step: "upload-catalog-to-0g",
      status: "ok",
      detail: `cid ${result.catalog_cid.slice(0, 16)}…`,
    });

    if (childOwner === "0x0000000000000000000000000000000000000000") {
      events.push({ step: "register-subname", status: "running" });
      const labelHash = keccak256(toUtf8Bytes(label));
      const tx1 = await registry.setSubnodeRecord(
        parentNode,
        labelHash,
        sepSigner.address,
        PUBLIC_RESOLVER,
        0,
      );
      await tx1.wait();
      result.subname_tx = tx1.hash;
      result.explorer.subname = `https://sepolia.etherscan.io/tx/${tx1.hash}`;
      events.push({
        step: "register-subname",
        status: "ok",
        detail: `tx ${tx1.hash.slice(0, 16)}…`,
      });
    } else {
      events.push({
        step: "register-subname",
        status: "skipped",
        detail: "subname already owned by server",
      });
    }

    events.push({ step: "set-records", status: "running" });
    const resolver = new Contract(PUBLIC_RESOLVER, RESOLVER_ABI, sepSigner);
    const iface = new Interface(RESOLVER_ABI);
    const calls = [
      iface.encodeFunctionData("setAddr(bytes32,uint256,bytes)", [
        childNode,
        60,
        sepSigner.address,
      ]),
      iface.encodeFunctionData("setText(bytes32,string,string)", [
        childNode,
        "endpoint",
        endpoint,
      ]),
      iface.encodeFunctionData("setText(bytes32,string,string)", [
        childNode,
        "description",
        `Seller agent: ${body.storeName}`,
      ]),
      iface.encodeFunctionData("setText(bytes32,string,string)", [
        childNode,
        "email",
        body.email,
      ]),
      iface.encodeFunctionData("setText(bytes32,string,string)", [
        childNode,
        "catalog-uri",
        `0g://${result.catalog_cid}`,
      ]),
    ];
    const tx2 = await resolver.multicall(calls);
    await tx2.wait();
    result.records_tx = tx2.hash;
    events.push({
      step: "set-records",
      status: "ok",
      detail: `tx ${tx2.hash.slice(0, 16)}…`,
    });

    result.ok = true;
    return NextResponse.json(result);
  } catch (e) {
    events.push({
      step: "error",
      status: "failed",
      detail: (e as Error).message,
    });
    return NextResponse.json(
      { ...result, ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
