export type CashState = {
  cash_idle_eur: number;
  pending_invoices_eur: number;
  monthly_burn_eur: number;
};

export interface AccountingSource {
  readonly name: string;
  fetch(): Promise<CashState>;
}
