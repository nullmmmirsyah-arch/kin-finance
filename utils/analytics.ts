// buildSixMonthWindow is duplicate of window(...,6) — deep Period module owns it.
// Keep shim for backward compat; new code should use window(now,tz,6) from @/utils/periodTime.
import { buildSixMonthWindow as _buildSixMonthWindow } from "./periodTime";
export const buildSixMonthWindow = _buildSixMonthWindow;

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
