# Technical Hardening: Validation, Authorization, Pagination, Render Safety

> Date: 2026-08-15
> Status: Approved
> Points: Teknis #1–#5 dari analisis kodebase

---

## 1. Shared Validation Module (`constants/validation.ts`)

**Problem:** Validation rules are duplicated across client (`transaction-form.tsx`, `account-form.tsx`, `category-form.tsx`, `budget-form.tsx`, `members.tsx`) and server (`convex/*.ts`). Server uses `Number.isSafeInteger`; client uses `Number.isInteger` — drift allows invalid amounts to pass client and fail server. Magic numbers (2, 3, 30, 50, 200, 8) are scattered.

**Solution:** Create a single pure TypeScript file `constants/validation.ts` with:

- Named constants: `ACCOUNT_NAME_MIN=2`, `ACCOUNT_NAME_MAX=30`, `CATEGORY_NAME_MIN=2`, `CATEGORY_NAME_MAX=30`, `HOUSEHOLD_NAME_MIN=3`, `HOUSEHOLD_NAME_MAX=50`, `NOTE_MAX_LENGTH=200`, `INVITE_CODE_LENGTH=8`, `INVITE_CHARSET="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"`, `BUDGET_AMOUNT_MIN=1`, `AMOUNT_MIN_ABS=1`.
- Pure validator functions returning `string | null` (error message or null):
  - `validateAccountName(name: string): string | null`
  - `validateCategoryName(name: string): string | null`
  - `validateHouseholdName(name: string): string | null`
  - `validateNote(note: string | undefined): string | null`
  - `validateTransactionAmount(amount: number, type: "income" | "expense" | "transfer"): string | null` — uses `Number.isSafeInteger`, enforces sign per type, `|amount| >= AMOUNT_MIN_ABS`.
  - `validateTransactionDate(date: number): string | null` — finite, not in the future.
  - `validateBudgetAmount(amount: number): string | null` — finite, `isSafeInteger`, `>= BUDGET_AMOUNT_MIN`.
  - `validateInviteCode(code: string): string | null` — trims, checks length = `INVITE_CODE_LENGTH`, charset.

**Server usage (Convex):** convex files import validators, e.g.:
```ts
import { validateAccountName } from "../constants/validation";
const err = validateAccountName(name);
if (err) throw new ConvexError(err);
```
This replaces inline validation blocks in each convex handler.

**Client usage:** Screens import same validators, e.g.:
```ts
import { validateAccountName, ACCOUNT_NAME_MAX } from "@/constants/validation";
// in canSubmit or handleSubmit:
const err = validateAccountName(name);
if (err) { setError(err); return; }
```
Also wire `maxLength={ACCOUNT_NAME_MAX}` on `<Input>` instead of hardcoded 30.

**Note:** `constants/validation.ts` contains zero React Native or Convex imports — pure TS, safe on both sides.

---

## 2. `transactions.list`: N+1 Hydration + Unbounded `collect()`

**Problem:** `transactions.list` (date-range query) hydrates every row with 3 sequential `ctx.db.get` calls and no cache — O(3N) uncached lookups. Also `collect()` returns all rows in range with no cap — a month with thousands of transactions causes unbounded memory load.

**Solution (server-only, no UI changes):**

A. **Entity cache** in `list` handler — reuse existing `hydrate` function with a shared `Map<string, Doc | undefined>` for category/account/toAccount lookups. One fetch per id, shared across rows.

B. **Server-side cap** — add optional `limit` arg (type: `v.optional(v.number())`, default `MAX_LIST_ROWS = 1000`, clamped to `[1, 1000]`). Apply after hydration and hidden-category filtering:
```ts
const hydrated = rows.map(row => ({ ...row, ...hydrate(row, cache) }));
const filtered = isOwner ? hydrated : hydrated.filter(r => !r.category?.hidden);
return { transactions: filtered.slice(0, limit), isOwner };
```
Shape stays `{ transactions: Doc<"transactions">[] | null, isOwner: boolean }`. Existing clients don't pass `limit` and receive up to 1000 rows — no UI change.

C. **Owner path:** apply the same cache + slice. No N+1.

---

## 3. Discard Guard in Edit Mode (`transaction-form.tsx`)

**Problem:** In edit mode (`isEdit`), `handleBack` (line 192) and `beforeRemove` listener (line 219) bypass the discard confirmation entirely. Also `hasInteracted` only compares `date`/`note` against `editingTx`, ignoring changes to amount/type/account/toAccount/category.

**Solution:**

A. **Rewrite `hasInteracted`** to cover all editable fields in both create and edit mode:
```ts
const hasInteracted = useMemo(() => {
  if (!isEdit) {
    // Create mode: any non-default state = interacted
    return (
      amountText !== "" ||
      accountId !== null ||
      toAccountId !== null ||
      categoryId !== null ||
      note !== "" ||
      type !== "expense" ||
      date.toDateString() !== new Date().toDateString()
    );
  }
  // Edit mode: compare every field to editingTx
  if (!editingTx) return false;
  return (
    type !== editingTx.type ||
    amountValue !== Math.abs(editingTx.amount) ||
    accountId !== editingTx.accountId ||
    toAccountId !== (editingTx.toAccountId ?? null) ||
    categoryId !== (editingTx.categoryId ?? null) ||
    date.getTime() !== editingTx.date ||
    note !== (editingTx.note ?? "")
  );
}, [amountText, amountValue, type, accountId, toAccountId, categoryId, date, note, isEdit, editingTx]);
```

