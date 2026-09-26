import type { TransactionType } from "@/constants/transactions";

export type AccountSide = "single" | "from" | "to";

export interface ProjectAccountInput {
  balance: number;
  type: TransactionType;
  side: AccountSide;
  /** Absolute typed amount; null/zero/non-finite means "no projection, show raw balance". */
  amount: number | null;
  /** Absolute old amount (|editingTx.amount|); only used when isSameAccount is true. */
  oldAbsAmount?: number;
  /** Selected account is the old transaction's account for this side. */
  isSameAccount?: boolean;
}

function sideSign(type: TransactionType, side: AccountSide): number {
  if (type === "expense") return -1;
  if (type === "income") return 1;
  return side === "from" ? -1 : 1;
}

export function projectAccountBalance(input: ProjectAccountInput): number {
  const { balance, type, side, amount } = input;
  if (amount === null || !Number.isFinite(amount) || amount <= 0) return balance;
  const sign = sideSign(type, side);
  if (input.isSameAccount === true && input.oldAbsAmount !== undefined) {
    return balance + sign * (amount - input.oldAbsAmount);
  }
  return balance + sign * amount;
}

export interface ProjectBudgetInput {
  budgetAmount: number;
  spent: number;
  /** Absolute typed amount; null/zero/non-finite means "show current remaining". */
  amount: number | null;
  /** Absolute old amount (|editingTx.amount|); only used when isSameCategory is true. */
  oldAbsAmount?: number;
  /** Selected category is the old transaction's expense category. */
  isSameCategory?: boolean;
}

export function projectBudgetRemaining(input: ProjectBudgetInput): number {
  const { budgetAmount, spent, amount } = input;
  const effectiveSpent =
    input.isSameCategory === true && input.oldAbsAmount !== undefined
      ? spent - input.oldAbsAmount
      : spent;
  const current = budgetAmount - effectiveSpent;
  if (amount === null || !Number.isFinite(amount) || amount <= 0) return current;
  return current - amount;
}
