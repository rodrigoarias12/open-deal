import { OdooClient } from "../../sources/odoo";
import { OdooBuyerConnector } from "./odoo";
import { ExcelBuyerConnector } from "./excel";
import { CsvBuyerConnector } from "./csv";
import { SapBuyerConnector } from "./sap";
import { MockBuyerConnector } from "./mock";
import type { BuyerInventoryConnector } from "./types";

/**
 * Pick the buyer-side connector based on env vars. Precedence:
 *
 *   1. BUYER_CONNECTOR=<id>     — explicit override
 *   2. SAP_HOST set             → sap (live)
 *   3. ODOO_URL + ODOO_DB set   → odoo (live)
 *   4. BUYER_NEEDS_XLSX set     → excel
 *   5. BUYER_NEEDS_CSV set      → csv
 *   6. fallback                 → mock
 *
 * The factory NEVER throws on a transient connector failure — the
 * agent's caller can fall back to the next candidate or to the
 * needs.json fixture.
 */
export async function pickBuyerConnector(): Promise<BuyerInventoryConnector> {
  const explicit = process.env.BUYER_CONNECTOR?.toLowerCase();

  if (explicit) {
    // Explicit override skips healthCheck — useful for forcing a stub
    // (sap / shopify / mercadolibre) in demo mode without live creds.
    const c = buildById(explicit);
    if (c) return c;
    return new MockBuyerConnector();
  }

  const candidates: Array<() => BuyerInventoryConnector | null> = [];
  {
    if (process.env.SAP_HOST) candidates.push(() => new SapBuyerConnector());
    if (
      process.env.ODOO_URL &&
      process.env.ODOO_DB &&
      process.env.ODOO_USERNAME &&
      process.env.ODOO_PASSWORD
    ) {
      candidates.push(() => buildOdoo());
    }
    if (process.env.BUYER_NEEDS_XLSX) {
      candidates.push(() => new ExcelBuyerConnector(process.env.BUYER_NEEDS_XLSX!));
    }
    if (process.env.BUYER_NEEDS_CSV) {
      candidates.push(() => new CsvBuyerConnector(process.env.BUYER_NEEDS_CSV!));
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
  return new MockBuyerConnector();
}

function buildById(id: string): BuyerInventoryConnector | null {
  switch (id) {
    case "odoo":
      return buildOdoo();
    case "excel":
      return process.env.BUYER_NEEDS_XLSX
        ? new ExcelBuyerConnector(process.env.BUYER_NEEDS_XLSX)
        : null;
    case "csv":
      return process.env.BUYER_NEEDS_CSV
        ? new CsvBuyerConnector(process.env.BUYER_NEEDS_CSV)
        : null;
    case "sap":
      return new SapBuyerConnector();
    case "mock":
      return new MockBuyerConnector();
    default:
      return null;
  }
}

function buildOdoo(): BuyerInventoryConnector | null {
  if (
    !process.env.ODOO_URL ||
    !process.env.ODOO_DB ||
    !process.env.ODOO_USERNAME ||
    !process.env.ODOO_PASSWORD
  ) {
    return null;
  }
  const client = new OdooClient({
    url: process.env.ODOO_URL,
    db: process.env.ODOO_DB,
    username: process.env.ODOO_USERNAME,
    password: process.env.ODOO_PASSWORD,
  });
  return new OdooBuyerConnector(client);
}
