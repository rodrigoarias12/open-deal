import "dotenv/config";
import { requireEnv } from "../src/config";

const url = requireEnv("ODOO_URL");
const login = requireEnv("ODOO_USERNAME");
const password = requireEnv("ODOO_PASSWORD");

// Pass candidates via CLI: `tsx scripts/probe-odoo.ts db1 db2 db3`
// or via env: ODOO_DB_CANDIDATES="db1,db2,db3"
// Falls back to deriving common patterns from the ODOO_URL hostname.
const dbCandidates: string[] = (() => {
  const fromArgs = process.argv.slice(2);
  if (fromArgs.length) return fromArgs;
  const fromEnv = process.env.ODOO_DB_CANDIDATES;
  if (fromEnv) return fromEnv.split(",").map((s) => s.trim()).filter(Boolean);
  const host = new URL(url).hostname;
  const sub = host.split(".")[0];
  return [sub, host, sub.replace(/-/g, "_")];
})();

type AuthResp = { result?: { uid?: number; db?: string; username?: string }; error?: unknown };

async function tryWebSession(db: string): Promise<string> {
  const res = await fetch(`${url}/web/session/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", params: { db, login, password } }),
  });
  const body = (await res.json()) as AuthResp;
  if (body.result?.uid) return `OK uid=${body.result.uid} db=${body.result.db}`;
  if (body.error) return `ERR ${JSON.stringify(body.error).slice(0, 200)}`;
  return `UNKNOWN ${JSON.stringify(body).slice(0, 200)}`;
}

async function tryJsonRpc(db: string): Promise<string> {
  const res = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service: "common", method: "authenticate", args: [db, login, password, {}] },
    }),
  });
  const body = (await res.json()) as { result?: number | false; error?: unknown };
  if (body.result) return `OK uid=${body.result}`;
  if (body.error) return `ERR ${JSON.stringify(body.error).slice(0, 200)}`;
  return `UNKNOWN (result=${body.result})`;
}

async function main() {
  console.log(`probing ${url}`);
  for (const db of dbCandidates) {
    const a = await tryWebSession(db);
    const b = await tryJsonRpc(db);
    console.log(`db='${db}'`);
    console.log(`  /web/session/authenticate: ${a}`);
    console.log(`  /jsonrpc (common.auth):    ${b}`);
  }
}

main().catch(console.error);
