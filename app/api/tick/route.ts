import "dotenv/config";
import { NextResponse } from "next/server";
import { runTick } from "../../../src/agent/core";
import { logTick } from "../../../src/audit/logger";
import { CsvSource } from "../../../src/sources/csv";
import { OdooClient, OdooSource } from "../../../src/sources/odoo";
import { env } from "../../../src/config";
import type { AccountingSource } from "../../../src/sources/types";

export const dynamic = "force-dynamic";

function pickSource(): AccountingSource {
  if (env("ODOO_URL") && env("ODOO_DB") && env("ODOO_USERNAME") && env("ODOO_PASSWORD")) {
    return new OdooSource(
      new OdooClient({
        url: env("ODOO_URL")!,
        db: env("ODOO_DB")!,
        username: env("ODOO_USERNAME")!,
        password: env("ODOO_PASSWORD")!,
      }),
    );
  }
  return new CsvSource("fixtures/company.csv");
}

export async function POST() {
  try {
    const source = pickSource();
    const tick = await runTick(source);
    const path = await logTick(tick);
    return NextResponse.json({ tick, auditPath: path });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
