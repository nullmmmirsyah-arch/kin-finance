# Filter Sheet Deferred Apply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Transactions filter sheet apply its changes only when the user taps "Done" (draft-until-Done), instead of refreshing the list on every interaction.

**Architecture:** `FilterSheet` becomes the owner of a local draft (`draftType`/`draftAccountIds`/`draftCategoryIds`) re-initialized from the committed props each time the sheet opens. Every in-sheet interaction mutates only the draft. "Done" commits the draft to the page via a single new `onApply` callback; closing without Done (backdrop/back) discards the draft. The page keeps the committed state and its existing `queryArgs`/badge derivation unchanged, so the list refreshes exactly when `onApply` updates the committed state.

**Tech Stack:** React Native (Expo SDK 54), NativeWind 4, TypeScript.

## Global Constraints

- Path alias `@/*` → repo root.
- NativeWind v4: never use `style={({ pressed }) => [...]}` on `Pressable` — use `useState` + static style/`className`.
- No code comments unless the surrounding code already has them.
- English UI copy (labels unchanged: "Filter", "Type", "All", "Income", "Expense", "Transfer", "Account", "Category", "Reset", "Done").
- No changes to `convex/*.ts` or `convex/schema.ts` in this plan — do NOT run `npx convex codegen`.
- No new unit tests (no component test harness exists); verification is `npx tsc --noEmit`, `npm run lint`, `npm test` (69 existing tests must stay green).
- Commit each task separately on branch `review`.

---

### Task 1: Deferred apply in `FilterSheet` + rewire the Transactions page

**Files:**
- Modify: `components/FilterSheet.tsx` (replace the whole file)
- Modify: `app/(tabs)/transactions.tsx` (the `<FilterSheet ... />` JSX, currently lines ~449-481)
- Reference (read-only): `components/MultiSelectField.tsx`, `docs/superpowers/specs/2026-08-20-filter-sheet-draft-design.md`

