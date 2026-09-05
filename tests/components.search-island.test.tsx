import { describe, it, expect, vi } from "vitest";
// @ts-ignore — mocked via vitest alias tests/__mocks__/testing-library-react-native.ts
import { render } from "@testing-library/react-native";
import { SearchIsland } from "@/components/SearchIsland";
import { readFileSync } from "fs";
import * as React from "react";

const baseProps = {
  searchDraft: "nasi",
  onSearchDraft: vi.fn(),
  onCommit: vi.fn(),
  onClear: vi.fn(),
  typeFilter: "all" as const,
  onTypeChange: vi.fn(),
  accountIds: [] as any[],
  categoryIds: [] as any[],
  onAccountToggle: vi.fn(),
  onCategoryToggle: vi.fn(),
  activeCount: 0,
  accounts: [
    { _id: "a1" as any, name: "Cash" },
    { _id: "a2" as any, name: "Bank" },
  ] as any,
  categories: [
    { _id: "c1" as any, name: "Food", type: "expense" },
    { _id: "c2" as any, name: "Salary", type: "income" },
  ] as any,
};

describe("SearchIsland", () => {
  it("renders with field and quick filters", () => {
    const { toJSON } = render(React.createElement(SearchIsland, baseProps as any));
    expect(toJSON()).toBeTruthy();
    const src = readFileSync("components/SearchIsland.tsx", "utf8");
    expect(src).toContain("Cari catatan, nominal, akun");
    expect(src).toContain("Semua");
    expect(src).toContain("Expense");
    expect(src).toContain("Income");
    expect(src).toContain("Transfer");
    expect(src).toContain("Filter");
    // bear ears absolute views top -10 left 18/38
    expect(src).toContain("top: -10");
    expect(src).toContain("left: 18");
    expect(src).toContain("left: 38");
    // bear peek 34px
    expect(src).toContain("34");
    expect(src).toContain("bear-peek");
    // field 46px height
    expect(src).toContain("height: 46");
    // search button terra 48px (≥48 touch target)
    expect(src).toContain("height: 48");
    // quick filters 2.5 border
    expect(src).toContain("borderWidth: 2.5");
    // drawer cream 2.5 border radius 20
    expect(src).toContain("borderRadius: 20");
    // no Pressable style callback
    expect(src).not.toMatch(/style=\{\s*\(\s*\{\s*pressed/);
  });

  it("calls onCommit when Search pressed via props wiring", () => {
    const fn = vi.fn();
    const { getByTestId } = render(React.createElement(SearchIsland, { ...baseProps, onCommit: fn } as any));
    const src = readFileSync("components/SearchIsland.tsx", "utf8");
    expect(src).toContain("onCommit");
    expect(src).toContain('accessibilityLabel="Search"');
    expect(src).toContain('testID="search-commit"');
    // trigger the Search control through rendered UI
    const btn = getByTestId("search-commit") as unknown as { props: { onPress: () => void } };
    btn.props.onPress();
    expect(fn).toHaveBeenCalled();
  });

  it("shows drawer with chips and bear footer when logic contains drawer", () => {
    const src = readFileSync("components/SearchIsland.tsx", "utf8");
    expect(src).toContain('testID="filter-drawer"');
    expect(src).toContain("Account chips");
    expect(src).toContain("Category chips");
    expect(src).toContain("Reset");
    expect(src).toContain("Terapkan");
    expect(src).toContain("Bear family");
    // Bear imported
    expect(src).toContain("from \"@/components/Bear\"");
    expect(src).toContain("<Bear");
  });

  it("uses theme hooks and palette lock", () => {
    const src = readFileSync("components/SearchIsland.tsx", "utf8");
    expect(src).toContain("useThemeColors");
    expect(src).not.toContain("#3B82F6"); // no cold blues per palette lock
    expect(src).not.toMatch(/StyleSheet\.create/);
  });

  it("chip active logic uses 2.5px border and terra active", () => {
    const src = readFileSync("components/SearchIsland.tsx", "utf8");
    // chips use 2.5px border
    const matches = (src.match(/borderWidth: 2\.5/g) || []).length;
    expect(matches).toBeGreaterThanOrEqual(4);
    expect(src).toContain("C.primary");
  });
});
