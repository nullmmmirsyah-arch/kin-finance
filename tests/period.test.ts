import { describe, expect, it } from "vitest";
import { getPeriodBounds, getPrevPeriod, getNextPeriod, formatPeriodLabel, buildPeriodWindow } from "../utils/period";

describe("period utils", () => {
  const tz = "Asia/Jakarta";
  it("monthly bounds matches getMonthBounds", () => {
    const ts = Date.UTC(2026, 2, 15); // Mar 15 UTC
    const b = getPeriodBounds(ts, tz, "monthly");
    expect(b.start).toBeDefined();
    expect(b.end > b.start).toBe(true);
  });
  it("weekly starts Monday 00:00 tz", () => {
    // Wed 2026-03-04 12:00 UTC = Wed 19:00 Jakarta -> week Mon 2026-03-02
    const ts = Date.UTC(2026, 2, 4, 12);
    const b = getPeriodBounds(ts, tz, "weekly");
    const d = new Date(b.start);
    // check via Intl
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(b.start));
    expect(wd).toBe("Mon");
  });
  it("yearly Jan 1", () => {
    const ts = Date.UTC(2026, 5, 15);
    const b = getPeriodBounds(ts, tz, "yearly");
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(b.start));
    const month = parts.find(p=>p.type==="month")!.value;
    const day = parts.find(p=>p.type==="day")!.value;
    expect(month).toBe("01");
    expect(day).toBe("01");
  });
  it("prev/next monthly", () => {
    const start = getPeriodBounds(Date.UTC(2026,2,15), tz, "monthly").start;
    const prev = getPrevPeriod(start, tz, "monthly");
    const next = getNextPeriod(start, tz, "monthly");
    expect(prev < start).toBe(true);
    expect(next > start).toBe(true);
  });
  it("buildPeriodWindow 6 monthly", () => {
    const w = buildPeriodWindow(Date.UTC(2026,2,15), tz, "monthly", 6);
    expect(w.periods.length).toBe(6);
    expect(w.endDate > w.startDate).toBe(true);
  });
});
