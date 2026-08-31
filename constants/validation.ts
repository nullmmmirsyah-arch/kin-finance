export const ACCOUNT_NAME_MIN = 2;
export const ACCOUNT_NAME_MAX = 30;
export const CATEGORY_NAME_MIN = 2;
export const CATEGORY_NAME_MAX = 30;
export const HOUSEHOLD_NAME_MIN = 3;
export const HOUSEHOLD_NAME_MAX = 50;
export const NOTE_MAX_LENGTH = 200;
export const AMOUNT_MIN_ABS = 1;
export const BUDGET_AMOUNT_MIN = 1;
export const INVITE_CODE_LENGTH = 8;
export const INVITE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export type TransactionType = "income" | "expense" | "transfer";

export function validateAccountName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Account name is required.";
  if (trimmed.length < ACCOUNT_NAME_MIN)
    return `Account name must be at least ${ACCOUNT_NAME_MIN} characters.`;
  if (trimmed.length > ACCOUNT_NAME_MAX)
    return `Account name must be at most ${ACCOUNT_NAME_MAX} characters.`;
  return null;
}

export function validateCategoryName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Category name is required.";
  if (trimmed.length < CATEGORY_NAME_MIN)
    return `Category name must be at least ${CATEGORY_NAME_MIN} characters.`;
  if (trimmed.length > CATEGORY_NAME_MAX)
    return `Category name must be at most ${CATEGORY_NAME_MAX} characters.`;
  return null;
}

export function validateHouseholdName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Household name is required.";
  if (trimmed.length < HOUSEHOLD_NAME_MIN)
    return `Household name must be at least ${HOUSEHOLD_NAME_MIN} characters.`;
  if (trimmed.length > HOUSEHOLD_NAME_MAX)
    return `Household name must be at most ${HOUSEHOLD_NAME_MAX} characters.`;
  return null;
}

export function validateNote(note: string | undefined): string | null {
  if (note !== undefined && note.length > NOTE_MAX_LENGTH)
    return `Note must be at most ${NOTE_MAX_LENGTH} characters.`;
  return null;
}

export function validateTransactionAmount(
  amount: number,
  type: TransactionType,
): string | null {
  if (!Number.isFinite(amount)) return "Amount must be a finite number.";
  if (!Number.isSafeInteger(amount)) return "Amount must be a whole number.";
  if (amount === 0) return "Amount must be a non-zero number.";
  if (type === "income" && amount <= 0)
    return "Amount must be positive for income transactions.";
  if (type === "expense" && amount >= 0)
    return "Amount must be negative for expense transactions.";
  if (type === "transfer" && amount <= 0)
    return "Amount must be positive for transfers.";
  if (Math.abs(amount) < AMOUNT_MIN_ABS)
    return `Amount must be at least ${AMOUNT_MIN_ABS}.`;
  return null;
}

export function validateTransactionDate(date: number): string | null {
  if (!Number.isFinite(date)) return "Date must be a valid timestamp.";
  if (date > Date.now()) return "Transaction date cannot be in the future.";
  return null;
}

export function validateBudgetAmount(amount: number): string | null {
  if (!Number.isFinite(amount)) return "Amount must be a valid number.";
  if (!Number.isSafeInteger(amount)) return "Amount must be a whole number.";
  if (amount < BUDGET_AMOUNT_MIN)
    return `Amount must be at least ${BUDGET_AMOUNT_MIN}.`;
  return null;
}

export function validateInviteCode(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  if (normalized.length !== INVITE_CODE_LENGTH)
    return `Invite code must be ${INVITE_CODE_LENGTH} characters.`;
  for (const ch of normalized) {
    if (!INVITE_CHARSET.includes(ch))
      return "Invite code contains invalid characters.";
  }
  return null;
}

// Validates an IANA timezone identifier. `undefined` is allowed (an absent
// timezone means "match device", resolved at runtime); a provided value must
// be a real IANA identifier, otherwise it would crash `Intl.DateTimeFormat`
// calls on every screen. Rejects empty strings and non-zone strings alike.
export function validateTimezone(timezone: string | undefined): string | null {
  if (timezone === undefined) return null;
  try {
    // Throws RangeError for unknown identifiers on Node and Hermes.
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    return "Timezone must be a valid IANA timezone identifier.";
  }
  return null;
}

export const PERIOD_TYPES = ["monthly", "weekly", "yearly"] as const;
export type PeriodType = (typeof PERIOD_TYPES)[number];
export const BALANCE_MODES = ["fresh", "carryOver"] as const;
export type BalanceMode = (typeof BALANCE_MODES)[number];
export function validatePeriodType(v: string | undefined): string | null {
  if (v === undefined) return null;
  if (!PERIOD_TYPES.includes(v as PeriodType)) return "Period type must be monthly, weekly, or yearly.";
  return null;
}
export function validateBalanceMode(v: string | undefined): string | null {
  if (v === undefined) return null;
  if (!BALANCE_MODES.includes(v as BalanceMode)) return "Balance mode must be fresh or carryOver.";
  return null;
}
