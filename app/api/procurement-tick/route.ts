import "dotenv/config";
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { runProcurementTick } from "../../../apps/buyer-agent/src/index";

// One full procurement tick (RFQ → quote → policy → escrow → audit → ERP
// writeback) runs ~30-60s end-to-end on Sepolia + 0G + Odoo. Vercel
// hobby caps at 60s, pro at 300s. Set max generously.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Persist the latest tick to disk so /dashboard and the landing #demo
// panel can show "last live run · X ago" without re-running it.
async function persistLatest(result: unknown): Promise<void> {
  try {
    const dir = path.join(process.cwd(), ".cache");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "latest-procurement-tick.json"),
      JSON.stringify(result, null, 2),
      "utf8",
    );
  } catch {
    // Read-only filesystem in some Vercel environments — non-fatal.
  }
}

export async function POST() {
  try {
    const result = await runProcurementTick();
    await persistLatest(result);
    return NextResponse.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Cron-friendly GET (Vercel cron uses GET by default).
export async function GET() {
  try {
    const result = await runProcurementTick();
    await persistLatest(result);
    return NextResponse.json({ ok: true, summary: result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
