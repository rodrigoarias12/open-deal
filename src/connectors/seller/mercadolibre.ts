import type { Catalog, SellerCatalogConnector } from "./types";

/**
 * MercadoLibre seller-side connector — STUB for the demo, REAL contract
 * for production.
 *
 * To activate against a real ML user account:
 *   - Set ML_USER_ID   (numeric)
 *   - Set ML_TOKEN     (OAuth bearer, scope: read items)
 *
 * Then replace the body of `loadCatalog()` with a fetch to:
 *
 *   GET https://api.mercadolibre.com/users/{ML_USER_ID}/items/search?status=active
 *
 * Page through `results[]`, then for each item id:
 *
 *   GET https://api.mercadolibre.com/items/{item_id}
 *
 * Map each → CatalogItem:
 *   sku           = item.attributes.find(a => a.id === 'SELLER_SKU').value_name
 *   name          = item.title
 *   unit_price_usd= item.price (apply MXN/ARS→USD conversion via oracle)
 *   stock         = item.available_quantity
 *   delivery_days = item.shipping.local_pick_up ? 1 : 3
 *
 * The agent doesn't care which marketplace API is behind the catalog —
 * Shopify and MercadoLibre return the same Catalog shape.
 */

interface MlItemFixture {
  id: string;
  title: string;
  sku: string;
  price_local: number;
  currency: string;
  available_quantity: number;
  shipping_days: number;
}

const STUB_USER_ID = "123456789";
const STUB_ITEMS: MlItemFixture[] = [
  { id: "MLA1234567890", title: "Caja de cartón corrugada 30x20x15 (pack 50)", sku: "CARTON-CAJA-30",  price_local: 1100,  currency: "ARS", available_quantity: 200, shipping_days: 2 },
  { id: "MLA0987654321", title: "Plástico burbuja x 50m",                       sku: "BURBUJA-1M",     price_local: 5500,  currency: "ARS", available_quantity: 90,  shipping_days: 3 },
  { id: "MLA1112223334", title: "Papel A4 resma 500h",                          sku: "PAPEL-A4-RES",   price_local: 7200,  currency: "ARS", available_quantity: 60,  shipping_days: 4 },
];

// Stand-in conversion. Production version pulls from a price oracle
// (the same kh_pay-x402-paid feed the buyer agent uses for FX).
const ARS_TO_USD = 0.001;

export class MercadoLibreSellerConnector implements SellerCatalogConnector {
  readonly id = "mercadolibre";
  readonly name: string;

  constructor(opts?: { userId?: string; token?: string }) {
    const userId = opts?.userId || process.env.ML_USER_ID;
    this.name = userId
      ? `MercadoLibre (user ${userId})`
      : "MercadoLibre (stub — set ML_USER_ID+ML_TOKEN)";
  }

  async healthCheck(): Promise<boolean> {
    return Boolean(process.env.ML_USER_ID && process.env.ML_TOKEN);
  }

  async loadCatalog(): Promise<Catalog> {
    if (!process.env.ML_USER_ID || !process.env.ML_TOKEN) {
      return {
        seller: "Demo ML Seller (stub)",
        currency: "USDC",
        items: STUB_ITEMS.map((it) => ({
          sku: it.sku,
          name: it.title,
          unit_price_usd: round2(it.price_local * ARS_TO_USD),
          stock: it.available_quantity,
          delivery_days: it.shipping_days,
        })),
        source: this.id,
        source_ref: `[STUB] ML user ${STUB_USER_ID} — set ML_USER_ID + ML_TOKEN to enable live items API`,
      };
    }

    throw new Error(
      "live MercadoLibre connector not yet implemented — see source for the API shape; PRs welcome",
    );
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
