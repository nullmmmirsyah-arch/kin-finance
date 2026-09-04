import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  isValidCategoryIcon,
  getCategoryIconSource,
  DEFAULT_CATEGORY_ICON,
  CATEGORY_ICON_MAP,
  ALL_CATEGORY_ICONS,
  CATEGORY_STREAMLINE_MAP,
  getStreamlineIconName,
} from "@/constants/categoryIcons";
import streamlineData from "@/constants/streamlineIconData.json";

describe("categoryIcons", () => {
  it("accepts valid icons", () => {
    expect(isValidCategoryIcon("groceries")).toBe(true);
    expect(isValidCategoryIcon("other")).toBe(true);
    expect(isValidCategoryIcon("coffee")).toBe(true);
  });
  it("rejects invalid icons", () => {
    expect(isValidCategoryIcon("invalid")).toBe(false);
    expect(isValidCategoryIcon("")).toBe(false);
    expect(isValidCategoryIcon("Groceries")).toBe(false);
  });
  it("getCategoryIconSource falls back to other", () => {
    expect(getCategoryIconSource("invalid")).toBe(CATEGORY_ICON_MAP[DEFAULT_CATEGORY_ICON]);
    expect(getCategoryIconSource(undefined)).toBe(CATEGORY_ICON_MAP[DEFAULT_CATEGORY_ICON]);
    expect(getCategoryIconSource("")).toBe(CATEGORY_ICON_MAP[DEFAULT_CATEGORY_ICON]);
    expect(getCategoryIconSource("groceries")).toBe(CATEGORY_ICON_MAP["groceries"]);
  });
  it("ALL icons in map are valid", () => {
    for (const key of Object.keys(CATEGORY_ICON_MAP)) {
      expect(isValidCategoryIcon(key)).toBe(true);
    }
  });
  it("all icon files exist on disk (manifest + 56 PNG legacy fallback)", () => {
    const iconsDir = path.resolve(__dirname, "../assets/icons");
    expect(fs.existsSync(path.join(iconsDir, "manifest.json"))).toBe(true);
    for (const name of ALL_CATEGORY_ICONS) {
      const p = path.join(iconsDir, `${name}.png`);
      expect(fs.existsSync(p), `missing ${name}.png`).toBe(true);
    }
  });
  it("streamline map covers all allowlist + offline bundle", () => {
    const icons = (streamlineData as { icons: Record<string, { body: string }> }).icons;
    for (const name of ALL_CATEGORY_ICONS) {
      const iconName = CATEGORY_STREAMLINE_MAP[name as keyof typeof CATEGORY_STREAMLINE_MAP];
      expect(iconName, `missing streamline mapping for ${name}`).toBeTruthy();
      expect(icons[iconName]?.body, `missing SVG body for ${iconName} (${name})`).toBeTruthy();
    }
    expect(getStreamlineIconName("groceries")).toBe(CATEGORY_STREAMLINE_MAP.groceries);
    expect(getStreamlineIconName("invalid" as string)).toBe(CATEGORY_STREAMLINE_MAP.other);
    expect(getStreamlineIconName(undefined)).toBe(CATEGORY_STREAMLINE_MAP.other);
  });
});
