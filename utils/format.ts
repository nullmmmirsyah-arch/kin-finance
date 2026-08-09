const formatter = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return formatter.format(value);
}

export function formatAmountInput(value: string): string {
  const isNegative = value.startsWith("-");
  const digits = value.replace(/[^0-9]/g, "");
  if (digits === "") return isNegative ? "-" : "";
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return isNegative ? `-${formatted}` : formatted;
}
