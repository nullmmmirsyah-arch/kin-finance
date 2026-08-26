# Transactions — Server-Side Summary + Cursor Pagination

> Status: Living spec
> Date: 2026-08-26
> Follow-ups tracked as items A1 + A2 of the 2026-08-26 app review (polish backlog)

## 1. Context

Two related inefficiencies exist today:

1. **Home computes the monthly net client-side.** `app/(tabs)/home.tsx` subscribes to
   `transactions.list` for the whole current month (up to 1 000 hydrated rows) only to
   sum income/expense/net. Every mutation by any member re-runs that query and re-ships
   the full payload to every subscribed device.
2. **The Transactions page cannot page.** `transactions.list` caps at 1 000 rows with no
   continuation token; histories beyond the cap are unreachable, and the SectionList
   renders everything at once. The summary card and per-day net totals derive from that
   single capped result.

Once paging lands, the client no longer holds all rows, so the summary card *must* be
computed server-side for its numbers to stay correct. The two changes are therefore
designed together.

Decisions agreed during brainstorming:

- **Approach:** one unified paginated collection engine inside `list` (owner and member
  paths share it) + a new `summary` query. No duplicated page logic, no aggregate
  component / counters.
- **Day-net totals under pagination:** a day group shows its net total only once it is
  *complete* — i.e. an older group has loaded, or the end of the range has been reached.
- **Summary accuracy:** totals cover the entire date range regardless of any row cap
  (household-scale volumes make Convex's platform scan ceiling irrelevant in practice).

## 2. Goals

- Home's "net this month" comes from a tiny server-computed query (3 numbers).
- Transactions page loads ~30 rows at a time with infinite scroll; older history stays
  reachable no matter how large it grows.
- Summary card reflects **all** matching transactions in range, independent of paging.
- Member visibility rules unchanged: hidden-category transactions stay invisible to
  Members in both the paged list and the summary.
- Existing callers without a cursor keep working (additive contract).

## 3. Backend (`convex/transactions.ts`)

### 3.1 `list` — paginated

Args gain one optional field; return shape gains two fields:

```ts
args: {
  startDate: v.number(),
  endDate: v.number(),
  limit: v.optional(v.number()),            // default 1000, cap 1000 (unchanged)
  cursor: v.optional(v.object({             // NEW: continuation token from previous page
    date: v.number(),
    id: v.id("transactions"),
  })),
  accountIds: v.optional(v.array(v.id("accounts"))),
  categoryIds: v.optional(v.array(v.id("categories"))),
  type: v.optional(transactionType),
},
returns {
  transactions: HydratedTransaction[] | null,   // null = not a household member (unchanged)
  isOwner: boolean,                              // unchanged
  cursor?: { date: number; id: Id<"transactions"> },  // NEW: pass back for next page
  hasMore: boolean,                               // NEW
}
```

Engine rules:

- **Single collection core** used by both roles. Inputs: pinned index choice (existing
  priority: singleton `accountIds` → `by_household_account_date`, singleton
  `categoryIds` → `by_household_category_date`, set `type` → `by_household_type_date`,
  else `by_household_date`), post-index filter expression, visibility predicate,
  limit, cursor.
  - Owner predicate: accept all.
  - Member predicate: skip rows whose category is hidden (fetch via cache; identical to
    today's behavior — transactions on hidden accounts remain visible).
- **Cursor continuation** uses the proven `recent` pattern: resume scanning at
  `date <= cursor.date`, walk rows until `(cursor.date, cursor.id)` is seen, then start
  collecting. This handles ties on equal timestamps correctly and works identically for
  every index variant because all compound indexes end in the `date` component.
- **SCAN_BUDGET = limit × 10 applies uniformly**, including the owner path when
  multi-value filters force a post-index filter (today a plain `take(limit)` can
  under-fill). A pure owner index-range page effectively fills in one batch.
- **hasMore semantics:** track whether the index range was exhausted (a batch returned
  fewer rows than requested within the remaining range). `hasMore = !rangeExhausted`.
  When the budget runs out before the page fills, return the last *scanned* position as
  `cursor` so continuation resumes mid-scan instead of stalling (mirrors `recent`).
  When the page fills normally, `cursor` is the last *collected* row — safe against
  duplicates and gaps.
- Callers that omit `cursor` get exactly today's behavior plus the two new fields.

### 3.2 New query: `summary`

```ts
args: { startDate, endDate, accountIds?, categoryIds?, type? }
returns: { income: number; expense: number; net: number } | null   // null = no membership
```

- Walks `by_household_date` across the entire range (no row cap) accumulating
  `amount`/`type` only:
  - `income += amount` for income rows;
  - `expense += Math.abs(amount)` for expense rows;
  - transfers excluded (consistent with both existing summaries);
  - `net = income - expense`.
- No entity hydration. For Members, fetch each distinct encountered category (cached by
  id, bounded by category count) solely to test `hidden`; hidden-category rows are
  skipped.
- Filter normalization identical to `list` (`undefined`/empty/full arrays = no filter;
  OR within a dimension, AND across dimensions).
- Guarantee: totals include every matching row in range, independent of list pagination.

## 4. Frontend

### 4.1 Home (`app/(tabs)/home.tsx`)

Replace the month-long `transactions.list` subscription with:

```ts
const monthSummary = useQuery(api.transactions.summary, {
  startDate: monthStart,
  endDate: monthEnd,
});
```

Net line rendering (sign color, "+X this month") and skeletons map directly onto
`monthSummary`. Everything else on the screen (household card, budget pills, accounts
carousel, recent transactions) is untouched.

### 4.2 Transactions tab (`app/(tabs)/transactions.tsx`)

- **Paging:** accumulate pages using the same pattern Home already uses for `recent`
  (cursor state + accumulated array + reset when filters/date change). `PAGE_SIZE = 30`.
  `SectionList` `onEndReached` fetches the next page while `cursor` exists; footer shows
  a spinner while loading.
- **Summary card:** switches to `api.transactions.summary` with the exact same
  normalized filter args as the paged list (date range, `type`, `accountIds`,
  `categoryIds`). Income/Expense/Net cells render from it.
- **Complete-day totals:** compute each day group's net as today, but display it only
  when the day is complete — i.e. the group is not the oldest loaded group, or
  `hasMore === false`. With desc ordering the oldest group is always the last section.
- Unchanged: Date chip + Filter sheet draft-until-Done flow, filter badge counts,
  empty states ("no transactions" vs "no match" vs invalid custom range), undo-delete
  Snackbar, discard-guard-free read-only behavior.

## 5. Testing

- Extend `tests/transactions.list.test.ts`:
  - multi-page continuation with no duplicates and no gaps (including ties on the same
    timestamp crossing a page boundary);
  - `hasMore=false` exactly at range exhaustion;
  - owner under-fill case: multi-value filter walks past non-matching rows within
    SCAN_BUDGET and still fills the page;
  - backward compatibility: omitting `cursor` behaves like today.
- New `tests/transactions.summary.test.ts`:
  - owner totals over a full range; transfers excluded;
  - Member excludes hidden-category rows;
  - filter combinations (single-value pinning, multi-value OR, empty = no filter);
  - empty range → `{income: 0, expense: 0, net: 0}`.
- Verification gate: `npx convex codegen` → `npx tsc --noEmit` → `npm test` →
  `npm run lint`.

## 6. Documentation

PRD updates per its maintenance workflow: §2.1 (Transactions row), §3.6 (paging +
server-side summary), §3.8 (Home uses summary), §6 function table (`list` signature,
new `summary`), Change Log entry dated 2026-08-26.
