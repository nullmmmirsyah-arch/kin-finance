# Kin Finance — Product Specification

> Status: Living document
> Last updated: 2026-08-14
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
| Authentication | Sign in, sign up, email verification, MFA email code, Google SSO (Clerk). Auth gate in `app/_layout.tsx`. |
| Household | Create (first user becomes Owner), get active household, rename (Owner only), list members, remove member (Owner only; owner cannot be removed). |
| Invitations | Owner generates invite code (8 alphanumeric chars, HMAC-SHA-256 hash stored, 7-day expiry, single-use). Owner can revoke. Generating a new code auto-revokes previous active codes. Member joins by redeeming a code. Rate limited: max 5 attempts/code/min. |
| Accounts | Create (optional opening balance → auto "Initial Balance" transaction), edit (name/type/hidden), delete (guarded if referenced by transactions), list (visibility-filtered). Owner-only management. |
| Categories | Create, edit (name/type/hidden; type change guarded), delete (guarded if referenced), list (visibility-filtered). Two reserved "Initial Balance" categories per household are protected. Owner-only management. |
| Transactions | Create/edit/delete income, expense, transfer. Account balance(s) auto-update (reverse old, apply new). Transfers move between two accounts, no category. Members respect hidden account/category rules. |
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
  visible to Members; spending breakdown is not shown.

---

## 3. Core Features

### 3.1 Authentication (Clerk)

Clerk handles sign-in/up, email verification, MFA email code, and Google SSO.
`app/_layout.tsx` wraps the app in `ClerkProvider` + `ConvexProviderWithClerk`.
`Stack.Protected` gates signed-in routes (`(tabs)`, forms, members) vs the
signed-out index. `users.store` upserts the user profile on first load.

### 3.2 Household

Root entity for all financial data. Created once during onboarding; the
creating user becomes Owner. Owner can rename; both roles see the member list.

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

### 3.7 Budgets

Monthly spending limits per expense category. Identified by
`(householdId, categoryId, periodStart)` — one budget per category per month.
`periodStart` is the first day of the UTC month. Budget amounts are whole
numbers. Spending = sum of expense
transactions in that category during the month; progress = spent / amount.
Both Owner and Member can manage budgets. Budgets for hidden categories remain
visible (name + amount, no breakdown).

### 3.8 Home Dashboard

- Household card (name + member count).
- **My Accounts**: horizontal account cards with balances; "Add Account" card
  for Owner.
- **Recent Transactions**: latest 5 (paginated via cursor), grouped by day with
  day net total, "See All" link to the Transactions tab.
- Empty/loading states for each section.

### 3.9 Design System

| Token | Value |
|-------|-------|
| Colors | stone/amber warm palette — primary `#92400E`, background `#FFFBF5`, surface `#FEF3C7`, success `#065F46`, error `#991B1B`; full dark-mode variants in `constants/theme.ts` |
| Typography | H1 28 bold, H2 20 semibold, Body 16, Caption 14, Small 12 |
| Spacing | XS 4 / SM 8 / MD 16 / LG 24 / XL 32 |
| Radius | SM 12 / MD 16 / LG 24 |
| Shadow | Card `0 2 8 rgba(0,0,0,0.04)`, Elevated `0 4 16 rgba(0,0,0,0.08)` |
| Components | Button (48px, full width, solid), Input (48px outlined), Card (gradient, 16px radius), Header |
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
Transactions tab → "+" → type toggle (Income/Expense) or Transfer
  → amount, account, category (income/expense), date, note
  → or transfer: from/to account
  → Save → transactions.create → balances auto-updated → list
