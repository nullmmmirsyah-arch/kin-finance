/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";
import { sumNetExcludingTransfers } from "../utils/format";

describe("sumNetExcludingTransfers", () => {
  it("sums income-only transactions to a positive net", () => {
    const txs = [
      { type: "income", amount: 15000000 },
      { type: "income", amount: 2500000 },
    ];
    expect(sumNetExcludingTransfers(txs)).toBe(17500000);
  });

  it("sums expense-only transactions to a negative net", () => {
    const txs = [
      { type: "expense", amount: -5000 },
      { type: "expense", amount: -30000 },
    ];
    expect(sumNetExcludingTransfers(txs)).toBe(-35000);
  });

  it("nets mixed income and expense transactions", () => {
    const txs = [
      { type: "income", amount: 1000000 },
      { type: "expense", amount: -250000 },
      { type: "income", amount: 500000 },
    ];
    expect(sumNetExcludingTransfers(txs)).toBe(1250000);
  });

  it("ignores transfers entirely (transfers-only group nets to 0)", () => {
    const txs = [
      { type: "transfer", amount: 500000 },
      { type: "transfer", amount: 250000 },
    ];
    expect(sumNetExcludingTransfers(txs)).toBe(0);
  });

  it("counts income but ignores transfers in a mixed group", () => {
    const txs = [
      { type: "transfer", amount: 1000000 },
      { type: "income", amount: 500000 },
      { type: "transfer", amount: 750000 },
    ];
    expect(sumNetExcludingTransfers(txs)).toBe(500000);
  });

  it("nets to 0 for a zero-amount expense and for empty input", () => {
    expect(sumNetExcludingTransfers([{ type: "expense", amount: 0 }])).toBe(0);
    expect(sumNetExcludingTransfers([])).toBe(0);
  });
});