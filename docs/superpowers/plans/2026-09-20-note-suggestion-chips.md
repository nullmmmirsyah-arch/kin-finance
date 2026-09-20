# Note Suggestion Chips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the vertical note-suggestion rows with reference-style horizontal chips (text + ×, max width with honest `…`) backed by per-device SecureStore dismissal.

**Architecture:** New pure storage helpers in `lib/dismissed-notes.ts` (TDD, fully unit-tested); new presentational `components/transaction/NoteSuggestChips.tsx` (no render tests — repo has no RN component test infra, package.json has vitest only); thin wiring in `app/transaction-form.tsx`. Zero Convex changes.

**Tech Stack:** Expo SDK 54 / React Native 0.81, NativeWind (`className`), Feather icons, `expo-secure-store`, vitest.

## Global Constraints

- Install deps only with `npx expo install <pkg>` — no new dependencies needed (FlatList/RN core, Feather, SecureStore already present).
- Never use `style` callback functions on `Pressable` — static `style` objects only (NativeWind v4 gotcha).
- UI copy in English (chips, accessibility labels).
- SecureStore persistence is best-effort: try/catch, never block the form, fail-soft to "no dismissals".
- Dismissal matching is case-insensitive (consistent with existing suggestion dedup).
- No Convex schema/query/mutation changes.
- Gates before push: `npx tsc --noEmit`, `npm run lint`, `npx vitest run tests/dismissed-notes.test.ts`.

---

## File Structure

- `lib/dismissed-notes.ts` (new) — one responsibility: dismissed-note persistence + pure helpers. No UI imports.
- `tests/dismissed-notes.test.ts` (new) — unit tests for the above; mocks `expo-secure-store` via `vi.mock` factory (no existing SecureStore mock infra).
- `components/transaction/NoteSuggestChips.tsx` (new) — one responsibility: horizontal chip row UI. Props in, callbacks out, no data fetching.
- `app/transaction-form.tsx` (modify) — owns dismissed state, loads/saves store, filters suggestions, renders the component. Existing query (`useNoteSuggestions`), gating (`noteFocused`), and transfer skip stay untouched.

---

### Task 1: Dismissed-notes storage helpers + unit tests

**Files:**
- Create: `lib/dismissed-notes.ts`
- Create: `tests/dismissed-notes.test.ts`

**Interfaces:**
- Consumes: `expo-secure-store` (`getItemAsync`, `setItemAsync`).
- Produces (used by Task 3): `DismissedNotesStore` (`Record<string, string[]>`, key = `${householdId}:${categoryId}`, values oldest-first); `DISMISSED_NOTES_KEY = "kin.dismissedNotes.v1"`; `DISMISSED_NOTES_CAP = 50`; `buildDismissedKey(h: string, c: string): string`; `isDismissed(d: string[], n: string): boolean`; `applyDismissed(s: string[], d: string[]): string[]`; `trimDismissed(l: string[], cap?: number): string[]`; `addDismissedNote(store, h, c, n): DismissedNotesStore`; `loadDismissedNotes(): Promise<DismissedNotesStore>`; `saveDismissedNotes(store): Promise<void>`.

- [ ] **Step 1: Write the failing test** (`tests/dismissed-notes.test.ts`)

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dismissed-notes.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/dismissed-notes" (module does not exist yet).

- [ ] **Step 3: Write minimal implementation** (`lib/dismissed-notes.ts`)

