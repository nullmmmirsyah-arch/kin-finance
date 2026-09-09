import { describe, it, expect } from "vitest";
import streamlineData from "@/constants/streamlineIconData.json";
import { ACCOUNT_STREAMLINE_MAP, getAccountIconName } from "@/constants/accountIcons";
import { ACCOUNT_TYPES, subTypesFor, SUB_TYPE_LABELS } from "@/constants/accounts";
import { getAccountIconXml } from "@/components/AccountIcon";

describe("accountIcons", () => {
  it("maps every sub-type to an Iconify name with an SVG body", () => {
    const icons = (streamlineData as { icons: Record<string, { body: string }> }).icons;
    for (const t of ["cash", "bank", "ewallet", "credit_card", "other"] as const) {
      const iconName = ACCOUNT_STREAMLINE_MAP[t];
      expect(iconName, `missing mapping for ${t}`).toBeTruthy();
      expect(icons[iconName]?.body, `missing body for ${iconName}`).toBeTruthy();
    }
    expect(ACCOUNT_STREAMLINE_MAP.cash).toBe("cash-payment-bill");
    expect(ACCOUNT_STREAMLINE_MAP.bank).toBe("saving-bank-1");
    expect(ACCOUNT_STREAMLINE_MAP.ewallet).toBe("wireless-payment-credit-card-dollar");
    expect(ACCOUNT_STREAMLINE_MAP.credit_card).toBe("credit-card-1");
    expect(ACCOUNT_STREAMLINE_MAP.other).toBe("tags-1");
  });
  it("pairs sub-types to parent types", () => {
    expect(subTypesFor("asset")).toEqual(["cash", "bank", "ewallet", "other"]);
    expect(subTypesFor("debt")).toEqual(["credit_card", "other"]);
    expect(SUB_TYPE_LABELS.bank).toBe("Bank");
  });
  it("falls back to tags-1 for invalid/undefined", () => {
    expect(getAccountIconName("invalid" as any)).toBe("tags-1");
    expect(getAccountIconName(undefined)).toBe("tags-1");
    expect(getAccountIconName("bank")).toBe("saving-bank-1");
  });
  it("AccountIcon xml contains svg wrapper + body", () => {
    expect(getAccountIconXml("ewallet")).toContain("<svg");
    expect(getAccountIconXml("ewallet")).toContain("wireless-payment-credit-card-dollar");
    expect(getAccountIconXml("invalid" as any)).toContain("tags-1");
  });
});
