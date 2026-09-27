import { describe, expect, it } from "vitest";
import {
  extractAmounts,
  extractDates,
  fingerprintScore,
  pickAmount,
} from "../utils/receiptParser";

describe("extractAmounts", () => {
  it("parses Rp 150.000 and Rp 150.000,00 as 150000", () => {
    expect(extractAmounts("Transfer Rp 150.000 berhasil")).toEqual([150000]);
    expect(extractAmounts("Nominal Rp 150.000,00")).toEqual([150000]);
  });
});

describe("fingerprintScore", () => {
  it("counts case-insensitive keyword hits", () => {
    expect(fingerprintScore(["BCA", "m-BCA"], "m-bca transfer BCA")).toBe(2);
  });
});

describe("extractDates", () => {
  it("parses dd/mm/yyyy", () => {
    expect(extractDates("27/09/2026").length).toBe(1);
  });
});

describe("pickAmount afterKeyword", () => {
  it("picks amount after keyword", () => {
    expect(pickAmount("Total Rp 10.000\nAdmin Rp 2.000", "afterKeyword", "Admin")).toBe(2000);
  });
});

describe("fingerprint tie", () => {
  it("equal scores tie", () => {
    expect(fingerprintScore(["BCA"], "BCA")).toBe(fingerprintScore(["BRI"], "BRI"));
  });
});
