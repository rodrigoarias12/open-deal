import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { normaliseSheet } from "../../../app/lib/catalog-normalize";
import type { Catalog, SellerCatalogConnector } from "./types";

/**
 * Loads a catalog from a local .xlsx file. Reuses the same column
 * normaliser the /sell web onboarding uses, so the parsing rules are
 * identical: headers can be in Spanish or English, accents are
 * tolerated, preamble and footer rows are skipped.
 */
export class ExcelSellerConnector implements SellerCatalogConnector {
  readonly id = "excel";
  readonly name: string;

  constructor(
    private readonly path: string,
    private readonly seller: string = "Excel Seller",
    private readonly currency: string = "USDC",
  ) {
    this.name = `Excel (${path})`;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await readFile(this.path);
      return true;
    } catch {
      return false;
    }
  }

  async loadCatalog(): Promise<Catalog> {
    const buf = await readFile(this.path);
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
    });
    const result = normaliseSheet(rows);
    if (!result.ok) {
      throw new Error(`xlsx parse failed: ${result.error}`);
    }
    return {
      seller: this.seller,
      currency: this.currency,
      items: result.items,
      source: this.id,
      source_ref: this.path,
    };
  }
}