```ts
import * as SecureStore from "expo-secure-store";

export const DISMISSED_NOTES_KEY = "kin.dismissedNotes.v1";
export const DISMISSED_NOTES_CAP = 50;

export type DismissedNotesStore = Record<string, string[]>;

export function buildDismissedKey(householdId: string, categoryId: string): string {
  return `${householdId}:${categoryId}`;
}

export function isDismissed(dismissed: string[], note: string): boolean {
  const q = note.toLowerCase();
  return dismissed.some((d) => d.toLowerCase() === q);
}

export function applyDismissed(suggestions: string[], dismissed: string[]): string[] {
  if (dismissed.length === 0) return suggestions;
  return suggestions.filter((s) => !isDismissed(dismissed, s));
}

export function trimDismissed(list: string[], cap: number = DISMISSED_NOTES_CAP): string[] {
  if (list.length <= cap) return list;
  return list.slice(list.length - cap);
}

export function addDismissedNote(
  store: DismissedNotesStore,
  householdId: string,
  categoryId: string,
  note: string,
): DismissedNotesStore {
  const key = buildDismissedKey(householdId, categoryId);
  const current = store[key] ?? [];
  if (isDismissed(current, note)) return store;
  return { ...store, [key]: trimDismissed([...current, note]) };
}

export async function loadDismissedNotes(): Promise<DismissedNotesStore> {
  try {
    const raw = await SecureStore.getItemAsync(DISMISSED_NOTES_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const clean: DismissedNotesStore = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v) && v.every((e) => typeof e === "string")) clean[k] = v;
    }
    return clean;
  } catch {
    return {};
  }
}

export async function saveDismissedNotes(store: DismissedNotesStore): Promise<void> {
  try {
    await SecureStore.setItemAsync(DISMISSED_NOTES_KEY, JSON.stringify(store));
  } catch {
    // Best-effort; dismissal persistence must never block the form.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dismissed-notes.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/dismissed-notes.ts tests/dismissed-notes.test.ts
git commit -m "feat: add per-device dismissed note suggestions storage"
```

---

### Task 2: NoteSuggestChips presentational component

**Files:**
- Create: `components/transaction/NoteSuggestChips.tsx`

**Interfaces:**
- Consumes: `suggestions: string[]` (already dismissal-filtered by parent), `onSelect(note: string)`, `onDismiss(note: string)` from Task 3; `useThemeColors()` for `C.border`, `C.surface`, `C.textPrimary`, `C.textSecondary`.
- Produces: `<NoteSuggestChips suggestions onSelect onDismiss />`. No data fetching, no storage access. No render unit test (repo has no RN component test infra — vitest only; verified in package.json).

- [ ] **Step 1: Create the component** (`components/transaction/NoteSuggestChips.tsx`)

```tsx
import { FlatList, Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useThemeColors } from "@/constants/theme";

export const NOTE_CHIP_MAX_WIDTH = 220;

type Props = {
  suggestions: string[];
  onSelect: (note: string) => void;
  onDismiss: (note: string) => void;
};

export function NoteSuggestChips({ suggestions, onSelect, onDismiss }: Props) {
  const C = useThemeColors();
  if (suggestions.length === 0) return null;
  return (
    <FlatList
      data={suggestions}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(s) => s}
      contentContainerStyle={{ paddingRight: 16 }}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item: s }) => (
        <View
          style={{
            flexShrink: 0,
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: C.border,
            backgroundColor: C.surface,
            borderRadius: 999,
            paddingLeft: 12,
            paddingRight: 8,
            paddingVertical: 6,
            maxWidth: NOTE_CHIP_MAX_WIDTH,
            marginRight: 8,
          }}
        >
          <Pressable
            onPress={() => onSelect(s)}
            accessibilityRole="button"
            accessibilityLabel={`Use note ${s}`}
            style={{ flex: 1 }}
          >
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              className="text-xs"
              style={{ color: C.textPrimary }}
            >
              {s}
            </Text>
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onDismiss(s);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Dismiss suggestion ${s}`}
            hitSlop={8}
            style={{
              width: 28,
              height: 28,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="x" size={14} color={C.textSecondary} />
          </Pressable>
        </View>
      )}
    />
  );
}
```

Rules honored: static `style` objects only (no Pressable style callback); theme via `useThemeColors()`; English accessibility labels; `marginRight` (not just `gap`) plus right-side padding breathing room as the measuring-bug runway from spec §3.

- [ ] **Step 2: Typecheck the component**

Run: `npx tsc --noEmit`
Expected: PASS with no errors.

- [ ] **Step 3: Commit**

```bash
git add components/transaction/NoteSuggestChips.tsx
git commit -m "feat: add horizontal note suggestion chips with dismiss button"
```

---

### Task 3: Wire dismissal + component into transaction-form

**Files:**
- Modify: `app/transaction-form.tsx`
  - imports (after line 36 `useNoteSuggestions` import): add `import { NoteSuggestChips } from "@/components/transaction/NoteSuggestChips";` and `import { addDismissedNote, applyDismissed, buildDismissedKey, loadDismissedNotes, saveDismissedNotes, type DismissedNotesStore } from "@/lib/dismissed-notes";`
  - after line 95 (`const noteSuggestions = useNoteSuggestions(categoryId, note);`): add state + loading + filtering + dismiss handler (code below). `useState`, `useEffect`, `useMemo`, `useCallback` are already imported (line 3); `household` query already exists (line 69).
  - replace the vertical suggestion block (lines 986-1010) with the component usage below.

**Interfaces:**
- Consumes: Task 1 (`DismissedNotesStore`, `addDismissedNote`, `applyDismissed`, `buildDismissedKey`, `loadDismissedNotes`, `saveDismissedNotes`); Task 2 (`<NoteSuggestChips />`); existing `household?._id`, `categoryId`, `noteSuggestions`, `setNote`.
- Produces: working UI; nothing downstream (last task before verification).

- [ ] **Step 1: Add state, loading, filtering, and dismiss handler**

Insert after `const noteSuggestions = useNoteSuggestions(categoryId, note);`:

```tsx
const [dismissedStore, setDismissedStore] = useState<DismissedNotesStore>({});
const householdId = household?._id ?? null;
useEffect(() => {
  if (householdId === null) return;
  void loadDismissedNotes().then(setDismissedStore);
}, [householdId]);
const dismissedForCategory =
  householdId !== null && categoryId !== null
    ? (dismissedStore[buildDismissedKey(householdId, categoryId)] ?? [])
    : [];
