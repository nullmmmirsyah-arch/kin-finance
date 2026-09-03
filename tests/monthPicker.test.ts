import { describe, it, expect } from "vitest";
import { isFutureMonth } from "../components/MonthPicker";

describe("MonthPicker future disabled", () => {
  const tz = "Asia/Jakarta";
  const now = Date.UTC(2026, 8, 3, 6, 0, 0); // Sep 3 13:00 Jakarta -> Sep 3 UTC
  it("Oct 2026 is future when now Sep", () => {
    expect(isFutureMonth(2026, 10, tz, now)).toBe(true);
  });
  it("Aug 2026 is not future", () => {
    expect(isFutureMonth(2026, 8, tz, now)).toBe(false);
  });
  it("Sep 2026 same month not future", () => {
    expect(isFutureMonth(2026, 9, tz, now)).toBe(false);
  });
  it("Jan labels are Jan-Dec not 1-12", async () => {
    const mod = await import("../components/MonthPicker");
    expect(mod.MONTH_LABELS).toEqual(["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]);
  });
});
