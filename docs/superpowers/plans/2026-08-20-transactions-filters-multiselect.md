# Multi-Select Account & Category Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Transactions filter sheet's Account and Category controls from single-select inline lists into compact multi-select comboboxes (tri-state header + checkbox rows) with array-based server-side filtering.

**Architecture:** New pure utils (`utils/filters.ts`) derive tri-state, normalize selections into query args, and compute the badge count. Backend `transactions.list` takes `accountIds[]`/`categoryIds[]`; the owner path pins a singleton dimension to its compound index and applies the remaining dimensions as a post-index `q.or`/`q.eq` filter (Convex `withIndex` supports only single-value `eq`, so multi-value dimensions cannot use the compound index); the member path applies the same constraints as a JS predicate after the hidden-category skip. UI gets a new reusable `MultiSelectField` inline combobox component replacing `OptionList` in `FilterSheet`.

**Tech Stack:** Expo SDK 54, React Native, NativeWind v4, Convex (queries with compound indexes), TypeScript, vitest.

## Global Constraints

- After any change to `convex/*.ts` or `convex/schema.ts`, run `npx convex codegen` FIRST, then `npx tsc --noEmit`.
- Verify with `npx tsc --noEmit`, `npm run lint`, `npm test`.
- NativeWind v4: never use `style={({ pressed }) => [...]}` on `Pressable` — use `useState` + static className.
- Theme: import from `constants/theme.ts` (`useThemeColors`), use `dark:` variants; do not hardcode colors.
- Icons: `@expo/vector-icons/Feather`.
- Path alias: `@/*` → repo root.
- Do NOT add code comments unless surrounding code already has them.
- UI copy stays English.
- Commit per task with a conventional message; commit only the task's files.

## File Structure

- `utils/filters.ts` (new) — pure helpers: `getSelectionState`, `normalizeSelection`, `filterBadgeCount`, `pluralLabel`, `SelectionState` type.
- `tests/filters.test.ts` (new) — unit tests for the utils.
- `convex/transactions.ts` (modify) — `list` args → arrays; `ListFilters` → arrays; index selection + post-index filter; `matchesFilters` with Sets/includes.
- `tests/transactions.list.test.ts` (modify) — convert single-select filter tests to arrays; add multi-account/multi-category/member-array/combined tests.
- `components/MultiSelectField.tsx` (new) — inline combobox: collapsed tri-state field + expandable panel with select-all header, search, checkbox rows.
- `components/FilterSheet.tsx` (modify) — replace `OptionList` with two `MultiSelectField`s; props become arrays + toggle/toggle-all callbacks.
- `app/(tabs)/transactions.tsx` (modify) — state arrays; type-change pruning; query-arg normalization; badge via utils.
- `docs/Product Requirement Document/PRD.md` (modify) — §3.6 filtering text + "Last updated" date.

---

### Task 1: Pure filter utils

**Files:**
- Create: `utils/filters.ts`
- Test: `tests/filters.test.ts`

**Interfaces:**
- Produces (used by Tasks 3, 4):
  - `export type SelectionState = "empty" | "partial" | "all"`
  - `export function getSelectionState(total: number, selected: number): SelectionState`
  - `export function normalizeSelection(selectedIds: string[], optionIds: string[]): string[] | undefined`
  - `export function filterBadgeCount(typeActive: boolean, accountState: SelectionState, accountSelected: number, categoryState: SelectionState, categorySelected: number): number`
  - `export function pluralLabel(title: string): string`

- [ ] **Step 1: Write the failing tests**

Create `tests/filters.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/filters.test.ts`
Expected: FAIL — module `../utils/filters` cannot be resolved / functions undefined.

- [ ] **Step 3: Write the implementation**

Create `utils/filters.ts`:

