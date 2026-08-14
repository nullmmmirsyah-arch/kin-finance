const formatter = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return formatter.format(value);
}

export function formatAmountInput(value: string): string {
  const isNegative = value.startsWith("-");
  const rest = isNegative ? value.slice(1) : value;
  const intDigits = rest.replace(/[^0-9]/g, "");
  const formatted = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (formatted === "") return isNegative ? "-" : "";
  return isNegative ? `-${formatted}` : formatted;
}
