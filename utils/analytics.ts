import { getMonthBounds, formatMonthLabel } from "./date";

export function buildSixMonthWindow(
  now: number,
  timezone: string,
): { startDate: number; endDate: number; months: Array<{ periodStart: number; label: string }> } {
  const cur = getMonthBounds(now, timezone);
  let start = cur.start;
  for (let i = 0; i < 5; i++) {
    start = getMonthBounds(start - 1, timezone).start;
  }
  const months: Array<{ periodStart: number; label: string }> = [];
  let cursor = start;
  for (let i = 0; i < 6; i++) {
    months.push({ periodStart: cursor, label: formatMonthLabel(cursor, timezone) });
    cursor = getMonthBounds(cursor, timezone).end;
  }
  return { startDate: start, endDate: cur.end, months };
}

export function calcDelta(
  currentNet: number,
  prevNet: number,
  periodNoun: string = "month",
): { deltaPct: number | null; label: string } {
  if (prevNet === 0) return { deltaPct: null, label: currentNet === 0 ? "No change" : `New this ${periodNoun}` };
  const deltaPct = ((currentNet - prevNet) / Math.abs(prevNet)) * 100;
  return { deltaPct, label: `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}% vs last ${periodNoun}` };
}

export function maxBarValue(data: Array<{ income: number; expense: number }>): number {
  return Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
}
