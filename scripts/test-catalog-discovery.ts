/**
 * Smoke test for the catalog-discovery loader + SKU index.
 *
 * Loads two test catalogs (one via the http://localhost dev server if
 * running, one via inline fixture) and verifies the SKU index correctly
 * filters fan-out targets. No ENS / RPC dependency — validates the
 * loader logic in isolation.
 */

import { createServer } from "node:http";
import { buildSkuIndex, loadCatalogFromUri } from "../src/catalog/loader.js";
import type { Catalog } from "../src/connectors/seller/types.js";

const FIXTURE_A: Catalog = {
  seller: "Acme Cartonería S.A.",
  address: "0x1111111111111111111111111111111111111111",
  currency: "USDC",
  items: [
    { sku: "PAPEL-A4-RES", name: "Papel A4", unit_price_usd: 6.5, stock: 240, delivery_days: 2 },
    { sku: "CARTON-CAJA-30", name: "Caja 30cm", unit_price_usd: 1.2, stock: 1500, delivery_days: 1 },
  ],
};
const FIXTURE_B: Catalog = {
  seller: "TechSupply MX",
  address: "0x2222222222222222222222222222222222222222",
  currency: "USDC",
  items: [
    { sku: "TINTA-NEG-XL", name: "Tinta XL", unit_price_usd: 18, stock: 60, delivery_days: 3 },
    { sku: "MOUSE-LG-WL", name: "Mouse inalámbrico", unit_price_usd: 12, stock: 200, delivery_days: 2 },
  ],
};

async function main(): Promise<void> {
  console.log("[test] starting catalog-discovery smoke test");

  // Spin up two ephemeral HTTP servers serving the two fixture catalogs
  const serverA = createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(FIXTURE_A));
  });
  const serverB = createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(FIXTURE_B));
  });
  await new Promise<void>((r) => serverA.listen(0, "127.0.0.1", r));
  await new Promise<void>((r) => serverB.listen(0, "127.0.0.1", r));
  const portA = (serverA.address() as { port: number }).port;
  const portB = (serverB.address() as { port: number }).port;
  const uriA = `http://127.0.0.1:${portA}/catalog`;
  const uriB = `http://127.0.0.1:${portB}/catalog`;
  console.log(`[test] fixture servers: A=${uriA}, B=${uriB}`);

  // Step 1 — load via loader
  const catA = await loadCatalogFromUri(uriA);
  const catB = await loadCatalogFromUri(uriB);
  console.log(
    `[test] loaded A: ${catA.seller} (${catA.items.length} items), B: ${catB.seller} (${catB.items.length} items)`,
  );

  // Step 2 — build index
  type Seller = { ens: string };
  const sellerA: Seller = { ens: "acme-cartoneria.openagents-treasury.eth" };
  const sellerB: Seller = { ens: "techsupply-mx.openagents-treasury.eth" };
  const index = buildSkuIndex<Seller>([
    { seller: sellerA, catalog: catA },
    { seller: sellerB, catalog: catB },
  ]);
  console.log(
    `[test] index has ${index.size} unique SKUs across 2 sellers:`,
  );
  for (const [sku, sellers] of index) {
    console.log(`  · ${sku} → ${sellers.map((s) => s.seller.ens).join(", ")}`);
  }

  // Step 3 — verify expected lookups
  const cases: Array<{ sku: string; expect: string[] }> = [
    { sku: "PAPEL-A4-RES", expect: ["acme-cartoneria.openagents-treasury.eth"] },
    { sku: "TINTA-NEG-XL", expect: ["techsupply-mx.openagents-treasury.eth"] },
    { sku: "MOUSE-LG-WL", expect: ["techsupply-mx.openagents-treasury.eth"] },
    { sku: "DOES-NOT-EXIST", expect: [] },
  ];
  let pass = 0;
  let fail = 0;
  for (const c of cases) {
    const got = (index.get(c.sku) ?? []).map((e) => e.seller.ens).sort();
    const want = [...c.expect].sort();
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) {
      console.log(`[test]   ✓ ${c.sku} → ${got.length === 0 ? "(none)" : got.join(", ")}`);
      pass += 1;
    } else {
      console.log(`[test]   ✗ ${c.sku} expected [${want}], got [${got}]`);
      fail += 1;
    }
  }

  // Step 4 — verify error path on bad URI
  let errored = false;
  try {
    await loadCatalogFromUri("ftp://nope.example/catalog.json");
  } catch (e) {
    console.log(`[test]   ✓ unsupported scheme rejected: ${(e as Error).message.slice(0, 60)}`);
    errored = true;
  }
  if (errored) pass += 1;
  else {
    console.log(`[test]   ✗ unsupported scheme did not throw`);
    fail += 1;
  }

  serverA.close();
  serverB.close();

  console.log(`[test] result: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("[test] failed:", e);
  process.exit(1);
});
