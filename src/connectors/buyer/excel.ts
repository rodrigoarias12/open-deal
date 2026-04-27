import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import type { BuyerInventoryConnector, InventoryNeed } from "./types";

/**
 * Reads inventory needs from a local .xlsx file. Useful for SMEs whose
 * ERP is "the spreadsheet someone updates every Monday".
 *
 * Expected columns (case-insensitive, accents tolerant):
 *   - SKU / Código / Code / Ref         (required)
 *   - Producto / Item / Name            (optional, defaults to SKU)
 *   - Stock / Cantidad / Qty            (required, current on-hand)
 *   - Reorder / Reorder Min / Min       (optional, default = 5)
 *   - Reorder Qty / Qty to Order        (optional, default = 2× threshold)
 *   - Max Price / Precio Max            (optional, default = $100)
 *   - Deadline / Días                   (optional, default = 5)
 *
 * Items where Stock < Reorder are emitted as needs.
 */
export class ExcelBuyerConnector implements BuyerInventoryConnector {
  readonly id = "excel";
  readonly name: string;

  constructor(
    private readonly path: string,
    private readonly defaultThreshold = 5,
    private readonly defaultDeadlineDays = 5,
    private readonly defaultMaxUsd = 100,
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

  async readNeeds(): Promise<InventoryNeed[]> {
    const buf = await readFile(this.path);
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      raw: true,
    });

    const out: InventoryNeed[] = [];
    for (const row of rows) {
      const norm = normaliseRow(row);
      if (!norm.sku) continue;
      const stock = norm.stock ?? 0;
      const threshold = norm.reorder_min ?? this.defaultThreshold;
      if (stock >= threshold) continue;
      const qty =
        norm.reorder_qty ??
        Math.max(threshold * 2 - stock, threshold);
      out.push({
        sku: norm.sku,
        name: norm.name ?? norm.sku,
        quantity: qty,
        current_stock: stock,
        max_unit_price_usd: norm.max_price ?? this.defaultMaxUsd,
        deadline_days: norm.deadline_days ?? this.defaultDeadlineDays,
        reason: `auto: Excel low-stock alert (qty ${stock} < reorder ${threshold})`,
        source: this.id,
      });
    }
    return out;
  }
}

interface NormRow {
  sku: string | null;
  name: string | null;
  stock: number | null;
  reorder_min: number | null;
  reorder_qty: number | null;
  max_price: number | null;
  deadline_days: number | null;
}

const KEY_ALIASES: Record<keyof NormRow, string[]> = {
  sku: ["sku", "código", "codigo", "code", "ref", "reference", "referencia"],
  name: ["name", "producto", "product", "item", "nombre", "descripción", "descripcion", "description"],
  stock: ["stock", "qty", "quantity", "cantidad", "on hand", "on_hand", "disponible"],
  reorder_min: ["reorder min", "reorder_min", "reorder", "min", "umbral", "punto de pedido"],
  reorder_qty: ["reorder qty", "reorder_qty", "qty to order", "comprar", "qty order"],
  max_price: ["max price", "precio max", "max_price", "max usd", "presupuesto"],
  deadline_days: ["deadline", "days", "días", "dias", "plazo"],
};

function normString(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_\-]+/g, " ")
    .trim();
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d,.\-]/g, "").replace(/,/g, ".");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normaliseRow(row: Record<string, unknown>): NormRow {
  const out: NormRow = {
    sku: null,
    name: null,
    stock: null,
    reorder_min: null,
    reorder_qty: null,
    max_price: null,
    deadline_days: null,
  };
  const lookups = new Map<string, string>();
  for (const k of Object.keys(row)) lookups.set(normString(k), k);
  for (const [field, aliases] of Object.entries(KEY_ALIASES) as [keyof NormRow, string[]][]) {
    for (const a of aliases) {
      const key = lookups.get(normString(a));
      if (key !== undefined) {
        const val = row[key];
        if (field === "sku" || field === "name") {
          if (typeof val === "string" && val.trim()) {
            (out as Record<keyof NormRow, unknown>)[field] = val.trim();
          }
        } else {
          (out as Record<keyof NormRow, unknown>)[field] = asNumber(val);
        }
        if ((out as Record<keyof NormRow, unknown>)[field] !== null) break;
      }
    }
  }
  return out;
}
