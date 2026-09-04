import { validateTimezone as _validateTimezone } from "@/constants/validation";

export type PeriodType = "monthly" | "weekly" | "yearly";
export type BalanceMode = "fresh" | "carryOver";
export const PERIOD_TYPES = ["monthly", "weekly", "yearly"] as const;
export const BALANCE_MODES = ["fresh", "carryOver"] as const;

export type Bounds = { start: number; end: number };
export type Period = Bounds & {
  readonly type: PeriodType;
  readonly timezone: string;
  readonly label: string;
  readonly prev: Period;
  readonly next: Period;
  readonly contains: (ts: number) => boolean;
};
export type Window = { startDate: number; endDate: number; periods: { periodStart: number; label: string }[] };

// ── private wall-clock helpers (single source, DST double-iteration) ──

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
    if (part.type !== "literal") result[part.type] = Number(part.value);
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
export function getYearMonth(ts: number, timeZone: string): { year: number; month: number } {
  const p = zonedParts(ts, timeZone);
  return { year: p.year, month: p.month };
}
function zonedMonthStart(year: number, month: number, timeZone: string): number {
  return zonedWallToUtc(year, month, 1, 0, 0, 0, timeZone);
}
function getMonthBounds(ts: number, timeZone: string): Bounds {
  const { year, month } = getYearMonth(ts, timeZone);
  const start = zonedMonthStart(year, month, timeZone);
  const endYear = month === 12 ? year + 1 : year;
  const endMonth = month === 12 ? 1 : month + 1;
  const end = zonedMonthStart(endYear, endMonth, timeZone);
  return { start, end };
}
function getWeekBounds(ts: number, tz: string): Bounds {
  const p = zonedParts(ts, tz);
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(ts));
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const daysSinceMonday = map[wd] ?? 0;
  const wallUtc = Date.UTC(p.year, p.month - 1, p.day);
  const d = new Date(wallUtc);
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  const start = zonedWallToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 0, 0, 0, tz);
  const nd = new Date(wallUtc);
  nd.setUTCDate(nd.getUTCDate() - daysSinceMonday + 7);
  const end = zonedWallToUtc(nd.getUTCFullYear(), nd.getUTCMonth() + 1, nd.getUTCDate(), 0, 0, 0, tz);
  return { start, end };
}
function getYearBounds(ts: number, tz: string): Bounds {
  const p = zonedParts(ts, tz);
  const start = zonedWallToUtc(p.year, 1, 1, 0, 0, 0, tz);
  const end = zonedWallToUtc(p.year + 1, 1, 1, 0, 0, 0, tz);
  return { start, end };
}
function getBoundsInternal(ts: number, tz: string, type: PeriodType): Bounds {
  switch (type) {
    case "monthly":
      return getMonthBounds(ts, tz);
    case "weekly":
      return getWeekBounds(ts, tz);
    case "yearly":
      return getYearBounds(ts, tz);
  }
}
function formatMonthLabelInternal(timestamp: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "long", year: "numeric" }).format(new Date(timestamp));
}
function formatPeriodLabelInternal(start: number, tz: string, type: PeriodType): string {
  if (type === "monthly") return formatMonthLabelInternal(start, tz);
  if (type === "yearly") return new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric" }).format(new Date(start));
  const b = getBoundsInternal(start, tz, "weekly");
  const startLabel = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric" }).format(new Date(b.start));
  const endLabel = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric", year: "numeric" }).format(new Date(b.end - 1));
  return `${startLabel} – ${endLabel}`;
}
function validateTimezoneInternal(tz: string | undefined): string | null {
  return _validateTimezone(tz);
}
function assertValidTz(tz: string) {
  const err = validateTimezoneInternal(tz);
  if (err) throw new Error(err);
}
function assertValidType(t: string): asserts t is PeriodType {
  if (!PERIOD_TYPES.includes(t as PeriodType)) throw new Error("Period type must be monthly, weekly, or yearly.");
}

// ── public deep interface ──

