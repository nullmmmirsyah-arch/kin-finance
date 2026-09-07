import { describe, it, expect } from "vitest";
import { filterNoteSuggestions } from "@/hooks/useNoteSuggestions";
describe("filterNoteSuggestions", () => {
  it("filters by substring case-insensitive", () =>
    expect(filterNoteSuggestions(["Pisang goreng", "Test future", "Rajal"], "pisang")).toEqual([
      "Pisang goreng",
    ]));
  it("limits results", () => expect(filterNoteSuggestions(["a1", "a2", "a3", "a4"], "a", 2)).toHaveLength(2));
});
