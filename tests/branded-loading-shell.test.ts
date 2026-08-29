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
    const app = JSON.parse(readFileSync("app.json", "utf8"));
    const splash = app.expo.plugins.find((p: any) => Array.isArray(p) && p[0]==="expo-splash-screen")[1];
    expect(splash.backgroundColor).toBe("#FFFBF5");
    expect(splash.dark.backgroundColor).toBe("#1C1917");
    expect(splash.imageWidth).toBe(200);
  });
});