```ts
export type SelectionState = "empty" | "partial" | "all";

export function getSelectionState(total: number, selected: number): SelectionState {
  if (selected <= 0) return "empty";
  if (selected >= total) return "all";
  return "partial";
}

export function normalizeSelection(
  selectedIds: string[],
  optionIds: string[],
): string[] | undefined {
  if (optionIds.length === 0) return undefined;
  const selected = selectedIds.filter((id) => optionIds.includes(id));
  if (selected.length === 0) return undefined;
  if (selected.length >= optionIds.length) return undefined;
  return selected;
}

export function filterBadgeCount(
  typeActive: boolean,
  accountState: SelectionState,
  accountSelected: number,
  categoryState: SelectionState,
  categorySelected: number,
): number {
  return (
    (typeActive ? 1 : 0) +
    (accountState === "partial" ? accountSelected : 0) +
    (categoryState === "partial" ? categorySelected : 0)
  );
}

const PLURALS: Record<string, string> = {
  Account: "accounts",
  Category: "categories",
};

export function pluralLabel(title: string): string {
  return PLURALS[title] ?? `${title.toLowerCase()}s`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/filters.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Run full verification**

Run: `npx tsc --noEmit` and `npm run lint` and `npm test`
Expected: all clean / all pass.

- [ ] **Step 6: Commit**

```bash
git add utils/filters.ts tests/filters.test.ts
git commit -m "feat(filters): add pure selection utils with unit tests"
```

---

### Task 2: Backend array args + index selection

**Files:**
- Modify: `convex/transactions.ts:19-30` (`ListFilters`, `matchesFilters`), `convex/transactions.ts:197-364` (`list` handler)
- Test: `tests/transactions.list.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces (used by Task 4): `list` args `accountIds?: Id<"accounts">[]`, `categoryIds?: Id<"categories">[]`, `type?` unchanged. Semantics: `undefined`/`[]` = no constraint; non-empty array = match any member.

- [ ] **Step 1: Update the failing tests — convert single-select filter args to arrays**

In `tests/transactions.list.test.ts`, the `list` query filter args must change from single values to arrays. Edit every query that currently passes `accountId: <id>` to `accountIds: [<id>]` and every `categoryId: <id>` to `categoryIds: [<id>]`. The affected queries are in these tests (grep the file for `accountId:` and `categoryId:` to confirm):
- "owner filters by account" (near line 219)
- "owner filters by category" (near line 282)
- "owner combines type and account filters" (near line 387)
- "owner intersects type, account, and category filters" (near line 446)
- "member filtering a hidden category returns empty" (near line 476)
- "member filters by account" (near line 560)
- "respects the limit cap after filtering" (near line 610)

Add these new tests at the end of the `describe("transactions.list", ...)` block (follow the existing seed/identity pattern from the tests around lines 160-400):

