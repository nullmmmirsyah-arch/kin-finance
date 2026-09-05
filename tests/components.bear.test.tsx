import { describe, it, expect } from "vitest";
// @ts-ignore — mocked via vitest alias tests/__mocks__/testing-library-react-native.ts
import { render } from "@testing-library/react-native";
import { Bear, BearRow } from "@/components/Bear";
import { readFileSync } from "fs";
import * as React from "react";

describe("Bear", () => {
  it("renders faceless bear without eyes", () => {
    const { toJSON } = render(<Bear size="normal" />);
    expect(toJSON()).toBeTruthy();
    // faceless: no Text with eye — verify source never renders eyes/nose
    const src = readFileSync("components/Bear.tsx", "utf8");
    // Only outer ears/inner highlight allowed; must not contain eye/nose/mouth Text or emoji
    expect(src).not.toMatch(/<Text[^>]*>.*eye/i);
    // ensure file does not literally contain eye Text content
    const hasEyeText = />\s*eye\s*</i.test(src);
    expect(hasEyeText).toBe(false);
    // Bear component must contain head+ears+body structure
    expect(src).toContain("head");
    expect(src).toContain("Body");
  });

  it("renders small/mid variants", () => {
    expect(render(<Bear size="small" />).toJSON()).toBeTruthy();
    expect(render(<Bear size="mid" />).toJSON()).toBeTruthy();
    expect(render(<Bear size="normal" variant="papa" />).toJSON()).toBeTruthy();
    expect(render(<Bear size="normal" variant="mama" />).toJSON()).toBeTruthy();
    expect(render(<Bear size="small" variant="cub" />).toJSON()).toBeTruthy();
  });

  it("BearRow renders row without logic", () => {
    const { toJSON } = render(<BearRow count={3} />);
    expect(toJSON()).toBeTruthy();
    const src = readFileSync("components/Bear.tsx", "utf8");
    expect(src).toContain("BearRow");
    // BearRow also supports bears array
    const el = React.createElement(BearRow, {
      bears: [{ size: "small" }, { size: "mid" }, { size: "normal" }],
    });
    expect(el).toBeTruthy();
  });

  it("BearColors tokens exist and keep palette", () => {
    const theme = readFileSync("constants/theme.ts", "utf8");
    expect(theme).toContain("BearColors");
    expect(theme).toContain('teddy: "#D9A679"');
    expect(theme).toContain('teddyMid: "#DEB08A"');
    expect(theme).toContain('teddyLight: "#E8B48E"');
    expect(theme).toContain('honey: "#FDE68A"');
    expect(theme).toContain('honeyDeep: "#F59E0B"');
    expect(theme).toContain("BearVaultColors");
    // existing Colors must stay intact
    expect(theme).toContain('primary: "#92400E"');
  });
});
