# Kin Finance — Product Specification

> Status: Living document
> Last updated: 2026-09-10
> Architecture: `docs/ARCHITECTURE.md` | Design: `docs/DESIGN.md` | Source of truth: `convex/schema.ts`

---

## How to Maintain This Document

**This document defines the product** — what Kin Finance does and why. Technical implementation is in `docs/ARCHITECTURE.md`. Design tokens are in `docs/DESIGN.md`.

**Update workflow:**

1. **Database change** → update `convex/schema.ts` first (source of truth).
2. **Product behavior change** → update affected PRD section.
3. **Tech/architecture change** → update `docs/ARCHITECTURE.md`.
4. **Design token change** → update `docs/DESIGN.md` + `constants/theme.ts`.
5. **Feature implementation** → create `docs/superpowers/specs/YYYY-MM-DD-<feature>-design.md`.

---

## 1. Overview

### Product Purpose

Kin Finance is a shared household finance tracker for Android. It lets a family record income and expenses, organize them by Accounts and Categories, and plan monthly Budgets — with clear owner/member permission boundaries so everyone contributes but the Owner keeps control. Success means the family can see, together, what is coming in and going out.

### Users

Family members managing money together inside one shared Household, using Kin Finance on Android phones. The Owner (the user who creates the Household) controls Accounts, Categories, and member access; Members collaborate on Transactions and Budgets within visibility rules.

### Positioning

One shared Household is the root of all financial data, with role-based visibility as the organizing idea: an Owner runs Accounts, Categories, and membership, while Members participate in day-to-day Transactions and Budgets. The distinguishing behavior is that hiding an Account or Category from Members still surfaces the financial picture (e.g. Budgets for hidden Categories stay visible) without exposing transaction detail.

### Platform & Environment

- Android-first native app (Expo SDK 54, React Native 0.81, Expo Router 6), portrait phones.
- Auth via Clerk (email/password, email-code verification, MFA email code, Google SSO); real-time data via Convex.
- English UI copy (screens, errors, empty states).
- A user can belong to many Households (Personal / Family / Business, ledgers fully separate); exactly one is active at a time (server-side `users.activeHouseholdId`, follows across devices; read-time fallback to oldest when unset).

### Brand

- Product name: **Kin Finance**.
- English UI copy.
- Warm, family-focused design language: stone/amber palette, gradient cards, Feather (UI) + Streamline Ultimate Color via Iconify (CC BY 4.0, category vectors via `CategoryIcon`), 48px controls. See `docs/DESIGN.md`.

### Constraints

- Roles are per-household (Owner in one, Member in another allowed, no limit for MVP); switching via Home header (tap name, visible when >1 household) and Settings → Households; create/join of household N shows a Stay/Switch dialog (no silent auto-switch).
- Transaction dates cannot be in the future (enforced greyed & disabled in MonthPicker, DateField, Search Date; future periods not selectable); amounts are signed (+income / −expense / +transfer magnitude).
- **No currency symbol by design:** amounts render as bare whole numbers with thousand separators only. Kin Finance is currency-agnostic — household amounts are not tied to one currency, so no symbol or locale-currency formatting is applied anywhere in the UI.
- Data can only be accessed by Household members.
- Category icons: Streamline Ultimate Color 998 via Iconify — CC BY 4.0 requires attribution to Streamline; credit retained in PRD + About/Settings.

---

## 2. Requirements

### 2.1 Functional Requirements (by feature)