```ts
it("owner filters by multiple account ids", async () => {
  const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
  const ids = await t.run(async (ctx) => {
    const s = await seed(ctx);
    const bankId = await ctx.db.insert("accounts", {
      householdId: s.householdId,
      name: "Bank",
      type: "bank",
      balance: 0,
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("transactions", {
      householdId: s.householdId,
      accountId: s.accountId,
      categoryId: s.visibleCatId,
      amount: -100,
      type: "expense",
      note: "cash-tx",
      date: 100,
      createdBy: s.ownerId,
      updatedBy: s.ownerId,
      createdAt: 100,
      updatedAt: 100,
    });
    await ctx.db.insert("transactions", {
      householdId: s.householdId,
      accountId: bankId,
      categoryId: s.visibleCatId,
      amount: -200,
      type: "expense",
      note: "bank-tx",
      date: 200,
      createdBy: s.ownerId,
      updatedBy: s.ownerId,
      createdAt: 200,
      updatedAt: 200,
    });
    return { ...s, bankId };
  });
  const result = await owner.query(api.transactions.list, {
    startDate: 0,
    endDate: 1_000_000_000_000,
    accountIds: [ids.accountId, ids.bankId],
  });
  expect(result.transactions!.length).toBe(2);
  expect(result.transactions!.map((t) => t.note).sort()).toEqual(["bank-tx", "cash-tx"]);
});

it("owner filters by multiple category ids", async () => {
  const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
  const ids = await t.run(async (ctx) => {
    const s = await seed(ctx);
    const foodCatId = await ctx.db.insert("categories", {
      householdId: s.householdId,
      name: "Food",
      type: "expense",
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("transactions", {
      householdId: s.householdId,
      accountId: s.accountId,
      categoryId: s.visibleCatId,
      amount: -100,
      type: "expense",
      note: "vis-cat-tx",
      date: 100,
      createdBy: s.ownerId,
      updatedBy: s.ownerId,
      createdAt: 100,
      updatedAt: 100,
    });
    await ctx.db.insert("transactions", {
      householdId: s.householdId,
      accountId: s.accountId,
      categoryId: foodCatId,
      amount: -50,
      type: "expense",
      note: "food-tx",
      date: 200,
      createdBy: s.ownerId,
      updatedBy: s.ownerId,
      createdAt: 200,
      updatedAt: 200,
    });
    return { ...s, foodCatId };
  });
  const result = await owner.query(api.transactions.list, {
    startDate: 0,
    endDate: 1_000_000_000_000,
    categoryIds: [ids.visibleCatId, ids.foodCatId],
  });
  expect(result.transactions!.length).toBe(2);
  expect(result.transactions!.map((t) => t.note).sort()).toEqual(["food-tx", "vis-cat-tx"]);
});

it("member filters by multiple account and category ids", async () => {
  const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
  const ids = await t.run(async (ctx) => {
    const s = await seed(ctx);
    const bankId = await ctx.db.insert("accounts", {
      householdId: s.householdId,
      name: "Bank",
      type: "bank",
      balance: 0,
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const foodCatId = await ctx.db.insert("categories", {
      householdId: s.householdId,
      name: "Food",
      type: "expense",
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("transactions", {
      householdId: s.householdId,
      accountId: s.accountId,
      categoryId: s.visibleCatId,
      amount: -100,
      type: "expense",
      note: "match-1",
      date: 100,
      createdBy: s.ownerId,
      updatedBy: s.ownerId,
      createdAt: 100,
      updatedAt: 100,
    });
    await ctx.db.insert("transactions", {
      householdId: s.householdId,
      accountId: bankId,
      categoryId: foodCatId,
      amount: -50,
      type: "expense",
      note: "match-2",
      date: 200,
      createdBy: s.ownerId,
      updatedBy: s.ownerId,
      createdAt: 200,
      updatedAt: 200,
    });
    const gasCatId = await ctx.db.insert("categories", {
      householdId: s.householdId,
      name: "Gas",
      type: "expense",
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("transactions", {
      householdId: s.householdId,
      accountId: bankId,
      categoryId: gasCatId,
      amount: -30,
      type: "expense",
      note: "wrong-category",
      date: 300,
      createdBy: s.ownerId,
      updatedBy: s.ownerId,
      createdAt: 300,
      updatedAt: 300,
    });
    return { ...s, bankId, foodCatId, gasCatId };
  });
  const result = await member.query(api.transactions.list, {
    startDate: 0,
    endDate: 1_000_000_000_000,
    accountIds: [ids.accountId, ids.bankId],
    categoryIds: [ids.visibleCatId, ids.foodCatId],
  });
  expect(result.transactions!.length).toBe(2);
  expect(result.transactions!.map((t) => t.note).sort()).toEqual(["match-1", "match-2"]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/transactions.list.test.ts`
Expected: FAIL — the args `accountIds`/`categoryIds` are rejected by the validator (the current schema declares `accountId`/`categoryId`).

- [ ] **Step 3: Update the args and filters**

In `convex/transactions.ts`, replace the `list` args block (lines 198-205) with:

```ts
args: {
  startDate: v.number(),
  endDate: v.number(),
  limit: v.optional(v.number()),
  accountIds: v.optional(v.array(v.id("accounts"))),
  categoryIds: v.optional(v.array(v.id("categories"))),
  type: v.optional(transactionType),
},
```

