# Home — Recent Transactions Section

> Date: 2026-08-12
> Status: Approved

## Background

The Home dashboard currently shows a placeholder `EmptyState` for the "Recent Transactions" section (app/(tabs)/home.tsx:199-213). DESIGN.md (Screen 2) specifies the section should show the last 5 transactions with a "See All" link to the Transactions tab.

## Design

### Backend — `convex/transactions.ts`

Add a new query `recent`:

- Args: `{ limit: v.optional(v.number()) }`, default `5`, capped at `20`.
- Reuse the auth + membership lookup pattern from `list` (transactions.ts:218-242).
- Query `transactions` via the `by_household_date` index with `q.eq("householdId", ...)`, then `.order("desc")` and `.take(limit)`. Equality filter + descending order is valid on the index; no date range is used.
- Join `category`, `account`, and `toAccount` the same way `list` does (transactions.ts:254-268), and skip hidden categories for non-owner members.
- Return `{ transactions, isOwner }`, matching `list`'s response shape. Returns `{ transactions: null, isOwner: false }` when identity/user/membership is missing.

### Frontend — `app/(tabs)/home.tsx`

Replace the placeholder block (home.tsx:199-213):

- Query `api.transactions.recent` with `{ limit: 5 }`.
- Section header row: "Recent Transactions" + a "See All" pressable that does `router.push("/transactions")`.
- Group returned transactions by day using `formatDateHeader` (utils/date.ts:45), same grouping approach as the Transactions tab (app/(tabs)/transactions.tsx:72-89).
- Each day group renders:
  - Header row with the date (e.g. "August 7, 2026") on the left and the day's net total on the right. Net total = sum of signed amounts (income `+`, expense `−`, transfer magnitude). Color: green when positive, red when negative, neutral when zero.
  - The day's `TransactionCard`s (reused from components/TransactionCard.tsx) inside the existing rounded surface container.
- Each card's `onPress` → `router.push({ pathname: "/transaction-form", params: { id } })` (edit mode), consistent with the Transactions tab.
- Empty (`transactions` is `null` or `[]`): keep the existing `EmptyState`.
- Loading (`undefined`): small `ActivityIndicator`, consistent with the accounts section.

## Error Handling

The query returns `null` transactions when the user is not signed in or not a household member. Home already redirects non-household users to onboarding, so `null` is treated as an empty state.

## Verification

No schema changes. After editing `convex/transactions.ts`, run `npx convex codegen`, then `npx tsc --noEmit` and `npm run lint`.
