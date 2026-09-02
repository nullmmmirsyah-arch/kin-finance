# Day Net Totals per Group — Design

Date: 2026-08-17
Status: Approved (before implementation)

## Problem

The Transactions page groups transactions by day (`formatDateHeaderTz`) but
shows no running/net total per group, so a day's net at a glance is impossible
without mentally adding up rows. The Home dashboard already renders a net total
per day group (`app/(tabs)/home.tsx`), but its computation sums **all** amounts
including transfers (`data.reduce((sum, tx) => sum + tx.amount, 0)`), which
inflates the day's net.

## Goal

- Show a net total per day group on the Transactions page, matching the visual
  language of the Home dashboard (right-aligned, sign-colored).
- Fix Home's Recent Transactions day total so transfers are excluded, keeping
  both screens consistent.
- Transfers are excluded from the net because they move money between owned
  accounts and do not change household net worth.

## Design

### 1. Shared helper — `utils/format.ts`

Add one pure function mirroring the aggregation already used by the Transactions
summary card (`app/(tabs)/transactions.tsx:95-98`, which already excludes
transfers):

```ts
export function sumNetExcludingTransfers(
  txs: { type: string; amount: number }[],
): number {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (tx.type === "income") income += tx.amount;
    else if (tx.type === "expense") expense += Math.abs(tx.amount);
  }
  return income - expense;
}
```

Both call sites pass Convex hydrated transaction docs, which satisfy the
structural type `{ type: string; amount: number }`.

### 2. Transactions page — `app/(tabs)/transactions.tsx`

- In the `sections` `useMemo` (lines 72-89), compute `total` per group via
  `sumNetExcludingTransfers(data)` and include it in each section object.
- Update `renderSectionHeader` (lines 229-235) to a `flex-row items-center
  justify-between` layout: date title on the left, net total on the right.
  Total coloring and sign follow the Home pattern (`home.tsx:558-561`):
  - `total > 0` → `C.success`, prefixed `+`
  - `total < 0` → `C.error`
  - `total === 0` → `C.textSecondary` (incl. groups containing only transfers)

### 3. Home dashboard — `app/(tabs)/home.tsx`

- Replace the `total` computation in `recentGroups` (line 160) with
  `sumNetExcludingTransfers(data)`. Rendering stays unchanged.

## Edge Cases

- A day group containing only transfers → total `0`, displayed neutral.
- Empty list / no household → existing empty states unchanged.

## Out of Scope

- Week/month grouping toggle (deferred).
- Filtering, search, pagination (separate ideas).

## Verification

- `npx tsc --noEmit`.
- `npm run lint`.
- `npm test` (Vitest).
