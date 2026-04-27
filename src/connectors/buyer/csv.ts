import { readFile } from "node:fs/promises";
import type { BuyerInventoryConnector, InventoryNeed } from "./types";

/**
 * Reads inventory needs from a CSV file. The simplest format possible —
 * one row per SKU, expected columns the same as the Excel connector.
 *
 * Use when an SME exports their inventory from a custom system that
 * doesn't have an .xlsx but a .csv. No Excel dependency.
 */
export class CsvBuyerConnector implements BuyerInventoryConnector {
  readonly id = "csv";
  readonly name: string;

  constructor(
    private readonly path: string,
    private readonly defaultThreshold = 5,
    private readonly defaultDeadlineDays = 5,
    private readonly defaultMaxUsd = 100,
  ) {
    this.name = `CSV (${path})`;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await readFile(this.path, "utf8");
      return true;
    } catch {
      return false;
    }
  }

  async readNeeds(): Promise<InventoryNeed[]> {
    const text = await readFile(this.path, "utf8");
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
    const idx = (names: string[]) =>
      headers.findIndex((h) => names.includes(h));

    const skuI = idx(["sku", "code", "codigo", "código", "ref"]);
    const nameI = idx(["name", "producto", "product", "item", "nombre"]);
    const stockI = idx(["stock", "qty", "quantity", "cantidad"]);
    const reorderI = idx(["reorder", "reorder_min", "min"]);
    const reorderQtyI = idx(["reorder_qty", "qty_to_order"]);
    const maxPriceI = idx(["max_price", "precio_max", "max_usd"]);
    const daysI = idx(["deadline", "days", "dias", "días"]);

    if (skuI === -1 || stockI === -1) return [];

    const out: InventoryNeed[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i]);
      const sku = cells[skuI]?.trim();
      if (!sku) continue;
      const stock = num(cells[stockI]) ?? 0;
      const threshold = (reorderI >= 0 ? num(cells[reorderI]) : null) ?? this.defaultThreshold;
      if (stock >= threshold) continue;
      const reorderQty = (reorderQtyI >= 0 ? num(cells[reorderQtyI]) : null) ?? Math.max(threshold * 2 - stock, threshold);
      out.push({
        sku,
        name: nameI >= 0 ? cells[nameI]?.trim() || sku : sku,
        quantity: reorderQty,
        current_stock: stock,
        max_unit_price_usd:
          (maxPriceI >= 0 ? num(cells[maxPriceI]) : null) ?? this.defaultMaxUsd,
        deadline_days:
          (daysI >= 0 ? num(cells[daysI]) : null) ?? this.defaultDeadlineDays,
        reason: `auto: CSV low-stock alert (qty ${stock} < reorder ${threshold})`,
        source: this.id,
      });
    }
    return out;
  }
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQ = false;
      } else {
        cur += c;
      }
    } else {
      if (c === ",") {
        out.push(cur);
        cur = "";
      } else if (c === '"' && cur.length === 0) {
        inQ = true;
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out;
}

function num(s: string | undefined): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^\d,.\-]/g, "").replace(/,/g, ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
