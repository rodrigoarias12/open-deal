export type CashState = {
  currency: string;
  cash_idle: number;
  pending_invoices: number;
  monthly_burn: number;
};

export interface AccountingSource {
  readonly name: string;
  fetch(): Promise<CashState>;
}
