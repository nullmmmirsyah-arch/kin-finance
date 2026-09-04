import type { AccountType } from "./accounts";
export const ACCOUNT_STREAMLINE_MAP: Record<AccountType, string> = {
  bank: "saving-bank-1",
  cash: "cash-payment-bill",
  ewallet: "wireless-payment-credit-card-dollar",
  credit_card: "credit-card-1",
};
export function isAccountType(x: string): x is AccountType {
  return (["bank", "cash", "ewallet", "credit_card"] as string[]).includes(x);
}
export function getAccountIconName(type?: string): string {
  if (type && isAccountType(type)) return ACCOUNT_STREAMLINE_MAP[type];
  return ACCOUNT_STREAMLINE_MAP.bank;
}
