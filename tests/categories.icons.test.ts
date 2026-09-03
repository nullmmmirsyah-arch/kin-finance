import { describe, it, expect } from "vitest";
import {
  isValidCategoryIcon,
  getCategoryIconSource,
  DEFAULT_CATEGORY_ICON,
  CATEGORY_ICON_MAP,
} from "@/constants/categoryIcons";

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
});