Replace the `ListFilters` type and `matchesFilters` (lines 19-30) with:

```ts
type ListFilters = {
  accountIds?: Id<"accounts">[];
  categoryIds?: Id<"categories">[];
  type?: "income" | "expense" | "transfer";
};

function matchesFilters(row: Doc<"transactions">, filters: ListFilters): boolean {
  if (filters.accountIds !== undefined && !filters.accountIds.includes(row.accountId)) return false;
  if (filters.categoryIds !== undefined) {
    if (row.categoryId === undefined) return false;
    if (!filters.categoryIds.includes(row.categoryId)) return false;
  }
  if (filters.type !== undefined && row.type !== filters.type) return false;
  return true;
}
```

Replace the filter-construction block (lines 223-231, the `filters` object and `activeFilterCount`) with:

```ts
const filters: ListFilters = {};
if (args.accountIds !== undefined && args.accountIds.length > 0) filters.accountIds = args.accountIds;
if (args.categoryIds !== undefined && args.categoryIds.length > 0) filters.categoryIds = args.categoryIds;
if (args.type !== undefined) filters.type = args.type;

const pinnedDim: "account" | "category" | "type" | "none" =
  filters.accountIds !== undefined && filters.accountIds.length === 1
    ? "account"
    : filters.categoryIds !== undefined && filters.categoryIds.length === 1
      ? "category"
      : filters.type !== undefined
        ? "type"
        : "none";

const needsFilter =
  (filters.accountIds !== undefined && pinnedDim !== "account") ||
  (filters.categoryIds !== undefined && pinnedDim !== "category") ||
  (filters.type !== undefined && pinnedDim !== "type");
```

- [ ] **Step 4: Replace the owner index selection + filter**

Add this import at the top of `convex/transactions.ts` (next to the other imports):

```ts
import { Expression } from "convex/server";
```

Replace the owner-path block (lines 233-289, from `if (isOwner) {` through the closing of the `rows` assignment before the hydration loop) with:

```ts
    if (isOwner) {
      const base = ctx.db.query("transactions");
      let queryBuilder: ReturnType<typeof base.withIndex>;
      if (pinnedDim === "account") {
        queryBuilder = base.withIndex("by_household_account_date", (q) =>
          q
            .eq("householdId", membership.householdId)
            .eq("accountId", filters.accountIds![0])
            .gte("date", args.startDate)
            .lt("date", args.endDate),
        );
      } else if (pinnedDim === "category") {
        queryBuilder = base.withIndex("by_household_category_date", (q) =>
          q
            .eq("householdId", membership.householdId)
            .eq("categoryId", filters.categoryIds![0])
            .gte("date", args.startDate)
            .lt("date", args.endDate),
        );
      } else if (pinnedDim === "type") {
        queryBuilder = base.withIndex("by_household_type_date", (q) =>
          q
            .eq("householdId", membership.householdId)
            .eq("type", filters.type)
            .gte("date", args.startDate)
            .lt("date", args.endDate),
        );
      } else {
        queryBuilder = base.withIndex("by_household_date", (q) =>
          q
            .eq("householdId", membership.householdId)
            .gte("date", args.startDate)
            .lt("date", args.endDate),
        );
      }

      let rows: Doc<"transactions">[];
      if (needsFilter) {
        rows = await queryBuilder
          .filter((q) => {
            const parts: Expression<boolean>[] = [];
            if (filters.accountIds !== undefined && pinnedDim !== "account") {
              parts.push(
                q.or(...filters.accountIds.map((id) => q.eq(q.field("accountId"), id))),
              );
            }
            if (filters.categoryIds !== undefined && pinnedDim !== "category") {
              parts.push(
                q.or(...filters.categoryIds.map((id) => q.eq(q.field("categoryId"), id))),
              );
            }
            if (filters.type !== undefined && pinnedDim !== "type") {
              parts.push(q.eq(q.field("type"), filters.type));
            }
            return parts.length === 1 ? parts[0] : q.and(...parts);
          })
          .order("desc")
          .take(limit);
      } else {
        rows = await queryBuilder.order("desc").take(limit);
      }
```

