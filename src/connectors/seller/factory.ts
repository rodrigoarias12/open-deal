import { JsonSellerConnector } from "./json";
import { ExcelSellerConnector } from "./excel";
import { ShopifySellerConnector } from "./shopify";
import { MercadoLibreSellerConnector } from "./mercadolibre";
import { MockSellerConnector } from "./mock";
import type { SellerCatalogConnector } from "./types";

/**
 * Pick the seller-side connector based on env vars. Precedence:
 *
 *   1. SELLER_CONNECTOR=<id>             — explicit
 *   2. SHOPIFY_STORE + SHOPIFY_TOKEN     → shopify
 *   3. ML_USER_ID + ML_TOKEN             → mercadolibre
 *   4. SELLER_CATALOG_XLSX               → excel
 *   5. SELLER_CATALOG_PATH (.json)       → json
 *   6. fallback                          → mock
 *
 * Stubs (shopify / mercadolibre without creds) are skipped here. They
 * are explicitly selectable via SELLER_CONNECTOR=shopify when you
 * want the stub for a demo / docs run.
 */
export async function pickSellerConnector(): Promise<SellerCatalogConnector> {
  const explicit = process.env.SELLER_CONNECTOR?.toLowerCase();

  if (explicit) {
    const c = buildById(explicit);
    if (c) return c;
    return new MockSellerConnector();
  }

  const candidates: Array<() => SellerCatalogConnector | null> = [];
  {
    if (process.env.SHOPIFY_STORE && process.env.SHOPIFY_TOKEN) {
      candidates.push(() => new ShopifySellerConnector());
    }
    if (process.env.ML_USER_ID && process.env.ML_TOKEN) {
      candidates.push(() => new MercadoLibreSellerConnector());
    }
    if (process.env.SELLER_CATALOG_XLSX) {
      candidates.push(
        () =>
          new ExcelSellerConnector(
            process.env.SELLER_CATALOG_XLSX!,
            process.env.SELLER_NAME ?? "Excel Seller",
          ),
      );
    }
    if (process.env.SELLER_CATALOG_PATH) {
      candidates.push(() => new JsonSellerConnector(process.env.SELLER_CATALOG_PATH!));
    }
  }

  for (const make of candidates) {
    const c = make();
    if (!c) continue;
    if (c.healthCheck) {
      try {
        const ok = await c.healthCheck();
        if (!ok) continue;
      } catch {
        continue;
      }
    }
    return c;
  }
  return new MockSellerConnector();
}

function buildById(id: string): SellerCatalogConnector | null {
  switch (id) {
    case "json":
      return process.env.SELLER_CATALOG_PATH
        ? new JsonSellerConnector(process.env.SELLER_CATALOG_PATH)
        : new JsonSellerConnector("apps/seller-agent/catalog.json");
    case "excel":
      return process.env.SELLER_CATALOG_XLSX
        ? new ExcelSellerConnector(process.env.SELLER_CATALOG_XLSX)
        : null;
    case "shopify":
      return new ShopifySellerConnector();
    case "mercadolibre":
    case "ml":
      return new MercadoLibreSellerConnector();
    case "mock":
      return new MockSellerConnector();
    default:
      return null;
  }
}
