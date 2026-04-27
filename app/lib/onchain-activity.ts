import { Contract, JsonRpcProvider, formatEther } from "ethers";
import { readFile } from "node:fs/promises";

/**
 * Live network activity reader for the dashboard. Two surfaces:
 *
 *  1. Recent AuditAnchor entries from 0G Chain (one event per agent
 *     decision, every action since deployment).
 *  2. ProcurementEscrow event counters from Sepolia (orders created,
 *     shipped, released, refunded, disputed) plus total ETH locked.
 *
 * Both are read directly from chain via getLogs / view calls, no
 * indexer required. Defensive: any single failure surfaces as a
 * warning, never throws — the dashboard still renders.
 */

const ZG_RPC = process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const ZG_CHAIN_ID = 16602;
const ZG_EXPLORER = "https://chainscan-galileo.0g.ai";
const SEPOLIA_RPC =
  process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

const ANCHOR_ABI = [
  "event Anchored(uint256 indexed index, bytes32 indexed cidRoot, bytes32 indexed policyHash, address agent, uint64 timestamp)",
  "function count() external view returns (uint256)",
  "function get(uint256 index) external view returns (tuple(bytes32 cidRoot, bytes32 policyHash, uint64 timestamp, address agent))",
];

const ESCROW_ABI = [
  "function nextOrderId() external view returns (uint256)",
  // status: None=0, Pending=1, Shipped=2, Released=3, Refunded=4, Disputed=5
  "function orders(uint256 id) external view returns (address buyer, address seller, uint256 amount, bytes32 skuHash, uint64 deadline, uint64 disputeWindow, bytes32 trackingHash, uint8 status)",
];

export interface AnchorEntry {
  index: string;
  cidRoot: string;
  cidRootShort: string;
  policyHash: string;
  policyHashShort: string;
  agent: string;
  timestamp: number;
  age: string;
  txHash: string | null;
  explorer: string;
  storageExplorer: string | null;
}

export interface EscrowStats {
  contract: string;
  contractShort: string;
  explorer: string;
  nextOrderId: number;
  ordersCreated: number;
  shipmentsConfirmed: number;
  released: number;
  refunded: number;
  disputed: number;
  totalLockedEth: string;
}

export interface OnchainActivity {
  anchors: AnchorEntry[];
  escrow: EscrowStats | null;
  warnings: string[];
}

function ageString(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  const d = Math.max(0, now - ts);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

function shortHex(h: string, head = 8, tail = 4): string {
  if (!h || h.length < head + tail + 4) return h ?? "";
  return `${h.slice(0, head + 2)}…${h.slice(-tail)}`;
}

async function loadAnchorAddress(): Promise<string | null> {
  if (process.env.ZG_AUDIT_ANCHOR) return process.env.ZG_AUDIT_ANCHOR;
  try {
    const txt = await readFile("contracts/AuditAnchor.deployment.json", "utf8");
    return (JSON.parse(txt) as { address?: string }).address ?? null;
  } catch {
    return null;
  }
}

async function loadEscrowAddress(): Promise<string | null> {
  if (process.env.PROCUREMENT_ESCROW) return process.env.PROCUREMENT_ESCROW;
  try {
    const txt = await readFile("contracts/ProcurementEscrow.deployment.json", "utf8");
    return (JSON.parse(txt) as { address?: string }).address ?? null;
  } catch {
    return null;
  }
}

export async function loadRecentAnchors(limit = 10): Promise<{
  entries: AnchorEntry[];
  warning: string | null;
}> {
  const addr = await loadAnchorAddress();
  if (!addr) return { entries: [], warning: "AuditAnchor address not configured" };
  try {
    const provider = new JsonRpcProvider(ZG_RPC, ZG_CHAIN_ID);
    const contract = new Contract(addr, ANCHOR_ABI, provider);
    const total: bigint = await contract.count();
    if (total === 0n) return { entries: [], warning: null };
    const start = total > BigInt(limit) ? total - BigInt(limit) : 0n;
    const entries: AnchorEntry[] = [];
    for (let i = total - 1n; i >= start; i--) {
      const a = await contract.get(i);
      const cidRoot: string = a.cidRoot;
      const policyHash: string = a.policyHash;
      const ts = Number(a.timestamp);
      entries.push({
        index: i.toString(),
        cidRoot,
        cidRootShort: shortHex(cidRoot),
        policyHash,
        policyHashShort: shortHex(policyHash),
        agent: a.agent,
        timestamp: ts,
        age: ageString(ts),
        txHash: null,
        explorer: `${ZG_EXPLORER}/address/${addr}`,
        storageExplorer: null,
      });
    }
    return { entries, warning: null };
  } catch (e) {
    return { entries: [], warning: `0G anchor read failed: ${(e as Error).message}` };
  }
}

export async function loadEscrowStats(): Promise<{
  stats: EscrowStats | null;
  warning: string | null;
}> {
  const addr = await loadEscrowAddress();
  if (!addr) return { stats: null, warning: "ProcurementEscrow address not configured" };
  try {
    const provider = new JsonRpcProvider(SEPOLIA_RPC, SEPOLIA_CHAIN_ID);
    const contract = new Contract(addr, ESCROW_ABI, provider);
    const next: bigint = await contract.nextOrderId();
    // Free-tier RPCs cap eth_getLogs at 10 blocks, so we walk the public
    // `orders` mapping with pure view calls instead. With < 100 orders
    // for the demo this is fast enough and bypasses the limit.
    let ordersCreated = 0;
    let shipped = 0;
    let released = 0;
    let refunded = 0;
    let disputed = 0;
    let totalEth = 0n;
    const ids = Array.from({ length: Number(next) }, (_, i) => BigInt(i + 1));
    const orderResults = await Promise.all(
      ids.map(async (id) => {
        try {
          return await contract.orders(id);
        } catch {
          return null;
        }
      }),
    );
    for (const o of orderResults) {
      if (!o) continue;
      const status: number = Number(o.status ?? o[7]);
      const amount: bigint = (o.amount ?? o[2]) as bigint;
      if (status === 0) continue; // None — not yet allocated
      ordersCreated++;
      totalEth += amount;
      if (status === 2) shipped++;
      else if (status === 3) {
        shipped++;
        released++;
      } else if (status === 4) refunded++;
      else if (status === 5) disputed++;
    }
    return {
      stats: {
        contract: addr,
        contractShort: shortHex(addr, 6, 4),
        explorer: `${SEPOLIA_EXPLORER}/address/${addr}`,
        nextOrderId: Number(next),
        ordersCreated,
        shipmentsConfirmed: shipped,
        released,
        refunded,
        disputed,
        totalLockedEth: formatEther(totalEth),
      },
      warning: null,
    };
  } catch (e) {
    return {
      stats: null,
      warning: `Sepolia escrow read failed: ${(e as Error).message}`,
    };
  }
}

export async function loadOnchainActivity(anchorsLimit = 10): Promise<OnchainActivity> {
  const warnings: string[] = [];
  const [a, e] = await Promise.all([
    loadRecentAnchors(anchorsLimit),
    loadEscrowStats(),
  ]);
  if (a.warning) warnings.push(a.warning);
  if (e.warning) warnings.push(e.warning);
  return { anchors: a.entries, escrow: e.stats, warnings };
}
