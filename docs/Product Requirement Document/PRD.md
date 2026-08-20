# Kin Finance — Product Specification

> Status: Living document
> Last updated: 2026-08-20
> Source of truth: `convex/schema.ts`, `convex/*.ts`, `app/**/*.tsx`

---

## 0. How to Maintain This Document

This is the single product document for Kin Finance. It replaces the former
fragmented PRDs (`PRD_Household`, `PRD_MultiMember`, `PRD_Accounts`,
`PRD_Categories`, `PRD_Transactions`, `PRD_Budgets`), `PRODUCT.md`,
`docs/ARCHITECTURE.md`, and `docs/DESIGN.md`.

**Update workflow:**

1. **Every change** — code or requirement — gets a dated entry in
   [§8 Change Log](#8-change-log).
2. **Major feature or behavior change** — also update the affected sections
   (Requirements, Core Features, User Flow, Architecture, Database Schema,
   Tech Stack). Do not leave them stale.
3. **Bug fix or small tweak** — Change Log entry only; no section rewrite
   unless the fix contradicts something already written.
4. **Database change** — update `convex/schema.ts` first (source of truth),
   then §6 Database Schema and the Change Log.
5. When writing a section, verify against the live code — the spec is accurate
   to what exists today, not what was planned.

---

## 1. Overview

### Product Purpose

Kin Finance is a shared household finance tracker for Android. It lets a family
record income and expenses, organize them by Accounts and Categories, and plan
monthly Budgets — with clear owner/member permission boundaries so everyone
contributes but the Owner keeps control. Success means the family can see,
together, what is coming in and going out.

### Users

Family members managing money together inside one shared Household, using Kin
Finance on Android phones. The Owner (the user who creates the Household)
controls Accounts, Categories, and member access; Members collaborate on
Transactions and Budgets within visibility rules.

### Positioning

One shared Household is the root of all financial data, with role-based
visibility as the organizing idea: an Owner runs Accounts, Categories, and
membership, while Members participate in day-to-day Transactions and Budgets.
The distinguishing behavior is that hiding an Account or Category from Members
still surfaces the financial picture (e.g. Budgets for hidden Categories stay
visible) without exposing transaction detail.

### Platform & Environment

- Android-first native app (Expo SDK 54, React Native 0.81, Expo Router 6),
  portrait phones.
- Auth via Clerk (email/password, email-code verification, MFA email code,
  Google SSO); real-time data via Convex.
- English UI copy (screens, errors, empty states).
- All financial data is scoped to exactly one Household per user (MVP).

### Brand

- Product name: **Kin Finance**.
- English UI copy.
- Warm, family-focused design language: stone/amber palette, gradient cards,
  Feather icons, 48px controls. See §3.9 Design System.

### Constraints

- One Household per user in MVP; no household switching or multiple households.
- Transaction dates cannot be in the future; amounts are signed
  (+income / −expense / +transfer magnitude).
- Data can only be accessed by Household members.

---

## 2. Requirements

### 2.1 Functional Requirements (by feature)

| Feature | Requirements |
|---------|--------------|
| Authentication | Sign in, sign up (with confirm password), email verification, MFA email code, Google SSO, forgot-password reset (Clerk). Last-used method remembered per device (SecureStore) and leads the login CTA order. Auth gate in `app/_layout.tsx`. |
| Household | Create (first user becomes Owner), get active household, rename (Owner only), list members, remove member (Owner only; owner cannot be removed). |
| Invitations | Owner generates invite code (8 alphanumeric chars, HMAC-SHA-256 hash stored, 7-day expiry, single-use). Owner can revoke. Generating a new code auto-revokes previous active codes. Member joins by redeeming a code. Rate limited: max 5 attempts/code/min. |
| Accounts | Create (optional opening balance → auto "Initial Balance" transaction), edit (name/type/hidden), delete (guarded if referenced by transactions), list (visibility-filtered). Owner-only management. |
| Categories | Create, edit (name/type/hidden; type change guarded), delete (guarded if referenced), list (visibility-filtered). Two reserved "Initial Balance" categories per household are protected. Owner-only management. |
| Transactions | Create/edit/delete income, expense, transfer. Account balance(s) auto-update (reverse old, apply new). Transfers move between two accounts, no category. Members respect hidden account/category rules. `list` returns at most 1 000 rows per call (server cap, optional `limit`). Supports server-side filtering by transaction type, account, and category; a consolidated date filter (This Month / Last Month / Custom Range) sits behind one header chip. |
| Budgets | Create/edit/delete monthly budgets per expense category. List for a month with spent/progress. Members can fully manage. Budgets for hidden categories stay visible to Members. |
| Home | Dashboard: household card, My Accounts, Recent Transactions (paginated, grouped by day, "See All"). |
| Appearance | Theme preference System / Light / Dark, persisted per device (SecureStore). |

### 2.2 Validation Rules

| Field | Rule |
|-------|------|
| Household name | Required; 3–50 chars after trim |
| Account name | Required; 2–30 chars; unique within household |
| Account type | `cash` \| `bank` \| `ewallet` \| `credit_card` |
| Opening balance | Optional whole number (sign determines income/expense type) |
| Category name | Required; 2–30 chars; unique within household **and type**; `"Initial Balance"` reserved |
| Category type | `income` \| `expense` |
| Transaction amount | Whole number; non-zero; positive for income, negative for expense, positive magnitude for transfer; \|amount\| ≥ 1 |
| Transaction account | Required; visible for Member on create; reassignment requires visible account |
| Transfer accounts | Both required, must differ, same household |
| Transaction category | Required for income/expense; must match transaction type; visible for Member |
| Transaction date | Required; cannot be in the future |
| Note | Optional; ≤ 200 chars |
| Budget amount | Positive whole number ≥ 1 |
| Budget category | Required; must be **expense** type; unique per (household, category, month) |
| Invite code | 8 alphanumeric chars; case-normalized before hashing |

### 2.3 Permission Matrix

| Action | Owner | Member |
|--------|:-----:|:------:|
| View Household | ✅ | ✅ |
| Rename Household | ✅ | ❌ |
| List Members | ✅ | ✅ |
| Remove Member | ✅ | ❌ |
| Generate / Revoke Invite | ✅ | ❌ |
| Join Household | ✅ | ✅ |
| Create / Edit / Delete Account | ✅ | ❌ |
| Toggle Account Visibility | ✅ | ❌ |
| View Account Balance | ✅ | ✅ (visible only) |
| Select Account for new Transaction | ✅ | ✅ (visible only) |
| Create / Edit / Delete Category | ✅ | ❌ |
| Toggle Category Visibility | ✅ | ❌ |
| View / Create / Edit / Delete Transaction | ✅ | ✅ (visible category/account only) |
| Edit existing Transaction on hidden Account | ✅ | ✅ (cannot reassign to hidden) |
| Create / Edit Transfer | ✅ | ✅ (both accounts visible) |
| View / Create / Edit / Delete Budget | ✅ | ✅ |
| View Budget (hidden category) | ✅ | ✅ |

### 2.4 Visibility Rules

- **Hidden Account:** balance not visible to Members. Members cannot create a
  transaction on it or reassign an existing transaction to it; they may edit an
  existing transaction whose hidden account reference is unchanged.
- **Hidden Category:** transactions on that category are fully invisible and
  untouchable by Members (no view/create/edit/delete). Transfers have no
  category and are unaffected.
- **Hidden Category Budgets (exception):** budget category name and amount are
  visible to Members; spending breakdown is not shown (server-side:
  `spent`/`progress` are redacted for Members).

---

## 3. Core Features

### 3.1 Authentication (Clerk)

Clerk handles sign-in/up, email verification, MFA email code, Google SSO, and
forgot-password resets. `app/_layout.tsx` wraps the app in `ClerkProvider` +
`ConvexProviderWithClerk`. `Stack.Protected` gates signed-in routes (`(tabs)`,
forms, members) vs the signed-out index. `users.store` upserts the user
profile on first load.

#### Login screen (`app/index.tsx`)

- **Sign-in / Sign-up toggle** with confirm-password on sign-up (a mismatch
  blocks submission; toggling clears both password fields).
- **Google SSO** with a brand glyph, promoted above the email form behind an
  "or sign in with email" divider.
- **Forgot password** — three-step reset: email → emailed 6-digit code
  (with resend) → new password (`signIn.resetPasswordEmailCode`).
- **Email verification / MFA** — emailed 6-digit codes; verify submits once a
  full code is entered, with warm, reassuring copy.
- **Last-used method** — the successful method (Google vs email) is persisted
  in `expo-secure-store` via `lib/auth-preference.ts` and drives the login CTA
  order: the last-used method becomes the primary action near the thumb with a
  "Last used" badge — on the Google CTA when Google leads, or next to the
  "Email" field label when email leads — and an adapted subtitle. The
  preference is updated on every successful auth and never cleared.
- **Transient success beat** — after email verification or password reset, a
  short confirmation screen shows before routing into the app.

### 3.2 Household

Root entity for all financial data. Created once during onboarding; the
creating user becomes Owner. Owner can rename; both roles see the member list.

**Timezone:** each household stores an IANA timezone name. The default is
"match device": when no timezone is recorded the device's IANA timezone (via
`expo-localization`) is used at runtime; a concrete value is captured from the
creating device on household creation. The Owner can change it from the
Household screen (Members → Household → Timezone, `households.updateTimezone`)
choosing either "Match device" (clears the stored value so it keeps following
the device dynamically) or a manual IANA zone. All calendar-month boundaries —
budgets' `periodStart`/`periodEnd`, transactions "This Month" / "Last Month"
filters, and date-group headers on Home/Transactions — are computed in the
household timezone so every member classifies data into the same calendar month
regardless of device timezone. The Convex server remains timezone-agnostic
(compares raw epoch-ms). When the timezone changes, existing budget
`periodStart` values are re-anchored to the same calendar months in the new
timezone — migration runs only when the prior timezone was recorded **and** the
new value is a concrete zone (clearing to "match device" keeps stored
boundaries, since the device locale is assumed to match; legacy households
without a recorded timezone also keep their stored boundaries).

