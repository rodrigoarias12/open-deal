import { OdooClient } from "./odoo";

export interface OdooLowStockItem {
  sku: string;
  name: string;
  qty_available: number;
  reorder_point: number;
  source: "odoo";
}

type OdooProduct = {
  id: number;
  default_code: string | false;
  name: string;
  qty_available: number;
};

/**
 * Inventory source for the buyer agent. Reads products from Odoo and
 * surfaces items whose qty_available is below a threshold. Used to
 * generate procurement needs without hardcoding them.
 *
 * Robust to Odoo instances without an inventory module: returns an
 * empty list rather than throwing, so the caller can fall back to a
 * fixture when running against an accounting-only Odoo.
 */
export class OdooInventorySource {
  readonly name = "odoo-inventory";

  constructor(
    private readonly client: OdooClient,
    private readonly threshold = 5,
  ) {}

  async readLowStock(): Promise<OdooLowStockItem[]> {
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
        .map((p) => ({
          sku: p.default_code as string,
          name: p.name,
          qty_available: p.qty_available,
          reorder_point: this.threshold,
          source: "odoo" as const,
        }));
    } catch (e) {
      // Odoo may not have the inventory module enabled (accounting-only
      // instances), or the user may not have stock permissions. In that
      // case, return nothing and let the caller fall back to a fixture.
      console.log(
        `[odoo-inventory] could not read inventory (${(e as Error).message}) — falling back to fixture`,
      );
      return [];
    }
  }
}
