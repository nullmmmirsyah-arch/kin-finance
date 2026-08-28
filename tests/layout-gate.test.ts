import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";
describe("layout gate", () => {
  it("uses preventAutoHideAsync and BrandedLoadingShell without ClerkLoading spinner", () => {
    const src = readFileSync("app/_layout.tsx", "utf8");
    expect(src).toContain("preventAutoHideAsync");
    expect(src).toContain("BrandedLoadingShell");
    expect(src).toContain("hideAsync");
    expect(src).not.toContain("ClerkLoading");
  });
});