### 3.3 Multi-Member & Invites

- Owner generates an invite code from the Members screen. Codes are
  cryptographically random, 8 alphanumeric chars; only an HMAC-SHA-256 digest
  keyed by the server secret is stored (plaintext never persisted).
- Codes expire after 7 days, are single-use, can be revoked, and generating a
  new code invalidates previous active ones.
- Member joins via Onboarding → "Join with Invite Code" → `invitations.redeem`
  (atomic: no existing membership → validate hash/expiry/revoked/useCount →
  insert membership + increment useCount).
- Owner can remove Members; removed members lose access immediately but their
  transactions/budgets remain.

### 3.4 Accounts

Accounts are where money lives: `cash`, `bank`, `ewallet`, `credit_card`. Each
has an auto-maintained balance. Owner creates accounts with an optional opening
balance — the sign of the balance posts an initial transaction against a
reserved "Initial Balance" category so the balance is applied exactly once
through the standard path. Opening balances are whole numbers. Owner edits
name/type and toggles visibility. Owner
deletes accounts only when no transactions reference them.

### 3.5 Categories

Labels for classifying transactions, typed `income` or `expense`. Owner manages
them. Two reserved system-managed categories per household — "Initial Balance"
(income) and "Initial Balance" (expense) — are created with the household and
are protected from rename/hide/retype/delete and excluded from user-facing
lists. Type changes and deletes are guarded when budgets/transactions
reference the category.