| Feature | Requirements |
|---------|--------------|
| Authentication | Sign in, sign up (with confirm password), email verification, MFA email code, Google SSO, forgot-password reset (Clerk). Last-used method remembered per device (SecureStore) and leads the login CTA order. Password fields have visibility toggle (eye/eye-off, 48px); verification/MFA/reset codes use `oneTimeCode`/`sms-otp` autofill. |
| Household | Create (first user becomes Owner), get active household, rename (Owner only), list members, remove member (Owner only; owner cannot be removed), delete/leave/transfer. Owner hard-deletes cascade (all data); Member removes own membership only (transactions/budgets remain); Owner swaps `owner↔member` roles. Settings shows a SINGLE Households list (tap row → `/members?householdId=` detail; inline Set-active button). Danger Zone (delete/leave) in household detail screen. Preference `periodType` (`monthly` default, extensible `weekly`/`yearly` — coming soon) and `balanceMode` (`fresh` default vs `carryOver`) — Owner-only mutations. |
| Period Balances | Materialized snapshot per `periodType` (`monthly`/`weekly`/`yearly`) — `fresh`: `opening 0`, `closing = net` per period; `carryOver`: `opening = prev closing`, `closing = opening + net` (cascade from `household.createdAt` to now, O(1) read). |
| Invitations | Owner generates invite code (8 alphanumeric chars, HMAC-SHA-256 hash stored, 7-day expiry, single-use). Owner can revoke. Generating a new code atomically auto-revokes all previous active codes. Member joins by redeeming a code. Rate limited: max 5 attempts/code/min. Multi-household: redeem allowed while a member elsewhere — rejected only when already a member of THAT household; sets active only for a first-ever membership. |
| Accounts | Create (optional opening balance → auto "Initial Balance" transaction atomically), edit (name/type/subType/hidden), delete (guarded if referenced by transactions), list (visibility-filtered, grouped into ASSET/DEBT sections with subtotals). Owner-only management. Verify/reconcile: Owner can verify stored vs expected balances and recalculate when drift is detected. Type is `asset` or `debt` with a required validated `subType`. Icon fixed per sub-type via Streamline Ultimate Color (CC BY 4.0). |
| Categories | Create, edit (name/type/icon/hidden; type change guarded), delete (guarded if referenced), list (visibility-filtered). Icon chosen from 56 allowlist rendered via Streamline Ultimate Color 998 icons via Iconify — CC BY 4.0 Streamline. Two reserved "Initial Balance" categories per household are protected. Owner-only management. |
| Transactions | Create/edit/delete income, expense, transfer. Account balance(s) auto-update (reverse old, apply new). Transfers move between two accounts, no category. Members respect hidden account/category rules. `list` returns at most 1 000 rows per page; cursor-paginated. Home ledger is period-bound 30/page with Search+Filter. Search global cross-period with Date first chip, default last 14 days. `summary` query computes range income/expense/net server-side (transfers excluded; Members' hidden-category rows excluded). Supports server-side filtering by transaction type, account, and category. Supports server-side substring search by note, amount string, account name and category name (≥2 chars) — committed only after user taps Search button or submits via keyboard (no auto debounce). Amount input is whole-number only. |
| Search | Global cross-period search with Date first chip, default last 14 days (inclusive `today - 13d`), 30/page FlatList cross-period, Future dates greyed & disabled. FilterSheet for bill type/category/account; summary Records N with income/expense totals. |
| Budgets | Create/edit/delete monthly budgets per expense category. List for a month with spent/progress. Members can fully manage. Budgets for hidden categories stay visible to Members. |
| Home | Dashboard (swipeable period — PagerView 12 periods, MonthPicker Jan-Dec future disabled): household card, Period Balance (Income/Expense/Balance per period via periodBalances), Budgets (3 pills per selectedPeriodStart), Full SectionList 30/page daily groups + Today card + My Accounts + Search+Filter period-bound. TransactionCard rows show Category • Account (transfer: Account → ToAccount) with no time. |
| Analytics | Spending by Category (selected period) + Delta closing vs prev closing on Home below Budgets. PeriodBalances snapshot O(1) read. |
| Appearance | Theme preference System / Light / Dark, persisted per device (SecureStore). |

### 2.2 Validation Rules

| Field | Rule |
|-------|------|
| Household name | Required; 3–50 chars after trim |
| Account name | Required; 2–30 chars; unique within household |
| Account type | `asset` \| `debt` (labels Asset/Debt) |
| Account sub-type | Required; must belong to the parent type (`asset` → `cash`/`bank`/`ewallet`/`other`, `debt` → `credit_card`/`other`); server throws `Sub-type is not valid for this account type.` on mismatch; editable after create |
| Opening balance | Optional whole number (sign determines income/expense type) |
| Category name | Required; 2–30 chars; unique within household **and type**; `"Initial Balance"` reserved |
| Category type | `income` \| `expense` |
| Category icon | Optional; must be one of 56 allowlist names; defaults to `other`; rendered via Streamline Ultimate Color (Iconify CC BY 4.0) |
| Transaction amount | Whole number; non-zero; positive for income, negative for expense, positive magnitude for transfer; \|amount\| ≥ 1; decimals blocked at keyboard |
| Transaction account | Required; visible for Member on create; reassignment requires visible account |
| Transfer accounts | Both required, must differ, same household |
| Transaction category | Required for income/expense; must match transaction type; visible for Member |
| Transaction date | Required; cannot be in the future |
| Note | Optional; ≤ 200 chars |
| Budget amount | Positive whole number ≥ 1 |
| Budget category | Required; must be **expense** type; unique per (household, category, month) |
| Invite code | 8 alphanumeric chars; case-normalized before hashing |
| Household periodType | `monthly` \| `weekly` \| `yearly`; optional (default `monthly`); `weekly`/`yearly` coming soon |
| Household balanceMode | `fresh` \| `carryOver`; optional (default `fresh`) |

### 2.3 Permission Matrix

Roles are per-household — a user can be Owner of one household and Member of another.

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
| Update Balance Mode | ✅ | ❌ |
| Update Period Type | ✅ | ❌ |
| Delete Household | ✅ | ❌ |
| Leave Household | ❌ | ✅ |
| Transfer Ownership | ✅ | ❌ |

### 2.4 Visibility Rules

- **Hidden Account:** balance not visible to Members. Members cannot create a transaction on it or reassign an existing transaction to it; they may edit an existing transaction whose hidden account reference is unchanged.
- **Hidden Category:** transactions on that category are fully invisible and untouchable by Members (no view/create/edit/delete). Transfers have no category and are unaffected.
- **Hidden Category Budgets (exception):** budget category name and amount are visible to Members; spending breakdown is not shown (server-side: `spent`/`progress` are redacted for Members).

---

## 3. Core Features

### 3.1 Authentication (Clerk)

Clerk handles sign-in/up, email verification, MFA email code, Google SSO, and forgot-password resets.

**Login screen:**
- Sign-in / Sign-up toggle with confirm-password on sign-up (a mismatch blocks submission; toggling clears both password fields).
- Google SSO with a brand glyph, promoted above the email form behind an "or sign in with email" divider.
- Forgot password — three-step reset: email → emailed 6-digit code (with resend) → new password.
- Email verification / MFA — emailed 6-digit codes; verify submits once a full code is entered.
- Last-used method — the successful method (Google vs email) is persisted in `expo-secure-store` and drives the login CTA order.
- Password visibility: eye icon toggles secureTextEntry; accessible label.
- OTP autofill: code inputs use textContentType='oneTimeCode' + autoComplete='sms-otp'.

### 3.2 Household

Root entity for all financial data. Created once during onboarding; the creating user becomes Owner. Owner can rename; both roles see the member list.

**Timezone:** each household stores an IANA timezone name. The default is "match device": when no timezone is recorded the device's IANA timezone is used at runtime; a concrete value is captured from the creating device on household creation. The Owner can change it from the Household screen. All calendar-month boundaries — budgets' `periodStart`/`periodEnd`, transactions "This Month" / "Last Month" filters, and date-group headers — are computed in the household timezone so every member classifies data into the same calendar month regardless of device timezone.

**Period handling:** each household stores `periodType` (`monthly` default, `weekly`/`yearly` extensible) and `balanceMode` (`fresh` default vs `carryOver`). `fresh`: each period's `openingBalance 0`, `closingBalance = net (income-expense)` isolated; `carryOver`: `openingBalance = prev closing`, `closingBalance = opening + net` cumulative. Both are Owner-only. Period boundaries use `getPeriodBounds(ts,tz,type)`.

**Delete / Leave / Transfer:** Owner hard-deletes cascade (transactions → budgets → periodBalances → accounts → categories → invitations → householdMemberships → households). Member removes own membership only (transactions/budgets remain). Owner swaps `owner↔member` roles. UI Danger Zone in household detail screen.

**Multi-household:** User can belong to many Households; exactly one is active at a time (server-side `users.activeHouseholdId`). `households.listMine` returns all memberships oldest-first with `{household, role, isActive}`. `households.switchActive({householdId})` requires membership. `households.create` sets active only for the first-ever household. `leaveHousehold`/`deleteHousehold` reassign active to the oldest remaining household only when the left/deleted one was active.

### 3.3 Multi-Member & Invites

- Owner generates an invite code from the Members screen. Codes are cryptographically random, 8 alphanumeric chars; only an HMAC-SHA-256 digest keyed by the server secret is stored (plaintext never persisted).
- Codes expire after 7 days, are single-use, can be revoked, and generating a new code atomically invalidates all previous active ones within the same mutation.
- Member joins via Onboarding → "Join with Invite Code".
- Owner can remove Members; removed members lose access immediately but their transactions/budgets remain.

### 3.4 Accounts

Accounts are where money lives, classified as `asset` (label Asset) or `debt` (label Debt). Each has an auto-maintained balance plus a required `subType` that controls the icon: asset → `cash`/`bank`/`ewallet`/`other`, debt → `credit_card`/`other`. Owner creates accounts with an optional opening balance — the sign of the balance posts an initial transaction against a reserved "Initial Balance" category so the balance is applied exactly once through the standard path atomically in one mutation. Opening balances are whole numbers. Owner edits name/type/subType and toggles visibility. Owner deletes accounts only when no transactions reference them. The Accounts tab groups rows into ASSET and DEBT sections, each with a subtotal.

**Balance Reconciliation:** Owner can verify stored vs expected balances and recalculate all balances from transaction history when drift is detected.

### 3.5 Categories

Labels for classifying transactions, typed `income` or `expense`. Owner manages them. Each category stores an optional `icon` key (56 allowlist names, default `other`). Rendering via Streamline Ultimate Color 998 via Iconify (CC BY 4.0). The picker shows a 4-column grid of 56 vectors. Two reserved system-managed categories per household — "Initial Balance" (income) and "Initial Balance" (expense) — are created with the household and are protected from rename/hide/retype/delete. Type changes and deletes are guarded when budgets/transactions reference the category.

### 3.6 Transactions

Core records of financial activity: income, expense, or transfer.

- **Income/Expense:** linked to one Account and one Category; amount signed (+income, −expense), a whole number; category type must match transaction type.
- **Transfer:** links two Accounts (from → to), no category; amount is a positive magnitude.
- **Balance auto-update:** create applies; update reverses old + applies new (handles account changes); delete reverses.
- Members cannot create on hidden accounts/categories or reassign to them, but can edit existing transactions referencing hidden accounts.
- **Sheet UX:** header X + tabs Expenses/Income/Transfer, grid kategori scroll 4 kolom filtered by type, Transfer dual card + swap, pill akun tappable default lastTransaction, amount bare whole number, keypad custom 4×4, date pill opens calendar modal, Note 200 + auto-suggest, duplicate 24h Alert, discard guard.
- **Day-grouped net totals:** the Transactions list shows a net total per day header (income − expense; transfers excluded), colored by sign.

**Filtering:** server-side by **type** (income/expense/transfer), **accounts**, and **categories**, with the date range consolidated behind a single Date chip. Account and Category are multi-select. Interactions inside the filter sheet edit a local draft; filters apply only when the user taps Done.

**Pagination & server-side summary:** `transactions.list` accepts an optional `cursor` and returns `cursor`/`hasMore`. The Transactions page accumulates 30-row pages on scroll; the summary card uses `transactions.summary`, which walks the entire range uncapped.

**Search:** Text input + Search button; committed search (≥2 chars) is sent to `list`/`summary` only after user taps Search or submits via keyboard (no auto debounce). Matches note substring, absolute amount string, account.name, toAccount.name, category.name.

### 3.7 Budgets

Monthly spending limits per expense category. Identified by `(householdId, categoryId, periodStart)` — one budget per category per month. `periodStart` is the first day of the calendar month in the household timezone. Budget amounts are whole numbers. Spending = sum of expense transactions in that category during the month; progress = spent / amount. Both Owner and Member can manage budgets. Budgets for hidden categories remain visible (name + amount, no breakdown). For Members, the spending breakdown of budgets on hidden categories is not shown.

### 3.8 Home Dashboard

**MonthPicker Accessibility Note:** The Week and Year tabs in the MonthPicker are currently inactive ("Coming soon"). The Year navigation chevrons are also disabled when `year >= curYear`. Accessibility features for these controls are pending activation. See `components/MonthPicker.tsx`.

- Greeting uses the user's first name.
- Household card (name + " Household", no member count).
- **Period navigation:** swipeable 12 past+now, MonthPicker Jan-Dec future disabled.
- **Period Balance:** Income/Expense/Balance per period via periodBalances.
- **Budgets:** up to 3 budget pills per selectedPeriodStart.
- **Search+Filter period-bound:** rounded search bar + Search pill + Filter pill.
- **Full SectionList 30/page daily groups:** period-bound, grouped by day with day net total, Today card, My Accounts horizontal cards.
- Empty states include action CTAs.
- FAB uses reanimated spring animation.
- Sign-out is accessible only via the Settings tab.

### 3.9 Reports

Swipable 12 past+now with MonthPicker Jan-Dec future disabled.
- **Category Ranking Card:** type "expenses"|"income" toggle, segments + total + othersAmount via spendingByCategory or transactions.list aggregation, donut, list rows 1..N, 5 top + show-more.
- **Bill Ranking Card:** Bill Amount Ranking TOP 10 sorted descending.
- **Delta Card:** currentClosing vs prevClosing.

### 3.10 Search — Global Cross-Period

Global search outside tabs.
- **Default 14d window:** today = new Date(), defaultStart = today - 14 days.
- **Top bar:** back + rounded search input — committed search ≥2 chars sent to list/summary.
- **Chips row:** Date first + Bill type + Category + Account; FilterSheet handles bill type/category/account.
- **FlatList 30/page cross-period.**

### 3.11 Period Balances

Materialized per-period snapshot powering Home/Analytics O(1) reads.

- **Table `periodBalances`:** householdId, periodType, periodStart/periodEnd (epoch ms, tz-aware), income/expense (aggregated per period, transfers excluded), openingBalance/closingBalance (derived, see balanceMode).
- **Balance modes:** `fresh` (default): opening 0, closing = income-expense isolated; `carryOver`: opening = prev closing, closing = opening + net cumulative cascade.
- **Recompute cascade:** single `by_household_date` scan, group+upsert per period. Hidden account and hidden category excluded for Members.

---

## 4. User Flow

### 4.1 First Login (Onboarding)

```text
App Open → Native splash → BrandedLoadingShell (optimistic progress)
  → Clerk Auth Gate (isLoaded) → signed in → check households.getActive (Convex)
  → null → Onboarding Screen
      → Create Household  (households.create → owner + reserved categories)
      → or Join with Invite Code (invitations.redeem → member)
  → success → Home (dashboard) — SplashScreen.hideAsync() only after Onboarding/Home ready.
```

### 4.2 Returning User

```text
App Open → Native splash → BrandedLoadingShell (0→70 fast, 70→90 while Clerk + households.getActive resolve, pause at 90 with offline banner if isConnected===false)
  → Clerk Auth Gate → signed in → households.getActive found → progress 90→100 + hide splash -> Home
  (Signed-out branch: isLoaded && !isSignedIn → progress 90→100 -> Login with seamless fade).
```

### 4.3 Owner Creates Account (with opening balance)

```text
Accounts tab → "+" → fill name/type/opening balance
  → accounts.create({ name, type, openingBalance, hidden })
  → validate account name uniqueness + openingBalance isSafeInteger
  → if openingBalance != 0, lookup reserved "Initial Balance" category by sign (income/expense)
  → account inserted with balance = openingBalance
  → if openingBalance != 0, insert "Initial balance" transaction atomically in the SAME mutation
  → account appears with opening balance reflected
```

### 4.4 Create Transaction

```text
Home → "+" → sheet (Expenses/Income/Transfer tabs)
  → pick category from scroll grid (or transfer: Payment/Receive cards + swap)
  → amount via custom keypad (+ - × ÷ live eval)
  → account pill, date pill, note with auto-suggest
  → Save → transactions.create → balances auto-updated → back
```

### 4.5 Owner Invites Member

```text
Settings → Households list → tap row → household detail (`/members?householdId=`) → "Generate Invite" FAB
  → server: generate code, HMAC hash, store digest + 7-day expiry + single-use
  → atomically auto-revoke ALL previous active invites within same mutation
  → insert new invitation
  → show code once → copy/share — listActive now returns at most 1 row
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
  → Filter chip → sheet edits a local draft (Type chips All/Income/Expense/Transfer,
    Account/Category multi-select comboboxes, Reset clears the draft)
  → Done → filters apply → list, summary card, and per-day net totals reflect the active filters
```

---

## Appendix A — Future / Out of Scope

Not implemented; kept for roadmap reference.

- Multiple Households per user implemented as of 2026-09-10 (server-side active, Home + Settings switcher, Stay/Switch dialog); household archiving still future.
- Email-based invitations.
- Account/category colors; multi-currency; archiving/merging.
- Split transactions; recurring transactions; attachments/receipts; CSV/PDF export.
- Budget rollover; weekly/yearly budgets; notifications; templates.
- Selection haptics — intentionally deferred.
- Reports/analytics beyond current Budget progress; full-text search beyond note substring (≥2 chars).