The hydration loop and member path that follow (lines 290-363) stay unchanged — the member path already calls `matchesFilters(row, filters)`, which now handles arrays.

- [ ] **Step 5: Run codegen, typecheck, and tests**

Run: `npx convex codegen`
Run: `npx tsc --noEmit`
Run: `npx vitest run tests/transactions.list.test.ts`
Expected: all pass (16 tests: 13 existing converted + 3 new).

- [ ] **Step 6: Run full verification**

Run: `npm run lint` and `npm test`
Expected: clean / all pass.

- [ ] **Step 7: Commit**

```bash
git add convex/transactions.ts tests/transactions.list.test.ts
git commit -m "feat(transactions): multi-value account/category filters"
```

---

### Task 3: MultiSelectField component

**Files:**
- Create: `components/MultiSelectField.tsx`
- Modify: `components/FilterSheet.tsx` (removes `OptionList`; covered in Task 4 — do not touch here)

**Interfaces:**
- Consumes: `pluralLabel` and `getSelectionState` from `utils/filters.ts` (Task 1).
- Produces (used by Task 4):

```ts
type Props = {
  title: string;
  options: { _id: string; name: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onToggleAll: (selectAll: boolean) => void;
  disabled?: boolean;
};
```

This component is UI-only; the repo has no RN component test harness, so verification is typecheck + lint. The pure logic it uses is already unit-tested in Task 1.

- [ ] **Step 1: Write the component**

Create `components/MultiSelectField.tsx`:

