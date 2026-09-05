import { describe, expect, it } from "vitest";
import { formatAmountInput, formatNumber } from "../utils/format";

describe("formatAmountInput", () => {
  it("formats 1250000 as 1,250,000", () => {
    expect(formatAmountInput("1250000")).toBe("1,250,000");
  });

  it("formats single digits and small numbers without commas", () => {
    expect(formatAmountInput("0")).toBe("0");
    expect(formatAmountInput("5")).toBe("5");
    expect(formatAmountInput("999")).toBe("999");
  });

  it("formats 1000 as 1,000", () => {
    expect(formatAmountInput("1000")).toBe("1,000");
  });

  it("strips leading zeros but keeps single zero", () => {
    expect(formatAmountInput("000123")).toBe("123");
    expect(formatAmountInput("0000")).toBe("0");
    expect(formatAmountInput("007")).toBe("7");
  });

  it("truncates at decimal point", () => {
    expect(formatAmountInput("12.34")).toBe("12");
    expect(formatAmountInput("1.500")).toBe("1");
  });

  it("ignores non-digits", () => {
    expect(formatAmountInput("abc123def")).toBe("123");
    expect(formatAmountInput("1,000")).toBe("1,000");
    expect(formatAmountInput(" Rp 1.250.000 ")).toBe("1,250,000");
  });

  it("returns empty for empty or non-digit only", () => {
    expect(formatAmountInput("")).toBe("");
    expect(formatAmountInput("abc")).toBe("");
  });

  it("handles preset addition via formatNumber", () => {
    const current = 0;
    expect(formatNumber(current + 50000)).toBe("50,000");
    expect(formatNumber(100000 + 50000)).toBe("150,000");
  });

  it("combines digits via 000 suffix correctly", () => {
    // simulate pressing 000 after 1
    const raw = "1" + "000";
    expect(formatAmountInput(raw)).toBe("1,000");
    const raw2 = "12" + "000";
    expect(formatAmountInput(raw2)).toBe("12,000");
  });
});
