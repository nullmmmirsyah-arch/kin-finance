import { describe, it, expect } from "vitest";
import { buildSixMonthWindow, calcDelta, maxBarValue } from "./analytics";

describe("buildSixMonthWindow", () => {
  it("returns 6 consecutive month starts including current", () => {
    const tz = "Asia/Jakarta";
    const now = Date.UTC(2026, 3, 15); // Apr 15
    const { startDate, endDate, months } = buildSixMonthWindow(now, tz);
    expect(months).toHaveLength(6);
    expect(months[5].periodStart < endDate).toBe(true);
    expect(startDate).toBe(months[0].periodStart);
    // each month periodStart equals next month's start via getMonthBounds
    for (let i = 0; i < 5; i++) {
      expect(months[i].periodStart < months[i + 1].periodStart).toBe(true);
    }
  });
});

describe("calcDelta", () => {
  it("computes pct when prev non-zero", () => {
    expect(calcDelta(110, 100).deltaPct).toBeCloseTo(10);
    expect(calcDelta(110, 100).label).toContain("+10.0%");
  });
  it("returns null when prev zero", () => {
    expect(calcDelta(50, 0).deltaPct).toBeNull();
    expect(calcDelta(50, 0).label).toBe("New this month");
    expect(calcDelta(0, 0).deltaPct).toBeNull();
    expect(calcDelta(0, 0).label).toBe("No change");
  });
  it("computes negative delta", () => {
    expect(calcDelta(90, 100).deltaPct).toBeCloseTo(-10);
    expect(calcDelta(90, 100).label).toContain("-10.0%");
  });
});

describe("maxBarValue", () => {
  it("returns at least 1 and max income/expense", () => {
    expect(maxBarValue([])).toBe(1);
    expect(maxBarValue([{ income: 10, expense: 20 }])).toBe(20);
    expect(maxBarValue([{ income: 100, expense: 5 }, { income: 50, expense: 200 }])).toBe(200);
  });
});
