import { describe, expect, it } from "vitest";
import {
  filterBadgeCount,
  getSelectionState,
  normalizeSelection,
  pluralLabel,
} from "../utils/filters";

describe("getSelectionState", () => {
  it("returns empty for zero selected", () => {
    expect(getSelectionState(8, 0)).toBe("empty");
  });
  it("returns empty when there are no options", () => {
    expect(getSelectionState(0, 0)).toBe("empty");
  });
  it("returns all when every option is selected", () => {
    expect(getSelectionState(8, 8)).toBe("all");
  });
  it("returns partial in between", () => {
    expect(getSelectionState(8, 3)).toBe("partial");
  });
});

describe("normalizeSelection", () => {
  const ids = ["a", "b", "c"];
  it("returns undefined for an empty selection", () => {
    expect(normalizeSelection([], ids)).toBeUndefined();
  });
  it("returns undefined when every option is selected", () => {
    expect(normalizeSelection(["a", "b", "c"], ids)).toBeUndefined();
  });
  it("returns the subset for a partial selection", () => {
    expect(normalizeSelection(["a", "c"], ids)).toEqual(["a", "c"]);
  });
  it("filters out ids not in the option list", () => {
    expect(normalizeSelection(["a", "x"], ids)).toEqual(["a"]);
  });
  it("returns undefined when there are no options", () => {
    expect(normalizeSelection(["a"], [])).toBeUndefined();
  });
});

describe("filterBadgeCount", () => {
  it("counts type plus partial dimensions", () => {
    expect(filterBadgeCount(true, "partial", 2, "empty", 0)).toBe(3);
  });
  it("ignores empty and all dimensions", () => {
    expect(filterBadgeCount(false, "all", 8, "all", 5)).toBe(0);
  });
  it("counts both partial dimensions", () => {
    expect(filterBadgeCount(false, "partial", 2, "partial", 3)).toBe(5);
  });
});

describe("pluralLabel", () => {
  it("pluralizes known titles", () => {
    expect(pluralLabel("Account")).toBe("accounts");
    expect(pluralLabel("Category")).toBe("categories");
  });
  it("falls back to lowercase plural", () => {
    expect(pluralLabel("Tag")).toBe("tags");
  });
});
