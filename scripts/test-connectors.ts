import "dotenv/config";
import { pickBuyerConnector } from "../src/connectors/buyer/factory";
import { pickSellerConnector } from "../src/connectors/seller/factory";

async function testBuyer(label: string, env: Record<string, string | undefined>): Promise<void> {
  console.log(`\n=== buyer · ${label} ===`);
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const c = await pickBuyerConnector();
  console.log(`  connector: ${c.id} — ${c.name}`);
  try {
    const needs = await c.readNeeds();
    console.log(`  ${needs.length} need(s)`);
    for (const n of needs.slice(0, 3))
      console.log(`    · ${n.sku} stock=${n.current_stock} order=${n.quantity} src=${n.source}`);
  } catch (e) {
    console.log(`  read error: ${(e as Error).message}`);
  }
}

async function testSeller(label: string, env: Record<string, string | undefined>): Promise<void> {
  console.log(`\n=== seller · ${label} ===`);
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const c = await pickSellerConnector();
  console.log(`  connector: ${c.id} — ${c.name}`);
  try {
    const cat = await c.loadCatalog();
    console.log(`  ${cat.items.length} item(s) (currency ${cat.currency})`);
    for (const item of cat.items.slice(0, 3))
      console.log(`    · ${item.sku} $${item.unit_price_usd}/u stock=${item.stock} ${item.delivery_days}d`);
  } catch (e) {
    console.log(`  read error: ${(e as Error).message}`);
  }
}

async function main(): Promise<void> {
  // Buyer side
  await testBuyer("auto (env-driven, expects odoo)", {});
  await testBuyer("excel forced", {
    BUYER_CONNECTOR: "excel",
    BUYER_NEEDS_XLSX: "fixtures/buyer/needs.xlsx",
  });
  await testBuyer("sap stub forced", { BUYER_CONNECTOR: "sap" });
  await testBuyer("mock fallback", {
    BUYER_CONNECTOR: undefined,
    ODOO_URL: "",
    ODOO_DB: "",
    BUYER_NEEDS_XLSX: undefined,
  });

  // Seller side — reset env for clean tests
  await testSeller("json default", {
    SELLER_CONNECTOR: undefined,
    SELLER_CATALOG_PATH: "apps/seller-agent/catalog.json",
    SELLER_CATALOG_XLSX: undefined,
    SHOPIFY_STORE: undefined,
    ML_USER_ID: undefined,
  });
  await testSeller("excel forced", {
    SELLER_CONNECTOR: "excel",
    SELLER_CATALOG_XLSX: "fixtures/sellers/papelera-del-sur.xlsx",
    SELLER_NAME: "Papelera del Sur",
  });
  await testSeller("shopify stub forced", { SELLER_CONNECTOR: "shopify" });
  await testSeller("mercadolibre stub forced", { SELLER_CONNECTOR: "mercadolibre" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
