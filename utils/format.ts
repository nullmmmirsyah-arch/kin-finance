const formatter = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return formatter.format(value);
}

export function formatAmountInput(value: string): string {
  // Whole numbers only — strip sign, decimals, and non-digits; then add thousand separators.
  // This keeps client display aligned with `validateTransactionAmount` which rejects non-integers.
  const digits = value.replace(/[^0-9]/g, "");
  if (digits === "") return "";
  // Remove leading zeros but keep single zero
  const normalized = digits.replace(/^0+(?=\d)/, "");
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function sumNetExcludingTransfers(
  txs: { type: string; amount: number }[],
): number {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (tx.type === "income") income += tx.amount;
    else if (tx.type === "expense") expense += Math.abs(tx.amount);
  }
  return income - expense;
}