### 3.6 Transactions

Core records of financial activity: income, expense, or transfer.

- **Income/Expense:** linked to one Account and one Category; amount signed
  (+income, −expense), a whole number; category type must match transaction type.
- **Transfer:** links two Accounts (from → to), no category; amount is a
  positive magnitude; `from.balance -= amount`, `to.balance += amount`.
- **Balance auto-update:** create applies; update reverses old + applies new
  (handles account changes via net deltas); delete reverses.
- `createdBy` / `updatedBy` recorded on every transaction.
- Members cannot create on hidden accounts/categories or reassign to them, but
  can edit existing transactions referencing hidden accounts.
- **Form UX:** contextual subtitle/type icon, chip type selector, amount with
  thousand-separator formatting, contextual sign-convention hint, "Repeat last"
  shortcut, date hint, note character counter, discard guard on both header
  back button and Android hardware back button. See §4.4 for details.
- **Day-grouped net totals:** the Transactions list shows a net total per day
  header (income − expense; transfers excluded because they move money between
  owned accounts and do not change household net worth), colored by sign.
- The `list` query hydrates entities with a per-query cache and caps results at
  1 000 rows.

**Filtering (as of 2026-08-20):** the Transactions page filters the visible list
server-side by **type** (income/expense/transfer), **account**, and **category**,
with the date range (This Month / Last Month / Custom Range) consolidated behind a
single Date chip. The summary card and per-day net totals derive from the filtered
query result, so they always match the visible rows. Category options are
contextual to the selected type (income → income categories, expense → expense
categories); selecting type `transfer` clears an active category filter, since
transfers have no category. Filtering is pushed into compound indexes
(`by_household_account_date`, `by_household_category_date`, `by_household_type_date`)
so a filter never scans the full date window. For Members, the existing bounded
scan (limit × 10) still applies — hidden-category rows cannot be indexed away —
so heavy filtering over long ranges may return fewer rows than the limit. The
empty state distinguishes "no transactions at all" from "no transactions match
your filters" (with a Clear filters action).

### 3.7 Budgets

Monthly spending limits per expense category. Identified by
`(householdId, categoryId, periodStart)` — one budget per category per month.
`periodStart` is the first day of the calendar month in the **household
timezone** (IANA name stored on `households`, e.g. `Asia/Jakarta`; defaults to
the device timezone when unset). Budget amounts are whole numbers. Spending =
sum of expense
transactions in that category during the month; progress = spent / amount.
Both Owner and Member can manage budgets. Budgets for hidden categories remain
visible (name + amount, no breakdown). For Members, the spending breakdown
(spent/progress) of budgets on hidden categories is not shown.

### 3.8 Home Dashboard

- Greeting uses the user's first name (from Clerk `user.firstName`, falling back
  to profile name, then email prefix with dots replaced by spaces).
- Household card (name + member count badge).
- **Total Balance**: gradient card showing the sum of all account balances, with
  a secondary line showing this month's net income/expense in semantic color
  (green for positive, red for negative).
- **Budgets** (when budgets exist): up to 3 budget pills showing category name,
  spent/budgeted amounts, and a color-threshold progress bar (green → amber →
  red). "See All" links to the Budgets tab.
- **My Accounts**: horizontal account cards with type-specific tinted icon
  backgrounds (green for cash, amber for bank, blue for e-wallet, red for credit
  card); "Add Account" card for Owner; "Manage" link to the Accounts tab. For
  Members, tapping a card goes to the Accounts tab (owner-only edit/delete stays
  in the Accounts tab).
- **Recent Transactions**: latest 5 (paginated via cursor), grouped by day with
  day net total (income − expense; transfers excluded), "See All" link to the
  Transactions tab. Transaction icons map category names to relevant Feather
  icons (shopping-cart, coffee, car, home, briefcase, etc.) with semantic colors
  (green for income, red for expense).
- Empty states include action CTAs (e.g., "Add Transaction" on empty transaction
  list, "Add Account" for Owners on empty accounts).
- FAB uses reanimated spring animation (scale on press) for tactile feedback.
- Sign-out is accessible only via the Settings tab, not the home header.

### 3.9 Design System

| Token | Value |
|-------|-------|
| Colors | stone/amber warm palette — primary `#92400E`, background `#FFFBF5`, surface `#FEF3C7`, success `#065F46`, error `#991B1B`; full dark-mode variants in `constants/theme.ts` |
| Typography | H1 28 bold, H2 20 semibold, Body 16, Caption 14, Small 12 |
| Spacing | XS 4 / SM 8 / MD 16 / LG 24 / XL 32 |
| Radius | SM 12 / MD 16 / LG 24 |
| Shadow | Card `0 2 8 rgba(0,0,0,0.04)`, Elevated `0 4 16 rgba(0,0,0,0.08)` |
| Components | Button (48px, full width, solid), Input (48px outlined), Card (gradient, 16px radius), Header, Skeleton (pulse loading placeholder) |
| Icons | Feather, 24px default / 20px small |
| Theme | System / Light / Dark via `Appearance.setColorScheme`; NativeWind `dark:` variants + `useThemeColors()` / `useThemeGradients()` |

---

## 4. User Flow

### 4.1 First Login (Onboarding)

```text
App Open → Clerk Auth Gate → signed in → check households.getActive
  → null → Onboarding Screen
      → Create Household  (households.create → owner + reserved categories)
      → or Join with Invite Code (invitations.redeem → member)
  → success → Home (dashboard)
```

### 4.2 Returning User