const visibleNoteSuggestions = useMemo(
  () => applyDismissed(noteSuggestions, dismissedForCategory),
  [noteSuggestions, dismissedForCategory],
);
const handleDismissSuggestion = useCallback(
  (s: string) => {
    if (householdId === null || categoryId === null) return;
    setDismissedStore((prev) => {
      const next = addDismissedNote(prev, householdId, categoryId, s);
      if (next !== prev) void saveDismissedNotes(next);
      return next;
    });
  },
  [householdId, categoryId],
);
```

- [ ] **Step 2: Replace the suggestion block**

Replace the `{noteFocused && noteSuggestions.length > 0 ? ( ... vertical rows ... ) : null}` block with:

```tsx
{noteFocused && visibleNoteSuggestions.length > 0 ? (
  <NoteSuggestChips
    suggestions={visibleNoteSuggestions}
    onSelect={setNote}
    onDismiss={handleDismissSuggestion}
  />
) : null}
```

Behavior preserved: transfer mode (`categoryId === null`) still shows no suggestions; `noteFocused` gating unchanged; `onSelect={setNote}` keeps the proven full-string fill.

- [ ] **Step 3: Run gates**

Run: `npx tsc --noEmit`
Expected: PASS with no errors.
Run: `npm run lint`
Expected: PASS with no errors.
Run: `npx vitest run tests/dismissed-notes.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 4: Commit**

```bash
git add app/transaction-form.tsx
git commit -m "feat: wire dismissible horizontal note suggestions into transaction form"
```

---

### Task 4: Push to review and hand off OTA verification

**Files:** none (verification only).

- [ ] **Step 1: Push**

```bash
git push origin review
```
Expected: push succeeds; CI `check` job (tsc/lint) green.

- [ ] **Step 2: Hand the owner the OTA checklist** (device-only bug — cannot be verified in CI):
  - `pekanan`, `kelapa`, `kebutuhan seharian` render fully in the chip row.
  - A note wider than the chip cap renders honest `…`, and tapping it still fills the full note.
  - Tapping chip text fills the note; tapping × removes only that suggestion.
  - Dismissed suggestion stays gone after closing/reopening the form and after app restart.
  - Typing still filters suggestions; transfer mode still shows none.
