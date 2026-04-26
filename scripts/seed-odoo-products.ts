/**
 * Seeds the demo Odoo (edu-paydece-lite.odoo.com) with realistic
 * procurement products so the buyer's "low stock from Odoo" claim
 * stops being a fixture fallback.
 *
 * Strategy:
 *  1. Authenticate, dump instance metadata (version, modules, product count)
 *  2. Probe what fields exist on product.product (does the stock module
 *     give us qty_available?)
 *  3. Create products with our demo SKUs
 *  4. If stock module is installed: also push stock.quant records to
 *     simulate low stock
 *  5. If not: set list_price and a custom ".reorder_threshold" tag
 *     in `description` so the buyer reader can match it
 *
 * Idempotent: skips products whose default_code already exists.
 */
import "dotenv/config";
import { OdooClient } from "../src/sources/odoo";
import { requireEnv } from "../src/config";

const SKUS = [
  {
    sku: "PAPEL-A4-RES",
    name: "Papel A4 (resma 500h, 75g)",
    list_price: 8.5,
    currency: "USD",
    qty_to_seed: 2, // below the buyer's threshold of 5 → triggers low-stock
  },
  {
    sku: "CARTON-CAJA-30",
    name: "Caja cartón corrugado 30x20x15",
    list_price: 1.5,
    currency: "USD",
    qty_to_seed: 3,
  },
  {
    sku: "TINTA-NEG-XL",
    name: "Cartucho tinta negra XL",
    list_price: 22.0,
    currency: "USD",
    qty_to_seed: 1,
  },
  {
    sku: "SOBRES-MAN-25",
    name: "Sobres manila 25 (pack 100)",
    list_price: 5.0,
    currency: "USD",
    qty_to_seed: 4,
  },
  {
    sku: "CINTA-EMB-50M",
    name: "Cinta embalaje 50m transparente",
    list_price: 4.0,
    currency: "USD",
    qty_to_seed: 8, // above threshold — won't trigger
  },
];

