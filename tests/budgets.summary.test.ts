import { describe, expect, it } from "vitest";
import { summarizeBudgets } from "../utils/budgets";

describe("summarizeBudgets", () => {
  it("sums budgeted and spent with remaining and honey level", () => {
    const s = summarizeBudgets([
      { amount: 1000, spent: 300 },
      { amount: 500, spent: 200 },
    ]);
    expect(s).toEqual({
      budgeted: 1500,
      spent: 500,
      hasRedacted: false,
      progress: 500 / 1500,
      honeyLevel: 1 - 500 / 1500,
      remaining: 1000,
    });
  });
  it("marks redacted when any spent is undefined and zeroes progress", () => {
    const s = summarizeBudgets([
      { amount: 1000, spent: undefined },
      { amount: 500, spent: 200 },
    ]);
    expect(s.budgeted).toBe(1500);
    expect(s.spent).toBe(200);
    expect(s.hasRedacted).toBe(true);
    expect(s.progress).toBe(0);
    expect(s.honeyLevel).toBe(0);
    expect(s.remaining).toBe(1300);
  });
  it("handles over-budget and empty list", () => {
    const over = summarizeBudgets([{ amount: 500, spent: 700 }]);
    expect(over.progress).toBe(700 / 500);
    expect(over.honeyLevel).toBe(0);
    expect(over.remaining).toBe(-200);
    const empty = summarizeBudgets([]);
    expect(empty).toEqual({
      budgeted: 0,
      spent: 0,
      hasRedacted: false,
      progress: 0,
      honeyLevel: 0,
      remaining: 0,
    });
  });
});
