import type { BuyerInventoryConnector, InventoryNeed } from "./types";

/**
 * Synthetic data for offline runs / unit tests / docs. Returns a fixed
 * set of needs with the source set to `mock` so the audit log makes the
 * provenance explicit.
 */
export class MockBuyerConnector implements BuyerInventoryConnector {
  readonly id = "mock";
  readonly name = "Mock (synthetic)";

  constructor(private readonly needs: InventoryNeed[] = DEFAULT_MOCK_NEEDS) {}

  async readNeeds(): Promise<InventoryNeed[]> {
    return this.needs.map((n) => ({ ...n, source: this.id }));
  }
}

const DEFAULT_MOCK_NEEDS: InventoryNeed[] = [
  {
    sku: "PAPEL-A4-RES",
    name: "Papel A4 (resma 500h)",
    quantity: 10,
    current_stock: 2,
    max_unit_price_usd: 8.0,
    deadline_days: 5,
    reason: "mock: low-stock alert",
    source: "mock",
  },
  {
    sku: "CARTON-CAJA-30",
    name: "Caja cartón 30x20",
    quantity: 50,
    current_stock: 3,
    max_unit_price_usd: 1.5,
    deadline_days: 3,
    reason: "mock: low-stock alert",
    source: "mock",
  },
];
