/**
 * Catalog loader — resolves a `procurement.catalog-uri` ENS text record
 * value to a parsed Catalog.
 *
 * Specified in PROTOCOL.md §1 (`procurement.discovery.v1`) and §2
 * (`procurement.catalog.v1`). Two URI schemes are supported in v0.1:
 *
 *   0g://<rootHash>     download from 0G Storage via Indexer
 *   https://… / http:// fetch over plain HTTP(S)
 *
 * Used by:
 *   - apps/buyer-agent (pre-RFQ catalog fan-fetch + SKU indexing)
 *   - app/api/seller/[subname]/rfq (per-RFQ catalog lookup; will move
 *     to this loader on the next refactor pass)
 */

import { mkdir, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Indexer } from "@0gfoundation/0g-ts-sdk";
import type { Catalog } from "../connectors/seller/types.js";

const DEFAULT_ZG_INDEXER =
  "https://indexer-storage-testnet-turbo.0g.ai";

export interface LoadCatalogOptions {
  /** Override the 0G Indexer base URL. Defaults to env or the public Galileo indexer. */
  zgIndexerUrl?: string;
  /** Per-fetch timeout in milliseconds for HTTP(S) catalogs. */
  fetchTimeoutMs?: number;
}

export async function loadCatalogFromUri(
  uri: string,
  opts: LoadCatalogOptions = {},
): Promise<Catalog> {
  const indexerUrl =
    opts.zgIndexerUrl || process.env.ZG_INDEXER_URL || DEFAULT_ZG_INDEXER;

  if (uri.startsWith("0g://")) {
    const raw = uri.slice(5);
    const rootHash = raw.startsWith("0x") ? raw : `0x${raw}`;
    const indexer = new Indexer(indexerUrl);
    const dir = join(tmpdir(), `open-deal-catalog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    await mkdir(dir, { recursive: true });
    const path = join(dir, "catalog.json");
    const e = await indexer.download(rootHash, path, true);
    if (e) throw new Error(`0G download failed: ${e}`);
    const text = await readFile(path, "utf8");
    await unlink(path).catch(() => {});
    return JSON.parse(text) as Catalog;
  }

  if (uri.startsWith("https://") || uri.startsWith("http://")) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      opts.fetchTimeoutMs ?? 8000,
    );
    try {
      const r = await fetch(uri, { signal: controller.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
      return (await r.json()) as Catalog;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`unsupported catalog-uri scheme: ${uri.slice(0, 32)}…`);
}

/**
 * Build a SKU → sellers index from a list of (seller, catalog) pairs.
 * Used by the buyer to filter RFQ fan-out targets by SKU presence,
 * so a 5-seller registry only generates 2 RFQs when only 2 sellers
 * carry the requested SKU. Scales to N sellers without changing the
 * RFQ surface.
 */
export interface IndexedSeller<T> {
  seller: T;
  catalog: Catalog;
}

export function buildSkuIndex<T>(
  entries: IndexedSeller<T>[],
): Map<string, IndexedSeller<T>[]> {
  const index = new Map<string, IndexedSeller<T>[]>();
  for (const entry of entries) {
    for (const item of entry.catalog.items) {
      const list = index.get(item.sku);
      if (list) list.push(entry);
      else index.set(item.sku, [entry]);
    }
  }
  return index;
}