```tsx
import Feather from "@expo/vector-icons/Feather";
import { useThemeColors } from "@/constants/theme";
import { getSelectionState, pluralLabel } from "@/utils/filters";
import { useMemo, useState } from "react";
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from "react-native";

const SEARCH_THRESHOLD = 8;

type Props = {
  title: string;
  options: { _id: string; name: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onToggleAll: (selectAll: boolean) => void;
  disabled?: boolean;
};

export function MultiSelectField({
  title,
  options,
  selectedIds,
  onToggle,
  onToggleAll,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const C = useThemeColors();

  const total = options.length;
  const selectedCount = options.filter((o) => selectedIds.includes(o._id)).length;
  const state = getSelectionState(total, selectedCount);
  const showSearch = total > SEARCH_THRESHOLD;
  const plural = pluralLabel(title);

  const filtered = useMemo(() => {
    if (!showSearch || search.trim() === "") return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, showSearch, search]);

  const label =
    state === "partial"
      ? `${selectedCount} of ${total} ${plural}`
      : `All ${plural}`;

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
        {title}
      </Text>
      <Pressable
        onPress={() => {
          Keyboard.dismiss();
          if (open) {
            setOpen(false);
          } else {
            setSearch("");
            setOpen(true);
          }
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: open }}
        className={`h-12 flex-row items-center justify-between rounded-xl border px-4 ${
          disabled
            ? "border-border bg-background opacity-50 dark:border-border-dark dark:bg-background-dark"
            : "border-border bg-background dark:border-border-dark dark:bg-background-dark"
        }`}
      >
        <View className="flex-row items-center gap-2">
          <Feather
            name={
              state === "all"
                ? "check-square"
                : state === "partial"
                  ? "minus-square"
                  : "square"
            }
            size={18}
            color={state === "empty" ? C.textSecondary : C.primary}
          />
          <Text
            className={`text-base ${
              disabled
                ? "text-text-secondary dark:text-text-secondary-dark"
                : "text-text-primary dark:text-text-primary-dark"
            }`}
          >
            {disabled ? `All ${plural}` : label}
          </Text>
        </View>
        <Feather name="chevron-down" size={20} color={C.textSecondary} />
      </Pressable>

      {open && !disabled ? (
        <View className="overflow-hidden rounded-xl border border-border dark:border-border-dark">
          <Pressable
            onPress={() => onToggleAll(state !== "all")}
            accessibilityRole="button"
            className="min-h-11 flex-row items-center justify-between border-b border-border px-4 py-2.5 dark:border-border-dark"
          >
            <Text className="text-sm font-medium text-primary dark:text-primary-dark">
              {state === "all" ? "Unselect all" : "Select all"}
            </Text>
            <Feather
              name={
                state === "all"
                  ? "check-square"
                  : state === "partial"
                    ? "minus-square"
                    : "square"
              }
              size={18}
              color={C.primary}
            />
          </Pressable>
          {showSearch ? (
            <View className="border-b border-border px-4 py-2 dark:border-border-dark">
              <TextInput
                placeholder="Search…"
                placeholderTextColor={C.textSecondary}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
              />
            </View>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" className="max-h-52">
            {filtered.length === 0 ? (
              <Text className="px-4 py-6 text-center text-sm text-text-secondary dark:text-text-secondary-dark">
                No results found
              </Text>
            ) : (
              filtered.map((option) => {
                const selected = selectedIds.includes(option._id);
                return (
                  <Pressable
                    key={option._id}
                    onPress={() => {
                      Keyboard.dismiss();
                      onToggle(option._id);
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    className="min-h-12 flex-row items-center justify-between px-4 py-3"
                  >
                    <Text className="text-base text-text-primary dark:text-text-primary-dark">
                      {option.name}
                    </Text>
                    <Feather
                      name={selected ? "check-square" : "square"}
                      size={20}
                      color={selected ? C.primary : C.textSecondary}
                    />
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: clean. (The component is not yet used anywhere, so `npm test` is unaffected.)

- [ ] **Step 3: Commit**

```bash
git add components/MultiSelectField.tsx
git commit -m "feat(components): add MultiSelectField inline combobox"
```

---

### Task 4: Wire FilterSheet + transactions page

**Files:**
- Modify: `components/FilterSheet.tsx` (props, remove `OptionList` + `SEARCH_THRESHOLD`, use `MultiSelectField`)
- Modify: `app/(tabs)/transactions.tsx` (state arrays, type pruning, queryArgs, badge, FilterSheet props)

**Interfaces:**
- Consumes: `MultiSelectField` (Task 3), utils from `utils/filters.ts` (Task 1), `list` array args (Task 2).

**FilterSheet Props (new):**

```ts
type Props = {
  visible: boolean;
  typeFilter: TypeFilter;
  accountIds: Id<"accounts">[];
  categoryIds: Id<"categories">[];
  accounts: Doc<"accounts">[];
  categories: Doc<"categories">[];
  onTypeFilterChange: (type: TypeFilter) => void;
  onAccountToggle: (id: Id<"accounts">) => void;
  onAccountIdsChange: (ids: Id<"accounts">[]) => void;
  onCategoryToggle: (id: Id<"categories">) => void;
  onCategoryIdsChange: (ids: Id<"categories">[]) => void;
  onReset: () => void;
  onClose: () => void;
};
```

- [ ] **Step 1: Rewrite FilterSheet**

In `components/FilterSheet.tsx`:
1. Remove the `OptionList` function (lines 33-121) and the `SEARCH_THRESHOLD` const (line 17).
2. After removing `OptionList`, the main `FilterSheet` body no longer uses `Feather`, `useThemeColors`, `Keyboard`, `TextInput`, or `useState` (they were only used inside `OptionList`). Trim the imports on line 1-5 to exactly:

```ts
import { Shadow } from "@/constants/theme";
import { useMemo } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { Doc, Id } from "@/convex/_generated/dataModel";
```

3. Replace the `Props` type with the interface above.
3. Import `MultiSelectField`:

```ts
import { MultiSelectField } from "@/components/MultiSelectField";
```

4. Replace the Account + Category sections in the sheet body (currently the two `<View className="mt-4">` blocks using `OptionList`, around lines 192-209) with:

```tsx
          <View className="mt-4">
            <MultiSelectField
              title="Account"
              options={accounts.map((a) => ({ _id: a._id, name: a.name }))}
              selectedIds={accountIds}
              onToggle={(id) => onAccountToggle(id as Id<"accounts">)}
              onToggleAll={(selectAll) =>
                onAccountIdsChange(selectAll ? accounts.map((a) => a._id) : [])
              }
            />
          </View>

          <View className="mt-4">
            <MultiSelectField
              title="Category"
              options={categoryOptions.map((c) => ({ _id: c._id, name: c.name }))}
              selectedIds={categoryIds}
              onToggle={(id) => onCategoryToggle(id as Id<"categories">)}
              onToggleAll={(selectAll) =>
                onCategoryIdsChange(
                  selectAll ? categoryOptions.map((c) => c._id) : [],
                )
              }
              disabled={typeFilter === "transfer"}
            />
          </View>
