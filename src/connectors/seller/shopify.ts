import type { Catalog, SellerCatalogConnector } from "./types";

/**
 * Shopify seller-side connector — STUB for the demo, REAL contract for
 * production.
 *
 * To activate against a real Shopify store:
 *   - Set SHOPIFY_STORE   (e.g. "acme.myshopify.com")
 *   - Set SHOPIFY_TOKEN   (Admin API access token, scope: read_products)
 *
 * Then replace the body of `loadCatalog()` with a GraphQL Admin API
 * call. The query the production version will use:
 *
 *   query Catalog {
 *     products(first: 250) {
 *       edges {
 *         node {
 *           id title
 *           variants(first: 1) {
 *             edges { node { sku price inventoryQuantity } }
 *           }
 *         }
 *       }
 *     }
 *   }
 *
 * Map each product → CatalogItem (sku, name=title, unit_price_usd=price,
 * stock=inventoryQuantity, delivery_days from a metafield or default).
 */

interface ShopifyProductFixture {
  id: string;
  title: string;
  sku: string;
  price: number;
  qty: number;
  ship_days: number;
}

const STUB_STORE = "acme-demo.myshopify.com";
const STUB_PRODUCTS: ShopifyProductFixture[] = [
  { id: "gid://shopify/Product/1", title: "Papel A4 Premium (resma)", sku: "PAPEL-A4-RES", price: 7.5, qty: 120, ship_days: 3 },
  { id: "gid://shopify/Product/2", title: "Sobre manila pack 100",     sku: "SOBRES-MAN-25", price: 4.5, qty: 80,  ship_days: 2 },
  { id: "gid://shopify/Product/3", title: "Cinta packing 50m clear",   sku: "CINTA-EMB-50M", price: 3.6, qty: 240, ship_days: 1 },
];

export class ShopifySellerConnector implements SellerCatalogConnector {
  readonly id = "shopify";
  readonly name: string;

  constructor(opts?: { store?: string; token?: string }) {
    const store = opts?.store || process.env.SHOPIFY_STORE;
    this.name = store ? `Shopify (${store})` : "Shopify (stub — set SHOPIFY_STORE+TOKEN)";
  }

  async healthCheck(): Promise<boolean> {
    return Boolean(process.env.SHOPIFY_STORE && process.env.SHOPIFY_TOKEN);
  }

  async loadCatalog(): Promise<Catalog> {
    if (!process.env.SHOPIFY_STORE || !process.env.SHOPIFY_TOKEN) {
      // Stub mode — return shape-correct data marked as stub.
      return {
        seller: "Acme Demo Shopify (stub)",
        currency: "USDC",
        items: STUB_PRODUCTS.map((p) => ({
          sku: p.sku,
          name: p.title,
          unit_price_usd: p.price,
          stock: p.qty,
          delivery_days: p.ship_days,
        })),
        source: this.id,
        source_ref: `[STUB] ${STUB_STORE} — set SHOPIFY_STORE + SHOPIFY_TOKEN to enable live Admin API`,
      };
    }

    // Production wiring goes here.
    throw new Error(
      "live Shopify connector not yet implemented — see source for the GraphQL shape; PRs welcome",
    );
  }
}