export function validateTimezone(tz: string | undefined): string | null {
  return validateTimezoneInternal(tz);
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

export function getPeriodBounds(ts: number, tz: string, type: PeriodType): Bounds {
  assertValidTz(tz);
  assertValidType(type);
  return getBoundsInternal(ts, tz, type);
}
export function getPrevPeriod(start: number, tz: string, type: PeriodType): number {
  return getBoundsInternal(start - 1, tz, type).start;
}
export function getNextPeriod(start: number, tz: string, type: PeriodType): number {
  return getBoundsInternal(start, tz, type).end;
}
export function formatPeriodLabel(start: number, tz: string, type: PeriodType): string {
  return formatPeriodLabelInternal(start, tz, type);
}
export function buildPeriodWindow(
  now: number,
  tz: string,
  type: PeriodType,
  count: number,
): { startDate: number; endDate: number; periods: { periodStart: number; label: string }[] } {
  assertValidTz(tz);
  assertValidType(type);
  let start = getBoundsInternal(now, tz, type).start;
  for (let i = 1; i < count; i++) start = getBoundsInternal(start - 1, tz, type).start;
  const periods: { periodStart: number; label: string }[] = [];
  let cur = start;
  for (let i = 0; i < count; i++) {
    periods.push({ periodStart: cur, label: formatPeriodLabelInternal(cur, tz, type) });
    cur = getBoundsInternal(cur, tz, type).end;
  }
  return { startDate: start, endDate: cur, periods };
}

// Legacy analytics shim — window with 6 months kept for reports
export function buildSixMonthWindow(now: number, timezone: string) {
  const w = buildPeriodWindow(now, timezone, "monthly", 6);
  return { startDate: w.startDate, endDate: w.endDate, months: w.periods };
}

// Rich Period object — one interface hides many helpers
export function period(at: number, timezone: string, type: PeriodType = "monthly"): Period {
  assertValidTz(timezone);
  assertValidType(type);
  const b = getBoundsInternal(at, timezone, type);
  const label = formatPeriodLabelInternal(b.start, timezone, type);
  const p: Period = {
    start: b.start,
    end: b.end,
    type,
    timezone,
    label,
    get prev() {
      return period(b.start - 1, timezone, type);
    },
    get next() {
      return period(b.end, timezone, type);
    },
    contains: (ts: number) => ts >= b.start && ts < b.end,
  };
  return p;
}
export function window(now: number, timezone: string, count: number, type: PeriodType = "monthly"): Window {
  const w = buildPeriodWindow(now, timezone, type, count);
  return w;
}

// Convenience shims over A core — C ergonomics, thin wrappers
// No expo-localization import here — Convex cannot bundle it. Client should resolve via constants/timezones.
function resolveTimezone(tz?: string): string {
  if (tz && !validateTimezoneInternal(tz)) return tz;
  return "UTC";
}
export function currentPeriod(
  household?: { timezone?: string; periodType?: PeriodType },
  now?: number,
): Period {
  const tz = resolveTimezone(household?.timezone);
  const type = household?.periodType ?? "monthly";
  return period(now ?? Date.now(), tz, type);
}
export function adjacentPeriod(start: number, direction: "prev" | "next", household?: { timezone?: string; periodType?: PeriodType }): Period {
  const tz = resolveTimezone(household?.timezone);
  const type = household?.periodType ?? "monthly";
  if (direction === "prev") return period(start - 1, tz, type);
  return period(start, tz, type).next;
}
export function sixMonthWindow(now?: number, household?: { timezone?: string }): Window {
  const tz = resolveTimezone(household?.timezone);
  return window(now ?? Date.now(), tz, 6, "monthly");
}

// Re-export helpers for date compat
export function getMonthBoundsCompat(ts: number, tz: string): Bounds {
  return getMonthBounds(ts, tz);
}
export function zonedMonthStartCompat(year: number, month: number, tz: string): number {
  return zonedMonthStart(year, month, tz);
}
export { zonedMonthStart, getMonthBounds, getWeekBounds, getYearBounds, formatMonthLabelInternal as formatMonthLabel, zonedWallToUtc, zonedParts };
export function formatDateHeaderTz(timestamp: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "long", day: "numeric", year: "numeric" }).format(new Date(timestamp));
}
export function formatTimeTz(timestamp: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}
export function formatDateShortTz(timestamp: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", year: "numeric" }).format(new Date(timestamp));
}
export function getDayBounds(date: Date, timeZone: string): { start: number; end: number } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const start = zonedWallToUtc(year, month, day, 0, 0, 0, timeZone);
  const end = zonedWallToUtc(year, month, day + 1, 0, 0, 0, timeZone);
  return { start, end };
}
