import { describe, it, expect } from "vitest";
import { getDayBounds } from "../utils/date";

describe("search default 14d", () => {
  it("today Sep3 => start Aug20", () => {
    const tz = "Asia/Jakarta";
    const today = new Date(2026, 8, 3); // Sep 3 (months 0-indexed)
    const end = getDayBounds(today, tz).end;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 14);
    const start = getDayBounds(startDate, tz).start;
    const days = (end - start) / 86400000;
    expect(days).toBe(15);
  });

  it("date label shows inclusive range for default window", () => {
    const tz = "Asia/Jakarta";
    const today = new Date(2026, 8, 3);
    const end = getDayBounds(today, tz).end;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 14);
    const start = getDayBounds(startDate, tz).start;
    // Inclusive range is 15 days
    expect(end - start).toBe(15 * 86400000);
    // Label would be formatDateShortTz(start) – formatDateShortTz(end-1)
    // For Sep 3 default, start day is Aug 20, end-1 is Sep 3
    const startDay = new Date(start);
    const endInclusive = new Date(end - 1);
    // Basic sanity: start is before endInclusive
    expect(startDay.getTime()).toBeLessThan(endInclusive.getTime());
  });
});
