/**
 * Agentic ERP — buyer-side inventory connector contract.
 *
 * Specified in PROTOCOL.md §6 (`procurement.connector.v1`). Anyone can
 * implement the interface for their own ERP / spreadsheet / API. The
 * buyer agent is data-source-agnostic.
 *
 * Required: `id`, `name`, `readNeeds()`.
 * Optional: `healthCheck()`, `pushOrder()`.
 */

export interface InventoryNeed {
  /** Stock-keeping unit identifier matching the seller-side catalog. */
  sku: string;
  /** Optional product description for the LLM and the audit log. */
  name?: string;
  /** Quantity to procure. The connector decides — usually `(reorder_qty - on_hand)`. */
  quantity: number;
  /** Current on-hand quantity. Logged but not used in the policy gate. */
  current_stock?: number;
  /** Hard cap the buyer agent will not exceed when ranking quotes. */
  max_unit_price_usd?: number;
  /** Days from now the goods must arrive by. */
  deadline_days: number;
  /** Plain-language reason — surfaced in the Telegram approval if it fires. */
  reason: string;
  /** Identifier of the connector that produced this row (audit metadata). */
  source: string;
}

export interface BuyerInventoryConnector {
  readonly id: string;
  readonly name: string;
  readNeeds(): Promise<InventoryNeed[]>;
  healthCheck?(): Promise<boolean>;
  /**
   * Optional: write a placed order back to the source system (e.g. Odoo
   * purchase.order, an SAP RFC, an Excel append). Safe to omit; the
   * caller falls back to console + audit-only.
   */
  pushOrder?(order: PlacedOrder): Promise<{ id: string; url?: string }>;
}

export interface PlacedOrder {
  sku: string;
  quantity: number;
  unit_price_usd: number;
  total_usd: number;
  seller_ens: string;
  seller_address: string;
  escrow_tx: string;
  escrow_order_id: string;
  audit_anchor_index?: string;
  at: string;
}
