/**
 * Reads each fixtures/sellers/*.json and generates a parallel .xlsx with
 * realistic Latin-American B2B price-list formatting:
 *
 *   - Spanish column headers ("Producto", "Precio Unitario", "Stock", …)
 *   - Sometimes "Código" instead of "SKU"
 *   - Sometimes a header row with company info before the table
 *   - Empty rows + a "Total" footer to test the parser's resilience
 *
 * Run: npx tsx scripts/generate-seller-xlsx.ts
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import * as XLSX from "xlsx";

interface CatalogItem {
  sku: string;
  name: string;
  unit_price_usd: number;
  stock: number;
  delivery_days: number;
}
interface Catalog {
  seller: string;
  currency: string;
  items: CatalogItem[];
}
interface Onboard {
  storeName: string;
  email: string;
  catalog: Catalog;
}

// Different layouts per seller so the parser is exercised against
// realistic variation, not just one template.
const LAYOUTS: Record<string, "compact" | "with_header" | "with_footer" | "code_column" | "minimal"> = {
  acme: "with_header",
  "distri-norte": "with_footer",
  "papelera-del-sur": "code_column",
  "box-master": "compact",
  "techsupply-mx": "minimal",
};

function buildSheet(seller: string, items: CatalogItem[], layout: string): XLSX.WorkSheet {
  let rows: (string | number | null)[][] = [];

  switch (layout) {
    case "with_header":
      rows = [
        [seller, null, null, null, null],
        ["Lista de precios — actualizada 04/2026", null, null, null, null],
        [],
        ["SKU", "Producto", "Precio Unitario (USD)", "Stock", "Días Entrega"],
        ...items.map((i) => [i.sku, i.name, i.unit_price_usd, i.stock, i.delivery_days]),
      ];
      break;
    case "with_footer":
      rows = [
        ["SKU", "Descripción", "Precio", "Stock", "Entrega"],
        ...items.map((i) => [i.sku, i.name, i.unit_price_usd, i.stock, i.delivery_days]),
        [],
        ["Total ítems", null, null, items.reduce((s, i) => s + i.stock, 0), null],
      ];
      break;
    case "code_column":
      rows = [
        ["Código", "Producto", "Precio Unitario", "Stock", "Días"],
        ...items.map((i) => [i.sku, i.name, i.unit_price_usd, i.stock, i.delivery_days]),
      ];
      break;
    case "compact":
      rows = [
        ["sku", "nombre", "precio", "stock", "dias_entrega"],
        ...items.map((i) => [i.sku, i.name, i.unit_price_usd, i.stock, i.delivery_days]),
      ];
      break;
    case "minimal":
    default:
      rows = [
        ["SKU", "Item", "Price", "Quantity", "Lead time"],
        ...items.map((i) => [i.sku, i.name, i.unit_price_usd, i.stock, i.delivery_days]),
      ];
      break;
  }

  return XLSX.utils.aoa_to_sheet(rows);
}

async function main(): Promise<void> {
  const dir = "fixtures/sellers";
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    const slug = basename(f, ".json");
    const data = JSON.parse(await readFile(join(dir, f), "utf8")) as Onboard;
    const layout = LAYOUTS[slug] || "minimal";
    const sheet = buildSheet(data.catalog.seller, data.catalog.items, layout);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Lista de precios");
    const out = join(dir, `${slug}.xlsx`);
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    await writeFile(out, buf);
    console.log(`  ✓ ${out} — layout: ${layout}, ${data.catalog.items.length} items`);
  }
  console.log("\ndone.");
}

main().catch((e) => {
  console.error("failed:", e);
  process.exit(1);
});
