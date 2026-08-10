# Budgets — Design

> Date: 2026-08-10
> Status: Approved
> Source: `docs/Product Requirement Document/PRD_Budgets`

---

## Overview

Implement monthly per-category spending budgets. Owner and Member both create, edit, delete, and view budgets. Budgets for hidden expense categories remain visible to Members (visibility exception); Members see the aggregate `spent` figure but never the transaction breakdown.

Navigation: a new **Budgets** tab (5th tab) between Transactions and Settings.

---

## Backend

### Schema (`convex/schema.ts`)

New `budgets` table:

```typescript
budgets: {
  householdId: Id<"households">
  categoryId: Id<"categories">      // must be expense
  periodStart: number               // first day of selected month (epoch ms, local time)
  amount: number                    // spending limit, >= 1
  createdBy: Id<"users">
  updatedBy: Id<"users">
  createdAt: number
  updatedAt: number
}
```

Indexes:
- `by_householdId` on `["householdId"]`
- `by_categoryId` on `["categoryId"]`
- `by_household_period` on `["householdId", "periodStart"]`

Uniqueness: one budget per `(householdId, categoryId, periodStart)` — enforced in `create` (Convex has no unique constraint). `update` never changes category or month, so only `create` needs the check.

### Convex functions (`convex/budgets.ts`)

All functions require sign-in + household membership (same `getUserAndMembership` pattern as `convex/categories.ts`). No role check — Owner and Member have equal permissions per PRD. Errors are friendly `ConvexError` messages.

| Function | Args | Returns / Behavior |
|---|---|---|
| `list` | `{ periodStart, periodEnd }` | `{ budgets, isOwner }`. Fetch month's budgets via `by_household_period` (`eq periodStart`). Compute spent by querying **expense** transactions in `[periodStart, periodEnd)` via `by_household_date` index, summing per budgeted `categoryId`. Each entry: `{ ...budget, category, spent, progress }` where `progress = spent / amount`. No filtering by `category.hidden` — all budgets visible to everyone. |
| `get` | `{ budgetId }` | Budget + joined `category` + `periodStart`, for the edit form. `null` if not found / not in household. |
| `categoryOptions` | — | All **expense** categories in the household (visible + hidden), excluding the reserved "Initial Balance" category. Source for the form's category picker. |
| `create` | `{ categoryId, amount, periodStart }` | Validate `amount >= 1`. Category must exist in household and be `type === "expense"` (else *"Cannot create budget for an income category."*). Reject duplicate `(categoryId, periodStart)` with *"A budget already exists for this category in this month."* Insert with `createdBy`/`updatedBy` = user, timestamps = now. |
| `update` | `{ budgetId, amount }` | Budget must exist in household. `amount >= 1`. Patch `amount`, `updatedBy`, `updatedAt`. |
| `remove` | `{ budgetId }` | Budget must exist in household. Delete; transactions unaffected. |

### `periodStart` timezone decision

The client computes both bounds in **local** time with the existing `utils/date.ts` helpers:

- `periodStart = startOfMonth(selectedMonth).getTime()`
- `periodEnd = addMonths(startOfMonth(selectedMonth), 1).getTime()`

The server cannot derive "next local month" (it runs in UTC), so the client passes both bounds. This keeps budget month boundaries identical to what the Transactions tab already shows. Deliberate deviation from `docs/ARCHITECTURE.md`'s "UTC policy" note; acceptable because household members share a timezone in practice.

### Integration fixes (`convex/categories.ts`)

`categories.update` (type-change guard) and `categories.remove` currently check only referencing **transactions** (lines ~182 and ~245) though their messages already mention budgets. Add a `budgets` `by_categoryId` lookup so an owner cannot retype or delete a category that a budget references.

---

## UI

### Tab layout

- `app/(tabs)/_layout.tsx`: add Budgets tab (Feather `pie-chart`) between Transactions and Settings.
- `app/_layout.tsx`: register `budget-form` in the protected `<Stack>`.

### `app/(tabs)/budgets.tsx` — list screen

- Header "Budgets" + month selector `< August 2026 >` (chevrons via `addMonths`). Any month navigable including future (planning ahead).
- `useQuery(api.budgets.list, { periodStart, periodEnd })` from selected month.
- Summary `GradientCard`: total budgeted, total spent, and a month progress bar.
- `BudgetCard` list (FlatList):
  - Category name; `eye-off` Feather icon when the category is hidden.
  - `spent / budget` amounts, progress bar (`View` widths), error color when over budget.
  - Edit + delete icons shown to **all** users.
- Delete → `Alert` confirmation (categories.tsx pattern); feedback via `Snackbar`.
- Empty state: icon, "No budgets yet", "Set budgets to control your spending.", **Set Budget** action.
- FAB → `budget-form` (visible to all users).

### `components/BudgetCard.tsx`

New card: category name + hidden marker, spent/budget text, progress bar, edit/delete icons. Progress bar built with plain `View`s — no new library.

### `app/budget-form.tsx` — form route

Top-level route (matches `account-form`/`category-form`):

- Create mode (param `periodStart`): month shown read-only ("August 2026"); `SelectField` of expense categories from `categoryOptions`; `Input amount`; "Set Budget" button.
- Edit mode (param `id`): `budgets.get` prefills amount; month + category shown read-only/disabled; "Save Changes" button.
- Client validation: amount required, positive, ≥ 1; category required on create. Server `ConvexError` messages surfaced as inline text.
- Submit → mutation → `router.back()` + snackbar.

---

## Data Flow

```text
List:   month state → { periodStart, periodEnd } → budgets.list → rows (spent, progress)
Create: FAB (passes periodStart) → budget-form → categoryOptions → create → back + snackbar
Edit:   card edit (passes id) → budget-form → budgets.get → prefill → update → back + snackbar
Delete: card trash → Alert → budgets.remove → snackbar
```

---

## Edge Cases

- Over budget: progress bar capped at 100%, error color, spent shown in error color.
- Future months: empty list, spent 0, create still allowed.
- Duplicate (category, month): rejected server-side with the PRD message.
- Income category: rejected server-side; picker only offers expense categories.
- Hidden category: selectable and visible in list for Members (with `eye-off` marker); no transaction detail leaked.
- No budgets for month: empty state with Set Budget CTA.
- Loading / not-a-member states match other screens (`ActivityIndicator`, "You are not a member of a household.").
- Categories integration: retyping/deleting a budgeted category is blocked by the new budget-reference checks.

---

## Verification

No test framework. With `npx convex dev` running in a separate terminal:

1. `npx convex codegen` (after any `convex/*.ts` or `schema.ts` change)
2. `npx tsc --noEmit`
3. `npm run lint`
4. Manual smoke test in Expo Go: create/edit/delete budget, month navigation, over-budget progress, hidden-category visibility as a member.
