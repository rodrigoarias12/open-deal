import { readFile } from "node:fs/promises";
import type { Catalog, SellerCatalogConnector } from "./types";

/**
 * Loads a catalog from a local JSON file. The simplest possible
 * connector — what `apps/seller-agent/catalog.json` was using before
 * the connector pattern.
 */
export class JsonSellerConnector implements SellerCatalogConnector {
  readonly id = "json";
  readonly name: string;

  constructor(private readonly path: string) {
    this.name = `JSON (${path})`;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const text = await readFile(this.path, "utf8");
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }

  async loadCatalog(): Promise<Catalog> {
    const raw = await readFile(this.path, "utf8");
    const data = JSON.parse(raw) as Partial<Catalog>;
    if (!Array.isArray(data.items)) {
      throw new Error(`json catalog at ${this.path} has no items array`);
    }
    return {
      seller: data.seller ?? "Unnamed Seller",
      address: data.address,
      currency: data.currency ?? "USDC",
      items: data.items as Catalog["items"],
      source: this.id,
      source_ref: this.path,
    };
  }
}
