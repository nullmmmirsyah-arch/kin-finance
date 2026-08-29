import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";
describe("OtaUpdater polished", () => {
  it("uses UpdateBanner and downloading state", () => {
    const src = readFileSync("components/OtaUpdater.tsx", "utf8");
    expect(src).toContain("UpdateBanner");
    expect(src).toContain("downloading");
    expect(src).toContain("fetchUpdateAsync");
    expect(src).toContain("reloadAsync");
  });
});
