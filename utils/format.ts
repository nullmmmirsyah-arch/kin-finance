const formatter = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return formatter.format(value);
}

export function formatAmountInput(value: string): string {
  // Whole numbers only — explicitly truncate decimals/signs, do not silently reinterpret.
  // "1.500" -> "1" (truncate after "."), not "1,500"; "12.34" -> "12"; "-12" -> "12".
  // Normal unsigned integers are formatted with thousand separators; validation surfaces errors.
  // Currency-aware: "Rp 1.250.000" preserves full value by normalizing grouping separators before decimal handling.
  const trimmed = value.trim();
  const isCurrency = /rp/i.test(trimmed);
  if (isCurrency) {
    const withoutRp = trimmed.replace(/^rp\s*/i, "").trim();
    // Preserve comma-grouped Rp 1,250,000 while still handling decimal comma 1.250,50
    const decimalMatch = withoutRp.match(/^(.*),(\d{1,2})\s*$/);
    const wholeCurrencyValue = decimalMatch ? decimalMatch[1] : withoutRp;
    const digits = wholeCurrencyValue.replace(/[^0-9]/g, "");
    if (digits === "") return "";
    const normalized = digits.replace(/^0+(?=\d)/, "");
    return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  const beforeDecimal = value.split(".")[0] ?? "";
  const digits = beforeDecimal.replace(/[^0-9]/g, "");
  if (digits === "") return "";
  const normalized = digits.replace(/^0+(?=\d)/, "");
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function wasDecimalTruncated(raw: string): boolean {
  return raw.includes(".");
}

export function detectAmountTruncation(
  raw: string,
  formatted: string,
): { truncated: boolean; reason: "decimal" | "nonDigit" | null } {
  if (raw.includes(".")) return { truncated: true, reason: "decimal" };
  const rawDigits = raw.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
  const formattedDigits = formatted.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
  if (rawDigits !== formattedDigits) return { truncated: true, reason: "nonDigit" };
  const rawNormalized = raw.replace(/,/g, "").replace(/^0+(?=\d)/, "");
  const formattedNormalized = formatted.replace(/,/g, "").replace(/^0+(?=\d)/, "");
  if (rawNormalized !== formattedNormalized) {
    return { truncated: true, reason: "nonDigit" };
  }
  return { truncated: false, reason: null };
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
