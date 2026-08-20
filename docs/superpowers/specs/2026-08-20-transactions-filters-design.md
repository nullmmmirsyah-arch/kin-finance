# Transactions Filters — Design

> Status: Approved
> Date: 2026-08-20
> Feature: Filter transactions by type, account, and category, with a consolidated
> date filter (This Month / Last Month / Custom Range) behind a single chip.

## 1. Goal

Add filtering to the Transactions page (`app/(tabs)/transactions.tsx`):

- **Type** filter: All / Income / Expense / Transfer.
- **Account** filter: any visible household account.
- **Category** filter: any visible household category (reserved "Initial Balance"
  excluded, since `categories.list` already filters them out).
- Consolidate the existing date controls (This Month / Last Month / Custom Range
  chips + inline custom-range row) into a **single Date chip** that opens a modal.

The Income/Expense/Net summary card and per-day net totals must reflect the active
filters. Filtering is **server-side** so results are accurate for long custom date
ranges and safe from the member scan budget.

## 2. Decisions

- **Server-side filtering** — extend `transactions.list` with optional
  `accountId`, `categoryId`, `type` args. Single code path for every range length.
- **No manual caching** — Convex already caches queries per argument tuple and
  invalidates reactively; filter changes re-run the query cheaply.
- **Two-chip header UI** — one Date chip (with active-range label) and one Filter
  chip (with an active-filter count badge). Custom-range fields move into the Date
  modal; account/category/type move into the Filter modal.
- **Inline option lists inside the Filter sheet** (radio + search when >8 options)
  instead of nested `SelectField` modals, to avoid stacked-Modal jank on Android.
  Implementation mirrors `SelectField`'s search/checkmark pattern.

## 3. Backend

### 3.1 Schema (`convex/schema.ts`)

Add three compound indexes to `transactions` (existing `by_household_date` stays):

```
by_household_date         ["householdId", "date"]             // unchanged
by_household_account_date ["householdId", "accountId", "date"]  // NEW
by_household_category_date ["householdId", "categoryId", "date"] // NEW
by_household_type_date    ["householdId", "type", "date"]        // NEW
```

Rationale: pushing a filter into the index (via `eq` on the second field, range on
the third) avoids scanning all rows in the date window when a filter matches few
rows — e.g. 5 transactions for one account inside a 10 000-row month. This is the
explicit guard against blowing the scan budget.

### 3.2 `convex/transactions.ts` — `list`

New optional args:

```ts
accountId: v.optional(v.id("accounts")),
categoryId: v.optional(v.id("categories")),
type: v.optional(v.union(v.literal("income"), v.literal("expense"), v.literal("transfer"))),
```

**Owner path** — pick the best index by active filter:

1. `accountId` set → `by_household_account_date`
   (`eq(householdId)` → `eq(accountId)` → date range), then predicate type/category.
2. else `categoryId` set → `by_household_category_date`, then predicate type/account.
3. else `type` set → `by_household_type_date`, then predicate account/category.
4. else `by_household_date` (current behavior).

A small local helper centralizes index selection so the mapping is testable.
`.take(limit)` still caps the result at `limit` matching rows.

**Member path** — the existing scan loop keeps skipping hidden-category rows and
additionally applies the same predicates (type/account/category) when collecting.
Hidden accounts are never reachable because members can only select visible
accounts in the UI; a hidden `categoryId` passed directly simply matches nothing
(those rows are skipped before collection).

Note: `categoryId` is optional on transactions (transfers have none). Filtering by
category never returns transfers; filtering by `type = "transfer"` returns
transfers only.

## 4. UI (`app/(tabs)/transactions.tsx` + new `components/FilterSheet.tsx`)

### 4.1 Header

Replace the current date-chip row and inline custom-range row with two chips:

```
[ 📅 <range label> ▾ ]   [ ⚙ Filter <n> ▾ ]
```

- Date chip label: `This Month` (default) / `Last Month` / `Aug 1 – Aug 20`
  (`formatDateShortTz` on each bound).
