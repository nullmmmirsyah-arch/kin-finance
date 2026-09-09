import { describe, it, expect } from "vitest";
import streamlineData from "@/constants/streamlineIconData.json";
import { ACCOUNT_STREAMLINE_MAP, getAccountIconName } from "@/constants/accountIcons";
import { ACCOUNT_TYPES } from "@/constants/accounts";
import { getAccountIconXml } from "@/components/AccountIcon";

describe("accountIcons", () => {
  it("maps all AccountType to Iconify names with SVG bodies", () => {
    const icons = (streamlineData as { icons: Record<string, { body: string }> }).icons;
    for (const t of ACCOUNT_TYPES) {
      const iconName = ACCOUNT_STREAMLINE_MAP[t.id];
      expect(iconName, `missing mapping for ${t.id}`).toBeTruthy();
      expect(icons[iconName]?.body, `missing body for ${iconName}`).toBeTruthy();
    }
    expect(ACCOUNT_STREAMLINE_MAP.asset).toBe("cash-payment-bill");
    expect(ACCOUNT_STREAMLINE_MAP.debt).toBe("credit-card-1");
  });
  it("fallback to cash-payment-bill for invalid/undefined", () => {
    expect(getAccountIconName("invalid" as any)).toBe("cash-payment-bill");
    expect(getAccountIconName(undefined)).toBe("cash-payment-bill");
    expect(getAccountIconName("asset")).toBe("cash-payment-bill");
  });
  it("AccountIcon xml contains svg wrapper + body", () => {
    expect(getAccountIconXml("asset")).toContain("<svg");
    expect(getAccountIconXml("asset")).toContain("cash-payment-bill");
    expect(getAccountIconXml("invalid" as any)).toContain("cash-payment-bill");
  });
});
