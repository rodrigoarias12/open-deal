import type { AccountingSource, CashState } from "./types.js";

type JsonRpcResponse<T> = { jsonrpc: "2.0"; id?: number; result?: T; error?: unknown };

export type OdooConfig = {
  url: string;
  db: string;
  username: string;
  /** Password or API key — Odoo treats them interchangeably for remote auth. */
  password: string;
};

export class OdooClient {
  private uid: number | null = null;

  constructor(private readonly cfg: OdooConfig) {}

  private async rpc<T>(service: string, method: string, args: unknown[]): Promise<T> {
    const res = await fetch(`${this.cfg.url}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: { service, method, args },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from Odoo`);
    const body = (await res.json()) as JsonRpcResponse<T>;
    if (body.error) throw new Error(`Odoo RPC error: ${JSON.stringify(body.error)}`);
    if (body.result === undefined) throw new Error("Odoo RPC returned no result");
    return body.result;
  }

  async authenticate(): Promise<number> {
    if (this.uid) return this.uid;
    const uid = await this.rpc<number | false>("common", "authenticate", [
      this.cfg.db,
      this.cfg.username,
      this.cfg.password,
      {},
    ]);
    if (!uid) throw new Error("Odoo authentication failed — check db/username/password");
    this.uid = uid;
    return uid;
  }

  async call<T = unknown>(
    model: string,
    method: string,
    args: unknown[] = [],
    kwargs: Record<string, unknown> = {},
  ): Promise<T> {
    const uid = await this.authenticate();
    return this.rpc<T>("object", "execute_kw", [
      this.cfg.db,
      uid,
      this.cfg.password,
      model,
      method,
      args,
      kwargs,
    ]);
  }
}

type OdooAccount = {
  id: number;
  code: string;
  name: string;
  account_type: string;
};

type OdooInvoice = {
  id: number;
  name: string;
  amount_residual_signed: number;
  move_type: string;
  payment_state: string;
};

type OdooMoveLine = {
  id: number;
  date: string;
  debit: number;
  credit: number;
};

type OdooCompany = {
  id: number;
  name: string;
  currency_id: [number, string];
};

export class OdooSource implements AccountingSource {
  readonly name = "odoo";

  constructor(private readonly client: OdooClient) {}

  private async companyCurrency(): Promise<string> {
    const companies = await this.client.call<OdooCompany[]>(
      "res.company",
      "search_read",
      [[]],
      { fields: ["id", "name", "currency_id"], limit: 1 },
    );
    return companies[0]?.currency_id?.[1] ?? "EUR";
  }

  private async sumCashIdle(): Promise<number> {
    const accounts = await this.client.call<OdooAccount[]>(
      "account.account",
      "search_read",
      [[["account_type", "=", "asset_cash"]]],
      { fields: ["id", "code", "name"], limit: 100 },
    );
    if (accounts.length === 0) return 0;
    const ids = accounts.map((a) => a.id);
    const lines = await this.client.call<OdooMoveLine[]>(
      "account.move.line",
      "search_read",
      [[
        ["account_id", "in", ids],
        ["parent_state", "=", "posted"],
      ]],
      { fields: ["debit", "credit"], limit: 50000 },
    );
    return lines.reduce((s, l) => s + l.debit - l.credit, 0);
  }

  private async sumPendingInvoices(): Promise<number> {
    const invoices = await this.client.call<OdooInvoice[]>(
      "account.move",
      "search_read",
      [[
        ["move_type", "in", ["out_invoice", "in_invoice"]],
        ["payment_state", "in", ["not_paid", "partial"]],
        ["state", "=", "posted"],
      ]],
      { fields: ["id", "name", "amount_residual_signed", "move_type", "payment_state"], limit: 1000 },
    );
    return invoices.reduce((s, i) => s + Math.abs(i.amount_residual_signed || 0), 0);
  }

  private async monthlyBurn(): Promise<number> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    const expenseLines = await this.client.call<OdooMoveLine[]>(
      "account.move.line",
      "search_read",
      [[
        ["account_id.account_type", "in", ["expense", "expense_depreciation", "expense_direct_cost"]],
        ["date", ">=", start],
        ["date", "<=", end],
        ["parent_state", "=", "posted"],
      ]],
      { fields: ["debit", "credit"], limit: 50000 },
    );
    return expenseLines.reduce((s, l) => s + l.debit - l.credit, 0);
  }

  async fetch(): Promise<CashState> {
    const [currency, cash, pending, burn] = await Promise.all([
      this.companyCurrency().catch(() => "EUR"),
      this.sumCashIdle().catch(() => 0),
      this.sumPendingInvoices().catch(() => 0),
      this.monthlyBurn().catch(() => 0),
    ]);
    return {
      currency,
      cash_idle: Math.round(cash),
      pending_invoices: Math.round(pending),
      monthly_burn: Math.round(burn),
    };
  }
}