**Interfaces:**
- Consumes: `MultiSelectField` props `{ title, options: {_id: string; name: string}[], selectedIds: string[], onToggle: (id: string) => void, onToggleAll: (selectAll: boolean) => void, disabled?: boolean }` (unchanged — do not edit `MultiSelectField.tsx`).
- Produces: `FilterSheet` new props `{ visible: boolean; typeFilter: TypeFilter; accountIds: Id<"accounts">[]; categoryIds: Id<"categories">[]; accounts: Doc<"accounts">[]; categories: Doc<"categories">[]; onApply: (type: TypeFilter, accountIds: Id<"accounts">[], categoryIds: Id<"categories">[]) => void; onClose: () => void }` (Task 2 does not consume these, but the page's `<FilterSheet>` usage must match).

- [ ] **Step 1: Replace `components/FilterSheet.tsx` with the draft version**

Replace the entire file content with:

```tsx
import { Shadow } from "@/constants/theme";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { MultiSelectField } from "@/components/MultiSelectField";

export type TransactionType = "income" | "expense" | "transfer";
export type TypeFilter = "all" | TransactionType;

const TYPE_OPTIONS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "income", label: "Income" },
  { id: "expense", label: "Expense" },
  { id: "transfer", label: "Transfer" },
];

type Props = {
  visible: boolean;
  typeFilter: TypeFilter;
  accountIds: Id<"accounts">[];
  categoryIds: Id<"categories">[];
  accounts: Doc<"accounts">[];
  categories: Doc<"categories">[];
  onApply: (
    type: TypeFilter,
    accountIds: Id<"accounts">[],
    categoryIds: Id<"categories">[],
  ) => void;
  onClose: () => void;
};

export function FilterSheet({
  visible,
  typeFilter,
  accountIds,
  categoryIds,
  accounts,
  categories,
  onApply,
  onClose,
}: Props) {
  const [draftType, setDraftType] = useState<TypeFilter>(typeFilter);
  const [draftAccountIds, setDraftAccountIds] = useState<Id<"accounts">[]>(accountIds);
  const [draftCategoryIds, setDraftCategoryIds] = useState<Id<"categories">[]>(categoryIds);

  useEffect(() => {
    if (!visible) return;
    setDraftType(typeFilter);
    setDraftAccountIds(accountIds);
    setDraftCategoryIds(categoryIds);
  }, [visible, typeFilter, accountIds, categoryIds]);

  const categoryOptions = useMemo(() => {
    if (draftType === "transfer") return [];
    if (draftType === "all") return categories;
    return categories.filter((c) => c.type === draftType);
  }, [categories, draftType]);

  const accountOptionItems = useMemo(
    () => accounts.map((a) => ({ _id: a._id, name: a.name })),
    [accounts],
  );
  const categoryOptionItems = useMemo(
    () => categoryOptions.map((c) => ({ _id: c._id, name: c.name })),
    [categoryOptions],
  );

  const handleTypeChange = (type: TypeFilter) => {
    setDraftType(type);
    setDraftCategoryIds((current) => {
      if (current.length === 0 || type === "all") return current;
      if (type === "transfer") return [];
      return current.filter((id) => {
        const cat = categories.find((c) => c._id === id);
        return cat !== undefined && cat.type === type;
      });
    });
  };

  const toggleAccount = (id: Id<"accounts">) =>
    setDraftAccountIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  const toggleCategory = (id: Id<"categories">) =>
    setDraftCategoryIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  const handleReset = () => {
    setDraftType("all");
    setDraftAccountIds([]);
    setDraftCategoryIds([]);
  };

  const handleDone = () => {
    onApply(draftType, draftAccountIds, draftCategoryIds);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityLabel="Filter transactions"
    >
      <Pressable className="flex-1 justify-end bg-black/40 px-5 pb-8" onPress={onClose}>
        <Pressable
          className="max-h-[80%] overflow-hidden rounded-2xl bg-background p-5 dark:bg-background-dark"
          style={Shadow.card}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView keyboardShouldPersistTaps="handled" className="flex-grow">
            <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
              Filter
            </Text>

            <View className="mt-4">
              <Text className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                Type
              </Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {TYPE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.id}
                    onPress={() => handleTypeChange(opt.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: draftType === opt.id }}
                    className={`min-h-12 items-center justify-center rounded-full border px-4 ${
                      draftType === opt.id
                        ? "border-primary bg-primary dark:border-primary-dark dark:bg-primary-dark"
                        : "border-border bg-background dark:border-border-dark dark:bg-background-dark"
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        draftType === opt.id
                          ? "text-background dark:text-background-dark"
                          : "text-text-secondary dark:text-text-secondary-dark"
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="mt-4">
              <MultiSelectField
                title="Account"
                options={accountOptionItems}
                selectedIds={draftAccountIds}
                onToggle={(id) => toggleAccount(id as Id<"accounts">)}
                onToggleAll={(selectAll) =>
                  setDraftAccountIds(selectAll ? accounts.map((a) => a._id) : [])
                }
              />
            </View>

            <View className="mt-4">
              <MultiSelectField
                title="Category"
                options={categoryOptionItems}
                selectedIds={draftCategoryIds}
                onToggle={(id) => toggleCategory(id as Id<"categories">)}
                onToggleAll={(selectAll) =>
                  setDraftCategoryIds(
                    selectAll ? categoryOptions.map((c) => c._id) : [],
                  )
                }
                disabled={draftType === "transfer"}
              />
            </View>

            <View className="mt-5 flex-row gap-3">
              <Pressable
                onPress={handleReset}
                accessibilityRole="button"
                className="h-12 flex-1 items-center justify-center rounded-xl border border-error"
              >
                <Text className="text-sm font-medium text-error">Reset</Text>
              </Pressable>
              <Pressable
                onPress={handleDone}
                accessibilityRole="button"
                className="h-12 flex-1 items-center justify-center rounded-xl border border-border bg-background dark:border-border-dark dark:bg-background-dark"
              >
                <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                  Done
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2: Rewire the `<FilterSheet>` usage in `app/(tabs)/transactions.tsx`**

Replace the entire `<FilterSheet ... />` JSX block (currently lines ~449-481, starting at `<FilterSheet` and ending at `/>`) with:

```tsx
      <FilterSheet
        visible={filterSheetOpen}
        typeFilter={typeFilter}
        accountIds={accountIds}
        categoryIds={categoryIds}
        accounts={accountsResult?.accounts ?? []}
        categories={categoriesResult?.categories ?? []}
        onApply={(type, accountIds, categoryIds) => {
          setTypeFilter(type);
          setAccountIds(accountIds);
          setCategoryIds(categoryIds);
        }}
        onClose={() => setFilterSheetOpen(false)}
      />
```

The old handlers (`onTypeFilterChange` with its category-pruning logic, `onAccountToggle`, `onAccountIdsChange`, `onCategoryToggle`, `onCategoryIdsChange`, `onReset`) are removed — their logic now lives inside the sheet. Do NOT touch `clearFilters` (used by the empty-state action) or the committed `typeFilter`/`accountIds`/`categoryIds` state/`queryArgs`/badge derivation.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0, no output. (If `Id` import in transactions.tsx becomes unused it will error here — it is still used by the `useState` type arguments, so it must remain.)

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: exit 0, zero warnings.

- [ ] **Step 5: Regression tests**

Run: `npm test`
Expected: 9 files / 69 tests pass.

- [ ] **Step 6: Commit**

```bash
git add "components/FilterSheet.tsx" "app/(tabs)/transactions.tsx"
git commit -m "feat(filters): apply filter sheet changes on Done"
```

---

### Task 2: Update the PRD

**Files:**
- Modify: `docs/Product Requirement Document/PRD.md`

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing.

- [ ] **Step 1: Update §3.6 "Filtering (as of 2026-08-20)" paragraph**

The paragraph ends with "...(with a Clear filters action)." Append this sentence before that final sentence (i.e., right before "The empty state distinguishes..."):

> Interactions inside the filter sheet (type chips, account/category checkboxes, select-all, Reset) edit a local draft and do not change the visible list; the filters apply only when the user taps **Done**, and closing the sheet without Done (backdrop tap or Android back) discards the draft.

- [ ] **Step 2: Update §4.9 Filter Transactions flow**

Replace the §4.9 text block (lines ~443-450) with:

```text
Transactions tab → Date chip (default This Month) → Last Month / Custom Range (From/To) → Done
  → Filter chip → sheet edits a local draft (Type chips All/Income/Expense/Transfer,
    Account/Category multi-select comboboxes, Reset clears the draft)
  → Done → filters apply → list, summary card, and per-day net totals reflect the active filters
```

- [ ] **Step 3: Add a Change Log entry**

Insert a new row at the top of the §8 table (below the header row `|------|------|-------------|`, above the existing `2026-08-20 | Feature | Transactions filters: ...` row):

```markdown
| 2026-08-20 | UX | Transactions filter sheet now applies filters only on "Done": interactions inside the sheet (type chips, account/category checkboxes, select-all, Reset) edit a local draft and no longer re-query the list per tap; the committed filters update — and the list/header badge refresh — only when the user taps Done; closing the sheet without Done (backdrop tap or Android back) discards the draft. Updates §3.6, §4.9 |
```

- [ ] **Step 4: Verify**

Run: `git diff "docs/Product Requirement Document/PRD.md"` and review — the three edits must be present and the table/flow formatting intact (pipe alignment, no stray characters).

- [ ] **Step 5: Commit**

```bash
git add "docs/Product Requirement Document/PRD.md"
git commit -m "docs(prd): document deferred filter sheet apply"
```