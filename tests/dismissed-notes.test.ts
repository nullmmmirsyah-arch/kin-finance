import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DISMISSED_NOTES_CAP,
  DISMISSED_NOTES_KEY,
  addDismissedNote,
  applyDismissed,
  buildDismissedKey,
  isDismissed,
  loadDismissedNotes,
  saveDismissedNotes,
  trimDismissed,
} from "@/lib/dismissed-notes";

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));

import * as SecureStore from "expo-secure-store";

const getItem = SecureStore.getItemAsync as unknown as ReturnType<typeof vi.fn>;
const setItem = SecureStore.setItemAsync as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildDismissedKey", () => {
  it("scopes by household and category", () =>
    expect(buildDismissedKey("h1", "c1")).toBe("h1:c1"));
});

describe("isDismissed", () => {
  it("matches case-insensitively", () => {
    expect(isDismissed(["Kelapa"], "kelapa")).toBe(true);
    expect(isDismissed(["Kelapa"], "KELAPA")).toBe(true);
  });
  it("returns false when absent", () =>
    expect(isDismissed(["kelapa"], "pekanan")).toBe(false));
});

describe("applyDismissed", () => {
  it("removes dismissed notes and keeps order", () =>
    expect(applyDismissed(["kelapa", "pekanan", "ayam"], ["PEKANAN"])).toEqual([
      "kelapa",
      "ayam",
    ]));
  it("returns suggestions untouched when nothing dismissed", () =>
    expect(applyDismissed(["kelapa"], [])).toEqual(["kelapa"]));
});

describe("trimDismissed", () => {
  it("keeps the newest entries at the cap", () => {
    const list = Array.from({ length: DISMISSED_NOTES_CAP + 5 }, (_, i) => `n${i}`);
    const trimmed = trimDismissed(list);
    expect(trimmed).toHaveLength(DISMISSED_NOTES_CAP);
    expect(trimmed[0]).toBe("n5");
    expect(trimmed[trimmed.length - 1]).toBe(`n${DISMISSED_NOTES_CAP + 4}`);
  });
  it("leaves short lists untouched", () =>
    expect(trimDismissed(["a", "b"])).toEqual(["a", "b"]));
});

describe("addDismissedNote", () => {
  it("adds under the household:category key", () => {
    const next = addDismissedNote({}, "h1", "c1", "kelapa");
    expect(next).toEqual({ "h1:c1": ["kelapa"] });
  });
  it("ignores case-insensitive duplicates without cloning", () => {
    const prev = { "h1:c1": ["kelapa"] };
    expect(addDismissedNote(prev, "h1", "c1", "KELAPA")).toBe(prev);
  });
  it("keeps categories separate", () => {
    const next = addDismissedNote({ "h1:c1": ["kelapa"] }, "h1", "c2", "ayam");
    expect(next).toEqual({ "h1:c1": ["kelapa"], "h1:c2": ["ayam"] });
  });
});

describe("loadDismissedNotes", () => {
  it("returns {} when storage is empty", async () => {
    getItem.mockResolvedValueOnce(null);
    await expect(loadDismissedNotes()).resolves.toEqual({});
  });
  it("returns {} on corrupt JSON", async () => {
    getItem.mockResolvedValueOnce("{oops");
    await expect(loadDismissedNotes()).resolves.toEqual({});
  });
  it("drops non-string entries but keeps valid ones", async () => {
    getItem.mockResolvedValueOnce(JSON.stringify({ "h1:c1": ["kelapa", 42], bad: "x" }));
    await expect(loadDismissedNotes()).resolves.toEqual({ "h1:c1": ["kelapa"] });
  });
  it("round-trips through save", async () => {
    const store = { "h1:c1": ["kelapa"] };
    await saveDismissedNotes(store);
    expect(setItem).toHaveBeenCalledWith(DISMISSED_NOTES_KEY, JSON.stringify(store));
    getItem.mockResolvedValueOnce(JSON.stringify(store));
    await expect(loadDismissedNotes()).resolves.toEqual(store);
  });
});
