import { readFile, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import * as XLSX from "xlsx";
import { normaliseSheet } from "../app/lib/catalog-normalize";

async function main(): Promise<void> {
  const dir = "fixtures/sellers";
  const xlsxFiles = (await readdir(dir)).filter((f) => f.endsWith(".xlsx")).sort();

  for (const f of xlsxFiles) {
    const slug = basename(f, ".xlsx");
    const buf = await readFile(join(dir, f));
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true });
    const result = normaliseSheet(rows);

    console.log(`\n[${slug}] ${result.ok ? "✓" : "✗"} ${result.items.length} items`);
    if (result.detectedHeaders) {
      const map = result.detectedHeaders
        .map((h) => `${h.raw}→${h.canonical}`)
        .join(", ");
      console.log(`  headers: ${map}`);
    }
    if (result.warnings.length) {
      console.log(`  warnings: ${result.warnings.join("; ")}`);
    }
    if (result.error) {
      console.log(`  ERROR: ${result.error}`);
    } else {
      for (const item of result.items) {
        console.log(`  · ${item.sku} | ${item.name.slice(0, 30)} | $${item.unit_price_usd} | ${item.stock}u | ${item.delivery_days}d`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