```

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
| `app/(tabs)/home.tsx` | Dashboard (household, accounts, recent transactions) |
| `app/(tabs)/accounts.tsx` | Accounts list (filters, FAB, owner edit/delete) |
| `app/(tabs)/transactions.tsx` | Transactions list (date filters, summary, grouped) |
| `app/(tabs)/budgets.tsx` | Budgets list (month selector, progress) |
| `app/(tabs)/settings.tsx` | Settings (Household, Appearance, Categories) |
| `app/onboarding.tsx` | Create/Join household |
| `app/members.tsx` | Members + rename + invite code generation/revoke |
| `app/account-form.tsx` / `category-form.tsx` / `transaction-form.tsx` / `budget-form.tsx` / `categories.tsx` | Feature CRUD screens |
| `components/` | Reusable UI (Button, Input, Card, Fab, EmptyState, Snackbar, ThemeProvider, TransactionCard, Chip, DateField, GradientCard) |
| `constants/theme.ts` | Theme tokens + `useThemeColors` / `useThemeGradients` |
| `lib/errors.ts` | `getConvexErrorMessage` — user-friendly error extraction |
| `convex/schema.ts` | Database schema (source of truth) |
| `convex/helpers.ts` | Shared auth/membership helper (`getUserAndMembership`) used by mutation handlers |
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

All operations within one mutation — atomic.

### 5.4 Error Handling Convention

- Every backend handler requires `ctx.auth.getUserIdentity()` and throws
  `ConvexError` with a plain, user-friendly string.
- Client must never display `error.message` (technical). Use
  `getConvexErrorMessage(e, fallback)` in every `catch`.
- Server-side `Server Error` console output for thrown errors is expected.

### 5.5 Invitation Security Model

- 8-char random codes (~41 bits entropy), server-secret HMAC-SHA-256 digests
  only (no plaintext / unkeyed hashes persisted).
- 7-day expiry, single-use, owner-revocable, auto-revoke on new code.
- Atomic redemption; per-code rate limit (5 attempts / 60s).

### 5.6 Initial Balance Category Contract

Each household gets two reserved "Initial Balance" categories (income and
expense) at creation. `accounts.create` with a non-zero opening balance posts a
transaction against the matching one. These categories are protected:
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
**Indexes:** `by_householdId`, `by_household_date`, `by_accountId`,
`by_toAccountId`, `by_categoryId`

**Invariants:** amount sign matches type; category type matches transaction
type; transfers have no category and `toAccountId !== accountId`.

### `budgets`

```text
householdId: id<households>
categoryId: id<categories>    // must be expense type
periodStart: number           // first day of UTC month (epoch ms)
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
| `households` | `create` | mutation | Create + owner membership + reserved categories |
| `households` | `getActive` | query | Current user's household |
| `households` | `update` | mutation | Rename (owner only) |
| `households` | `listMembers` | query | Member list (owner + members) |
| `households` | `removeMember` | mutation | Owner only; cannot remove owner |
| `invitations` | `create` | mutation | Generate code (owner), auto-revokes previous |
| `invitations` | `revoke` | mutation | Owner only |
| `invitations` | `redeem` | mutation | Atomic join; rate limited |
| `invitations` | `listActive` | query | Active invites for household |
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
| `transactions` | `list` | query | Date-range filtered |
| `transactions` | `recent` | query | Latest N with cursor pagination |
| `transactions` | `get` | query | Single transaction (hidden-category aware) |
| `budgets` | `list` | query | `{periodStart, periodEnd}`; spent + progress |
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
| Clipboard / Share / Haptics | `expo-clipboard`, native share sheet, `expo-haptics` |
| Icons | `@expo/vector-icons` Feather |

### Styling Rules

- Use NativeWind `className` (not `StyleSheet.create`).
- Theme via `useThemeColors()` / `useThemeGradients()` hooks + `dark:` variants.
- Gradient cards: `expo-linear-gradient` + `Gradients.card`; shadows
  `Shadow.card` / `Shadow.elevated`; icons Feather.
- Money inputs: shared `Input` component with `amount` prop (thousand-separator
  formatting).
- **NativeWind v4 gotcha:** never use `style={({ pressed }) => [...]}` on
  `Pressable` — it breaks `className`. Use `useState` + static style.

---

## 8. Change Log

Entries are chronological, newest first. Major changes update the relevant
sections above; fixes are logged here only.

| Date | Type | Description |
|------|------|-------------|
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
