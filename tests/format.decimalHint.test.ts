import { expect, test, describe } from "vitest";
import { formatAmountInput, wasDecimalTruncated, detectAmountTruncation } from "../utils/format";

describe("format decimal hint P0-3", () => {
  test("wasDecimalTruncated detects dot", () => {
    expect(wasDecimalTruncated("12.34")).toBe(true);
    expect(wasDecimalTruncated("1.500")).toBe(true);
    expect(wasDecimalTruncated("1500")).toBe(false);
    expect(wasDecimalTruncated("12a3")).toBe(false);
    expect(wasDecimalTruncated("")).toBe(false);
  });

  test("detectAmountTruncation returns decimal reason", () => {
    expect(detectAmountTruncation("12.34", formatAmountInput("12.34")).truncated).toBe(true);
    expect(detectAmountTruncation("12.34", formatAmountInput("12.34")).reason).toBe("decimal");
    expect(detectAmountTruncation("1.500", formatAmountInput("1.500")).reason).toBe("decimal");
  });

  test("detect non-digit truncation is not flagged as not truncated when formatting adds commas", () => {
    // "1500" -> "1,500" is not truncation, just formatting
    expect(detectAmountTruncation("1500", formatAmountInput("1500")).truncated).toBe(false);
    expect(detectAmountTruncation("1000000", formatAmountInput("1000000")).truncated).toBe(false);
  });

  test("formatAmountInput still strips correctly", () => {
    expect(formatAmountInput("1.500")).toBe("1");
    expect(formatAmountInput("12.34")).toBe("12");
    expect(formatAmountInput("-12")).toBe("12");
    expect(formatAmountInput("1,500")).toBe("1,500");
    expect(formatAmountInput("1500")).toBe("1,500");
  });
});
