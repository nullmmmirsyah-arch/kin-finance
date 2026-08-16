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

// Timezone-aware helpers. Period boundaries and date labels use the
// household timezone so every member classifies data into the same
// calendar month regardless of device timezone. The server stays
// timezone-agnostic (it compares raw epoch-ms).

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

// Offset (in ms) of the given instant relative to UTC in the timezone,
// such that `local wall clock interpreted as UTC - ts` equals the offset.
function zonedOffsetMs(ts: number, timeZone: string): number {
  const p = zonedParts(ts, timeZone);
  const wallAsUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return wallAsUtc - ts;
}

// Converts a wall-clock time in a timezone to an epoch-ms instant.
// Iterates twice because the offset depends on the instant (DST).
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

// Half-open calendar-month range [start, end) for `ts` in `timeZone`.
export function getMonthBounds(
  ts: number,
  timeZone: string,
): { start: number; end: number } {
  const p = zonedParts(ts, timeZone);
  const year = p.year;
  const month = p.month;
  const start = zonedWallToUtc(year, month, 1, 0, 0, 0, timeZone);
  const endYear = month === 12 ? year + 1 : year;
  const endMonth = month === 12 ? 1 : month + 1;
  const end = zonedWallToUtc(endYear, endMonth, 1, 0, 0, 0, timeZone);
  return { start, end };
}

export function formatDateHeaderTz(timestamp: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function formatTimeTz(timestamp: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function formatDateShortTz(timestamp: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function formatMonthLabel(timestamp: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}