```text
App Open → Clerk Auth Gate → signed in → households.getActive found → Home
```

### 4.3 Owner Creates Account (with opening balance)

```text
Accounts tab → "+" → fill name/type/opening balance
  → accounts.create({ name, type, openingBalance, hidden })
  → account inserted with balance 0
  → if openingBalance != 0, accounts.create posts the "Initial Balance"
    transaction server-side within the same atomic mutation
  → account appears with opening balance reflected
```

The opening-balance transaction is created internally by `accounts.create`
(against the reserved "Initial Balance" category matching the balance sign),
not by a separate client call. A zero opening balance skips that step entirely.

### 4.4 Create Transaction

```text
Transactions tab → "+" → type toggle (Income/Expense/Transfer)
  → amount input with thousand-separator formatting
  → account, category (income/expense), date, note
  → or transfer: from/to account
  → Save → transactions.create → balances auto-updated → list
```

**Form UX (as of 2026-08-17):**

- Header shows contextual subtitle ("Track an expense" / "Record incoming
  money" / "Move money between accounts") and a dynamic type icon.
- Type selector is a chip group; switching type clears mismatched selections
  and shows a snackbar when category is cleared.
- Amount input uses `formatAmountInput` for automatic thousand-separator
  display. Contextual hint below explains sign convention per type.
- "Repeat last" standalone row (below type chips, above amount) appears when
  a transaction was created in the same session — pre-fills type, amount,
  account, category (does not survive unmount). Includes icon, label, and
  description for self-explanatory power-user shortcut.
- Date field shows "Today's date is pre-filled — you can backdate
  transactions".
- Note field has a character counter (`0/200`) with amber/red color feedback
  at 150/180 chars.
- Empty category state links to category creation with a return note.
- Discard guard: header back button and Android hardware back button both
  show an Alert when the form has unsaved changes (type change from default
  or date change from today counts as interaction for new transactions).
- **Inline validation:** field-specific error states (`amountError`,
  `accountError`, `categoryError`, `dateError`) display directly beneath
  each field on blur or submit attempt. Type change clears all error states.
- **Three-section layout:** Type + Amount (bordered container),
  Account + Category or From/To Account (bordered container with
  `bg-surface`), Date + Note (bordered container). Consistent bordered
  treatment without gradient card — clean visual rhythm with background
  color differentiation for account/category emphasis.
- **Keyboard behavior:** tapping any non-text-input field (Account/Category/
  From-To selector, Date, type chip, "Repeat last") dismisses the keyboard
  before the field action runs; tapping a text input (Amount, Note) keeps the
  keyboard open so focus transfers.

### 4.5 Owner Invites Member

```text
Settings → Household Members → "Generate Invite" FAB
  → server: generate code, HMAC hash, store digest + 7-day expiry + single-use
  → auto-revoke previous active invites
  → show code once → copy/share
```

### 4.6 Member Joins Household

```text
App Open → Onboarding → "Join with Invite Code" → enter 8-char code
  → invitations.redeem (validate) → membership inserted → Home
```

### 4.7 Set / Edit a Budget

```text
Budgets tab → month selector → "+" (or tap row to edit)
  → select expense category, amount → create/update → list shows spent/progress
```

### 4.8 Change Appearance Theme

```text
Settings → Appearance → System / Light / Dark
  → setPreference → Appearance.setColorScheme → app-wide instant change
  → persisted to SecureStore, applied before first render on next launch
```

### 4.9 Filter Transactions

```text
Transactions tab → Date chip (default This Month) → Last Month / Custom Range (From/To) → Done
  → Filter chip → Type chips (All/Income/Expense/Transfer) + Account/Category lists
    (search when >8 options; Reset clears all)
  → list, summary card, and per-day net totals reflect the active filters
```

---

## 5. Architecture

### 5.1 System Diagram

```text
┌───────────────────────────────────────────────┐
│              MOBILE APP (Expo)                 │
│  Expo Router screens  •  Clerk (sign in/out)   │
│        └──────────┬───────────┘                │
│           ConvexProviderWithClerk               │
│           (real-time sync, live queries)        │
└───────────────────┬────────────────────────────┘
                    │
┌───────────────────▼────────────────────────────┐
│            CONVEX BACKEND                       │
│   Auth (Clerk JWT)  •  Queries  •  Mutations    │
│   Tables: users, households,                    │
│   householdMemberships, invitations, accounts,  │
│   categories, transactions, budgets             │
└────────────────────────────────────────────────┘
```

### 5.2 Responsibilities

| Component | Responsibility |
|-----------|---------------|
| `app/_layout.tsx` | ThemeProvider, ClerkProvider, ConvexProviderWithClerk, SnackbarProvider, root Stack + auth gating |
| `app/index.tsx` | Signed-out entry |
| `app/(tabs)/home.tsx` | Dashboard (household, accounts, recent transactions, monthly net, budget pills) |
| `app/(tabs)/accounts.tsx` | Accounts list (filters, FAB, owner edit/delete) |
| `app/(tabs)/transactions.tsx` | Transactions list (date + type/account/category filters, summary, day-grouped with net totals) |
| `app/(tabs)/budgets.tsx` | Budgets list (month selector, progress) |
| `app/(tabs)/settings.tsx` | Settings (Household, Appearance, Categories, Sign Out) |
| `app/onboarding.tsx` | Create/Join household |
| `app/members.tsx` | Members + rename + invite code generation/revoke |
| `app/account-form.tsx` / `category-form.tsx` / `transaction-form.tsx` / `budget-form.tsx` / `categories.tsx` | Feature CRUD screens |
| `components/` | Reusable UI (Button, Input, Card, Fab, EmptyState, Snackbar with optional action, Skeleton, ThemeProvider, TransactionCard, Chip, DateField, GradientCard, SelectField with search) |
| `constants/theme.ts` | Theme tokens + `useThemeColors` / `useThemeGradients` |
| `lib/errors.ts` | `getConvexErrorMessage` — user-friendly error extraction |
| `convex/schema.ts` | Database schema (source of truth) |
| `convex/helpers.ts` | Shared auth/scope helpers: `getUserAndMembership` (mutations, throws `ConvexError`), `findUserAndMembership` (queries, returns `{user, membership}` or `null`), `findUser` (user only, returns `null` when signed out), `requireOwner` (owner-gate check), `getScopedDoc` (fetch + household-scope guard that throws `"<Entity> not found."`) |
| `convex/*.ts` | Query/mutation functions |

### 5.3 Account Balance Auto-Update

```text
income/expense (amount signed):
  on create:   account.balance += amount
  on update:   if accountId changed:
                 old.balance -= oldAmount; new.balance += newAmount
               else: account.balance += (newAmount - oldAmount)
  on delete:   account.balance -= amount

transfer (amount = positive magnitude):
  on create:   from.balance -= amount; to.balance += amount
  on update:   reverse old, apply new (handles account changes)
  on delete:   from.balance += amount; to.balance -= amount
```

All operations within one mutation — atomic. The three code paths share two
helpers in `convex/transactions.ts` — `applyBalanceDelta` (safe per-account
patch, skips missing accounts) and `reverseBalances` (reverses a transaction's
effects) — so create/update/delete balance math cannot drift apart.

### 5.4 Error Handling Convention

- Every backend handler requires `ctx.auth.getUserIdentity()` and throws
  `ConvexError` with a plain, user-friendly string.
- Client must never display `error.message` (technical). Use
  `getConvexErrorMessage(e, fallback)` in every `catch`.
- Server-side `Server Error` console output for thrown errors is expected.
- **Feedback standardization:** validation errors render inline next to the
  field; operational errors (create/update/delete failures) surface via
  `Snackbar`; destructive actions (delete, remove member, revoke invite,
  sign out) require an `Alert.alert` confirmation first. Delete transaction
  shows a Snackbar with an **Undo** action that re-creates the transaction.
- Client and server share one validation module, `constants/validation.ts`
  (path alias `@/constants/validation`), eliminating drift (e.g. `isInteger`
  vs `isSafeInteger`).

### 5.5 Invitation Security Model

- 8-char random codes (~41 bits entropy), server-secret HMAC-SHA-256 digests
  only (no plaintext / unkeyed hashes persisted).
- 7-day expiry, single-use, owner-revocable, auto-revoke on new code.
- Atomic redemption; per-code rate limit (5 attempts / 60s).

### 5.6 Initial Balance Category Contract

Each household gets two reserved "Initial Balance" categories (income and
expense) at creation. The category name is the single shared constant
`RESERVED_CATEGORY_NAME` in `constants/categories.ts` — never a bare literal.
`accounts.create` with a non-zero opening balance posts a
transaction against the matching one; it assumes the category exists (created
with the household) and errors if it does not, rather than creating it on the
fly. These categories are protected:
`categories.create` cannot duplicate them; update/delete reject rename/hide/
retype/delete; they never appear in user-facing category selection.

---

## 6. Database Schema

Source of truth: `convex/schema.ts`. `households` is the root entity for all
financial data. `accounts`, `categories`, `transactions`, and `budgets` are
household-scoped financial entities. `householdMemberships` and `invitations`
are household-scoped relationship/access records (who belongs and who may
join). `users` is the global identity record — not household-scoped — linked to
households only through `householdMemberships`.

### `users`

```text
tokenIdentifier: string        // Clerk token ID
clerkUserId: string
name: string | undefined
email: string | undefined
imageUrl: string | undefined
```
**Indexes:** `by_tokenIdentifier` on `["tokenIdentifier"]`

### `households`

```text
name: string            // 3-50 chars, trimmed
timezone: string | undefined  // IANA name, e.g. "Asia/Jakarta"; undefined = match device
createdAt: number
updatedAt: number
```

### `householdMemberships`

```text
householdId: id<households>
userId: id<users>
role: "owner" | "member"
```
**Indexes:** `by_householdId`, `by_userId`

### `invitations`

```text
householdId: id<households>
codeHash: string              // HMAC-SHA-256 digest, never plaintext
createdBy: id<users>
expiresAt: number             // 7 days from creation
maxUses: number               // 1 (single-use, MVP)
useCount: number
revoked: boolean
redemptionAttempts: number    // rate-limit window
lastAttemptAt: number
createdAt: number
updatedAt: number
```
**Indexes:** `by_codeHash`, `by_householdId`

**Uniqueness note:** Convex indexes are not unique constraints. Uniqueness is
enforced at the mutation layer: `invitations.create` retries with a fresh code
on `codeHash` collision, and `invitations.redeem` rejects redemption when more
than one invitation matches the hash. Account names (unique per household) and
category names (unique per household + type) are likewise enforced via
transactional existence checks in `accounts.*` / `categories.*`, not by
database indexes. The same applies to the budget identity
`(householdId, categoryId, periodStart)`.

### `accounts`

```text
householdId: id<households>
name: string
type: "cash" | "bank" | "ewallet" | "credit_card"
balance: number               // auto-updated
hidden: boolean               // default false
createdAt: number
updatedAt: number
```
**Indexes:** `by_householdId`

### `categories`

```text
householdId: id<households>
name: string
type: "income" | "expense"
hidden: boolean               // default false
createdAt: number
updatedAt: number
```
**Indexes:** `by_householdId`

### `transactions`

```text
householdId: id<households>
accountId: id<accounts>       // income/expense: account; transfer: source (from)
categoryId: id<categories> | undefined  // income/expense only
toAccountId: id<accounts> | undefined   // transfer only
amount: number                // +income, -expense, +transfer magnitude
type: "income" | "expense" | "transfer"
note: string | undefined
date: number
createdBy: id<users>
updatedBy: id<users>
createdAt: number
updatedAt: number
```
**Indexes:** `by_householdId`, `by_household_date`, `by_household_account_date`
(`["householdId", "accountId", "date"]`), `by_household_category_date`
(`["householdId", "categoryId", "date"]`), `by_household_type_date`
(`["householdId", "type", "date"]`), `by_accountId`, `by_toAccountId`,
`by_categoryId`

**Invariants:** amount sign matches type; category type matches transaction
type; transfers have no category and `toAccountId !== accountId`.

### `budgets`

```text
householdId: id<households>
categoryId: id<categories>    // must be expense type
periodStart: number           // first day of calendar month in household timezone (epoch ms)
amount: number
createdBy: id<users>
updatedBy: id<users>
createdAt: number
updatedAt: number
```
**Indexes:** `by_householdId`, `by_categoryId`, `by_category_period`,
`by_household_period`

**Invariant:** unique on `(householdId, categoryId, periodStart)`.

### Convex Functions

| Module | Function | Type | Notes |
|--------|----------|------|-------|
| `users` | `store` | mutation | Upsert current user profile |
| `users` | `getMe` | query | Current user profile |
| `households` | `create` | mutation | Create + owner membership + reserved categories; records device IANA timezone (server-validated) |
| `households` | `getActive` | query | Current user's household |
| `households` | `update` | mutation | Rename (owner only) |
| `households` | `updateTimezone` | mutation | Set timezone (owner only); accepts `timezone: string \| undefined` (undefined = match device, clears stored value); server rejects non-IANA identifiers; re-anchors budget periods only when prior timezone recorded and new value is concrete |
| `households` | `listMembers` | query | Member list (owner + members) |
| `households` | `removeMember` | mutation | Owner only; cannot remove owner |
| `invitations` | `create` | mutation | Generate code (owner), auto-revokes previous |
| `invitations` | `revoke` | mutation | Owner only |
| `invitations` | `redeem` | mutation | Atomic join; rate limited |
| `invitations` | `listActive` | query | Active invites; owner only |
| `accounts` | `list` | query | Visibility-filtered accounts + `isOwner` |
| `accounts` | `create` | mutation | Owner; optional opening balance |
| `accounts` | `update` | mutation | Owner; name/type/hidden |
| `accounts` | `remove` | mutation | Owner; guarded by referencing transactions |
| `categories` | `list` | query | Filtered, excludes reserved categories |
| `categories` | `create` | mutation | Owner |
| `categories` | `update` | mutation | Owner; type change guarded |
| `categories` | `remove` | mutation | Owner; guarded by references |
| `transactions` | `create` | mutation | Validates sign/type/category/transfer |
| `transactions` | `update` | mutation | Reverse old + apply new balances |
| `transactions` | `remove` | mutation | Reverse balances |
| `transactions` | `list` | query | Date-range + optional `accountId`/`categoryId`/`type` filtered (index-driven); optional `limit` (default/max 1 000); cached hydration |
| `transactions` | `recent` | query | Latest N with cursor pagination |
| `transactions` | `get` | query | Single transaction (hidden-category aware) |
| `budgets` | `list` | query | `{periodStart, periodEnd}`; spent + progress; redacted (undefined) for Members on hidden categories |
| `budgets` | `get` | query | Single budget |
| `budgets` | `categoryOptions` | query | Expense categories for budget form |
| `budgets` | `create` | mutation | Member-ok; unique per category/month |
| `budgets` | `update` | mutation | Member-ok; amount only |
| `budgets` | `remove` | mutation | Member-ok |

---

## 7. Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo SDK 54, React Native 0.81 |
| Navigation | Expo Router 6 |
| Auth | Clerk (`@clerk/expo`) |
| Backend | Convex (`convex` 1.43) |
| Styling | NativeWind 4 (Tailwind CSS 3.4), `global.css`, `cssInterop` for `LinearGradient` |
| Animation | React Native Reanimated 4.1 |
| Language | TypeScript 5.9 |
| Persistence (device) | `expo-secure-store` (theme preference) |
| Date picker | `@react-native-community/datetimepicker` |
| Device locale / timezone | `expo-localization` (`getCalendars()[0].timeZone`) |
| Clipboard / Share / Haptics | `expo-clipboard`, native share sheet, `expo-haptics` |
| Icons | `@expo/vector-icons` Feather |

### Styling Rules

- Use NativeWind `className` (not `StyleSheet.create`).
- Theme via `useThemeColors()` / `useThemeGradients()` hooks + `dark:` variants.
- Gradient cards: `expo-linear-gradient` + `Gradients.card`; shadows
  `Shadow.card` / `Shadow.elevated`; icons Feather.
- Money inputs: shared `Input` component with `amount` prop (thousand-separator
  formatting); `number-pad` keyboard and `formatAmountInput` block decimal
  input, so whole-number-only is enforced at the keyboard, not as a submit error.
- SelectField: modal dropdown with search (auto-shows when >8 options),
  `keyboardShouldPersistTaps="handled"` on options list, `Shadow.card` token
  for modal sheet, `min-h-12` option items for 48px touch targets.
- **NativeWind v4 gotcha:** never use `style={({ pressed }) => [...]}` on
  `Pressable` — it breaks `className`. Use `useState` + static style.

---

## 8. Change Log

Entries are chronological, newest first. Major changes update the relevant
sections above; fixes are logged here only.

| Date | Type | Description |
|------|------|-------------|
| 2026-08-20 | Feature | Transactions filters: server-side `transactions.list` args `accountId`/`categoryId`/`type`, backed by three new compound indexes (`by_household_account_date`, `by_household_category_date`, `by_household_type_date`) so filters never scan the full date window; Transactions page header consolidated to a Date chip (This Month default / Last Month / Custom Range in a bottom-sheet modal) and a Filter chip (type chips + account/category option lists with search, Reset); summary card and per-day net totals derive from the filtered query; filter-aware empty state; new `FilterSheet` component. Updates §2.1, §3.6, §4.9, §5.2, §6 |
| 2026-08-18 | UX | Login screen branding refresh: replaced the Feather "home" icon inside a gradient card with the full `splash-icon.png` asset (160×160, no wrapper card, `resizeMode="contain"`); removed the separate "Kin Finance" text heading — the brand name is now rendered only within the image itself; the subtitle ("Welcome back…" / "Create an account…") remains below the icon. Removes unused `LinearGradient`, `Radius`, `Shadow`, and `useThemeGradients` from `app/index.tsx`. |
| 2026-08-17 | UX | Day net totals on the Transactions page: each day-group section header now shows the day's net (income − expense) in sign color (+ green / − red / 0 neutral), mirroring the Home dashboard pattern; the shared helper `sumNetExcludingTransfers` (`utils/format.ts`) computes it with transfers excluded, and Home's Recent Transactions day total was switched to the same helper so transfers no longer inflate the day's net. Updates §3.6, §3.8, §5.2 |
| 2026-08-17 | UX | Home Recent Transactions now shows the latest 5 transactions (was 2): `limit` raised 2 → 5 in `app/(tabs)/home.tsx` (single `RECENT_TRANSACTIONS_LIMIT` constant), the auto-fetch cursor heuristic updated so the section keeps fetching while under 5 items and the accumulated list is capped at 5 (`.slice(0, 5)`) — preventing overshoot past 5 when a continuation page returns a full page on top of a partial one (hidden-category Members) — and the loading skeleton renders 5 placeholder rows to match. Rationale (design reference — Copilot Money, Nubank, and finance dashboard kits surface 5–10 recent items; the old 2-item preview was below standard and forced an extra "See All" tap for a frequent task). Updates §3.8 |
| 2026-08-17 | UX | Keyboard auto-dismiss on field tap: `SelectField` and `DateField` triggers call `Keyboard.dismiss()` before opening their picker/modal, and the transaction form dismisses on type-chip and "Repeat last" taps — so tapping any non-text-input field closes the keyboard while the field action proceeds (blank-area taps already dismiss via `keyboardShouldPersistTaps="handled"`); tapping a text input (Amount, Note) keeps the keyboard open for focus transfer; applies to every form reusing `SelectField`/`DateField` (transaction, budget, account, category, members) |
| 2026-08-16 | Feature | Settings Sign Out button: full-width `Button variant="danger"` in a new "Account" section at the bottom of the Settings tab; tap opens an `Alert.alert` confirmation ("Sign Out?" / Cancel / Sign Out, per §5.4 destructive-action convention); on confirm, `signOut()` from Clerk clears the session and the `Stack.Protected` auth guard in `app/_layout.tsx` routes to the sign-in screen — no manual navigation; button shows a loading spinner and is disabled while signing out. Implements the existing §3.8 requirement that sign-out is accessible via the Settings tab |
| 2026-08-16 | Fix | Server-side IANA validation: `households.create` and `households.updateTimezone` now reject non-IANA timezone identifiers via `validateTimezone` (`Intl.DateTimeFormat` throws on unknown zones); `undefined` (match device) remains valid |
| 2026-08-16 | Feature | Timezone settings moved to Household screen (Members → Household → Timezone): Owner picks "Match device" (clears the stored timezone so it keeps following the device dynamically) or a manual zone via `households.updateTimezone` (owner-gated, `timezone: string \| undefined`, curated IANA list with offset hints in `constants/timezones.ts`); "match device" is the default — `resolveTimezone(stored)` in `constants/timezones.ts` falls back to `getCalendars()[0].timeZone` (via `expo-localization`) when no timezone is recorded, so legacy households with unset `timezone` now resolve to the device zone instead of `UTC` (fixes budgets whose `periodStart` was written in device-local time yet queried as UTC month start); when a recorded timezone changes, existing budget `periodStart` values are re-anchored to the same calendar months in the new timezone (migration only when a prior timezone was recorded and the new value is concrete; clearing to "match device" keeps stored boundaries); non-owner Members see a read-only timezone card; all screens use `resolveTimezone` |
| 2026-08-16 | Feature | Household timezone: `households.timezone` (IANA string, optional; absent = follow device timezone) captured on create via `expo-localization` (`getCalendars()[0].timeZone`); new timezone-aware helpers in `utils/date.ts` (`getMonthBounds`, `formatMonthLabel`, `formatDateHeaderTz`, `formatTimeTz`, `formatDateShortTz`) computing calendar-month boundaries and date labels in the household timezone; all period-boundary call sites migrated (Home dashboard + date-group headers, Budgets month selector, budget form `periodStart`/month label, Transactions "This Month"/"Last Month" filters + headers, `TransactionCard` time via `timezone` prop) so members in different timezones classify transactions into the same calendar month; server stays timezone-agnostic (raw epoch-ms comparison); fixes the budget exact-match mismatch where `periodStart` was written in device-local time but queried as UTC month start |
| 2026-08-16 | Refactor | Permission/scope consolidation + shared reserved-category constant: `requireOwner` and `getScopedDoc` in `convex/helpers.ts` replace ~9 inline owner-gate checks and ~16 duplicated get+household-scope checks across `accounts.*`, `categories.*`, `budgets.*`, `transactions.*`, `invitations.*` mutations (single `"You are not the owner..."` / `"<Entity> not found."` messages); `accounts.create` opening-balance path now relies on the reserved category guaranteed by `households.create` — removed the lookup-or-create fallback that could silently create duplicate "Initial Balance" categories; `RESERVED_CATEGORY_NAME` added to `constants/categories.ts` and shared by `households`, `accounts`, `categories`, `budgets` (was 4 hardcoded copies); removed dead null-check in `accounts.remove`; new `tests/accounts.create.test.ts` specs (5 cases) pinning opening-balance posting + owner-only permission |
| 2026-08-15 | Refactor | Backend auth/balance deduplication (analysis-driven): new query-safe helper `findUserAndMembership` (returns `null`) and user-only `findUser` in `convex/helpers.ts`, replacing ~14 copy-pasted identity→user→membership blocks across query handlers (`accounts.list`, `categories.list`, `budgets.list/get/categoryOptions`, `transactions.list/recent/get`, `households.getActive`, `invitations.listActive`, `users.getMe`); extracted shared `applyBalanceDelta` + `reverseBalances` in `convex/transactions.ts` so create/update/delete balances can't diverge (was 3 hand-rolled implementations of §5.3); `transactions.get` now reuses `hydrate`; inline account/category type literals replaced with `Doc<>` in `transactions.ts`; new `tests/transactions.balance.test.ts` characterization specs (6 cases) pinning balance auto-update behavior |
| 2026-08-15 | UX | Home dashboard redesign (critique score 21→target): balance card now shows monthly net income/expense with semantic color; budget pills row with progress bars; type-specific tinted account icons; category-mapped transaction icons with semantic colors; greeting uses first name; sign-out moved to Settings; empty states include action CTAs; FAB uses reanimated spring animation; dark mode badge contrast fixed |
| 2026-08-15 | UX | Transaction form design critique cycle (v1–v5, score 29→31/40): inline field-specific validation (amount, account, category, date errors show beneath each field); three-section layout with differentiated backgrounds (Account/Category `bg-surface`, Date/Note `bg-background`); removed GradientCard for consistent bordered treatment; "Repeat last" moved from type chip row to standalone icon+label+description row; date errors now inline under DateField instead of generic banner |
| 2026-08-15 | Hardening | Shared validation module (constants/validation.ts) used by client + server, fixing isInteger/isSafeInteger drift; transactions.list hydration cache + 1 000-row cap; discard guard fixed for edit mode (all fields tracked); invitations.listActive owner-gated; budgets.list redacts spent/progress for Members on hidden-category budgets; onboarding redirect moved out of render (members/settings); new convex-test specs for list cap, budget redaction, and invite owner-gate |
| 2026-08-15 | Polish | Transaction form UX: contextual subtitle/type icon, discard guard (header back + Android hardware back via `beforeRemove`), type-change snackbar on category clear, "Repeat last" chip (same-session `useRef`), amount thousand-separator formatting preserved, contextual sign-convention hint, date backdate hint, note character counter with amber/red feedback, rewritten error messages, `hasInteracted` triggers on type/date change for new transactions; SelectField: search (>8 options), NativeWind styling, `Shadow.card` token, `keyboardShouldPersistTaps="handled"`, `min-h-12` options, accessibility labels |
| 2026-08-14 | Polish | UX polish pass: Home My Accounts renders horizontal account cards (per §3.8) with owner "Add Account" card; Skeleton pulse loading on dashboard + list screens; Snackbar supports action buttons (undo delete transaction); sign-out confirmation; decimal input blocked at the keyboard + `formatAmountInput` strips decimals; operational errors unified to Snackbar across accounts/categories/budgets/members |
| 2026-08-14 | Polish | Hardening pass: whole-number amount enforcement (client + server), unified error handling via `getConvexErrorMessage` across all screens, extracted shared `getUserAndMembership` helper, removed dead theme tokens, project README + `npm test` script, unused asset cleanup |
| 2026-08-13 | Docs | Consolidate all fragmented docs into this single Product Specification |
| 2026-08-13 | Feature | Theme preference (System/Light/Dark) with `ThemeProvider` + SecureStore persistence |
| 2026-08-12 | Feature | Home Recent Transactions — live data, day-grouped with net totals, cursor pagination, "See All" |
| 2026-08-11 | Feature | Invite revoke UI — Pending Invites section; auto-revoke previous active invite on new code |
| 2026-08-10 | Feature | Multi-member — invite generate/redeem, member list, remove member |
| 2026-08-10 | Feature | Budgets — monthly budgets with spent/progress, hidden-category exception |
| 2026-08-09 | Feature | Transactions — income/expense/transfer, balance auto-update |
| 2026-08-09 | Feature | Categories — CRUD + visibility, reserved "Initial Balance" categories |
| 2026-08-09 | Feature | Amount input thousand-separator formatting (`Input` `amount` prop) |
| 2026-08-08 | Feature | Accounts — create w/ opening balance, edit/delete, type icons |
| 2026-08-07 | Feature | Household — create/rename/members; onboarding flow |
| 2026-08-07 | Feature | Convex + Clerk integration, auth gate |
| 2026-08-07 | Feature | Initial app scaffold (Expo Router, NativeWind, theme tokens) |

---

## Appendix A — Future / Out of Scope

Not implemented; kept for roadmap reference.

- Multiple Households per user; household switching/archiving/deletion.
- Transfer of ownership.
- Email-based invitations.
- Member leaving household.
- Account/category icons & colors; multi-currency; archiving/merging.
- Split transactions; recurring transactions; attachments/receipts; search;
  CSV/PDF export.
- Budget rollover; weekly/yearly budgets; notifications; templates.
- Reports/analytics beyond current Budget progress.
