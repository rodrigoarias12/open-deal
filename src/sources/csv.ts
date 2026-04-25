import { readFile } from "node:fs/promises";
import type { AccountingSource, CashState } from "./types.js";

export class CsvSource implements AccountingSource {
  readonly name = "csv";

  constructor(private readonly path: string) {}

  async fetch(): Promise<CashState> {
    const raw = await readFile(this.path, "utf8");
    const rows = raw
      .trim()
      .split("\n")
      .slice(1)
      .map((line) => line.split(","));

    const get = (key: string): number => {
      const row = rows.find((r) => r[0] === key);
      if (!row) throw new Error(`Missing row in CSV: ${key}`);
      return Number(row[1]);
    };

    return {
      currency: "EUR",
      cash_idle: get("cash_idle"),
      pending_invoices: get("pending_invoices"),
      monthly_burn: get("monthly_burn"),
    };
  }
}
