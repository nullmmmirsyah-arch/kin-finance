import { describe, it, expect } from "vitest";
import { filterNoteSuggestions, recentNoteSuggestions } from "@/hooks/useNoteSuggestions";
describe("filterNoteSuggestions", () => {
  it("filters by substring case-insensitive", () =>
    expect(filterNoteSuggestions(["Pisang goreng", "Test future", "Rajal"], "pisang")).toEqual([
      "Pisang goreng",
    ]));
  it("limits results", () => expect(filterNoteSuggestions(["a1", "a2", "a3", "a4"], "a", 2)).toHaveLength(2));
});

it("returns unique recent notes when draft is empty", () =>
  expect(
    recentNoteSuggestions(["Rajal 18.08.2026", "", "Test future", "Rajal 18.08.2026", "Pisang goreng madu"]),
  ).toEqual(["Rajal 18.08.2026", "Test future", "Pisang goreng madu"]));

it("limits recent notes", () =>
  expect(recentNoteSuggestions(["a", "b", "c", "d"], 2)).toEqual(["a", "b"]));
