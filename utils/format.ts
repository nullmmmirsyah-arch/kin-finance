const formatter = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return formatter.format(value);
}

export function formatAmountInput(value: string): string {
  // Whole numbers only — explicitly truncate decimals/signs, do not silently reinterpret.
  // "1.500" -> "1" (truncate after "."), not "1,500"; "12.34" -> "12"; "-12" -> "12".
  // Normal unsigned integers are formatted with thousand separators; validation surfaces errors.
  const beforeDecimal = value.split(".")[0] ?? "";
  const digits = beforeDecimal.replace(/[^0-9]/g, "");
  if (digits === "") return "";
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
