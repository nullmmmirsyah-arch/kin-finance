import { describe, expect, it } from "vitest";
import { formatPeriodShortLabel } from "../utils/period";
import { getPeriodBounds } from "../utils/period";

describe("formatPeriodShortLabel", () => {
  const tz = "Asia/Jakarta";
  it("monthly Sep 2026 renders Sep without year", () => {
    const start = getPeriodBounds(Date.UTC(2026, 8, 15), tz, "monthly").start;
    expect(formatPeriodShortLabel(start, tz, "monthly")).toBe("Sep");
  });
  it("monthly Jan renders Jan", () => {
    const start = getPeriodBounds(Date.UTC(2026, 0, 10), tz, "monthly").start;
    expect(formatPeriodShortLabel(start, tz, "monthly")).toBe("Jan");
  });
  it("weekly/yearly fall back to full label", () => {
    const mStart = getPeriodBounds(Date.UTC(2026, 8, 15), tz, "monthly").start;
    expect(formatPeriodShortLabel(mStart, tz, "yearly")).toBe("2026");
    const w = formatPeriodShortLabel(mStart, tz, "weekly");
    expect(w).toContain("–");
  });
});
