import type { Catalog, SellerCatalogConnector } from "./types";

/**
 * Synthetic catalog for offline runs / unit tests / docs.
 */
export class MockSellerConnector implements SellerCatalogConnector {
  readonly id = "mock";
  readonly name = "Mock (synthetic)";

  constructor(private readonly catalog: Catalog = DEFAULT_MOCK_CATALOG) {}

  async loadCatalog(): Promise<Catalog> {
    return { ...this.catalog, source: this.id };
  }
}

const DEFAULT_MOCK_CATALOG: Catalog = {
  seller: "Mock Seller",
  currency: "USDC",
  items: [
    { sku: "PAPEL-A4-RES", name: "Papel A4 (mock)", unit_price_usd: 6.5, stock: 100, delivery_days: 2 },
    { sku: "CARTON-CAJA-30", name: "Caja cartón (mock)", unit_price_usd: 1.2, stock: 500, delivery_days: 1 },
  ],
  source: "mock",
};
