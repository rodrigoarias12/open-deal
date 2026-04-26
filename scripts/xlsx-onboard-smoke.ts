import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { normaliseSheet } from "../app/lib/catalog-normalize";

const PATH = process.argv[2] || "fixtures/sellers/papelera-del-sur.xlsx";
const STORE = process.argv[3] || "Demo Seller XLSX";
const EMAIL = "ventas@demo.test";

async function main(): Promise<void> {
  const buf = readFileSync(PATH);
  const wb = XLSX.read(buf);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true });
  const r = normaliseSheet(rows);
  if (!r.ok) {
    console.log("[norm] FAIL:", r.error);
    process.exit(1);
  }
  console.log("[norm] OK —", r.items.length, "items");
  const detected = r.detectedHeaders?.map((h) => `${h.raw}→${h.canonical}`).join(", ");
  console.log("[norm] columns:", detected);

  const body = {
    storeName: STORE,
    email: EMAIL,
    catalog: { seller: STORE, currency: "USDC", items: r.items },
  };
  const start = Date.now();
  const resp = await fetch("https://agentic-erp-eth.vercel.app/api/seller/onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await resp.json()) as {
    ok?: boolean;
    subname?: string;
    catalog_cid?: string;
    endpoint?: string;
    error?: string;
  };
  console.log(`[onboard] HTTP ${resp.status} in ${(Date.now() - start) / 1000}s`);
  console.log(`  subname: ${j.subname}`);
  console.log(`  catalog_cid: ${j.catalog_cid?.slice(0, 18)}…`);
  console.log(`  endpoint: ${j.endpoint}`);
  console.log(`  ok: ${j.ok}`);
  if (!j.ok) console.log(`  error: ${j.error}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
