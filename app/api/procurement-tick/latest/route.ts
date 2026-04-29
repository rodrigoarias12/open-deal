import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const file = path.join(process.cwd(), ".cache", "latest-procurement-tick.json");
    const json = await readFile(file, "utf8");
    return NextResponse.json(JSON.parse(json), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "no procurement tick has been recorded yet" },
      { status: 404 },
    );
  }
}