B. **Remove `|| isEdit` bypass** in both `handleBack` and `beforeRemove`:
```ts
// handleBack: line 192
if (!hasInteracted) { router.back(); return; }
// beforeRemove: line 219
if (!hasInteracted) return;
```

C. `intentionalBack` mechanism remains unchanged (set `true` on submit/delete before `router.back()`).

---

## 4. Authorization & PRD Compliance

### 4a. `invitations.listActive` — owner-only

**Problem:** Any household member can call `listActive`, exposing invite metadata (`createdBy`, `expiresAt`, `useCount`) to non-owners even though the UI hides the section.

**Fix:** Add owner guard:
```ts
if (membership.role !== "owner") return [];
```

### 4b. `budgets.list` — redact spending breakdown for hidden categories

**Problem:** Per PRD §2.4: "Hidden Category Budgets (exception): budget category name and amount are visible to Members; spending breakdown is not shown." Current code returns full `spent`/`progress` for hidden-category budgets to members, violating the PRD.

**Fix:** After building the result array, for non-owners, set `spent = undefined, progress = undefined` when `category?.hidden === true`.

**Return type change:**
```ts
spent: number | undefined;    // was: number
progress: number | undefined; // was: number
```

**Client update (`components/BudgetCard.tsx`):**
- Change `spent` prop to `number | undefined`.
- Guard: `const spentAmount = spent ?? 0;` — use in display and progress calculation.
- When `spent === undefined`: display `—` instead of spent value and hide progress bar.

**Client update (`app/(tabs)/budgets.tsx`):**
- In `summary` computation, treat `budget.spent` as `budget.spent ?? 0`.
- `budget.category?.hidden` flag is already available via `budget.category.hidden`.

---

## 5. Render Side Effects: `members.tsx` & `settings.tsx`

**Problem:** `router.replace("/onboarding")` is called during render when `household === null`. Calling navigation during render can cause repeated navigations before mount completes and is flagged by React lint.

**Fix in both files:** Extract into a `useEffect`:
```ts
useEffect(() => {
  if (household === null) {
    router.replace("/onboarding");
  }
}, [household, router]);
```

Render returns a loading spinner while `household === null` (while navigation executes). Remove the `router.replace(...)` call from the render body.

---

## 6. Tests (convex-test)

### `tests/transactions.list.test.ts`
- Owner sees all non-hidden transactions in date range, up to `limit` (default 1000).
- Member sees only transactions with visible categories; hidden-category rows excluded.
- Unauthenticated returns `{ transactions: null, isOwner: false }`.

### `tests/budgets.list.test.ts`
- Owner sees full `spent`/`progress` for hidden-category budgets.
- Member sees budget with `spent: undefined, progress: undefined` for hidden-category budgets.
- Member sees normal `spent`/`progress` for visible-category budgets.

### `tests/invitations.listActive.test.ts`
- Owner sees active (non-revoked, non-expired, unused) invitations.
- Member (non-owner) in same household returns `[]`.
- Non-member returns `[]`.

---

## 7. PRD.md Updates

| Section | Change |
|---------|--------|
| §2.1 Functional Requirements, Transactions | Add note: "list returns up to 1 000 rows (server cap); hydration cached." |
| §2.4 Visibility Rules | Confirm: "Budgets for hidden categories show name + amount only; spending breakdown is not surfaced to Members (server redaction)." (This was already written; code now aligns.) |
| §3.6 Transactions | Add: "list query has a server-side cap of 1 000 rows." |
| §3.7 Budgets | Add: "For Members, spending breakdown (spent/progress) for budgets on hidden categories is not shown." |
| §5.4 Error Handling | Note shared validation module `constants/validation.ts`; both client and server import it. |
| §6 Convex Functions table | Update rows: `transactions.list` (limit param, cached hydration, cap), `invitations.listActive` (owner-only), `budgets.list` (spent/progress redaction for member + hidden). |
| §8 Change Log | New entry dated 2026-08-15: "Hardening: shared validation module (fixes isInteger/isSafeInteger drift), transactions.list hydration cache + 1000-row cap, discard guard fixed for edit mode, invitations.listActive owner-gate, budgets.list hidden-category breakdown redaction, router.replace side-effect removed from render in members/settings, new convex-test specs." |

---

## Scope Boundary

**In scope:** Points 1–5 as listed above + tests + PRD.
**Out of scope:** Enum consolidation (point 7), UI pagination/infinite scroll, `transactions.get` account-hidden handling, `budgets.categoryOptions` hidden-category filtering, any other UX or functional improvements.
