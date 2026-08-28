import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";
describe("UpdateBanner + login icon", () => {
  it("has UpdateBanner and login icon 200", () => {
    const banner = readFileSync("components/UpdateBanner.tsx", "utf8");
    expect(banner).toContain("UpdateBanner");
    expect(banner).toContain("Restart now");
    const login = readFileSync("app/index.tsx", "utf8");
    expect(login).toContain("width: 200");
    expect(login).toContain("height: 200");
  });
});
