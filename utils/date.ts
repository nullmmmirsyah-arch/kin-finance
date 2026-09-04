export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Normalizes the input to the start of its month before applying the offset,
// so addMonths(aug 15, 1) = sep 1. Callers use this for month-preset
// boundaries rather than calendar day-of-month arithmetic.
export function addMonths(date: Date, months: number): Date {
  const d = startOfMonth(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

const dateHeaderFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
});

const dateShortFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatDateHeader(timestamp: number): string {
  return dateHeaderFormatter.format(new Date(timestamp));
}

export function formatTime(timestamp: number): string {
  return timeFormatter.format(new Date(timestamp));
}

export function formatDateShort(timestamp: number): string {
  return dateShortFormatter.format(new Date(timestamp));
}

// Timezone-aware helpers — deep Period module owns wall-clock math (single source).
// Re-exported here for backward compat; new code should import from @/utils/periodTime.
export {
  zonedParts,
  zonedWallToUtc,
  getYearMonth,
  zonedMonthStart,
  getMonthBounds,
  getDayBounds,
  formatDateHeaderTz,
  formatTimeTz,
  formatDateShortTz,
  formatMonthLabel,
  getWeekBounds,
  getYearBounds,
  getPeriodBounds,
  getPrevPeriod,
  getNextPeriod,
  formatPeriodLabel,
  buildPeriodWindow,
} from "./periodTime";
