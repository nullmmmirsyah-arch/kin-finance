# Accounts Feature — Design Spec

> Date: 2026-08-08
> PRD: docs/Product Requirement Document/PRD_Accounts
> Status: Approved
> Depends On: Household

---

## Summary

Implement the Accounts feature per PRD_Accounts: backend (Convex schema + queries/mutations) and the full UI (dedicated Accounts screen and Create/Edit Account form), wired into a new bottom-tab navigator (Home | Accounts).

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Opening-balance transaction | Minimal `transactions.create` now | Opening balance must post via the standard transaction path; Transactions feature stays in its own PRD |
| Reserved categories | "Initial Balance" income + expense created with the household | ARCHITECTURE.md contract; the opening-balance flow selects by sign |
| UI scope | Full screens per DESIGN.md | Dedicated Accounts screen + Create/Edit form |
| Navigation | Bottom tabs (Home | Accounts) | Matches DESIGN.md tab bar; other tabs deferred to their PRDs |
| Row actions | Always-visible Edit and Delete icons on owner cards | DESIGN.md + PRD user flow require edit/delete in a single, discoverable step |
| Balance format | Plain number, thousand separators, no symbol (e.g. `1,234,567`) | User preference |

---

## Data Model

### `accounts` table

```text
householdId: id<households>
name: string                // 2-30 chars, trimmed, unique within household
type: "cash" | "bank" | "ewallet" | "credit_card"
balance: number             // current balance, auto-updated by transactions
hidden: boolean             // default false; owner toggle for members
createdAt: number
updatedAt: number
```

**Indexes:** `by_householdId` on `["householdId"]`

---

### `categories` table

```text
householdId: id<households>
name: string                // reserved: "Initial Balance"
type: "income" | "expense"
hidden: boolean
createdAt: number
updatedAt: number
```

**Indexes:** `by_householdId` on `["householdId"]`

Only the two reserved "Initial Balance" categories (one per type) are created in this feature. Full category management lands in the Categories PRD.

---

### `transactions` table

```text
householdId: id<households>
accountId: id<accounts>
categoryId: id<categories>
amount: number              // signed: positive = income, negative = expense
type: "income" | "expense"
note: string | undefined
date: number                // transaction date timestamp
createdBy: id<users>
updatedBy: id<users>
createdAt: number
updatedAt: number
```

**Invariant:** `amount > 0` when `type = "income"`, `amount < 0` when `type = "expense"`.

**Indexes:** `by_householdId` on `["householdId"]`, `by_accountId` on `["accountId"]`

---

## Convex Functions

### `convex/accounts.ts` (new)

#### `list` (query)

- **Args:** none
- **Returns:** `{ accounts: Account[] | null, isOwner: boolean }`
- **Behavior:**
  1. Resolve current user + membership.
  2. If signed out or no household → `{ accounts: null, isOwner: false }`.
  3. Owner → all accounts in household.
  4. Member → only `hidden === false`.
  5. `isOwner` = membership role is `"owner"` (drives FAB + edit/delete icons in UI).

#### `create` (mutation)

- **Args:** `{ name: string, type: AccountType, openingBalance?: number }`
- **Owner only.**
- **Behavior:**
  1. Auth + owner check (same pattern as `households.update`).
  2. Validate name: required, trimmed, 2–30 chars, unique within household.
  3. Validate type is one of `cash | bank | ewallet | credit_card`.
  4. Validate openingBalance is a finite number; default `0`.
  5. Insert account with `balance: 0`.
  6. If `openingBalance !== 0`:
     - Pick reserved category: income-type "Initial Balance" when > 0, expense-type when < 0.
     - Call shared transaction-posting path (`transactions.create`) with signed amount, `note: "Initial balance"`, `date: Date.now()`.
  7. Return the created account.

#### `update` (mutation)

- **Args:** `{ accountId: Id<"accounts">, name?: string, type?: AccountType, hidden?: boolean }`
- **Owner only.**
- **Behavior:**
  1. Auth + owner check.
  2. Account must exist and belong to the owner's household.
  3. If `name` provided: validate required, trimmed, 2–30 chars, unique within household excluding self.
  4. If `type` provided: validate enum.
  5. Patch account + `updatedAt`.

#### `delete` (mutation)