```

The `categoryOptions` derivation (lines 136-140) stays as-is. The `Id` import (line 5) is already present.

- [ ] **Step 2: Rewrite the transactions page state and wiring**

In `app/(tabs)/transactions.tsx`:

1. Import the utils at the top:

```ts
import { filterBadgeCount, getSelectionState, normalizeSelection } from "@/utils/filters";
```

2. Replace the two filter states (lines 92-93) with arrays:

```ts
const [accountIds, setAccountIds] = useState<Id<"accounts">[]>([]);
const [categoryIds, setCategoryIds] = useState<Id<"categories">[]>([]);
```

3. After the `categoriesResult`/`accountsResult` queries (line 123), compute the option lists and selection stats once:

```ts
const accountOptions = accountsResult?.accounts ?? [];
const categoryOptions = categoriesResult?.categories ?? [];
const accountSelected = accountOptions.filter((a) => accountIds.includes(a._id)).length;
const categorySelected = categoryOptions.filter((c) => categoryIds.includes(c._id)).length;
const accountState = getSelectionState(accountOptions.length, accountSelected);
const categoryState = getSelectionState(categoryOptions.length, categorySelected);
```

4. Replace `queryArgs` (lines 125-133) with normalized arrays:

```ts
const queryArgs = useMemo(() => {
  const normalizedAccounts = normalizeSelection(
    accountIds,
    accountOptions.map((a) => a._id),
  );
  const normalizedCategories = normalizeSelection(
    categoryIds,
    categoryOptions.map((c) => c._id),
  );
  return {
    ...range,
    ...(typeFilter !== "all" ? { type: typeFilter } : {}),
    ...(normalizedAccounts !== undefined ? { accountIds: normalizedAccounts } : {}),
    ...(normalizedCategories !== undefined ? { categoryIds: normalizedCategories } : {}),
  };
}, [range, typeFilter, accountIds, categoryIds, accountOptions, categoryOptions]);
```

5. Replace the badge computation (lines 168-173) with:

```ts
const activeFilterCount = filterBadgeCount(
  typeFilter !== "all",
  accountState,
  accountSelected,
  categoryState,
  categorySelected,
);
const filtersActive = activeFilterCount > 0;
```

6. Replace `clearFilters` (lines 181-185) with:

```ts
const clearFilters = () => {
  setTypeFilter("all");
  setAccountIds([]);
  setCategoryIds([]);
};
```

7. Update the empty-state/filtersActive references: replace the old `filtersActive` variable usage with the new `filtersActive` defined above (the variable has the same name, so references like the empty-state text already work; verify there is no leftover reference to `accountFilter`/`categoryFilter`).

8. Replace the `FilterSheet` usage (lines 424-445) with:

```tsx
      <FilterSheet
        visible={filterSheetOpen}
        typeFilter={typeFilter}
        accountIds={accountIds}
        categoryIds={categoryIds}
        accounts={accountsResult?.accounts ?? []}
        categories={categoriesResult?.categories ?? []}
        onTypeFilterChange={(type) => {
          setTypeFilter(type);
          setCategoryIds((current) => {
            if (current.length === 0 || type === "all") return current;
            if (type === "transfer") return [];
            return current.filter((id) => {
              const cat = categoriesResult?.categories?.find((c) => c._id === id);
              return cat !== undefined && cat.type === type;
            });
          });
        }}
        onAccountToggle={(id) =>
          setAccountIds((cur) =>
            cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
          )
        }
        onAccountIdsChange={setAccountIds}
        onCategoryToggle={(id) =>
          setCategoryIds((cur) =>
            cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
          )
        }
        onCategoryIdsChange={setCategoryIds}
        onReset={clearFilters}
        onClose={() => setFilterSheetOpen(false)}
      />
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Run: `npm test`
Expected: all clean / all pass. (`npm test` covers the utils and backend; the page wiring is typechecked and linted.)

