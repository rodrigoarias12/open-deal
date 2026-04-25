import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Tick } from "../agent/core.js";

const AUDIT_DIR = "audit";

export async function logTick(tick: Tick): Promise<string> {
  await mkdir(AUDIT_DIR, { recursive: true });
  const safeStamp = tick.at.replace(/[:.]/g, "-");
  const path = join(AUDIT_DIR, `${safeStamp}.json`);
  await writeFile(path, JSON.stringify(tick, null, 2));
  return path;
}
