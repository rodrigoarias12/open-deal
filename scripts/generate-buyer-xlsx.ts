/**
 * Generates a sample buyer-side needs .xlsx for the ExcelBuyerConnector.
 * Spanish + English headers, mixed locale formatting.
 */
import { writeFile } from "node:fs/promises";
import * as XLSX from "xlsx";

const ROWS = [
  ["SKU", "Producto", "Stock", "Reorder Min", "Reorder Qty", "Max Price (USD)", "Días Entrega"],
  ["PAPEL-A4-RES", "Papel A4 (resma 500h)", 2, 5, 10, 8.0, 5],
  ["CARTON-CAJA-30", "Caja cartón 30x20x15", 3, 8, 50, 1.5, 3],
  ["TINTA-NEG-XL", "Tinta negra XL", 1, 3, 5, 22.0, 7],
  ["SOBRES-MAN-25", "Sobres manila pack 100", 4, 10, 25, 6.0, 4],
  ["CINTA-EMB-50M", "Cinta embalaje 50m", 12, 5, 0, 4.0, 3], // above threshold, won't trigger
];

async function main(): Promise<void> {
  const sheet = XLSX.utils.aoa_to_sheet(ROWS);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Inventario");
  const out = "fixtures/buyer/needs.xlsx";
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  await writeFile(out, buf);
  console.log(`✓ ${out} — ${ROWS.length - 1} rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
