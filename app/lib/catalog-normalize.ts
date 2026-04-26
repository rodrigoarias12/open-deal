/**
 * Heuristic catalog normaliser. Given a 2-D array of cells (the way
 * SheetJS returns sheet contents with `aoa: true`), identifies the
 * header row, maps columns to canonical fields, and emits the catalog
 * shape the rest of the framework expects.
 *
 * Tolerant to:
 *   - preamble rows above the headers (company info, "Lista de precios")
 *   - footer rows below the data ("Total", aggregations)
 *   - English + Spanish + abbreviated header keywords
 *   - mixed casing / accents
 *   - empty rows scattered through the sheet
 *
 * Required canonical fields: sku, unit_price_usd, stock.
 * Optional: name (defaults to sku), delivery_days (defaults to 3).
 */

export interface CatalogItem {
  sku: string;
  name: string;
  unit_price_usd: number;
  stock: number;
  delivery_days: number;
}

export interface NormalizeResult {
  ok: boolean;
  items: CatalogItem[];
  detectedHeaders?: { col: number; raw: string; canonical: string }[];
  warnings: string[];
  error?: string;
}

type Canonical = "sku" | "name" | "unit_price_usd" | "stock" | "delivery_days";

const KEYWORDS: Record<Canonical, string[]> = {
  sku: ["sku", "código", "codigo", "code", "ref", "referencia", "reference"],
  name: [
    "producto",
    "product",
    "item",
    "name",
    "nombre",
    "descripción",
    "descripcion",
    "description",
    "detalle",
  ],
  unit_price_usd: [
    "precio unitario",
    "unit price",
    "precio",
    "price",
    "valor",
    "valor unitario",
    "precio unit",
  ],
  stock: ["stock", "cantidad", "qty", "quantity", "disponible", "available", "existencia"],
  delivery_days: [
    "días entrega",
    "dias entrega",
    "días de entrega",
    "dias de entrega",
    "días",
    "dias",
    "entrega",
    "delivery",
    "lead time",
    "lead",
    "dias_entrega",
  ],
};

function normString(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_\-]+/g, " ")
    .trim();
}

function classifyHeader(raw: unknown): Canonical | null {
  if (typeof raw !== "string") return null;
  const n = normString(raw);
  if (!n) return null;
  // Try longest keyword first to avoid "precio" matching before "precio unitario"
  const candidates: Array<{ field: Canonical; kw: string }> = [];
  for (const [field, kws] of Object.entries(KEYWORDS) as [Canonical, string[]][]) {
    for (const kw of kws) {
      if (n === normString(kw)) candidates.push({ field, kw });
    }
  }
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.kw.length - a.kw.length);
    return candidates[0].field;
  }
  // Looser contains-match as fallback
  for (const [field, kws] of Object.entries(KEYWORDS) as [Canonical, string[]][]) {
    for (const kw of kws) {
      if (n.includes(normString(kw))) return field;
    }
  }
  return null;
}

function scoreHeaderRow(row: unknown[]): {
  score: number;
  mapping: Map<number, Canonical>;
} {
  const mapping = new Map<number, Canonical>();
  let score = 0;
  for (let i = 0; i < row.length; i++) {
    const c = classifyHeader(row[i]);
    if (c && !Array.from(mapping.values()).includes(c)) {
      mapping.set(i, c);
      score++;
    }
  }
  return { score, mapping };
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d,.\-]/g, "").replace(/,/g, ".");
    if (!cleaned) return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function normaliseSheet(rows: unknown[][]): NormalizeResult {
  if (!rows || rows.length === 0) {
    return { ok: false, items: [], warnings: [], error: "empty sheet" };
  }

  // Find the row with the highest header-score in the first 10 rows
  let best = { idx: -1, score: 0, mapping: new Map<number, Canonical>() };
  const scanLimit = Math.min(10, rows.length);
  for (let i = 0; i < scanLimit; i++) {
    const r = rows[i] || [];
    const { score, mapping } = scoreHeaderRow(r);
    if (score > best.score) best = { idx: i, score, mapping };
  }

  if (best.idx === -1 || best.score < 3) {
    return {
      ok: false,
      items: [],
      warnings: [],
      error: `no header row detected — need at least 3 known columns (sku, price, stock). got headers: ${JSON.stringify(rows[0])}`,
    };
  }

  const mapping = best.mapping;
  const required: Canonical[] = ["sku", "unit_price_usd", "stock"];
  const missing = required.filter((r) => !Array.from(mapping.values()).includes(r));
  if (missing.length > 0) {
    return {
      ok: false,
      items: [],
      warnings: [],
      error: `missing required columns: ${missing.join(", ")}`,
      detectedHeaders: Array.from(mapping.entries()).map(([col, can]) => ({
        col,
        raw: String(rows[best.idx][col]),
        canonical: can,
      })),
    };
  }

  const items: CatalogItem[] = [];
  const warnings: string[] = [];
  for (let i = best.idx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const get = (canon: Canonical): unknown => {
      const col = Array.from(mapping.entries()).find(([, v]) => v === canon)?.[0];
      return col === undefined ? undefined : r[col];
    };
    const skuRaw = get("sku");
    if (typeof skuRaw !== "string" || !skuRaw.trim()) continue;
    const sku = skuRaw.trim();
    if (!/[A-Za-z0-9]/.test(sku)) continue;
    if (sku.toLowerCase().startsWith("total")) continue;

    const price = asNumber(get("unit_price_usd"));
    const stock = asNumber(get("stock"));
    if (price === null || stock === null) {
      warnings.push(`row ${i + 1}: missing price or stock for ${sku}, skipped`);
      continue;
    }

    const nameRaw = get("name");
    const name = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : sku;
    const deliveryRaw = asNumber(get("delivery_days"));
    const delivery_days = deliveryRaw !== null && deliveryRaw >= 0 ? Math.round(deliveryRaw) : 3;

    items.push({
      sku,
      name,
      unit_price_usd: Math.round(price * 100) / 100,
      stock: Math.max(0, Math.round(stock)),
      delivery_days,
    });
  }

  if (items.length === 0) {
    return {
      ok: false,
      items: [],
      warnings,
      error: "no data rows produced after header detection",
    };
  }

  return {
    ok: true,
    items,
    warnings,
    detectedHeaders: Array.from(mapping.entries()).map(([col, can]) => ({
      col,
      raw: String(rows[best.idx][col]),
      canonical: can,
    })),
  };
}
