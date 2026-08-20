# Filter Sheet — Deferred Apply (Draft until Done)

> Status: Living spec (amends the multi-select spec `2026-08-20-transactions-filters-multiselect-design.md`)
> Date: 2026-08-20

## 1. Context

The Transactions page filter sheet (branch `review`) applies every interaction
immediately: tapping a Type chip or toggling an Account/Category checkbox
updates the committed page state via `onTypeFilterChange` / `onAccountToggle` /
`onCategoryToggle` etc., so the transactions list and header badge re-query and
refresh on every tap. The "Done" button only closes the sheet.

The user reports this as confusing: the screen appears to "refresh" while the
sheet is still open. Desired behavior: interactions inside the sheet only
update a **local draft**; the list refreshes only when the user taps **Done**.
Closing the sheet without Done discards the draft.

This spec covers that change only. Filtering behavior, the tri-state combobox
fields, backend query args, and the badge rules are unchanged.

## 2. Goals

- Tapping options inside the filter sheet must not change the visible list or
  the header badge until the user taps **Done**.
- The sheet still reflects the currently applied filters when it opens.
- **Reset** clears only the draft; the user still taps **Done** to apply.
- Closing without Done (backdrop tap, Android back) discards the draft.
- No change to the server-side filter architecture, visibility rules, or the
  empty-state "Reset" action (that one applies immediately by design).

## 3. Design

### 3.1 Draft state inside `FilterSheet`

`components/FilterSheet.tsx` becomes the owner of the draft while open:

- Add local state `draftType: TypeFilter`, `draftAccountIds: Id<"accounts">[]`,
  `draftCategoryIds: Id<"categories">[]`.
- Re-initialize the draft from props each time the sheet opens via
  `useEffect` on `visible` (when it flips to `true`, copy
  `typeFilter`/`accountIds`/`categoryIds` into the draft). This guarantees the
  sheet shows the committed filters on every open, including after a Done.

### 3.2 Interactions mutate only the draft

- Type chips: set `draftType` and prune `draftCategoryIds` against
  `props.categories` using the existing rule — keep current when the new type
  is `all`; clear when it is `transfer`; otherwise drop ids whose category
  `type` differs. (This logic moves from `app/(tabs)/transactions.tsx` into the
  sheet.)
- Account/Category checkboxes and select-all: toggle within the draft arrays.
- **Reset**: set `draftType` to `all`, `draftAccountIds` and
  `draftCategoryIds` to `[]`. Stays open; applies only on Done.
- Category field `disabled` (transfer type) and the contextual category option
  list both derive from `draftType`.

### 3.3 Apply on Done

- Replace the mutator props (`onTypeFilterChange`, `onAccountToggle`,
  `onAccountIdsChange`, `onCategoryToggle`, `onCategoryIdsChange`, `onReset`)
  with a single **`onApply(type, accountIds, categoryIds)`** callback plus the
  existing `onClose`.
- Done button: call `onApply(draftType, draftAccountIds, draftCategoryIds)`
  then `onClose()`.
- Backdrop press and `onRequestClose` keep calling `onClose()` only — the draft
  is discarded, nothing is applied.
- The sheet stays open after Reset (user decides whether to tap Done, Cancel by
  backdrop, or continue editing).

### 3.4 Page (`app/(tabs)/transactions.tsx`)

- Keep the committed `typeFilter`/`accountIds`/`categoryIds` state and the
  `queryArgs`/badge derivation exactly as-is (they already derive from the
  committed state, so the list refreshes only when `onApply` updates it).
- Remove the inline pruning logic from the old `onTypeFilterChange`; wire
  `onApply` to `setTypeFilter` / `setAccountIds` / `setCategoryIds`.
- Keep `clearFilters` (empty-state action) unchanged — it applies immediately.

### 3.5 Error handling / edge cases

- Done with an unchanged draft: `onApply` sets identical values; no visible
  change, harmless.
- Reopen after backdrop-close: draft re-initializes from committed props, so
  the discarded changes never reappear.
- Android back / `onRequestClose`: `onClose()` only (discard).

## 4. Testing

- No new pure utilities or Convex functions are introduced, so no new unit
  tests are required. The pruning rule moves verbatim into the sheet.
- Verification: `npx tsc --noEmit`, `npm run lint`, `npm test` (regression —
  69 existing tests must stay green).