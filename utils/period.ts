import { formatMonthLabel, getMonthBounds } from "./date";

export type PeriodType = "monthly" | "weekly" | "yearly";
export type BalanceMode = "fresh" | "carryOver";

export const PERIOD_TYPES = ["monthly", "weekly", "yearly"] as const;
export const BALANCE_MODES = ["fresh", "carryOver"] as const;

function zonedParts(ts: number, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ts));
  const result: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] = Number(part.value);
    }
  }
  return result;
}

function zonedOffsetMs(ts: number, timeZone: string): number {
  const p = zonedParts(ts, timeZone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - ts;
}

function zonedWallToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): number {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  let ts = naive - zonedOffsetMs(naive, timeZone);
  ts = naive - zonedOffsetMs(ts, timeZone);
  return ts;
}

export function getWeekBounds(ts: number, tz: string): { start: number; end: number } {
  const p = zonedParts(ts, tz);
  // Determine weekday for the wall date (Mon-Sun)
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(ts));
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const daysSinceMonday = map[wd] ?? 0;
  // Wall date midnight as UTC date for arithmetic
  const wallUtc = Date.UTC(p.year, p.month - 1, p.day);
  const d = new Date(wallUtc);
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  const mondayYear = d.getUTCFullYear();
  const mondayMonth = d.getUTCMonth() + 1;
  const mondayDay = d.getUTCDate();
  const start = zonedWallToUtc(mondayYear, mondayMonth, mondayDay, 0, 0, 0, tz);
  // Add 7 days to wall date
  const next = new Date(wallUtc);
  next.setUTCDate(next.getUTCDate() - daysSinceMonday + 7);
  const ny = next.getUTCFullYear();
  const nm = next.getUTCMonth() + 1;
  const nd = next.getUTCDate();
  const end = zonedWallToUtc(ny, nm, nd, 0, 0, 0, tz);
  return { start, end };
}

export function getYearBounds(ts: number, tz: string): { start: number; end: number } {
  const p = zonedParts(ts, tz);
  const start = zonedWallToUtc(p.year, 1, 1, 0, 0, 0, tz);
  const end = zonedWallToUtc(p.year + 1, 1, 1, 0, 0, 0, tz);
  return { start, end };
}

export function getPeriodBounds(
  ts: number,
  tz: string,
  type: PeriodType,
): { start: number; end: number } {
  switch (type) {
    case "monthly":
      return getMonthBounds(ts, tz);
    case "weekly":
      return getWeekBounds(ts, tz);
    case "yearly":
      return getYearBounds(ts, tz);
  }
}

export function getPrevPeriod(start: number, tz: string, type: PeriodType): number {
  return getPeriodBounds(start - 1, tz, type).start;
}

export function getNextPeriod(start: number, tz: string, type: PeriodType): number {
  return getPeriodBounds(start, tz, type).end;
}

export function formatPeriodLabel(start: number, tz: string, type: PeriodType): string {
  if (type === "monthly") return formatMonthLabel(start, tz);
  if (type === "yearly")
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric" }).format(new Date(start));
  // weekly
  const b = getPeriodBounds(start, tz, "weekly");
  const startLabel = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric" }).format(
    new Date(b.start),
  );
  const endLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(b.end - 1));
  return `${startLabel} – ${endLabel}`;
}

export function buildPeriodWindow(
  now: number,
  tz: string,
  type: PeriodType,
  count: number,
): { startDate: number; endDate: number; periods: { periodStart: number; label: string }[] } {
  let start = getPeriodBounds(now, tz, type).start;
  for (let i = 1; i < count; i++) start = getPrevPeriod(start, tz, type);
  const periods: { periodStart: number; label: string }[] = [];
  let cur = start;
  for (let i = 0; i < count; i++) {
    periods.push({ periodStart: cur, label: formatPeriodLabel(cur, tz, type) });
    cur = getNextPeriod(cur, tz, type);
  }
  return { startDate: start, endDate: cur, periods };
}

export function validatePeriodType(v: string | undefined): string | null {
  if (v === undefined) return null;
  if (!(PERIOD_TYPES as readonly string[]).includes(v)) return "Period type must be monthly, weekly, or yearly.";
  return null;
}

export function validateBalanceMode(v: string | undefined): string | null {
  if (v === undefined) return null;
  if (!(BALANCE_MODES as readonly string[]).includes(v)) return "Balance mode must be fresh or carryOver.";
  return null;
}
