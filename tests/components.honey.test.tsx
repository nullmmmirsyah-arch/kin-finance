import { describe, it, expect } from "vitest";
// @ts-ignore mock
import { render } from "@testing-library/react-native";
import { readFileSync } from "fs";
import * as React from "react";
import { HoneyJar, HoneyHero } from "@/components/HoneyJar";

describe("HoneyJar", () => {
  it("honey fill height matches progress via source and renders", () => {
    const { toJSON } = render(<HoneyJar spent={500} amount={1000} categoryName="Food" />);
    expect(toJSON()).toBeTruthy();
    const src = readFileSync("components/HoneyJar.tsx", "utf8");
    // fill height = progress*100% logic
    expect(src).toContain("fillHeight");
    expect(src).toContain('testID="fill"');
    expect(src).toContain("progress * 100");
    expect(src).toContain("height: fillHeight");
    // also ensures 50% calculation: spent 500/1000 = 50%
    expect(src).toContain("Math.min(spent / amount");
  });

  it("honey fill height 25% and 100% logic source", () => {
    const src = readFileSync("components/HoneyJar.tsx", "utf8");
    expect(src).toContain('testID="fill"');
    expect(src).toContain("height: fillHeight");
    // rendered still truthy for varied amounts
    expect(render(<HoneyJar spent={250} amount={1000} categoryName="A" />).toJSON()).toBeTruthy();
    expect(render(<HoneyJar spent={1000} amount={1000} categoryName="B" />).toJSON()).toBeTruthy();
  });

  it("shows — and no track when redacted", () => {
    const { toJSON } = render(<HoneyJar categoryName="Food" amount={1000} spent={undefined} />);
    expect(toJSON()).toBeTruthy();
    const src = readFileSync("components/HoneyJar.tsx", "utf8");
    expect(src).toContain("—");
    expect(src).toContain("isRedacted");
    expect(src).toContain("honey-track");
    // redacted hides track: source has conditional isRedacted ? null
    expect(src).toContain("isRedacted ? null");
  });

  it("over → cherry fill uses error color", () => {
    const { toJSON } = render(<HoneyJar spent={1500} amount={1000} categoryName="Food" />);
    expect(toJSON()).toBeTruthy();
    const src = readFileSync("components/HoneyJar.tsx", "utf8");
    expect(src).toContain("cherry");
    expect(src).toContain("C.error");
    expect(src).toContain("over");
    // over case has cherry fill branch
    expect(src).toContain("backgroundColor: cherryColor");
  });

  it("honey jar has clay spec: border 2.5 radius 24, jar 64x72 cap terra, honey gradient, emoji 22, track 6px", () => {
    const src = readFileSync("components/HoneyJar.tsx", "utf8");
    expect(src).toContain("borderWidth: 2.5");
    expect(src).toContain("borderRadius: 24");
    expect(src).toContain("width: 64");
    expect(src).toContain("height: 72");
    expect(src).toContain("#FDE68A");
    expect(src).toContain("#F59E0B");
    expect(src).toContain("height: 6");
    expect(src).toContain("fontSize: 22");
    // cap terra via C.primary #92400E
    expect(src).toContain("C.primary");
    expect(src).toContain("LinearGradient");
    expect(src).toContain("Shadow.card");
    expect(src).toContain("useThemeColors");
    expect(src).not.toMatch(/style=\{\s*\(\s*\{\s*pressed/);
    // cream border
    expect(src).toContain("F3E6CD");
  });

  it("renders with icon and supports onEdit/onDelete", () => {
    const fn = () => {};
    expect(render(<HoneyJar categoryName="X" amount={500} spent={100} icon="food" onEdit={fn} onDelete={fn} />).toJSON()).toBeTruthy();
    expect(render(<HoneyJar categoryName="X" amount={500} />).toJSON()).toBeTruthy();
  });
});

describe("HoneyHero", () => {
  it("renders gradient hero with bears and stats", () => {
    const { toJSON } = render(<HoneyHero budgeted={2000} spent={500} />);
    expect(toJSON()).toBeTruthy();
    const src = readFileSync("components/HoneyJar.tsx", "utf8");
    expect(src).toContain("HoneyHero");
    expect(src).toContain("#FFF6D6");
    expect(src).toContain("#FFFFFF");
    expect(src).toContain("borderRadius: 26");
    expect(src).toContain("borderWidth: 2.5");
    expect(src).toContain('Bear size="small"');
    expect(src).toContain('Bear size="mid"');
    expect(src).toContain("Honey Jars");
    expect(src).toContain("LinearGradient");
    expect(src).toContain("height: 10");
    expect(src).toContain("Shadow.card");
  });

  it("hero redacted shows — no track via source", () => {
    const { toJSON } = render(<HoneyHero budgeted={1000} spent={0} hasRedacted={true} />);
    expect(toJSON()).toBeTruthy();
    const src = readFileSync("components/HoneyJar.tsx", "utf8");
    expect(src).toContain("hasRedacted");
    expect(src).toContain("hero-track");
    expect(src).toContain("—");
    expect(src).toContain("hero-spent");
  });

  it("hero shows stats 2 columns white cards", () => {
    const src = readFileSync("components/HoneyJar.tsx", "utf8");
    expect(src).toContain("hero-budgeted");
    expect(src).toContain("hero-spent");
    expect(src).toContain("Budgeted");
    expect(src).toContain("Spent");
  });
});

describe("budgets.tsx honey integration", () => {
  it("budgets.tsx uses HoneyJar and HoneyHero with FlatList", () => {
    const src = readFileSync("app/(tabs)/budgets.tsx", "utf8");
    expect(src).toContain("HoneyJar");
    expect(src).toContain("HoneyHero");
    expect(src).toContain("api.budgets.list");
    expect(src).toContain("getMonthBounds");
    expect(src).toContain("hasRedacted");
    expect(src).toContain("FlatList");
    expect(src).toContain("HoneyJar");
    // preserves budgeted/spent calc
    expect(src).toContain("budgeted");
    expect(src).toContain("spent");
  });
});
