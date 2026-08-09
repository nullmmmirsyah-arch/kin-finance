# Transactions Feature — Design

> Date: 2026-08-09
> Source PRD: `docs/Product Requirement Document/PRD_Transactions`
> Status: Approved by project owner
> Depends On: Accounts, Categories (both shipped)

---

## Overview

Implement the Transactions feature from PRD_Transactions. Transactions record **income**, **expense**, and **transfers between accounts**. Each income/expense transaction links to one Account and one Category and auto-updates the Account balance; a transfer moves money between two Accounts (no category) and updates both balances. All transactions record `createdBy`/`updatedBy`. Both Owner and Member can create, edit, and delete. Visibility rules: hidden accounts keep existing transactions visible/editable to Members; hidden categories make their transactions invisible/untouchable to Members.

## Decisions

- **Navigation:** Transactions is a new bottom tab (`Home | Accounts | Transactions | Settings`), matching DESIGN.md Screen 5. The list screen is the tab root; create/edit is a pushed stack screen `/transaction-form`.
- **Date picker:** Install `@react-native-community/datetimepicker` (Expo Go compatible, official RN picker). Used for the transaction date in the form and for the Custom Range From/To fields.
- **Date/time policy:** Dates stored as epoch ms, boundaries computed in **local** time (transaction dates are user-local events; budgets' UTC rule governs budget monthly identity only). To satisfy the PRD "time" display, the stored timestamp = picked date + current wall-clock time-of-day on create; editing the date keeps the original time-of-day.
- **Delete UX:** Instead of the PRD's "swipe left → Delete", follow the app's established inline-action convention (see categories design note): **tap row → Edit screen → "Delete Transaction" button** with `Alert` confirmation.
- **FAB (add transaction):** The FAB shows a `label` ("Add Transaction") as a rounded pill (icon `plus` + text) so its purpose is obvious. It appears on **both** the Transactions list and the Home screen; both push `/transaction-form` in create mode. It is visible to Owner **and** Member (both can create transactions). Existing icon-only FABs on Accounts/Categories are unchanged.
- **Selects:** New reusable `SelectField` modal dropdown component for Account and Category selection (no dropdown primitive exists in the app yet).
- **Categories without icons:** Categories have no icon field; the transaction row uses the `tag` icon in a surface block, consistent with `CategoryCard`.
- **Transfers:** `type` gains `"transfer"`. A transfer carries `accountId` (source/from) + `toAccountId` (destination), `amount` as a positive magnitude, and **no category** (`categoryId` undefined). Invariant `toAccountId !== accountId`. Member must have both accounts visible to create or reassign; a transfer touching a hidden account remains visible/editable/deletable by Members (mirrors the hidden-account rules).
- **Summary:** transfers are excluded from income/expense totals (a transfer does not change household net).

## Backend — `convex/schema.ts`

Update the `transactions` table (currently defined without transfer support):

```ts
transactions: defineTable({
  householdId: v.id("households"),
  accountId: v.id("accounts"),                        // income/expense: the account; transfer: source (from)
  categoryId: v.optional(v.id("categories")),         // income/expense only; undefined for transfer
  toAccountId: v.optional(v.id("accounts")),          // transfer only (destination)
  amount: v.number(),                                 // income: > 0; expense: < 0; transfer: > 0 (magnitude)
  type: v.union(v.literal("income"), v.literal("expense"), v.literal("transfer")),
  note: v.optional(v.string()),
  date: v.number(),
  createdBy: v.id("users"),
  updatedBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_householdId", ["householdId"])
  .index("by_household_date", ["householdId", "date"])
  .index("by_accountId", ["accountId"])
  .index("by_toAccountId", ["toAccountId"])
  .index("by_categoryId", ["categoryId"])
```

`by_household_date` replaces the `by_date` index mentioned in ARCHITECTURE (a plain `date` index is never used alone). `by_toAccountId` powers the account-deletion guard for transfers.

**Invariants:**
- income: `amount > 0`, `categoryId` set, `toAccountId` undefined.
- expense: `amount < 0`, `categoryId` set, `toAccountId` undefined.
- transfer: `amount > 0`, `categoryId` undefined, `toAccountId` set, `toAccountId !== accountId`.

## Backend — `convex/transactions.ts`

Refactor the existing file (currently only `create`, with inline auth logic) to mirror `accounts.ts`/`categories.ts`: shared `getUserAndMembership(ctx)` helper, `{ transactions, isOwner }` query shape, `ConvexError` messages. Existing `create` behavior and signature must be preserved for income/expense (`accounts.create` calls it for opening balances); it gains transfer support.

Shared validation helpers:

- `validateAmount(amount, type)` — finite, nonzero; income > 0; expense < 0; transfer > 0 (magnitude); minimum absolute value 1.
- `validateNote(note?)` — optional, max 200 chars.
- `validateDate(date)` — finite, not in the future.

### `list` (query) — `{ startDate, endDate }`

- Signed out / no user / no household → `{ transactions: null, isOwner: false }`.
- Query household transactions in `[startDate, endDate]` via `by_household_date`.
- **Member:** exclude transactions whose category is hidden (income/expense only; transfers have no category). Transactions on hidden **accounts** remain visible (including transfers touching one).
- Enrich each transaction with its `category` doc (income/expense) and `account` + `toAccount` docs (transfer). Needed for list rendering and edit-form pre-fill.
- Return `{ transactions, isOwner }`, sorted by `date` descending.

### `create` (mutation) — `{ accountId, categoryId?, toAccountId?, amount, type, note?, date }`

- Income/expense (existing path): account + category must belong to household; Owner may use hidden, Member must use visible; category type matches `type`; signed amount; balance `account.balance + amount`.
- Transfer: `toAccountId` required and `!== accountId`, belongs to household; `categoryId` must be absent; amount positive. Owner may use hidden accounts; Member must have **both** accounts visible. Balance: `from.balance -= amount`, `to.balance += amount`.
- Insert with `createdBy`/`updatedBy` = caller; patch balances atomically within the mutation.

### `update` (mutation) — `{ transactionId, accountId?, categoryId?, toAccountId?, amount?, type?, note?, date? }`

- Transaction must belong to caller's household.
- Compute final effective values (current doc + provided patches), validating the final shape per type (e.g., income→transfer requires `toAccountId`; transfer→income requires `categoryId`; `from !== to`).
- Balance auto-adjust, generalized reverse-old / apply-new across all affected accounts:
  - income/expense old: `oldAccount.balance -= oldAmount`; new: `newAccount.balance += newAmount`.
  - transfer old: `oldFrom.balance += oldAmount`, `oldTo.balance -= oldAmount`; new: `newFrom.balance -= newAmount`, `newTo.balance += newAmount`.
- Permissions:
  - Member: when changing any account reference (income/expense `accountId`, transfer `from`/`to`), the newly chosen account must be visible (cannot reassign to hidden). Keeping an existing hidden account unchanged is allowed.
  - Member: new category (income/expense) must be visible.
  - Owner: any household account/category.
- Validation: effective category type matches effective `type`; effective amount sign matches effective `type`; date not in future; note ≤ 200.
- Patch `updatedBy`/`updatedAt` and every touched account's `updatedAt`.

### `delete` (mutation) — `{ transactionId }`

- Transaction must belong to caller's household.
- Member: reject if the transaction's category is hidden (income/expense; defense-in-depth — such transactions are invisible anyway). Transfers have no category and remain deletable.
- Reverse balance: income/expense `account.balance - amount`; transfer `from.balance += amount`, `to.balance -= amount`.
- Delete the transaction.

## Backend — `convex/accounts.ts`

Update `remove` so it also rejects when the account is referenced as `toAccountId` (transfer destination), in addition to the existing `by_accountId` check. Error message mirrors the existing one.

## UI — `app/(tabs)/transactions.tsx` (Transactions tab)

Mirrors `app/(tabs)/accounts.tsx` + DESIGN.md Screen 5.

- Header: "Transactions" (28px bold, text-primary). Inline error text below.
- Filter chips: This Month | Last Month | Custom Range.
  - This Month / Last Month: computed preset boundaries (local time). Default: This Month.
  - Custom Range: reveal two date fields (From / To) via datetimepicker, `maximumDate` = today.
- Summary card (`GradientCard`): total income (green), total expense (red), net (neutral), for the current filter range. **Transfers excluded from all three.**
- SectionList grouped by date: date header ("August 7, 2026"), then `TransactionCard` rows.
- `TransactionCard`: category icon block (`tag`, surface bg) for income/expense, **arrow icon + default note "Transfer to {toName}" for transfer**; note (fallback: category name); amount (`+` green / `-` red for income/expense, **neutral text-primary without sign for transfer**); time.
- Tap row → `/transaction-form?id=...`.
- FAB `label="Add Transaction"` → `/transaction-form` (Owner and Member).
- EmptyState: icon `book-open`, title "No transactions yet", description "Start by recording your first transaction.", action "Add Transaction".
- Query: `api.transactions.list({ startDate, endDate })` only — the enriched payload carries category + account docs per transaction; no separate `accounts.list`/`categories.list` calls on this screen.
- Loading spinner while undefined; "You are not a member of a household." when `transactions === null`.

## UI — `app/transaction-form.tsx` (create/edit, pushed stack screen)

Mirrors `app/account-form.tsx`/`app/category-form.tsx` + DESIGN.md Screen 6.

- Create mode: header "New Transaction", submit "Save Transaction". Edit mode (`?id=`): header "Edit Transaction", submit "Save Changes", plus a destructive "Delete Transaction" button (confirm via `Alert`).
- Type toggle: `Chip` trio **Income | Expense | Transfer**, default Expense. Switching type clears a mismatched category selection (income/expense) or from/to (transfer).
- Fields by type:
  - Income/Expense: Account `SelectField` (required), Category `SelectField` filtered by type (required), Date, Note.
  - Transfer: **From Account** + **To Account** `SelectField`s (required; `from !== to`), Amount (positive magnitude), Date, Note optional. **No category field.**
- Amount: `<Input amount />`, large centered styling — thousand-separator formatting on keystroke (same behavior as the opening-balance input; no ad hoc formatting). Pre-fill with `Math.abs(amount)`. Client sends signed amount (+income / -expense / +transfer).
- Account options: from `accounts.list` (Owner: all; Member: visible only + current account when editing a tx on a hidden account). Transfer validates both selections.
- Category options: from `categories.list` filtered by current type (reserved "Initial Balance" categories already excluded by `categories.list`).
- Date: field showing formatted date → datetimepicker, `maximumDate` = today, default today.
- Note: `<Input>`, placeholder "Note (optional)", `maxLength` 200.
- Client validation mirrors server (amount required/nonzero, accounts/category required per type, `from !== to`, date not future, note ≤ 200).
- Server errors (category type mismatch, hidden account, `from === to`) surface inline.
- Loading/not-found states like `category-form.tsx`.
- Edit pre-fill from enriched `transactions.list` payload (transaction's own category/account docs).

## UI — new components

- `components/Fab.tsx` — add optional `label?: string`. When present, render a rounded pill (icon `plus` + label text); otherwise keep current circular icon-only look. Same position/colors.
- `components/SelectField.tsx` — `{ label?, placeholder, value (display), options: { id, value }[], onSelect, error? }`. Pressable opens a bottom `Modal` with a scrollable option list; tap selects and closes. NativeWind `className`, theme tokens only, no `style` callbacks on Pressable (use `useState` pressed state).
- `components/TransactionCard.tsx` — compact row: category icon block (income/expense) or transfer arrow, note, amount (± colored or neutral), time.
- `utils/date.ts` — `startOfDay`, `formatDateHeader` ("August 7, 2026"), `formatTime`, month-preset boundary helpers (local time).

## Navigation

- Add `Transactions` tab to `app/(tabs)/_layout.tsx` (Feather `list` or `trending-up` icon) between Accounts and Settings.
- Register `transaction-form` in the root Stack in `app/_layout.tsx` (inside signed-in `Stack.Protected`), pushed pattern like `category-form`.
- Add FAB to Home (`app/(tabs)/home.tsx`) → `/transaction-form`.

## Consistency / Constraints

- NativeWind `className`, theme tokens (`Colors`, `Shadow`, `Radius`) only — no hardcoded colors.
- No `style={({ pressed }) => ...}` callbacks on `Pressable` (NativeWind v4 gotcha); use `useState` pressed state.
- Reuse `Button`, `Input`, `Chip`, `Fab`, `EmptyState`, `GradientCard`.
- Amount coloring: income → `Colors.success`, expense → `Colors.error`, transfer → `Colors.textPrimary`.
- Money display: `formatNumber` (thousand separators). Amount inputs use `<Input amount />` — never format ad hoc.
- Regenerate Convex bindings after backend changes (`npx convex codegen`).

## Out of Scope

- Home "Recent Transactions" live list (separate concern; stays as its current empty state).
- `transactions.listByAccount` (ARCHITECTURE mentions it; no screen needs it yet).
- Split, recurring, attachments/receipts, multi-currency, search, export (PRD Future Improvements). **Transfers are now in scope.**

## Success Criteria

- Owner and Member can create income/expense transactions.
- Owner and Member can create transfers between accounts; both balances update (from −, to +).
- Owner and Member can edit a transaction/transfer; balances auto-adjust (reverse old, apply new), including account-change cases.
- Owner and Member can delete a transaction/transfer; balances auto-reverse.
- `transactions.list` filters by date range, defaults to current month, groups by date, shows time.
- Transfers appear in the list (neutral, no income/expense sign) and are excluded from income/expense totals.
- Member cannot see or touch transactions on hidden categories.
- Member can see and edit existing transactions/transfers on hidden accounts, but cannot create on or reassign to a hidden account.
- `createdBy`/`updatedBy` recorded on create and update.
- FAB "Add Transaction" obvious and present on both Transactions list and Home, for both roles.
- Amount input shows thousand separators as the user types (matches opening-balance input).
- Empty state and error handling present.
- Validation (amount sign/min, category type match, `from !== to`, date not future, note length) enforced server-side.
