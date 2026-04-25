import "dotenv/config";
import { requireEnv } from "../src/config";
import { OdooClient, OdooSource } from "../src/sources/odoo";

async function main() {
  const client = new OdooClient({
    url: requireEnv("ODOO_URL"),
    db: requireEnv("ODOO_DB"),
    username: requireEnv("ODOO_USERNAME"),
    password: requireEnv("ODOO_PASSWORD"),
  });

  console.log("[odoo] authenticating...");
  const uid = await client.authenticate();
  console.log(`[odoo] authenticated, uid=${uid}`);

  const version = await client["rpc" as keyof OdooClient].call(
    client,
    "common",
    "version",
    [],
  );
  console.log(`[odoo] server version: ${JSON.stringify(version)}`);

  console.log("\n[odoo] inspecting instance data...");
  const accounts = await client.call<{ id: number; code: string; name: string; account_type: string }[]>(
    "account.account",
    "search_read",
    [[]],
    { fields: ["id", "code", "name", "account_type"], limit: 10 },
  );
  console.log(`[odoo] found ${accounts.length} accounts (first 10):`);
  for (const a of accounts) {
    console.log(`  ${a.code.padEnd(10)} ${a.account_type.padEnd(22)} ${a.name}`);
  }

  const invCount = await client.call<number>(
    "account.move",
    "search_count",
    [[["move_type", "in", ["out_invoice", "in_invoice"]]]],
  );
  console.log(`\n[odoo] total invoices in system: ${invCount}`);

  console.log("\n[odoo] running OdooSource.fetch() to simulate agent call...");
  const source = new OdooSource(client);
  const state = await source.fetch();
  console.log(`[odoo] CashState:`, state);
}

main().catch((e) => {
  console.error("[odoo] FAILED:", (e as Error).message);
  process.exit(1);
});
