import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
describe("BrandedLoadingShell", () => {
  it("exists and contains optimistic progress + offline", () => {
    const src = readFileSync("components/BrandedLoadingShell.tsx", "utf8");
    expect(src).toContain("BrandedLoadingShell");
    expect(src).toContain("progress");
    expect(src).toContain("expo-splash-screen");
    expect(src).toContain("isConnected");
  });
  it("app.json background matches theme", () => {
    const src = readFileSync("app.config.js", "utf8");
    expect(src).toContain('backgroundColor: "#FFFBF5"');
    expect(src).toContain('backgroundColor: "#1C1917"');
    expect(src).toContain("imageWidth: 200");
  });
});
