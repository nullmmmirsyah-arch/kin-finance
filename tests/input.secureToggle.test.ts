import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
describe("Input secureToggle", () => {
  it("contains secureToggle prop and eye toggling", () => {
    const src = readFileSync("components/Input.tsx", "utf8");
    expect(src).toContain("secureToggle");
    expect(src).toContain("eye-off");
    expect(src).toContain("eye");
  });
});
