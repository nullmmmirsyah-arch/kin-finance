import { describe, it, expect } from "vitest";
import streamlineData from "@/constants/streamlineIconData.json";
import { ACCOUNT_STREAMLINE_MAP, getAccountIconName } from "@/constants/accountIcons";
import { ACCOUNT_TYPES } from "@/constants/accounts";

describe("accountIcons", () => {
  it("maps all 4 AccountType to Iconify names with SVG bodies", () => {
    const icons = (streamlineData as { icons: Record<string,{body:string}> }).icons;
    for (const t of ACCOUNT_TYPES) {
      const iconName = ACCOUNT_STREAMLINE_MAP[t.id];
      expect(iconName, `missing mapping for ${t.id}`).toBeTruthy();
      expect(icons[iconName]?.body, `missing body for ${iconName}`).toBeTruthy();
    }
    expect(ACCOUNT_STREAMLINE_MAP.bank).toBe("saving-bank-1");
    expect(ACCOUNT_STREAMLINE_MAP.cash).toBe("cash-payment-bill");
    expect(ACCOUNT_STREAMLINE_MAP.ewallet).toBe("wireless-payment-credit-card-dollar");
    expect(ACCOUNT_STREAMLINE_MAP.credit_card).toBe("credit-card-1");
  });
  it("fallback to saving-bank-1 for invalid/undefined", () => {
    expect(getAccountIconName("invalid" as any)).toBe("saving-bank-1");
    expect(getAccountIconName(undefined)).toBe("saving-bank-1");
    expect(getAccountIconName("cash")).toBe("cash-payment-bill");
  });
});
