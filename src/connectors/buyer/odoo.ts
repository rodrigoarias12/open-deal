import { OdooClient } from "../../sources/odoo";
import type { BuyerInventoryConnector, InventoryNeed, PlacedOrder } from "./types";

interface OdooProduct {
  id: number;
  default_code: string | false;
  name: string;
  qty_available: number;
}

interface OdooPartner {
  id: number;
  name: string;
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

  /**
   * Closes the loop: writes the resolved purchase order back into Odoo so
   * the ERP records what the agent actually did. Creates (or finds) a
   * res.partner for the seller, then a purchase.order with the chain
   * artifacts (escrow tx + 0G audit anchor) embedded in the notes.
   *
   * Returns Odoo PO name + a deep link if EXTERNAL_ODOO_BASE is set.
   * Best-effort: failure here does NOT roll back the onchain action — the
   * tick already succeeded. The writeback is recorded as a warning in audit.
   */
  async pushOrder(order: PlacedOrder): Promise<{ id: string; url?: string }> {
    // 1. Resolve product.product by SKU.
    const products = await this.client.call<{ id: number; name: string }[]>(
      "product.product",
      "search_read",
      [[["default_code", "=", order.sku]]],
      { fields: ["id", "name"], limit: 1 },
    );
    if (products.length === 0) {
      throw new Error(`product with default_code=${order.sku} not found in Odoo`);
    }
    const productId = products[0].id;

    // 2. Find or create the seller partner. We tag with the ENS name as
    //    the canonical key so re-runs don't multiply partners.
    const partnerName = order.seller_ens || order.seller_address;
    let partnerId: number;
    const existing = await this.client.call<OdooPartner[]>(
      "res.partner",
      "search_read",
      [[["name", "=", partnerName]]],
      { fields: ["id", "name"], limit: 1 },
    );
    if (existing.length > 0) {
      partnerId = existing[0].id;
    } else {
      const newIds = await this.client.call<number[]>(
        "res.partner",
        "create",
        [[{
          name: partnerName,
          is_company: true,
          comment: `Open Deal seller agent · ${order.seller_address}`,
          ref: order.seller_ens,
          supplier_rank: 1,
        }]],
      );
      partnerId = newIds[0];
    }

    // 3. Create the purchase.order. State stays draft; we confirm it
    //    immediately below so it lands in 'purchase' state — the ERP
    //    sees it as a real, committed order.
    const notes = [
      "Created by Open Deal autonomous agent",
      `escrow tx: ${order.escrow_tx}`,
      `escrow order id: ${order.escrow_order_id}`,
      order.audit_anchor_index
        ? `audit anchor: #${order.audit_anchor_index} on 0G Galileo`
        : null,
      `seller ENS: ${order.seller_ens}`,
      `agent ts: ${order.at}`,
    ]
      .filter(Boolean)
      .join("\n");

    const poIds = await this.client.call<number[]>(
      "purchase.order",
      "create",
      [[{
        partner_id: partnerId,
        origin: `open-deal:${order.escrow_tx.slice(0, 14)}…`,
        notes,
        order_line: [
          [
            0,
            0,
            {
              product_id: productId,
              product_qty: order.quantity,
              price_unit: order.unit_price_usd,
              name: `${products[0].name} (Open Deal)`,
            },
          ],
        ],
      }]],
    );
    const poId = poIds[0];

    // 4. Confirm the PO. button_confirm moves draft → purchase. If it
    //    fails (e.g., missing config), we still return the PO id — the
    //    record is in Odoo even if not confirmed.
    try {
      await this.client.call("purchase.order", "button_confirm", [[poId]]);
    } catch (e) {
      console.log(`[${this.id}] PO ${poId} created but not confirmed: ${(e as Error).message}`);
    }

    // 5. Read back the name (e.g., "P00042") for the return value.
    const [readBack] = await this.client.call<{ id: number; name: string }[]>(
      "purchase.order",
      "read",
      [[poId]],
      { fields: ["id", "name"] },
    );

    const base = process.env.EXTERNAL_ODOO_BASE || process.env.ODOO_URL;
    const url = base
      ? `${base.replace(/\/+$/, "")}/odoo/purchase/${poId}`
      : undefined;

    return { id: readBack?.name ?? `PO#${poId}`, url };
  }
}