async function main(): Promise<void> {
  const client = new OdooClient({
    url: requireEnv("ODOO_URL"),
    db: requireEnv("ODOO_DB"),
    username: requireEnv("ODOO_USERNAME"),
    password: requireEnv("ODOO_PASSWORD"),
  });

  console.log("[seed] authenticating…");
  const uid = await client.authenticate();
  console.log(`[seed] uid=${uid}`);

  console.log("\n[seed] checking key modules…");
  type Module = { name: string; state: string };
  const modules = await client.call<Module[]>(
    "ir.module.module",
    "search_read",
    [[["name", "in", ["stock", "product", "sale", "purchase", "account"]]]],
    { fields: ["name", "state"] },
  );
  for (const m of modules) {
    console.log(`  ${m.name.padEnd(12)} ${m.state}`);
  }
  const stockInstalled = modules.some((m) => m.name === "stock" && m.state === "installed");
  console.log(`  → stock module installed: ${stockInstalled}`);

  console.log("\n[seed] probing product.product fields…");
  type FieldDef = { name: string; type: string; readonly: boolean };
  const allFields = await client.call<Record<string, { type: string; readonly: boolean }>>(
    "product.product",
    "fields_get",
    [],
    { attributes: ["type", "readonly"] },
  );
  const interestingFields = ["default_code", "name", "list_price", "qty_available", "sale_ok", "type", "active", "description_purchase"];
  for (const f of interestingFields) {
    const def = allFields[f];
    if (def) console.log(`  ${f.padEnd(22)} type=${def.type} readonly=${def.readonly}`);
    else console.log(`  ${f.padEnd(22)} (missing)`);
  }

  console.log("\n[seed] counting existing products…");
  const totalProducts = await client.call<number>("product.product", "search_count", [[]]);
  console.log(`  total: ${totalProducts}`);

  console.log("\n[seed] creating / updating SKUs…");
  for (const item of SKUS) {
    type Existing = { id: number; default_code: string | false; name: string };
    const existing = await client.call<Existing[]>(
      "product.product",
      "search_read",
      [[["default_code", "=", item.sku]]],
      { fields: ["id", "default_code", "name"], limit: 1 },
    );
    // Odoo 19: only `consu`, `service`, `combo` are valid for `type`.
    // Storability is now its own boolean (`is_storable`). To attach
    // stock.quant we need a "Goods" product with is_storable=true.
    const baseVals = {
      list_price: item.list_price,
      name: item.name,
      sale_ok: true,
      active: true,
      type: "consu" as const,
      ...(stockInstalled ? { is_storable: true } : {}),
    };
    if (existing.length > 0) {
      console.log(`  · ${item.sku} exists (id ${existing[0].id}), updating…`);
      await client.call("product.product", "write", [[existing[0].id], baseVals]);
    } else {
      const id = await client.call<number>("product.product", "create", [
        {
          default_code: item.sku,
          purchase_ok: true,
          ...baseVals,
        },
      ]);
      console.log(`  ✓ ${item.sku} created (id ${id})`);
    }
  }

  if (stockInstalled) {
    console.log("\n[seed] pushing low-stock quants for each SKU…");
    type StockLoc = { id: number; name: string; usage: string };
    const internalLocs = await client.call<StockLoc[]>(
      "stock.location",
      "search_read",
      [[["usage", "=", "internal"]]],
      { fields: ["id", "name", "usage"], limit: 1 },
    );
    if (internalLocs.length === 0) {
      console.log("  (no internal stock location — skipping quant seed)");
    } else {
      const locId = internalLocs[0].id;
      console.log(`  using location ${locId} (${internalLocs[0].name})`);
      for (const item of SKUS) {
        type ProdRef = { id: number };
        const prod = await client.call<ProdRef[]>(
          "product.product",
          "search_read",
          [[["default_code", "=", item.sku]]],
          { fields: ["id"], limit: 1 },
        );
        if (prod.length === 0) continue;
        // Use an inventory adjustment via stock.quant directly (Odoo 17+)
        type QuantRef = { id: number };
        const existingQ = await client.call<QuantRef[]>(
          "stock.quant",
          "search_read",
          [[["product_id", "=", prod[0].id], ["location_id", "=", locId]]],
          { fields: ["id"], limit: 1 },
        );
        if (existingQ.length > 0) {
          await client.call("stock.quant", "write", [
            [existingQ[0].id],
            { quantity: item.qty_to_seed, inventory_quantity: item.qty_to_seed },
          ]);
          console.log(`  · ${item.sku} → quant updated to ${item.qty_to_seed}`);
        } else {
          const qid = await client.call<number>("stock.quant", "create", [
            {
              product_id: prod[0].id,
              location_id: locId,
              quantity: item.qty_to_seed,
              inventory_quantity: item.qty_to_seed,
            },
          ]);
          console.log(`  ✓ ${item.sku} → quant ${qid} = ${item.qty_to_seed}`);
        }
      }
    }
  } else {
    console.log("\n[seed] stock module NOT installed — skipping quants.");
    console.log("  The buyer agent's OdooInventorySource will need a fallback");
    console.log("  signal: list_price + tag in description, or external trigger.");
  }

  console.log("\n[seed] verifying via the inventory-source query the buyer uses…");
  type ProductRow = {
    id: number;
    default_code: string | false;
    name: string;
    qty_available?: number;
    list_price?: number;
  };
  const rows = await client.call<ProductRow[]>(
    "product.product",
    "search_read",
    [[["default_code", "in", SKUS.map((s) => s.sku)]]],
    { fields: ["id", "default_code", "name", "qty_available", "list_price"] },
  );
  for (const r of rows) {
    console.log(`  ${(r.default_code || "?").padEnd(18)} qty_available=${r.qty_available ?? "n/a"}  list_price=${r.list_price ?? "?"}`);
  }
  console.log("\n[seed] OK ✓");
}

main().catch((e) => {
  console.error("[seed] failed:", e);
  process.exit(1);
});
