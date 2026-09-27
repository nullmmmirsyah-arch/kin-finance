import { describe, expect, it } from "vitest";
import {
  extractAmounts,
  extractDates,
  fingerprintScore,
  pickAmount,
  pickNote,
  resolveCategory,
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

  it("parses Indonesian month name", () => {
    expect(extractDates("27 September 2026").length).toBe(1);
  });

  it("rejects out-of-range day/month", () => {
    expect(extractDates("99/99/2026")).toEqual([]);
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

describe("resolveCategory", () => {
  it("prefers keyword rule over default", () => {
    expect(
      resolveCategory("KOPI KENANGAN Rp 20.000", {
        keywordRules: [{ keyword: "KOPI", categoryId: "cat-food" }],
        defaultCategoryId: "cat-default",
      }),
    ).toBe("cat-food");
  });

  it("matches keyword with surrounding spaces", () => {
    expect(
      resolveCategory("transfer BCA Rp 10.000", {
        keywordRules: [{ keyword: " BCA ", categoryId: "cat-bank" }],
        defaultCategoryId: "cat-default",
      }),
    ).toBe("cat-bank");
  });

  it("falls back to default then null", () => {
    expect(
      resolveCategory("no match here", {
        keywordRules: [{ keyword: "BCA", categoryId: "cat-bank" }],
        defaultCategoryId: "cat-default",
      }),
    ).toBe("cat-default");
    expect(
      resolveCategory("no match here", {
        keywordRules: [{ keyword: "BCA", categoryId: "cat-bank" }],
      }),
    ).toBeNull();
  });
});

describe("pickNote merchantLine", () => {
  it("picks longest non-amount line", () => {
    expect(
      pickNote(
        ["Rp 150.000", "KOPI KENANGAN SUDIRMAN", "27/09/2026"],
        "merchantLine",
      ),
    ).toBe("KOPI KENANGAN SUDIRMAN");
  });
});