- [ ] **Step 4: Commit**

```bash
git add components/FilterSheet.tsx "app/(tabs)/transactions.tsx"
git commit -m "feat(transactions): multi-select account and category filters in sheet"
```

---

### Task 5: PRD update

**Files:**
- Modify: `docs/Product Requirement Document/PRD.md` (header line 4, §3.6 lines 262-275)

- [ ] **Step 1: Update the header date**

Change `> Last updated: 2026-08-18` to `> Last updated: 2026-08-20`.

- [ ] **Step 2: Rewrite the §3.6 filtering paragraph**

Replace the sentence "Category options are contextual to the selected type (income → income categories, expense → expense categories); selecting type `transfer` clears an active category filter, since transfers have no category." with multi-select wording, and adjust the index sentence. Replace lines 262-275 with:

```markdown
**Filtering (as of 2026-08-20):** the Transactions page filters the visible list
server-side by **type** (income/expense/transfer), **accounts**, and **categories**,
with the date range (This Month / Last Month / Custom Range) consolidated behind a
single Date chip. The summary card and per-day net totals derive from the filtered
query result, so they always match the visible rows. Account and Category are
multi-select: each is a compact combobox with a tri-state header (empty / partial /
all), a "select all / unselect all" action, and checkbox rows; the `list` query takes
`accountIds` and `categoryIds` arrays, where an empty or full selection is treated as
no filter. Category options are contextual to the selected type (income → income
categories, expense → expense categories); selecting type `transfer` clears active
category filters, since transfers have no category. A filter dimension with a single
selected value is pinned to its compound index
(`by_household_account_date`, `by_household_category_date`, `by_household_type_date`);
dimensions with multiple values are applied as a post-index `or` filter, so a filter
never scans the full date window. For Members, the existing bounded scan (limit × 10)
still applies — hidden-category rows cannot be indexed away — so heavy filtering over
long ranges may return fewer rows than the limit. The empty state distinguishes "no
transactions at all" from "no transactions match your filters" (with a Clear filters
action).
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: clean (docs-only change).

- [ ] **Step 4: Commit**

```bash
git add "docs/Product Requirement Document/PRD.md"
git commit -m "docs(prd): document multi-select account/category filters"
```

---

### Task 6: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run all verification**

Run: `npx convex codegen` (regenerates `_generated/`; no schema change expected)
Run: `npx tsc --noEmit`
Run: `npm run lint`
Run: `npm test`
Expected: all pass (unit tests for filters, backend list tests, and all other suites).

- [ ] **Step 2: Sanity-check the change surface**

Run: `git status` and `git diff --stat HEAD~6`
Expected files changed across the branch: `utils/filters.ts`, `tests/filters.test.ts`, `convex/transactions.ts`, `tests/transactions.list.test.ts`, `components/MultiSelectField.tsx`, `components/FilterSheet.tsx`, `app/(tabs)/transactions.tsx`, `docs/Product Requirement Document/PRD.md`.

No commit for this task (verification only).