- Filter chip: badge shows the number of active filters (type != All, account set,
  category set). No badge when none active.

### 4.2 Date modal (bottom sheet)

- Radio options: **This Month** (default), **Last Month**, **Custom Range**.
- Custom Range reveals two `DateField`s (From / To), `maximumDate` = today,
  inline error when From > To (reuses the existing `invalidCustomRange` logic,
  moved here).
- **Done** button applies and closes.

Range computation (existing `useMemo` in `transactions.tsx`) is unchanged except it
now reads the date state chosen in this modal.

### 4.3 Filter modal (new `FilterSheet` component)

- **Type**: chips `All / Income / Expense / Transfer`.
- **Account**: inline option list — "All accounts" + visible accounts (from
  `api.accounts.list`), search input when >8 options, checkmark on selected.
- **Category**: inline option list — "All categories" + visible categories (from
  `api.categories.list`), search when >8, checkmark on selected.
  - Contextual: type `income` → income categories only; `expense` → expense
    categories only; `transfer` → category field disabled **and the category
    filter is cleared** (transfers have no category, so a stale category filter
    would otherwise silently match nothing).
- **Reset** button — clears type/account/category.
- **Done** button applies and closes.

### 4.4 State & derived data

```ts
const [dateFilter, setDateFilter] = useState<"thisMonth" | "lastMonth" | "custom">("thisMonth");
const [customFrom, setCustomFrom] = useState(() => startOfDay(new Date()));
const [customTo, setCustomTo] = useState(() => startOfDay(new Date()));
// Local union — the codebase has no exported TransactionType yet.
type TransactionType = "income" | "expense" | "transfer";

const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
const [accountFilter, setAccountFilter] = useState<Id<"accounts"> | null>(null);
const [categoryFilter, setCategoryFilter] = useState<Id<"categories"> | null>(null);
```

Query args:

```ts
useQuery(api.transactions.list, {
  ...range,
  ...(typeFilter !== "all" && { type: typeFilter }),
  ...(accountFilter !== null && { accountId: accountFilter }),
  ...(categoryFilter !== null && { categoryId: categoryFilter }),
});
```

Summary card and day-net totals are computed from `result.transactions`, so they
reflect filters automatically (transfers remain excluded from net via
`sumNetExcludingTransfers`).

### 4.5 Empty state (filter-aware)

Distinguish two cases:

- No transactions at all in range → existing "No transactions yet" + "Add
  Transaction" CTA.
- Transactions exist but filters match nothing → "No transactions match your
  filters" + "Clear filters" action (resets type/account/category).

## 5. Testing

New cases in `tests/transactions.list.test.ts` (existing seed pattern):

1. Owner: account filter returns only that account's transactions.
2. Owner: category filter returns only that category's transactions; transfers
   excluded.
3. Owner: type filter returns only that type.
4. Owner: combined filters (type + account) return the intersection.
5. Member: category filter on a hidden category returns empty (no leak).
6. Transfers never match a category filter.
7. Limit still applies after filtering (`limit: 2` of 5 matches → 2).
8. Index selection helper picks the correct index per active filter.

Verification commands (per AGENTS.md): `npx convex codegen` first (schema + convex
files changed), then `npx tsc --noEmit`, `npm test`, `npm run lint`.

## 6. PRD Update

- §2.1 Transactions row — mention type/account/category filters.
- §3.6 Transactions — new paragraph describing the two-chip filter UI and
  contextual category↔type behavior; summary/day-net reflect filters; empty state
  is filter-aware.
- §4 — add a "Filter Transactions" flow (two chips → Date modal / Filter modal).
- §5.2 — update the `transactions.tsx` responsibilities row.
- §6 — add the three compound indexes to the `transactions` schema block and note
  the new `transactions.list` args in the Convex Functions table.
- §8 — dated Change Log entry.

## 7. Out of Scope

- Search bar (future; server-side filter args already provide the seam).
- Free-text note search.
- Persisting filter selections across sessions.