/**
 * Agentic ERP — seller-side catalog connector contract.
 *
 * Specified in PROTOCOL.md §6 (`procurement.connector.v1`). Anyone can
 * implement the interface for their commerce backend (Shopify,
 * MercadoLibre, WooCommerce, custom REST, etc.). The seller agent and
 * the hosted /api/seller/[subname]/rfq endpoint both consume the same
 * shape, so a self-hosted Shopify seller and a hosted JSON seller are
 * interoperable on the buyer side.
 */

export interface CatalogItem {
  sku: string;
  name: string;
  unit_price_usd: number;
  stock: number;
  delivery_days: number;
}

export interface Catalog {
  seller: string;
  address?: string;
  currency: string;
  items: CatalogItem[];
  /** Identifier of the connector that produced this catalog. */
  source?: string;
  /** Optional tag for the audit log (file name, store handle, …). */
  source_ref?: string;
}

export interface RecordedSale {
  sku: string;
  quantity: number;
  unit_price_usd: number;
  total_usd: number;
  buyer_ens?: string;
  buyer_address?: string;
  rfq_id?: string;
  at: string;
}

export interface SellerCatalogConnector {
  readonly id: string;
  readonly name: string;
  loadCatalog(): Promise<Catalog>;
  healthCheck?(): Promise<boolean>;
  /**
   * Optional: write a confirmed sale back to the source system
   * (Shopify Admin order, MercadoLibre item update, Excel append).
   * Safe to omit; the framework records the sale onchain regardless.
   */
  recordSale?(sale: RecordedSale): Promise<{ id: string; url?: string }>;
}