- **Args:** `{ accountId: Id<"accounts"> }`
- **Owner only.**
- **Behavior:**
  1. Auth + owner check.
  2. Account must exist and belong to the owner's household.
  3. **Guard:** if any transaction references the account → reject with:
     `"Cannot delete account — existing transactions reference this account. Delete or reassign those transactions first."`
  4. Delete the account.

---

### `convex/transactions.ts` (new, minimal)

#### `create` (mutation)

- **Args:** `{ accountId: Id<"accounts">, categoryId: Id<"categories">, amount: number, type: "income" | "expense", note?: string, date: number }`
- **Behavior:**
  1. Auth + household membership check.
  2. Account must exist and belong to the caller's household.
  3. Category must exist and belong to the caller's household.
  4. Validate: amount sign matches type (`income` → `amount > 0`, `expense` → `amount < 0`); category type matches transaction type.
  5. Insert transaction.
  6. Apply amount to account balance (`balance += amount`) in the same mutation (atomic).

This is the single source of truth for balance updates; `accounts.create` reuses it for opening balance so the balance is applied exactly once through the standard path.

---

### `convex/households.ts` (modified)

#### `create` (mutation)

- **New step after creating the household + owner membership:** insert the two reserved categories:
  - `{ name: "Initial Balance", type: "income", hidden: false }`
  - `{ name: "Initial Balance", type: "expense", hidden: false }`

---

## Convex Error Messages (English)

| Context | Message |
|---------|---------|
| Not signed in | `You are not signed in.` |
| User not found | `User not found.` |
| Not owner | `You are not the owner of this household.` |
| Household not found | `Household not found.` |
| Account name required | `Account name is required.` |
| Account name too short | `Account name must be at least 2 characters.` |
| Account name too long | `Account name must be at most 30 characters.` |
| Account name duplicate | `Account name already exists.` |
| Invalid type | `Invalid account type.` |
| Account not found | `Account not found.` |
| Delete guard | `Cannot delete account — existing transactions reference this account. Delete or reassign those transactions first.` |
| Transaction account/category mismatch | `Account does not belong to your household.` / `Category does not belong to your household.` |
| Amount/type mismatch | `Amount must be positive for income transactions.` / `Amount must be negative for expense transactions.` |

---

## Navigation

```
app/
  _layout.tsx          → root Stack: index, onboarding, (tabs), account-form
  index.tsx            → auth (unchanged)
  onboarding.tsx       → unchanged
  account-form.tsx     → NEW: Create/Edit Account (signed-in stack screen)
  (tabs)/
    _layout.tsx        → NEW: Tabs (Home | Accounts)
    index.tsx          → MOVED from app/home.tsx
    accounts.tsx       → NEW: Accounts list screen
```

Root `_layout.tsx`: add `<Stack.Screen name="(tabs)" />` and `<Stack.Screen name="account-form" />` under the signed-in guard.

Tab bar (per DESIGN.md): `Home` (home icon) and `Accounts` (credit-card icon). Active tint = `Colors.primary`, inactive = `Colors.textSecondary`.

---

## UI Components (new)

| Component | Spec |
|-----------|------|
| `components/AccountCard.tsx` | Row: type icon (Feather), name, formatted balance; wrapped in `GradientCard` styling |
| `components/Chip.tsx` | Filter chip (All | Cash | Bank | E-Wallet | Credit Card); active = primary fill, inactive = outlined |
| `components/Fab.tsx` | Floating "+" button (primary, shadow, 56px), owner-only |
| `constants/accounts.ts` | `ACCOUNT_TYPES` map: id, label, Feather icon |
| `utils/format.ts` | `formatNumber(n)` → plain thousand-separated string via `Intl.NumberFormat("en-US")`, no symbol |

---

## Screens

### `app/(tabs)/accounts.tsx` — Accounts Screen

**Layout (top to bottom):**
1. Header: "Accounts" (H1, left aligned)
2. Filter chips: All | Cash | Bank | E-Wallet | Credit Card
3. Account list: each row shows type icon, account name, formatted balance. Owner rows show Edit and Delete icon buttons. Member rows are static.
4. FAB "+" → `/account-form` (Owner only, hidden for Member).
5. Empty state: wallet icon → "No accounts yet" → "Add your first account to start tracking your money." → [Add Account] (Owner only).

