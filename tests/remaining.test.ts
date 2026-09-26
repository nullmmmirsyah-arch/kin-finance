import { describe, expect, it } from "vitest";
import { projectAccountBalance, projectBudgetRemaining } from "../utils/remaining";

describe("projectAccountBalance", () => {
  it("projects expense as balance minus amount", () => {
    expect(
      projectAccountBalance({ balance: 12000, type: "expense", side: "single", amount: 3000 }),
    ).toBe(9000);
  });
  it("projects income as balance plus amount", () => {
    expect(
      projectAccountBalance({ balance: 12000, type: "income", side: "single", amount: 3000 }),
    ).toBe(15000);
  });
  it("projects transfer from-minus and to-plus", () => {
    expect(
      projectAccountBalance({ balance: 12000, type: "transfer", side: "from", amount: 3000 }),
    ).toBe(9000);
    expect(
      projectAccountBalance({ balance: 5000, type: "transfer", side: "to", amount: 3000 }),
    ).toBe(8000);
  });
  it("returns raw balance when amount is null, zero, or non-finite", () => {
    expect(
      projectAccountBalance({ balance: 12000, type: "expense", side: "single", amount: null }),
    ).toBe(12000);
    expect(
      projectAccountBalance({ balance: 12000, type: "expense", side: "single", amount: 0 }),
    ).toBe(12000);
    expect(
      projectAccountBalance({ balance: 12000, type: "expense", side: "single", amount: NaN }),
    ).toBe(12000);
  });
  it("corrects for the old transaction when editing the same account", () => {
    expect(
      projectAccountBalance({
        balance: 9000,
        type: "expense",
        side: "single",
        amount: 15000,
        oldAbsAmount: 10000,
        isSameAccount: true,
      }),
    ).toBe(4000);
  });
  it("ignores old amount when the account changed", () => {
    expect(
      projectAccountBalance({
        balance: 20000,
        type: "expense",
        side: "single",
        amount: 15000,
        oldAbsAmount: 10000,
        isSameAccount: false,
      }),
    ).toBe(5000);
  });
});

describe("projectBudgetRemaining", () => {
  it("projects remaining as budget minus spent minus amount", () => {
    expect(
      projectBudgetRemaining({ budgetAmount: 50000, spent: 45000, amount: 3000 }),
    ).toBe(2000);
  });
  it("returns current remaining when amount is null", () => {
    expect(
      projectBudgetRemaining({ budgetAmount: 50000, spent: 45000, amount: null }),
    ).toBe(5000);
  });
  it("adds back the old amount when editing the same category", () => {
    expect(
      projectBudgetRemaining({
        budgetAmount: 50000,
        spent: 45000,
        amount: 8000,
        oldAbsAmount: 5000,
        isSameCategory: true,
      }),
    ).toBe(2000);
  });
  it("keeps over-budget projections negative", () => {
    expect(
      projectBudgetRemaining({ budgetAmount: 50000, spent: 48000, amount: 5000 }),
    ).toBe(-3000);
  });
  it("returns raw current remaining when amount is empty even for the same category", () => {
    expect(
      projectBudgetRemaining({
        budgetAmount: 50000,
        spent: 45000,
        amount: null,
        oldAbsAmount: 5000,
        isSameCategory: true,
      }),
    ).toBe(5000);
  });
});
