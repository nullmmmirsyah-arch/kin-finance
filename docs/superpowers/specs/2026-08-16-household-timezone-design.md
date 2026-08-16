# Design: Household Timezone

> Date: 2026-08-16
> Status: Approved
> Product: Kin Finance

## Problem

Date/period boundaries are computed inconsistently across the app:

- Budget `periodStart` is an **exact-match index key** (`by_category_period`,
  `by_household_period`). The writer (budget form) and reader (home/budgets
  screens) must compute the **same number**.
- Budget form previously stored `Date.now()` (current instant) as
  `periodStart`, so new budgets never matched the month-boundary query.
- The remaining mismatch: client computes month bounds in **device-local
  time** while the Convex server runs in UTC. A household with members in
  different timezones would classify the same transaction into different
  calendar months — breaking shared budget numbers.

## Goal

Make every member of a household agree on the calendar classification of
financial data (which month a transaction belongs to, what "this month"
means), regardless of device timezone.

## Decision

**Per-household timezone (IANA string), stored on the `households` table.**

One source of truth for period boundaries. All month-boundary computation
and date formatting uses the household timezone. The Convex server stays
timezone-agnostic (compares raw epoch-ms numbers).

## Design

### 1. Schema change

`convex/schema.ts` — add to `households`:

```ts
timezone: v.string()   // IANA name, e.g. "Asia/Jakarta"; default "UTC"
```

Fallback for existing households without the field: `"UTC"`.

### 2. Date utilities (`utils/date.ts`)

Add timezone-aware helpers (all operate on epoch-ms numbers):

```ts
// Returns { start, end } of the calendar month in the given timezone.
// Half-open range [start, end).
export function getMonthBounds(ts: number, timezone: string): {
  start: number;
  end: number;
};

// Format a timestamp as a date header in the given timezone.
export function formatDateHeaderTz(ts: number, timezone: string): string;

// Format a timestamp as a short date in the given timezone.
export function formatDateShortTz(ts: number, timezone: string): string;

// Format a timestamp as time-of-day in the given timezone.
export function formatTimeTz(ts: number, timezone: string): string;
```

Implementation notes:

- `getMonthBounds` uses `Intl.DateTimeFormat("en-US", { timeZone, ... })`
  parts or a date-in-timezone helper to find the UTC instant of the first
  millisecond of the month, then adds one calendar month. Must handle DST
  transitions (never assume 30/31 days — use calendar math on the
  timezone-shifted date).
- The formatters accept `timeZone` in `Intl.DateTimeFormatOptions`.

### 3. Convex — `convex/households.ts`

`households.create` gains an optional `timezone: v.optional(v.string())`
argument; default `"UTC"`. The value is stored on the household. No other
backend change: `getActive` returns the full doc including `timezone`.

### 4. Client — period boundaries and display

All screens that compute month boundaries now resolve the household
timezone first (via `households.getActive`) and pass it into the helpers:

| Screen | Change |
|--------|--------|
| `app/(tabs)/home.tsx` | `monthStart`/`monthEnd` via `getMonthBounds(now, household.timezone)`; recent-transaction day headers via `formatDateHeaderTz` |
| `app/(tabs)/budgets.tsx` | `periodStart`/`periodEnd` + month-selector label via household timezone |
| `app/budget-form.tsx` | `periodStart` from route param or `getMonthBounds(Date.now(), household.timezone).start`; month label via `formatDateHeaderTz`-style month formatting |
| `app/(tabs)/transactions.tsx` | range `startDate`/`endDate` and date-header grouping via household timezone |
| `components/TransactionCard.tsx` | time-of-day via `formatTimeTz` |
| `app/transaction-form.tsx` | date stored as an epoch instant; classification into months happens through the consistent boundary query. No change required to stored value semantics |

### 5. Device timezone detection

`npx expo install expo-localization`. On household create, pass the device
IANA timezone from `expo-localization` (fallback `"UTC"`).

### 6. Existing data

Existing households without `timezone` default to `"UTC"` (server-side
read handles the missing field). No migration needed for correctness, but
households created before this change will use UTC boundaries until the
owner re-creates or a future settings UI sets the timezone.

## Non-goals

- Per-user timezone (deliberately rejected — creates classification
  divergence for shared budgets).
- Transaction date normalization to midnight-in-household-tz (stored epoch
  instants are fine; classification happens via consistent boundary queries).
- Household settings UI to change timezone (future work).

## Risks

- `Intl.DateTimeFormat` timeZone support on Hermes/Android: `Intl` is
  enabled in Expo SDK 54; verify timezone formatting works on the target
  Android runtime during implementation.
- `getMonthBounds` correctness around DST: must use calendar arithmetic on
  the timezone-shifted date, not fixed day counts.

## Test/verify

- `npx tsc --noEmit`
- `npm run lint`
- Manual: create household (records device timezone), set a budget, confirm
  it appears on Home; switch device timezone and confirm boundaries hold.