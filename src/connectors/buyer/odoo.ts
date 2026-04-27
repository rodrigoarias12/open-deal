import { OdooClient } from "../../sources/odoo";
import type { BuyerInventoryConnector, InventoryNeed } from "./types";

interface OdooProduct {
  id: number;
  default_code: string | false;
  name: string;
  qty_available: number;
}

/**
 * Reads inventory needs from a real Odoo instance via JSON-RPC.
 *
 * Filters `product.product` for items that are sale_ok and below a
 * reorder threshold, returning one InventoryNeed per low-stock SKU.
 *
 * Falls back gracefully on instances without the stock module — the
 * factory will then pick a different connector via env precedence.
 */
export class OdooBuyerConnector implements BuyerInventoryConnector {
  readonly id = "odoo";
  readonly name = "Odoo (JSON-RPC)";

  constructor(
    private readonly client: OdooClient,
    private readonly threshold = 5,
    private readonly defaultDeadlineDays = 5,
    private readonly defaultMaxUsd = 100,
  ) {}

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.authenticate();
      return true;
    } catch {
      return false;
    }
  }

  async readNeeds(): Promise<InventoryNeed[]> {
    try {
      const products = await this.client.call<OdooProduct[]>(
        "product.product",
        "search_read",
        [[
          ["qty_available", "<", this.threshold],
          ["sale_ok", "=", true],
        ]],
        {
          fields: ["id", "default_code", "name", "qty_available"],
          limit: 50,
        },
      );
      return products
        .filter((p) => p.default_code && typeof p.default_code === "string")
        .map((p) => {
          const qty = Math.max(this.threshold * 2 - p.qty_available, this.threshold);
          return {
            sku: p.default_code as string,
            name: p.name,
            quantity: qty,
            current_stock: p.qty_available,
            max_unit_price_usd: this.defaultMaxUsd,
            deadline_days: this.defaultDeadlineDays,
            reason: `auto: Odoo low-stock alert (qty ${p.qty_available} < reorder ${this.threshold})`,
            source: this.id,
          };
        });
    } catch (e) {
      console.log(`[${this.id}] read failed: ${(e as Error).message}`);
      return [];
    }
  }
}
