# Transactions Filters — Multi-Select Account & Category

> Status: Living spec (supersedes the single-select Account/Category controls from `2026-08-20-transactions-filters-design.md`; Date + Type controls unchanged)
> Date: 2026-08-20

## 1. Context

The Transactions page filter sheet (shipped on branch `review`, commits `ec6aa1d..29adde5`)
lets the user filter by Date, Type, Account, and Category. Today Account and Category are
single-select: an always-expanded `OptionList` with an inline search input (shown only when
more than 8 options exist). The user asked for a compact **combobox** so long account/category
lists do not bloat the sheet, and expanded the requirement to **multi-select**:

- Each of Account and Category becomes a dropdown field with a **tri-state header**
  (empty / partial / all) and a "select all / unselect all" action.
- Each option row is a **checkbox** (selected or not).
- Filtering by multiple accounts and multiple categories must be supported end to end.

This spec covers that enhancement only. It assumes the existing Date pill, Type chips,
badge, empty state, and server-side filter architecture stay as-is unless stated otherwise.

## 2. Goals

- Compact the filter sheet: Account and Category collapse to two small fields regardless of
  list length.
- Support filtering by any subset of accounts and any subset of categories, including
  "all" and "all except N".
- Keep the query efficient (index-backed where possible) and the member visibility
  guarantees intact (no hidden account/category leaks).
- Keep the logic testable: tri-state derivation and query-arg normalization are pure
  functions with unit tests.

## 3. Backend (`convex/transactions.ts`)

### 3.1 Args

Replace the single-value filter args with arrays:

```ts
export const listArgs = v.object({
  startDate: v.number(),
  endDate: v.number(),
  type: v.optional(v.union(v.literal("income"), v.literal("expense"), v.literal("transfer"))),
  accountIds: v.optional(v.array(v.id("accounts"))),
  categoryIds: v.optional(v.array(v.id("categories"))),
  limit: v.optional(v.number()),
});
```

Semantics of the arrays:

- `undefined` or `[]` → no constraint for that dimension (match all).
- Non-empty array → match transactions whose field is **any** member of the array.
- The client normalizes "every option selected" to `undefined` (Section 4.3), so the
  backend never receives a redundant full-set array.

### 3.2 Index selection (owner path)

Convex `withIndex` constraints support only `eq` on a single value per field (no `in`),
so a dimension with 2+ selected values cannot use the per-dimension compound index.
Pick the index by this priority — the first dimension that is a *singleton* array wins:

1. `accountIds.length === 1` → `by_household_account_date`, constrain `householdId` +
   `accountId` (eq) + `date` range.
2. else `categoryIds.length === 1` → `by_household_category_date`, constrain `householdId` +
   `categoryId` (eq) + `date` range.
3. else `type` set → `by_household_type_date`, constrain `householdId` + `type` (eq) +
   `date` range.
4. else → `by_household_date`, constrain `householdId` + `date` range.

Every dimension not pinned by the chosen index is applied as a **post-index filter**
(`q.and`):

- remaining multi-dimension arrays → `q.or(...ids.map((id) => q.eq(field, id)))`
- `type` (when not pinned) → `q.eq("type", type)`

Only build the `filter()` call when at least one extra condition exists; otherwise the
owner path is a pure index range (no filter callback), which removes the previous
tautology (`_id === _id`) construction entirely.

`.take(limit)` applies after filtering so the existing limit semantics are preserved.

### 3.3 Member path

Members cannot use the account/category compound indexes (visibility) and already scan
`by_household_date` with the hidden-category skip. After the skip, apply the same
constraints as a JS predicate (no Convex `.filter()` needed):

- `accountIds` → `selectedAccounts.has(tx.accountId)`
- `categoryIds` → `selectedCategories.has(tx.categoryId)`
- `type` → `tx.type === type`

The existing bounded-scan caveat (limit × 10, documented in PRD §3.6) is unchanged.

### 3.4 Backward compatibility

The only other caller of `transactions.list` is `home.tsx` (passes `startDate`/`endDate`
only) — unaffected. Tests that pass `accountId`/`categoryId` are updated to the array form.

## 4. Client

### 4.1 New component `components/MultiSelectField.tsx`

A reusable, self-contained inline combobox (no nested Modal — it expands inside the sheet):

- **Collapsed field:** `Pressable` styled like `SelectField` (h-12, border, chevron-down).
  Label text is derived from the tri-state:
  - empty → `All <title>s` (e.g. "All accounts")
  - partial → `<n> of <total> <title>s` (e.g. "3 of 8 accounts")
  - all → `All <title>s`
  - A small filled/partial square glyph (Feather `check-square` / `minus-square` /
    `square`) reflects the tri-state.
- **Expanded panel** (inline, below the field, bounded `max-h-52` + `ScrollView`
  `keyboardShouldPersistTaps="handled"`):
  - Header row: a tri-state checkbox + label. Label shows **"Select all"** when the state
    is empty or partial, and **"Unselect all"** when the state is all; tapping flips the
    whole set (select-all when empty/partial, unselect-all when all).
  - Search `TextInput` shown only when `options.length > 8` (`SEARCH_THRESHOLD`, same as
    `OptionList`/`SelectField`), filters by name substring.
  - Option rows: `Feather check-square` / `square` + name; tapping toggles that option.