**Behavior:**
- Loads `accounts.list`; shows spinner while loading.
- Filter chip state filters the displayed list client-side by type.
- Delete: `Alert.alert` confirmation ("Delete Account?", `Delete "X"?`, Cancel | Delete). On confirm → `accounts.delete`. Guard rejection shows the exact PRD message inline.
- Edit: tap Edit icon → `/account-form?id=<accountId>`.

**Member state:** read-only list of visible accounts. No FAB, no edit/delete icons. Empty state without action button.

### `app/account-form.tsx` — Create/Edit Account

Route param `id` (optional): absent → create, present → edit.

**Create mode:**
- Header: "Create Account"
- Input: Account name
- Type selector (Cash | Bank | E-Wallet | Credit Card), default Cash
- Input: Opening balance (optional), number, allows leading `-`
- Toggle: "Visible to members" (default on, with description)
- Button: "Create Account"

**Edit mode:**
- Same fields pre-filled from the account
- Header: "Edit Account"
- No opening balance field (balance changes only via transactions)
- Button: "Save Changes"

**Behavior:**
- Client-side validation before submit (name required/2–30, balance numeric).
- On success → `router.back()` to Accounts.
- On error → inline friendly message (controlled Convex message or generic fallback).
- Member: navigation blocked (no entry point); backend rejects anyway.

---

## Home Screen (light touch)

Move `app/home.tsx` → `app/(tabs)/index.tsx`. Replace the static "My Accounts" placeholder EmptyState with a live account summary: if accounts exist, show count + "Manage" link to the Accounts tab; if none, keep the empty state. No other changes.

---

## Error Handling

- Controlled Convex errors are plain English and displayed directly.
- Unexpected errors → generic fallbacks: `Failed to create account.`, `Failed to update account.`, `Failed to delete account.`, `Please try again.`
- No technical backend error text is shown.

---

## Validation Summary

| Field | Rule |
|-------|------|
| Account name | Required, 2–30 chars, trimmed, unique within household |
| Account type | One of `cash`, `bank`, `ewallet`, `credit_card` |
| Opening balance | Optional number; `0` default; no sign requirement (treated as starting value) |
| Visibility | Boolean, default `false` (visible) |

---

## File Changes

| File | Action |
|------|--------|
| `convex/schema.ts` | Modify — add `accounts`, `categories`, `transactions` tables |
| `convex/accounts.ts` | Create — `list`, `create`, `update`, `delete` |
| `convex/transactions.ts` | Create — `create` (minimal) |
| `convex/households.ts` | Modify — create reserved "Initial Balance" categories |
| `app/_layout.tsx` | Modify — register `(tabs)` + `account-form` |
| `app/home.tsx` | Move → `app/(tabs)/index.tsx`, wire live account summary |
| `app/(tabs)/_layout.tsx` | Create — Tabs |
| `app/(tabs)/accounts.tsx` | Create — Accounts screen |
| `app/account-form.tsx` | Create — Create/Edit Account form |
| `components/AccountCard.tsx` | Create |
| `components/Chip.tsx` | Create |
| `components/Fab.tsx` | Create |
| `constants/accounts.ts` | Create |
| `utils/format.ts` | Create |

---

## Success Criteria

- [ ] Owner can create an Account (name, type, optional opening balance).
- [ ] Opening balance auto-records a signed "Initial balance" transaction via `transactions.create`.
- [ ] Account balance reflects the opening balance and auto-updates via the standard transaction path.
- [ ] Owner can edit Account name, type, and visibility.
- [ ] Owner can delete an Account; delete is rejected with the PRD guard message if transactions reference it.
- [ ] Owner can toggle Account visibility.
- [ ] Member sees only visible Accounts; Member cannot create/edit/delete/toggle.
- [ ] Accounts screen renders filter chips, empty state, and FAB (owner only).
- [ ] Owner rows show Edit and Delete icons that navigate to edit and confirm-delete.
- [ ] Validation works (name 2–30, unique, enum type).
- [ ] Error states use plain English, no technical backend errors.
- [ ] `npx tsc --noEmit` and `npm run lint` pass.

---

## Out of Scope

- Full Transactions, Categories, Budgets features.
- Transactions list/update/delete UI.
- Account icons, colors, multi-currency, archiving, merging, credit-card due dates.
