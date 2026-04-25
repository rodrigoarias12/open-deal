import { Type } from "typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/core";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  keccak256,
  toUtf8Bytes,
} from "ethers";
import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";

const DEFAULT_RPC = "https://evmrpc-testnet.0g.ai";
const DEFAULT_INDEXER = "https://indexer-storage-testnet-turbo.0g.ai";
const DEFAULT_CHAIN_ID = 16602;
const EXPLORER_BASE = "https://chainscan-galileo.0g.ai";
const STORAGE_SCAN_BASE = "https://storagescan-galileo.0g.ai";

const ANCHOR_ABI = [
  "function anchor(bytes32 cidRoot, bytes32 policyHash) external returns (uint256)",
  "function count() external view returns (uint256)",
  "event Anchored(uint256 indexed index, bytes32 indexed cidRoot, bytes32 indexed policyHash, address agent, uint64 timestamp)",
];

const RecordAuditSchema = Type.Object(
  {
    record: Type.Unknown({
      description:
        "The audit JSON object to persist. Will be JSON.stringified, uploaded to 0G Storage, and anchored on chain. Should include enough context to reconstruct the decision: input snapshot, policy snapshot used, model output, resulting tx hash if any.",
    }),
    policy_hash: Type.Optional(
      Type.String({
        description:
          "Optional bytes32 (0x...) keccak256 of the policy that authorized the action. If omitted, derived from record.policy if present.",
      }),
    ),
    rpc_url: Type.Optional(Type.String({ description: "0G Chain RPC URL." })),
    indexer_url: Type.Optional(
      Type.String({ description: "0G Storage indexer URL." }),
    ),
    anchor_address: Type.Optional(
      Type.String({ description: "AuditAnchor contract address on 0G Chain." }),
    ),
  },
  { additionalProperties: false },
);

function jsonResult(payload: unknown): {
  type: "tool_result";
  toolResultMessage: { content: { type: "text"; text: string }[] };
  details: unknown;
} {
  return {
    type: "tool_result",
    toolResultMessage: {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    },
    details: payload,
  };
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`audit-to-0g: missing env ${key}`);
  return v;
}

function buildRecordAuditTool() {
  return {
    name: "record_audit",
    label: "Record Audit to 0G",
    description:
      "Persists an agent audit record to 0G Storage and anchors the storage root on 0G Chain. Returns the storage root hash, the chain tx hash, and explorer URLs. Call this AFTER any onchain action to produce a verifiable history entry that any third party can fetch and check against the chain anchor.",
    parameters: RecordAuditSchema,
    execute: async (
      _toolCallId: string,
      rawParams: unknown,
    ): Promise<ReturnType<typeof jsonResult>> => {
      const params = (rawParams ?? {}) as {
        record?: unknown;
        policy_hash?: string;
        rpc_url?: string;
        indexer_url?: string;
        anchor_address?: string;
      };
      if (params.record === undefined) {
        throw new Error("record_audit: missing 'record' parameter");
      }

      const rpc = params.rpc_url || process.env.ZG_RPC_URL || DEFAULT_RPC;
      const indexerUrl =
        params.indexer_url || process.env.ZG_INDEXER_URL || DEFAULT_INDEXER;
      const anchorAddress =
        params.anchor_address || requireEnv("ZG_AUDIT_ANCHOR");
      const privateKey = requireEnv("AGENT_PRIVATE_KEY");

      const provider = new JsonRpcProvider(rpc, DEFAULT_CHAIN_ID);
      const signer = new Wallet(privateKey, provider);

      const recordJson = JSON.stringify(params.record, null, 2);
      const bytes = new TextEncoder().encode(recordJson);
      const memData = new MemData(bytes);

      const indexer = new Indexer(indexerUrl);
      const [tx, uploadErr] = await indexer.upload(memData, rpc, signer);
      if (uploadErr) {
        throw new Error(`0G Storage upload failed: ${uploadErr}`);
      }
      if (!tx || !tx.rootHash) {
        throw new Error("0G Storage returned no root hash");
      }
      const cidRoot: string = tx.rootHash.startsWith("0x")
        ? tx.rootHash
        : `0x${tx.rootHash}`;
      const storageTx: string = tx.txHash;

      let policyHash: string;
      if (params.policy_hash) {
        policyHash = params.policy_hash.startsWith("0x")
          ? params.policy_hash
          : `0x${params.policy_hash}`;
      } else if (
        typeof params.record === "object" &&
        params.record !== null &&
        "policy" in (params.record as Record<string, unknown>)
      ) {
        policyHash = keccak256(
          toUtf8Bytes(
            JSON.stringify((params.record as Record<string, unknown>).policy),
          ),
        );
      } else {
        policyHash = keccak256(toUtf8Bytes(""));
      }

      const contract = new Contract(anchorAddress, ANCHOR_ABI, signer);
      const anchorTx = await contract.anchor(cidRoot, policyHash);
      const receipt = await anchorTx.wait();
      const count = await contract.count();

      return jsonResult({
        ok: true,
        cidRoot,
        policyHash,
        storage: {
          txHash: storageTx,
          explorer: `${STORAGE_SCAN_BASE}/tx/${storageTx}`,
        },
        chain: {
          anchorAddress,
          txHash: anchorTx.hash,
          blockNumber: receipt?.blockNumber ?? null,
          explorer: `${EXPLORER_BASE}/tx/${anchorTx.hash}`,
          anchorIndex: (count - 1n).toString(),
        },
      });
    },
  };
}

export default definePluginEntry({
  id: "audit-to-0g",
  name: "Audit to 0G",
  description:
    "Persists agent audit records to 0G Storage and anchors them on 0G Chain. Provides a record_audit tool the agent calls after any onchain action.",
  register(api) {
    api.registerTool(buildRecordAuditTool() as never);
  },
});
