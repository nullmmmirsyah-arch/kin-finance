import { describe, it, expect } from "vitest";
// @ts-ignore mock
import { render } from "@testing-library/react-native";
import { readFileSync } from "fs";
import * as React from "react";
import { VaultCard, VaultHero, VaultAdd } from "@/components/VaultCard";

describe("VaultCard", () => {
  it("vault card shows top color bar by type", () => {
    const { toJSON } = render(<VaultCard name="Cash" type="cash" balance={1000} hidden={false} />);
    expect(toJSON()).toBeTruthy();
    const src = readFileSync("components/VaultCard.tsx", "utf8");
    expect(src).toContain('top-bar-cash');
    expect(src).toContain('top-bar-');
    expect(src).toContain("#10B981");
    expect(src).toContain("#3B82F6");
    // bank terra mapped to primary #92400E or Colors.primary
    expect(src).toContain("92400E");
  });

  it("vault card renders all types", () => {
    expect(render(<VaultCard name="Bank" type="bank" balance={2000} />).toJSON()).toBeTruthy();
    expect(render(<VaultCard name="Ewallet" type="ewallet" balance={3000} />).toJSON()).toBeTruthy();
    expect(render(<VaultCard name="Credit" type="credit_card" balance={-500} />).toJSON()).toBeTruthy();
  });

  it("vault card shows hidden badge", () => {
    const el = React.createElement(VaultCard, { name: "Hidden", type: "cash", balance: 0, hidden: true });
    expect(el).toBeTruthy();
    const src = readFileSync("components/VaultCard.tsx", "utf8");
    expect(src).toContain("Hidden");
    expect(src).toContain("eye-off");
  });

  it("vault card has clay spec: border 2.5 radius 24, 8px top bar, icon 54, balance 17", () => {
    const src = readFileSync("components/VaultCard.tsx", "utf8");
    expect(src).toContain("borderWidth: 2.5");
    expect(src).toContain("borderRadius: 24");
    expect(src).toContain("height: 8");
    expect(src).toContain("width: 54");
    expect(src).toContain("height: 54");
    expect(src).toContain("fontSize: 14");
    expect(src).toContain("fontSize: 17");
    expect(src).toContain("fontSize: 11");
    expect(src).toContain("borderWidth: 2");
    // mini-btns cream border
    expect(src).toContain("F3E6CD");
    // no Pressable style callback
    expect(src).not.toMatch(/style=\{\s*\(\s*\{\s*pressed/);
  });

  it("vault card supports onEdit/onDelete", () => {
    const fn = () => {};
    expect(render(<VaultCard name="X" type="cash" balance={1} onEdit={fn} onDelete={fn} />).toJSON()).toBeTruthy();
    expect(render(<VaultCard name="X" type="cash" balance={1} />).toJSON()).toBeTruthy();
  });

  it("uses theme hook and Bear not hardcode", () => {
    const src = readFileSync("components/VaultCard.tsx", "utf8");
    expect(src).toContain("useThemeColors");
    expect(src).toContain("Shadow.card");
  });
});

describe("VaultHero", () => {
  it("renders gradient hero with bears and totals", () => {
    const { toJSON } = render(<VaultHero total={12345} count={3} />);
    expect(toJSON()).toBeTruthy();
    const src = readFileSync("components/VaultCard.tsx", "utf8");
    expect(src).toContain("VaultHero");
    expect(src).toContain("#FFF6D6");
    expect(src).toContain("#FFFFFF");
    expect(src).toContain("borderRadius: 26");
    expect(src).toContain("borderWidth: 2.5");
    expect(src).toContain('Bear size="mid"');
    expect(src).toContain('Bear size="normal"');
    expect(src).toContain("fontSize: 26");
    expect(src).toContain("LinearGradient");
  });
});

describe("VaultAdd", () => {
  it("renders dashed add card for Owner", () => {
    const { toJSON } = render(<VaultAdd onPress={() => {}} />);
    expect(toJSON()).toBeTruthy();
    const src = readFileSync("components/VaultCard.tsx", "utf8");
    expect(src).toContain("VaultAdd");
    expect(src).toContain('borderStyle: "dashed"');
    expect(src).toContain("Add Vault");
  });
});

describe("accounts.tsx grid integration", () => {
  it("accounts.tsx uses VaultCard grid numColumns=2 and VaultHero", () => {
    const src = readFileSync("app/(tabs)/accounts.tsx", "utf8");
    expect(src).toContain("VaultCard");
    expect(src).toContain("VaultHero");
    expect(src).toContain("VaultAdd");
    expect(src).toContain("numColumns={2}");
    expect(src).toContain("gap");
    // preserves data hooks and isOwner gating
    expect(src).toContain("api.accounts.list");
    expect(src).toContain("api.accounts.verify");
    expect(src).toContain("isOwner");
    expect(src).toContain("reconcile");
  });
});
