# P0 Polish Batch — Design

> Date: 2026-08-26
> Status: Approved (user-confirmed scope decisions inline)

## Goal

Ship the agreed P0 polish batch: fix the Home budget permission inconsistency,
surface hidden accounts to Owners, protect unsaved changes on every form,
replace the transaction form's plain-text loader with skeletons, and align the
one stray non-English string with the app's English UI policy. Document two
deliberate product decisions in the PRD (no currency symbol by design;
haptics deferred).

## Scope (locked with user)

| # | Item | Decision |
|---|------|----------|
| 1 | Currency symbols | **Excluded by design** — document in PRD, no code change |
| 2 | Home "Create Budget" gated behind Owner | Fix: show CTA to all roles (PRD §2.3 already grants Members full budget management; Budgets tab FAB already does) |
| 3 | Hidden indicator on AccountCard | Passive badge only (eye-off pill), no interactive toggle |
| 4 | Discard guard on account/category/budget forms | Shared hook approach (option B) |
| 5 | Haptics | **Deferred** — document in PRD Appendix A, no code change |
| 6 | Plain "Loading…" screens | Replace with skeletons on **transaction-form only** |
| 7 | Stray Indonesian OTA string | Translate to English |

## Design

### 1. Shared hook `hooks/useDiscardGuard.ts` (new file)

```ts
useDiscardGuard({ isDirty: boolean }): { handleBack, markIntentional }
```

- `handleBack` — wire to each form's header back button. Clean state →
  `router.back()` immediately. Dirty → `Alert.alert("Discard unsaved
  changes?", "You have unsaved changes that will be lost.", [Keep editing /
  Discard])`; Discard sets the internal flag and navigates back.
- `markIntentional` — call right before programmatic `router.back()` after a
  successful save/delete so the guard does not fire.
- The hook registers the `beforeRemove` listener itself (covers Android
  hardware back, gestures, and any programmatic navigation), allowing through
  when clean or flagged intentional, otherwise preventing the event and
  showing the same Alert.
- Alert copy is identical to today's transaction-form strings (single source
  of truth moves into the hook).
- transaction-form migrates onto this hook (plumbing only — its `hasInteracted`
  memo stays in the screen and feeds `isDirty`). No parallel guard
  implementations remain.

### 2. Dirty computation per form

| Form | Create | Edit |
|------|--------|------|
| account-form | `name.trim() !== "" \|\| type !== "cash" \|\| openingBalance !== "" \|\| hidden !== false` | compare name/type/hidden against the seeded `editingAccount` |
| category-form | `name.trim() !== "" \|\| type !== "expense" \|\| hidden !== false` | compare against seeded `editingCategory` |
| budget-form | `amount !== "" \|\| selectedCategoryId !== null` | comma-stripped `amount` ≠ `String(existingBudget.amount)` |

While an edit-mode form is still loading its seed (`editingX === undefined`)
the dirty flag is `false`, so the guard is inert during load and on the
"not found" screens.

### 3. Home budget CTA un-gate (`app/(tabs)/home.tsx`)

Drop `monthBudgets.isOwner` conditions around the empty-budget EmptyState:
every role sees "Create Budget" → `/budget-form`. Backend unchanged
(`budgets.create` is already member-ok).

### 4. AccountCard passive hidden badge

- New optional prop `hidden?: boolean`.
- When true, render a small pill under the type label styled like
  CategoryCard's type pill (rounded-full border, background token) containing
  Feather `eye-off` 12px + "Hidden" text-xs in secondary color.
- `accounts.tsx` passes `item.hidden` in both owner and member branches.
  Members never receive hidden accounts from `accounts.list`, so the badge is
  effectively Owner-only with no extra gating.
- Non-goal: the mini account cards on Home do not get the badge (kept out of
  scope).

### 5. transaction-form skeleton loading

Replace the plain "Loading…" SafeAreaView (shown while `accounts.list` or
edit-mode `transactions.get` resolves) with: the real back-button header
(safe — guard is inert while clean), skeleton title/subtitle bars, and three
skeleton blocks approximating the three bordered form sections plus one
button-height bar, using the existing `Skeleton` component and `Radius.md`.

### 6. OtaUpdater copy

`"Update baru sudah siap. Restart aplikasi untuk menerapkan."` →
`"A new update is ready. Restart the app to apply it."` (PRD §5.7 quote
updated accordingly).

## Error handling

Unchanged conventions: validation inline, operational errors via Snackbar,
destructive actions confirmed via Alert. The discard Alert follows the
existing destructive-action pattern.

## Testing & verification

UI-only change set (plus one display string); no pure utils or Convex
functions touched, so no new unit tests per repo policy. Verification:
`npx tsc --noEmit`, `npm run lint`, `npm test` (existing suite must stay
green).

## PRD documentation updates

- §1 Constraints: amounts intentionally rendered without a currency symbol
  (currency-agnostic whole numbers with thousand separators).
- Appendix A: haptic feedback deferred (dependency installed, intentionally
  unused for now).
- §3.8, §4.4, §5.2, §5.7: reflect items above; §8 Change Log entries dated
  2026-08-26; header "Last updated" bumped.