- **Props:**

```ts
type Props = {
  title: string;                          // "Account" | "Category"
  options: { _id: string; name: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;         // toggle one option
  onToggleAll: (selectAll: boolean) => void; // true = select all, false = unselect all
  disabled?: boolean;                     // e.g. Category when type === "transfer"
};
```

- The pluralization hack `title.toLowerCase() === "account"` is dropped; the plural label
  is derived from the prop (e.g. `"Account"` → `"accounts"`, `"Category"` → `"categories"`)
  via a small pure helper so it stays testable.

### 4.2 `components/FilterSheet.tsx`

- Replace both `OptionList` usages with `MultiSelectField` (Account and Category).
- Props change from single ids to arrays: `accountIds: Id<"accounts">[]`,
  `categoryIds: Id<"categories">[]`, and callbacks `onAccountToggle(id)`,
  `onCategoryToggle(id)`, `onToggleAllAccounts(selectAll)`, `onToggleAllCategories(selectAll)`.
- Category option list stays type-contextual: `transfer` → no categories (field disabled);
  `income`/`expense` → categories of that type; `all` → all categories. This is the same
  `categoryOptions` derivation as today.

### 4.3 `app/(tabs)/transactions.tsx`

- State: `accountIds`/`categoryIds` become `Id[]`; `typeFilter` unchanged.
- **Type-change pruning (extends the F2 fix to arrays):** when the type changes, drop any
  selected category whose type no longer matches: `transfer` → clear all; `income`/
  `expense` → keep only categories whose `type === newType`; `all` → keep everything.
- **Query-arg normalization (pure util):** for each dimension, map the selection against
  the *current* option list into `undefined` when the selection is empty **or** covers
  every option; otherwise the array of selected ids. Normalization runs inside `queryArgs`
  so the query stays stable and the index path stays optimal.
- **Badge:** `Filter · N` where `N` = `(typeFilter !== "all" ? 1 : 0)` + sum over partial
  dimensions of their selected-item count (a dimension in empty or all state contributes 0).
- Reset clears type + both arrays.

### 4.4 Pure utils

New file `utils/filters.ts` (unit-testable, no React/Convex imports):

- `getSelectionState(total: number, selected: number): "empty" | "partial" | "all"`
- `normalizeSelection(selectedIds: string[], optionIds: string[]): string[] | undefined`
  (returns the array, or `undefined` when empty or covering all option ids)
- `filterBadgeCount(typeActive: boolean, accountState, accountCount, categoryState, categoryCount): number`
- `pluralLabel(title: string): string` (`"Account"` → `"accounts"`, `"Category"` → `"categories"`)

## 5. Edge Cases

- **No options** (no accounts/categories yet): collapsed field shows "All accounts" /
  "All categories", disabled; badge unaffected.
- **Search with no matches:** show "No results found" (same as `SelectField`).
- **Selection while options change** (e.g. category type-context prunes the list): selected
  ids that no longer exist in the option list are pruned at the query-arg layer (they are
  simply absent from the option set → excluded from normalization and badge count).
- **Long lists:** search threshold at 8; panel scrolls; the sheet's outer ScrollView (from
  the earlier fix) still reaches Reset/Done.
- **Keyboard:** panel `keyboardShouldPersistTaps="handled"` so taps land on rows while the
  search input is focused; `Keyboard.dismiss()` on collapse.

## 6. Testing

- **Unit (vitest, `tests/filters.test.ts`):** tri-state boundaries (0, middle, full),
  normalization (empty, full, subset, unknown ids), badge counting (type on/off × states),
  plural labels.
- **Backend (`tests/transactions.list.test.ts`):**
  - multi `accountIds` (2 accounts) returns the union,
  - multi `categoryIds` (2 categories) returns the union,
  - singleton `accountIds`/`categoryIds` still resolve via the compound index paths,
  - type + multi account + multi category combined returns the intersection,
  - member path with multi `accountIds` and multi `categoryIds` (visible only),
  - member filtering a hidden category id returns empty (unchanged guarantee),
  - limit cap after filtering (existing test, adapted to array args).
- All existing single-select tests are converted to the array form.
- Verification: `npx convex codegen` (schema untouched, but required after any
  `convex/*.ts` change), `npx tsc --noEmit`, `npm run lint`, `npm test`.

## 7. Documentation

Update `docs/Product Requirement Document/PRD.md` §3.6 to describe multi-select
Account/Category filters (checkbox + tri-state), the array args, and the index-selection
rule; bump the "Last updated" line to 2026-08-20.

## 8. Out of Scope

- Multi-select for Type (stays as single chips).
- Virtualized lists (FlatList/FlashList) — the search + bounded scroll is sufficient for
  realistic account/category counts; revisit only if lists grow to hundreds.
- Applying the same multi-select UX to `transaction-form` or other forms.