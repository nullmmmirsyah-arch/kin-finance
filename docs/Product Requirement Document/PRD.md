# Kin Finance — Product Specification

> Status: Living document
> Last updated: 2026-08-30 (P0-1 fixes: cashflow timezone + Delta contrast + Donut svg)
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
- **No currency symbol by design:** amounts render as bare whole numbers with
  thousand separators only. Kin Finance is currency-agnostic — household
  amounts are not tied to one currency, so no symbol or locale-currency
  formatting is applied anywhere in the UI.
- Data can only be accessed by Household members.

---

## 2. Requirements

### 2.1 Functional Requirements (by feature)

| Feature | Requirements |
|---------|--------------|
| Authentication | Sign in, sign up (with confirm password), email verification, MFA email code, Google SSO, forgot-password reset (Clerk). Last-used method remembered per device (SecureStore) and leads the login CTA order. Auth gate in `app/_layout.tsx`. Password fields have visibility toggle (eye/eye-off, 48px); verification/MFA/reset codes use `oneTimeCode`/`sms-otp` autofill. |
| Household | Create (first user becomes Owner), get active household, rename (Owner only), list members, remove member (Owner only; owner cannot be removed). |
| Invitations | Owner generates invite code (8 alphanumeric chars, HMAC-SHA-256 hash stored, 7-day expiry, single-use). Owner can revoke. Generating a new code auto-revokes previous active codes. Member joins by redeeming a code. Rate limited: max 5 attempts/code/min. |
| Accounts | Create (optional opening balance → auto "Initial Balance" transaction), edit (name/type/hidden), delete (guarded if referenced by transactions), list (visibility-filtered). Owner-only management. |
| Categories | Create, edit (name/type/hidden; type change guarded), delete (guarded if referenced), list (visibility-filtered). Two reserved "Initial Balance" categories per household are protected. Owner-only management. |
| Transactions | Create/edit/delete income, expense, transfer. Account balance(s) auto-update (reverse old, apply new). Transfers move between two accounts, no category. Members respect hidden account/category rules. `list` returns at most 1 000 rows per page (server cap, optional `limit`). `list` is cursor-paginated (`cursor`/`hasMore`); the Transactions page loads 30 rows per page. A `summary` query computes range income/expense/net server-side (transfers excluded; Members' hidden-category rows excluded). Supports server-side filtering by transaction type, account, and category; a consolidated date filter (This Month / Last Month / Custom Range) sits behind one header chip. Supports server-side substring search by note (≥2 chars) on `list` and `summary` (debounced 300ms, bounded scan); pull-to-refresh (RefreshControl) and stale-data banner (ConnectivityBanner + Retry) on Home/Transactions/Accounts/Budgets — refresh/retry re-queries via Convex reactive subscription (visual spinner + stale clear, no manual cache invalidation needed). Amount input is whole-number only (`number-pad` + `formatAmountInput` strips decimals/non-digits, thousand-separator display); duplicate detection warns if same amount+account+category/type exists within 24h (confirmation Alert); "Repeat last" persists the last created transaction via SecureStore (`lib/last-transaction.ts`) and survives unmount/restart with contextual copy. |
| Budgets | Create/edit/delete monthly budgets per expense category. List for a month with spent/progress. Members can fully manage. Budgets for hidden categories stay visible to Members. |
| Home | Dashboard: household card, Total Balance, Budgets (3 pills), **Analytics (below Budgets): Net delta vs last month (GradientCard badge), Cashflow 6-month bar chart (income Success / expense Error), Spending by Category donut this month (legend + center total)** — all household-timezone-aware, Member hidden-category excluded (single-scan `transactions.cashflow` + `transactions.spendingByCategory`), pure-View + reanimated with Pressable tooltip; My Accounts, Recent Transactions (paginated, grouped by day, "See All"). PTR & stale banner still applies. |
| Analytics | Cashflow 6 months + Spending by Category (this month) + Delta vs last month on Home below Budgets. Two efficient single-scan queries (`cashflow`, `spendingByCategory`) — 1 `by_household_date` scan per query, hidden-category cache, window validation (cashflow ≤200d, spending ≤32d). |
| Appearance | Theme preference System / Light / Dark, persisted per device (SecureStore). |

### 2.2 Validation Rules

| Field | Rule |
|-------|------|
| Household name | Required; 3–50 chars after trim |
| Account name | Required; 2–30 chars; unique within household |
| Account type | `cash` \| `bank` \| `ewallet` \| `credit_card` |
| Opening balance | Optional whole number (sign determines income/expense type); `number-pad` + `formatAmountInput` (integer-only, same as transaction amount) |
| Category name | Required; 2–30 chars; unique within household **and type**; `"Initial Balance"` reserved |
| Category type | `income` \| `expense` |
| Transaction amount | Whole number; non-zero; positive for income, negative for expense, positive magnitude for transfer; \|amount\| ≥ 1; client enforces via `number-pad` + `formatAmountInput` (strips decimals/non-digits, thousand separators) so decimals never reach validation |
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
- **Password visibility:** eye icon toggles secureTextEntry; accessible label.
- **OTP autofill:** code inputs use textContentType='oneTimeCode' + autoComplete='sms-otp' + keyboardType='numeric' + maxLength 6 + autoFocus.
- **Modular structure:** app/index.tsx orchestrator (~150 lines) + hooks/useAuthFlow, hooks/useResetFlow, components/Auth/* (EmailField, PasswordField, CodeField, GoogleButton, ResetFlow).
- **Launch continuity (as of 2026-08-29):** login branding uses `splash-icon.png` at 200×200 (`resizeMode="contain"`), same size and center position as the native splash (`expo-splash-screen` `imageWidth: 200`) and the same background (`#FFFBF5` light / `#1C1917` dark) as `components/BrandedLoadingShell`, so the native splash fades seamlessly into the login screen without a size jump or color flash.

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
  integer-only thousand-separator formatting (`number-pad` + `formatAmountInput` strips decimals/non-digits), contextual sign-convention hint, "Repeat last"
  shortcut (persisted via SecureStore `lib/last-transaction.ts`, survives unmount/restart; contextual copy shows `type + amount`; tap reuses type/amount/account/category), duplicate detection (same amount+account+category/type within 24h triggers confirmation Alert with `hapticWarning`), date hint, note character counter, discard guard on both header
  back button and Android hardware back button. See §4.4 for details.
- **Day-grouped net totals:** the Transactions list shows a net total per day
  header (income − expense; transfers excluded because they move money between
  owned accounts and do not change household net worth), colored by sign.
- The `list` query hydrates entities with a per-query cache and caps results at
  1 000 rows.

**Filtering (as of 2026-08-20):** the Transactions page filters the visible list
server-side by **type** (income/expense/transfer), **accounts**, and **categories**,
with the date range (This Month / Last Month / Custom Range) consolidated behind a
single Date chip. The summary card and per-day net totals derive from the filtered
query result, so they always match the visible rows. Account and Category are
multi-select: each is a compact combobox with a tri-state header (empty / partial /
all), a "select all / unselect all" action, and checkbox rows; the `list` query takes
`accountIds` and `categoryIds` arrays, where an empty or full selection is treated as
no filter. Category options are contextual to the selected type (income → income
categories, expense → expense categories); selecting type `transfer` clears active
category filters, since transfers have no category. A filter dimension with a single
selected value is pinned to its compound index
(`by_household_account_date`, `by_household_category_date`, `by_household_type_date`),
narrowing the scanned range; when no dimension is pinned (all are empty or multi-valued),
the remaining filters are applied post-index — combined with AND across the account, category,
and type dimensions, while each selected ID array uses OR semantics — and may walk the full
date window until the requested limit is collected, especially when matches are sparse. For
Members, the existing bounded scan (limit × 10)
still applies — hidden-category rows cannot be indexed away — so heavy filtering over
long ranges may return fewer rows than the limit. Interactions inside the filter sheet
(type chips, account/category checkboxes, select-all, Reset) edit a local draft and do not
change the visible list; the filters apply only when the user taps **Done**, and closing the
sheet without Done (backdrop tap or Android back) discards the draft. The empty state
distinguishes "no transactions at all" from "no transactions match your filters" (with a
Clear filters action).

**Pagination & server-side summary (as of 2026-08-26):** `transactions.list` accepts an optional `cursor {date, id}` and returns `cursor`/`hasMore`; owner and member share one bounded-scan engine (SCAN_BUDGET = limit × 10) with the same pinned-index priority as before. The Transactions page accumulates 30-row pages on scroll; the summary card uses `transactions.summary`, which walks the entire range uncapped (hydration-free; members skip hidden categories via a cached lookup). Day-group net totals render only for completed days — an older group has loaded, or `hasMore` is false.

**Search (as of 2026-08-27):** Text input above filter chips with 300ms debounce; committed search (≥2 chars, trimmed, case-insensitive) is sent as `search` to `list`/`summary`; matched via `note.toLowerCase().includes(search)` post-index, bounded by existing SCAN_BUDGET (no new index); `summary` checks `row.note` hydration-free; transactions on hidden categories are excluded for Members; empty shows “No results for …” with Clear action. Search <2 chars is treated as no filter.

**Recent unified engine (as of 2026-08-27):** `transactions.recent` uses a unified bounded scan (SCAN_BUDGET = limit × 10, `by_household_date` desc) for both roles with tie-aware cursor (extra-row detection) and truthful `hasMore`; Home caps at 5.

**PTR & stale real (as of 2026-08-28):** 4 tabs use hooks/useConnectivity (NetInfo) — banner appears instantly when isConnected===false, fallback undefined >3s otherwise; RefreshControl and banner Retry show a 600ms spinner, clear stale state, and trigger haptic, relying on Convex reactive subscription for fresh data (no manual cache invalidation). Requires native rebuild for NetInfo.

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
  a secondary line showing this month's net income/expense (from `transactions.summary`, server-computed) in semantic color
  (green for positive, red for negative).
- **Budgets** (when budgets exist): up to 3 budget pills showing category name,
  spent/budgeted amounts, and a color-threshold progress bar (green → amber →
  red). "See All" links to the Budgets tab. When no budgets exist, the empty
  state's "Create Budget" action is available to Owners and Members alike.
- **Analytics (below Budgets, as of 2026-08-30 — fixes 2026-08-30):**
  - **Delta Card** (`components/charts/DeltaCard.tsx`): `GradientCard` showing `currentNet` (this month) vs `prevNet` (last month) — looked up by `periodStart === monthStart/prevMonthStart` (not `cashflow[4]/[5]` index, fixes July "New this month" when July had data but UTC vs Jakarta bucket mismatch gave `prevNet=0`) via `calcDelta` (`utils/analytics.ts`); `prevNet===0` → "New this month" / "No change"; badge now `useColorScheme`-aware: light `bg #DCFCE7` (pos, border `#86EFAC`) / `#FEE2E2` (neg, border `#FCA5A5`) / `#FFFBF5` + `C.border` (neutral, `minus`), dark `bg ${success/error}26` border `40` (~15% alpha on dark surface), text `C.success/C.error/C.textSecondary`, reanimated `withSpring` scale. `transactions.cashflow` now takes optional `timezone` (client passes `resolveTimezone(household.timezone)`) so server buckets in same TZ, fixing legacy `household.timezone=null` where server used UTC and client used device `Asia/Jakarta` → 7 buckets `Feb..Aug` vs 6 `Mar..Aug`.
  - **Cashflow 6-Month Bar Chart** (`components/charts/CashflowBarChart.tsx`): 6 month groups (household timezone, `buildSixMonthWindow`, end `cur.end`), paired bars (Income `success` / Expense `error`, max 100px, scale = `maxBarValue`), extracted `AnimatedBar` (avoids hook-in-loop) with reanimated `withDelay(i*60,withTiming(400))`, `Pressable` tooltip per month (`Income +X, Expense -Y, Net Z` + `hapticSuccess`, `Shadow.elevated`, no `style` callback); empty → "No transactions in last 6 months".
  - **Spending by Category Donut** (`components/charts/SpendingDonut.tsx` + `react-native-svg 15.12.1`): This month expense only, top 5 + aggregated "Others" (`overflowAmount`), palette `C.accountCash/Bank/Ewallet/CreditCard/primary` + 2 accents, **colored donut via `react-native-svg` `Circle` `strokeDasharray` (r=15.915, circumference 100, `dash=pct*100`, `offset=25-cumulative*100`)** over track `C.border` (r 15.915, w 7), inner cutout 80px `C.background` showing `formatNumber(total)`; legend `FadeIn.delay(i*40)` + `Pressable` selectable row (`% • amount` when selected, `hapticSuccess`, `isDimmed` `opacity 0.35` on non-selected arcs, `strokeWidth 8.5` when selected); `Others` row shows `+N more` → `%` when selected; empty → card "No spending this month". Requires `npx expo install react-native-svg` (included in Expo Go 54, still OTA-eligible).
  - All cards use `Shadow.card`, `Radius.md`, `useThemeColors()` (dark variants), `Feather` icons, no new native deps. Loading: `Skeleton` 80/180/140. Hidden category excluded for Members (cached `hiddenCategoryCache`). Offline: shows cached Convex data + `ConnectivityBanner`.
- **My Accounts**: horizontal account cards with type-specific tinted icon
  backgrounds (green for cash, amber for bank, blue for e-wallet, red for credit
  card); "Add Account" card for Owner; "Manage" link to the Accounts tab. For
  Members, tapping a card goes to the Accounts tab (owner-only edit/delete stays
  in the Accounts tab).
- **Recent Transactions**: latest 5 (unified bounded scan, cursor-aware; cap unchanged), grouped by day with
  day net total (income − expense; transfers excluded), "See All" link to the
  Transactions tab. Transaction icons map category names to relevant Feather
  icons (shopping-cart, coffee, car, home, briefcase, etc.) with semantic colors
  (green for income, red for expense).
- **PTR & stale real (as of 2026-08-28):** 4 tabs use hooks/useConnectivity (NetInfo) — banner appears instantly when isConnected===false, fallback undefined >3s otherwise; RefreshControl and banner Retry show a 600ms spinner, clear stale state, and trigger haptic, relying on Convex reactive subscription for fresh data (no manual cache invalidation). Requires native rebuild for NetInfo.
- Empty states include action CTAs (e.g., "Add Transaction" on empty transaction
  list, "Add Account" for Owners vs. Owner-hint for Members on empty accounts).
- FAB uses reanimated spring animation (scale on press) for tactile feedback.
- Haptics: `hapticSuccess` on create/update, `hapticWarning` on validation, `hapticError` on failure (via `lib/haptics.ts`).
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
App Open → Native splash (splash-icon 200px, #FFFBF5 / #1C1917, fade 300ms) → BrandedLoadingShell (same bg + icon, optimistic progress 0→70 fast)
  → Clerk Auth Gate (isLoaded) → signed in → check households.getActive (Convex)
  → null → Onboarding Screen
      → Create Household  (households.create → owner + reserved categories)
      → or Join with Invite Code (invitations.redeem → member)
  → success → Home (dashboard) — SplashScreen.hideAsync() only after Onboarding/Home ready so no login flash.
```

### 4.2 Returning User

```text
App Open → Native splash → BrandedLoadingShell (0→70 fast, 70→90 while Clerk + households.getActive resolve, pause at 90 with offline banner if isConnected===false)
  → Clerk Auth Gate → signed in → households.getActive found → progress 90→100 + hide splash -> Home
  (Signed-out branch: isLoaded && !isSignedIn → progress 90→100 -> Login with same 200px icon, seamless fade; no Home flash)
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
- Amount input uses `formatAmountInput` for automatic integer-only thousand-separator
  display (`number-pad` keyboard; decimals/non-digits stripped on type so `1.500` → `1,500`, no submit error). Contextual hint below explains sign convention per type.
- "Repeat last" standalone row (below type chips, above amount) appears when
  a previous transaction exists — persisted via `lib/last-transaction.ts` (SecureStore, survives unmount and app restart; loaded on mount via `getLastTransaction`, saved via `setLastTransaction` on create) — pre-fills type, amount, account, category/toAccount; note is cleared, date reset to today. Row shows contextual copy (`Copies {type}, {amount} — tap to reuse`). Duplicate detection before create: if `transactions.recent` (20 latest) contains same `amount+type+account(+category/toAccount)` within 24h, a confirmation `Alert` ("Possible duplicate — Save anyway? / Cancel") with `hapticWarning` is shown; Cancel aborts, Save anyway proceeds.
- Date field shows "Today's date is pre-filled — you can backdate
  transactions".
- Note field has a character counter (`0/200`) with amber/red color feedback
  at 150/180 chars.
- Empty category state links to category creation with a return note.
- Discard guard: header back button and Android hardware back button both
  show an Alert when the form has unsaved changes (type change from default
  or date change from today counts as interaction for new transactions).
  The guard plumbing lives in the shared `useDiscardGuard` hook
  (`hooks/useDiscardGuard.ts`) — React Navigation's `usePreventRemove`
  (native-stack-safe prevention) + confirmation Alert + an
  intentional-navigation flag so app-initiated backs (header button,
  post-save/delete) skip the Alert — and is reused identically by the
  account, category, and budget forms, which each compute their own
  dirty flag by comparing current fields against their defaults
  (create) or seeded entity (edit).
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
  keyboard open so focus transfers. The form scrolls via `KeyboardAwareScrollView`
   so the focused input stays visible above the keyboard on both platforms.
- **Loading state:** while form data loads (the account list on create, the
  transaction on edit), the screen renders the header plus Skeleton
  placeholders mirroring the three-section layout instead of plain text.

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
  → Filter chip → sheet edits a local draft (Type chips All/Income/Expense/Transfer,
    Account/Category multi-select comboboxes, Reset clears the draft)
  → Done → filters apply → list, summary card, and per-day net totals reflect the active filters
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
| `app/_layout.tsx` | `SafeAreaProvider` + ThemeProvider, KeyboardProvider, ClerkProvider, ConvexProviderWithClerk, SnackbarProvider, `<OtaUpdater />` (background OTA `fetchUpdateAsync` only `ready` when `isNew`, `cancelled` guard) + `BrandedLoadingShell` (same bg/icon as native splash, optimistic progress, offline banner, `useSafeAreaInsets` not needed) — no `throw` on missing `EXPO_PUBLIC_*` (defensive `Configuration missing` screen, `hideAsync` after 500ms) + orchestrated auth gate (`preventAutoHideAsync`/`hideAsync` `setOptions fade 300`, `isLoaded`/`getActive` without login flash, fallback `hideAsync` after 3.5s when `isLoaded && isSignedIn && household===undefined`), `SafeAreaProvider` ensures `UpdateBanner` insets, root Stack |
| `app/index.tsx` | Signed-out entry (splash-icon 200×200 aligned with native splash + shell for seamless fade) |
| `app/(tabs)/home.tsx` | Dashboard (household, accounts, recent transactions, monthly net, budget pills + **Analytics below Budgets: DeltaCard + CashflowBarChart + SpendingDonut** via `transactions.cashflow`/`spendingByCategory` (2 queries, household TZ, hidden-aware), `buildSixMonthWindow`/`calcDelta`); `BudgetPill` is `memo`, account `FlatList` has `removeClippedSubviews/windowSize/getItemLayout` for perf |
| `components/charts/*` | `DeltaCard` (GradientCard + `useColorScheme` solid tints `#DCFCE7/#FEE2E2` light, alpha `26/40` dark, bordered), `CashflowBarChart` (`AnimatedBar` extracted, `withDelay` stagger), `SpendingDonut` (`react-native-svg` `Circle` `strokeDasharray` colored arcs, inner cutout, `FadeIn` + selectable highlight) — all `react-native-reanimated` + `Pressable` tooltip + `useThemeColors()` |
| `utils/analytics.ts` | `buildSixMonthWindow(now, timezone)` (cur 6× `getMonthBounds`, labels `formatMonthLabel`), `calcDelta(currentNet, prevNet)` (`null` when `prev 0` → "New this month"/"No change", else `+X.X% vs last month`), `maxBarValue(data)` |
| `app/(tabs)/accounts.tsx` | Accounts list (filters, FAB, owner edit/delete); `FlatList` perf props (`removeClippedSubviews/windowSize/initialNumToRender`) |
| `app/(tabs)/transactions.tsx` | Transactions list (date + type/account/category filters, summary, day-grouped with net totals); `SectionList` perf props (`removeClippedSubviews/windowSize/initialNumToRender/maxToRenderPerBatch`) |
| `app/(tabs)/budgets.tsx` | Budgets list (month selector, progress); `FlatList` perf props |
| `app/(tabs)/settings.tsx` | Settings (Household, Appearance, Categories, Sign Out) |
| `app/onboarding.tsx` | Create/Join household |
| `app/members.tsx` | Members + rename + invite code generation/revoke |
| `app/account-form.tsx` / `category-form.tsx` / `transaction-form.tsx` / `budget-form.tsx` / `categories.tsx` | Feature CRUD screens; `transaction-form` now persists `lastTransaction` via `lib/last-transaction.ts` + duplicate check against `transactions.recent`; amount inputs are integer-only |
| `lib/last-transaction.ts` | Persisted "Repeat last" store: `getLastTransaction`/`setLastTransaction` via `expo-secure-store` (`last-transaction` key), type `LastTransaction {type, amount, accountId, toAccountId?, categoryId?}` |
| `components/` | Reusable UI (Button, Input, Card, Fab, EmptyState, Snackbar with optional action, Skeleton, ThemeProvider, TransactionCard, Chip, DateField, GradientCard, SelectField with search, ConnectivityBanner, BrandedLoadingShell, UpdateBanner (`useSafeAreaInsets.top` to avoid status-bar overlap with `edgeToEdgeEnabled: true`)) + non-UI controllers (OtaUpdater — `isNew` guard, `cancelled` guard) |
| `hooks/useDiscardGuard.ts` | Shared unsaved-changes guard: dirty flag in → `handleBack` + `markIntentional` out; owns the `usePreventRemove` registration and discard Alert used by all four forms |
| `hooks/useConnectivity.ts` | NetInfo wrapper: subscribes to `@react-native-community/netinfo`, exposes `isConnected` (boolean \| null) for instant offline detection |
| `components/Auth/*` | Auth dumb components: `EmailField`, `PasswordField`, `CodeField`, `GoogleButton`, `ResetFlow` |
| `hooks/useAuthFlow.ts` / `hooks/useResetFlow.ts` | Clerk logic: sign-in/up, verification/MFA, Google SSO, password reset; orchestrated by `app/index.tsx` |
| `components/Input.tsx` | `secureToggle` prop: eye/eye-off 48px button toggles `secureTextEntry` with accessible label; OTP fields use `oneTimeCode`/`sms-otp` |
| `constants/theme.ts` | Theme tokens + `useThemeColors` / `useThemeGradients` |
| `lib/haptics.ts` | Safe haptics wrapper (`hapticSuccess`/`hapticWarning`/`hapticError` via `expo-haptics`) |
| `lib/errors.ts` | `getConvexErrorMessage` — user-friendly error extraction |
| `utils/format.ts` | `formatNumber`, `formatAmountInput` (integer-only, strips decimals/non-digits, thousand separators), `sumNetExcludingTransfers` |
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
  field with `hapticWarning`; operational errors (create/update/delete failures) surface via
  `Snackbar` with `hapticError` (never inline `setError`); destructive actions (delete, remove member, revoke invite,
  sign out) require an `Alert.alert` confirmation first. Delete transaction
  shows a Snackbar with an **Undo** action that re-creates the transaction. Duplicate-transaction warning uses `Alert` + `hapticWarning` ("Possible duplicate — Save anyway?").
- **Stale/ offline:** NetInfo `isConnected===false` → instant `ConnectivityBanner` (“You’re offline — showing cached data” + Retry); fallback `undefined` >3s otherwise. Retry and pull-to-refresh (`RefreshControl`, 600ms, `primary` tint) on Home/Transactions/Accounts/Budgets bump a `refreshKey` to re-subscribe Convex queries (real re-query + haptic). Full-screen remains for non-member `null`.
- **Offline:** NetInfo isConnected===false → instant ConnectivityBanner; fallback 3s for Convex undefined.
- **Haptics:** `hapticSuccess` on create/update, `hapticWarning` on validation + duplicate detection, `hapticError` on mutation failure (all via `lib/haptics.ts`, safely no-ops in Expo Go/web).
- Client and server share one validation module, `constants/validation.ts`
  (path alias `@/constants/validation`), eliminating drift (e.g. `isInteger`
  vs `isSafeInteger`). Amount inputs enforce whole numbers at the keyboard (`number-pad` + `formatAmountInput` stripping, `Input amount` prop) so decimals are blocked before validation.

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

### 5.7 Over-the-Air (OTA) Updates & Distribution

Updates ship via **EAS Update** (`updates.url`, `runtimeVersion` policy
`appVersion`) and the app binary via EAS Build APK (`eas.json` production:
`buildType: "apk"`, `distribution: internal`, `appVersionSource: remote`,
`environment: production` / `preview` / `development` **required** — without `environment` field `EXPO_PUBLIC_*` are not injected (so `568a2577` still saw `Configuration missing`); `Plain` visibility required for `EXPO_PUBLIC_*` ( `Sensitive` is not inlined to JS). No Play Store is required — internal distribution via `expo.dev` link is used for APK installs (Free tier: 15 Android builds/month, 1 000 MAU for updates).

**Splash & launch polish (as of 2026-08-29):** native splash (`expo-splash-screen` `imageWidth: 200`, `backgroundColor: #FFFBF5` light / `#1C1917` dark to match `constants/theme.ts`) fades 300ms into `components/BrandedLoadingShell` (same bg + centered `splash-icon.png` 200×200, progress bar `0→70%` in 400ms fast, `70→90%` while `Clerk isLoaded` + `households.getActive` resolve, `90→100%` on `SplashScreen.hideAsync()`; `hapticSuccess` on complete). `app/_layout.tsx` calls `preventAutoHideAsync()` + `setOptions({duration: 300, fade: true})` and only hides after `isLoaded` and the `Login`/`Onboarding`/`Home` branch is ready — returning signed-in users never see a login flash, signed-out users fade seamlessly into `Login` with the same 200px icon; defensive: no `throw` on missing `EXPO_PUBLIC_*` (shows `Configuration missing` screen, `hideAsync` after 500ms) and fallback `hideAsync` after 3.5s when `isLoaded && isSignedIn && household===undefined` (offline/Convex error) so `BrandedLoadingShell` with `Retry` is always visible, never stuck black splash; `SafeAreaProvider` at root + `UpdateBanner` uses `useSafeAreaInsets().top` (`paddingTop: insets.top`) to avoid `edgeToEdgeEnabled: true` status-bar overlap (clock/WiFi/battery). Offline during launch pauses progress at 90% with `ConnectivityBanner` ("You’re offline — showing cached data" + Retry) and honest copy (`Waiting for connection…` / `Can’t reach Kin Finance`) — never a false spinner. `app/index.tsx` icon is fixed at 200×200 to align with the native splash.

**Startup policy (as of 2026-08-21):** `app.json` sets
`updates.checkAutomatically: "ON_ERROR_RECOVERY"` with
`fallbackToCacheTimeout: 0`. Cold boot therefore launches the embedded or
cached update immediately and never blocks on a network manifest check.
Rationale: in release builds expo-updates delays React instance creation until
its controller finishes startup; combined with an automatic launch-time check,
the first launch after install/update had to create the updates SQLite DB,
copy and hash every embedded asset, and fetch the remote manifest before the
first frame drew — exceeding Android's ANR threshold on low-end devices
(frozen splash icon → "kin-finance isn't responding"; kill + relaunch worked
because the DB was then initialized). Native config changed here requires a
new APK build to reach users.

**Background check:** `components/OtaUpdater.tsx` (mounted in
`app/_layout.tsx` inside `SnackbarProvider` + `SafeAreaProvider`) runs once per session, 5 s after
launch: `checkForUpdateAsync()` → if available, `fetchUpdateAsync()` (only `ready` when `result.isNew === true`, preserves `cancelled` guard, avoids `reloadAsync` on no-op/rollback) with `UpdateBanner` states `downloading` (progress 0→100, `paddingTop: insets.top`) → `ready` ("New update ready" + **Restart now** calling `reloadAsync()` + **Later** which auto-applies at next cold start, also `paddingTop`). If `runtimeVersion` changed (native update required), a blocking dialog "New version available — Download" (`Linking.openURL(downloadUrl)`, `accessibilityRole`) links to the EAS artifact instead of `reload`. Skipped entirely when `__DEV__` or `!Updates.isEnabled` (Expo Go). Failures are swallowed silently.

**Release rule:** changes to native config (anything in `app.json` plugins,
`updates`, dependencies with native code) require a new build + APK
redistribution; JS-only changes can ship via `eas update --channel production`. NetInfo is native — changes require new EAS Build APK, not just `eas update`.

**Environment variables (manual):** `expo.dev` > `kin-finance` > Environment Variables **per environment** (`production`/`preview`/`development`) must contain `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_CONVEX_URL` (both **Plain** visibility — `Sensitive` is not inlined to JS for `EXPO_PUBLIC_*`; from `.env` / `.env.local`; switch `production` to prod URL after `npx convex deploy --prod`); `eas.json` must have `environment: production/preview/development` on each build profile or vars are not injected. `CONVEX_DEPLOYMENT` is local-only; `CLERK_JWT_ISSUER_DOMAIN` / `CLERK_FRONTEND_API_URL` are set in Convex Cloud, not EAS. `.env.example` wording is `per environment`.

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
| `transactions` | `list` | query | Date-range + optional `accountIds`/`categoryIds`/`type`/`search` (≥2 chars, note substring) filtered (index-driven + post-index search); optional `limit` (default/max 1 000) per page; optional `cursor` continuation; returns `cursor`/`hasMore`; cached hydration |
| `transactions` | `summary` | query | Range totals `{income, expense, net}`; same filters as `list` including `search`; transfers excluded; uncapped walk; hidden-category aware for Members (search checks `note` hydration-free) |
| `transactions` | `recent` | query | Latest N with cursor pagination (unified bounded scan SCAN_BUDGET=limit×10 for owner/member, tie-aware, truthful `hasMore`) |
| `transactions` | `get` | query | Single transaction (hidden-category aware) |
| `budgets` | `list` | query | `{periodStart, periodEnd}`; spent + progress; redacted (undefined) for Members on hidden categories |
| `budgets` | `get` | query | Single budget |
| `budgets` | `categoryOptions` | query | Expense categories for budget form |
| `budgets` | `create` | mutation | Member-ok; unique per category/month |
| `budgets` | `update` | mutation | Member-ok; amount only |
| `budgets` | `remove` | mutation | Member-ok |
| `transactions` | `cashflow` | query | Single-scan `by_household_date` over 6-month window (≤200d), buckets by household timezone month start (optional `timezone` arg — client passes `resolveTimezone(household.timezone)` so server matches 6-bucket window even for legacy `household.timezone=null` where server previously used UTC vs client `Asia/Jakarta` → 7 buckets Feb..Aug and `cashflow[4]/[5]` index mismatch causing July `prevNet=0` → "New this month" fix 2026-08-30; Home now finds by `periodStart` not index), aggregates income/expense/net per month, includes zero-months, transfers excluded, Member hidden-category excluded via cached lookup |
| `transactions` | `spendingByCategory` | query | Single-scan `by_household_date` over 1-month window (≤32d), filters `expense` only, aggregates by category (hidden excluded for Member, `nameCache`), returns top 10 sorted desc + `total` (sum of returned segments) |

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
| Charts / SVG | `react-native-svg` 15.12.1 (`SpendingDonut` donut arcs via `Circle` `strokeDasharray`; included in Expo Go 54) |
| Keyboard handling | `react-native-keyboard-controller` (`KeyboardProvider` global + `KeyboardAwareScrollView` on input screens) |
| Language | TypeScript 5.9 |
| Persistence (device) | `expo-secure-store` (theme preference, last-transaction `last-transaction` key via `lib/last-transaction.ts`) |
| OTA updates | `expo-updates` 29 (EAS Update, `checkAutomatically: ON_ERROR_RECOVERY` + background check via `components/OtaUpdater.tsx`) |
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
- Forms use `KeyboardAwareScrollView` (`react-native-keyboard-controller`)
  instead of RN `KeyboardAvoidingView`. `KeyboardAvoidingView` itself supports
  both platforms, but this app wired it iOS-only
  (`behavior={Platform.OS === "ios" ? "padding" : undefined}`), making it a
  no-op on Android; with `edgeToEdgeEnabled: true`, Android's native
  keyboard resize no longer reliably keeps bottom fields visible, so the
  keyboard covered them. Keep `KeyboardAwareScrollView` on form screens —
  do not reintroduce `KeyboardAvoidingView`.
- **NativeWind v4 gotcha:** never use `style={({ pressed }) => [...]}` on
  `Pressable` — it breaks `className`. Use `useState` + static style.

---

## 8. Change Log

Entries are chronological, newest first. Major changes update the relevant
sections above; fixes are logged here only.

| Date | Type | Description |
|------|------|-------------|
| 2026-08-30 | Fix | Analytics P0-1 follow-ups: (1) **SpendingDonut colored** — `react-native-svg 15.12.1` (`npx expo install`) — donut was `C.border` gray track only (legend had palette but ring was solid), now renders colored arcs via `Circle` `strokeDasharray` (`r 15.915`, `dash pct*100`, `offset 25-cumulative*100`, `strokeWidth 7→8.5` when selected, `opacity 0.35` dim, inner cutout 80px `Total`), "Others" aggregated grey, hook-order lint fix (`useMemo` before early return). (2) **Cashflow July "New this month"** — July had data but `DeltaCard` showed `New this month` (prev 0) due to `home.tsx` hardcoded `cashflow[5]/[4]` + timezone mismatch (server `UTC` for `household.timezone=null` vs client `Asia/Jakarta` → 7 buckets `Feb..Aug`); fix: `transactions.cashflow` now takes optional `timezone` (client `resolveTimezone`) and Home finds by `periodStart` (`find c.periodStart===monthStart/prevMonthStart`) with `useMemo`. (3) **DeltaCard contrast** in light mode (`+264.8%` badge was `C.surface` cream + `15` ~8% green tint on cream → gray): light `bg #DCFCE7`/`#FEE2E2` solid + border `#86EFAC`/`#FCA5A5`, dark `26`/`40` alpha, neutral `C.background` + `C.border`, `useColorScheme`-aware (`e1b1b49`, `b640606`, `091858d`). Updates §3.8, §5.2, §6, §7. |
| 2026-08-30 | Feature | P0-1 Dashboard Analytics (below Budgets): Added `transactions.cashflow` + `transactions.spendingByCategory` (single-scan, household TZ, hidden-aware, window capped) + `utils/analytics.ts` + `components/charts/{DeltaCard,CashflowBarChart,SpendingDonut}` (pure View, reanimated staggered/spring + Pressable tooltip, theme-uniform) — wired in `app/(tabs)/home.tsx` below Budgets with Skeleton/Empty/Offline handling. PRD §2.1, §3.8, §5.2, §6 updated. |
| 2026-08-29 | Polish | P0-3 + P0-5 + P1-9: **P0-3 Transaction form** — `utils/format.ts:formatAmountInput` integer-only (explicit decimal truncation, `1.500`→`1`, `12.34`→`12`), `lib/last-transaction.ts` SecureStore persistence for "Repeat last" (survives unmount/restart, contextual copy `Copies {type}, {amount}`), duplicate detection via windowed `transactions.list` (48-hour window centered on candidate date ±24h + matching account/type/category, limit 1000 to examine all matches, `hapticWarning` + `Alert` "Possible duplicate"); **P0-5 Performance** — `BudgetPill` memoized + `useCallback` stable handler, `FlatList`/`SectionList` on Home/Transactions/Accounts/Budgets get `removeClippedSubviews/windowSize/initialNumToRender/maxToRenderPerBatch/getItemLayout` (Home `getItemLayout` length 160, offset 172 stride); **P1-9 Validation consistency** — `number-pad` on all `Input amount`, `account-form` separate `openingBalanceError`, operational errors via `Snackbar` + `hapticError` with `hapticWarning` on validation. Updates §2.1, §2.2, §3.6, §4.4, §5.2, §5.4, §7 |
| 2026-08-29 | Fix | Launch polish follow-ups: `eas.json` add `environment: production/preview/development` to all build profiles (required for EAS to inject `EXPO_PUBLIC_*` — `production` with `distribution: internal` previously missed, so `568a2577` still saw `Configuration missing`; `Plain` visibility required for `EXPO_PUBLIC_*`); `app/_layout.tsx` no longer `throw` on missing `EXPO_PUBLIC_*` — shows `Configuration missing` screen, wraps with `SafeAreaProvider`, `hideAsync` after 500ms, and fallback `hideAsync` after 3.5s when `isLoaded && isSignedIn && household===undefined` to avoid stuck black splash; `components/OtaUpdater.tsx` guards `fetchUpdateAsync` result `isNew` (only `progress 100` + `ready` + `reloadAsync` when truly new, avoids reload on no-op/rollback) and preserves `cancelled` guard; `components/UpdateBanner.tsx` respects `edgeToEdgeEnabled` via `useSafeAreaInsets().top` (`paddingTop: insets.top`) on all states to avoid overlapping clock/WiFi/battery, `blocking` Download now uses `Linking.openURL(downloadUrl)` + `accessibilityRole`; `.env.example` wording `per channel` → `per environment`. Updates §5.2, §5.7, §5.4, `eas.json`, `app.json` |
| 2026-08-29 | Polish | Launch polish B (EAS Update-First, no Play Store, Free tier): native splash sync to `#FFFBF5`/`#1C1917` (match `constants/theme.ts`) + `imageWidth 200` + fade 300ms, `BrandedLoadingShell` (same bg/icon, optimistic progress `0→70` fast 400ms / `70→90` while `Clerk isLoaded` + `households.getActive` / `90→100` on `hideAsync`) + orchestrated gate in `app/_layout.tsx` (`preventAutoHideAsync`/`hideAsync` only after `Login`/`Onboarding`/`Home` ready — no login flash for returning users, seamless 200px icon into `Login`), offline clarity (pause at 90% + `ConnectivityBanner` + honest copy), `UpdateBanner` (`downloading`/`ready` + `Restart now`/`Later`, blocking dialog for native `runtimeVersion` change), `app/index.tsx` icon fixed to 200×200, internal EAS link distribution without Play Store, manual `EXPO_PUBLIC_*` env per channel. Updates §3.1, §4.1, §4.2, §5.2, §5.7 |
| 2026-08-28 | Polish | P0 Batch 3: PTR/Banner real (NetInfo + refreshKey re-query, instant offline, haptic) + Auth modular (5 Auth components + 2 hooks, Input eye toggle 48px, OTP autofill oneTimeCode/sms-otp). Updates §2.1, §3.1, §3.6, §3.8, §5.2, §5.4, §5.7 |
| 2026-08-27 | Polish | P0 Batch 2: Pull-to-refresh + stale `ConnectivityBanner` on Home/Transactions/Accounts/Budgets (RefreshControl 600ms, banner after 3s `undefined`); note search (≥2 chars, 300ms debounce) on `transactions.list`/`summary` (post-index substring on `note`, bounded by SCAN_BUDGET, hydration-free for summary, hidden-aware, “No results for …” empty); `transactions.recent` unified bounded scan (owner/member, tie-aware cursor, truthful `hasMore`, cap 5 unchanged); safe `lib/haptics.ts` wrapper (`hapticSuccess`/`hapticWarning`/`hapticError`) wired to 5 forms (transaction/account/category/budget/members); role-aware Accounts empty for Members (“Only the Owner can add accounts…”). Updates §2.1, §3.6, §3.8, §5.2, §5.4, §8 |
| 2026-08-26 | Feature | Transactions paging + server-side summary: `transactions.list` unified owner/member scan engine gains `cursor {date,id}` continuation and truthful `hasMore` (SCAN_BUDGET now also covers filtered owner scans, fixing potential under-fill); new `transactions.summary` computes uncapped range income/expense/net (transfers excluded, member hidden-category aware, hydration-free). Home's "net this month" and the Transactions summary card switched to `summary`; the Transactions list loads 30-row pages on scroll and shows day-net totals only for completed days (older group loaded or `hasMore=false`). Updates §2.1, §3.6, §3.8, §6 |
| 2026-08-26 | Fix | Discard-guard reliability on native-stack: `hooks/useDiscardGuard.ts` replaced its manual `beforeRemove` listener with React Navigation's `usePreventRemove(isDirty, callback)` — raw `beforeRemove` prevention "may not work correctly with `@react-navigation/native-stack`" (per React Navigation docs) because native-side interception needs the prevent-remove registration pushed down to react-native-screens, so hardware back could pop a dirty form before the JS guard ran; `usePreventRemove` wires that registration. Behavior: dirty + system back → Alert → Discard re-dispatches the prevented action (loop-free via the library's internal visited-route set); app-initiated backs (header button, post-save/delete via `markIntentional`) keep bypassing the Alert through the intentional-navigation flag. Hook API (`handleBack`/`markIntentional`) unchanged — no form changes. Updates §4.4, §5.2 |
| 2026-08-26 | Docs | Documented two deliberate product decisions: amounts render **without a currency symbol by design** — Kin Finance is currency-agnostic, showing bare whole numbers with thousand separators (§1 Constraints); haptic feedback deferred — `expo-haptics` stays installed but intentionally unused for now (Appendix A) |
| 2026-08-26 | Polish | P0 polish batch: Home empty-budget "Create Budget" CTA now shown to Members too (was Owner-gated, contradicting the §2.3 matrix where Members fully manage budgets and the Budgets tab FAB which was never gated); AccountCard gains a passive eye-off "Hidden" pill so Owners can spot hidden accounts without opening the edit form (Members never receive hidden accounts from `accounts.list`); new shared `hooks/useDiscardGuard.ts` (`beforeRemove` listener + discard Alert + intentional-navigation flag) now protects unsaved changes on account, category, and budget forms via per-form dirty checks, and transaction-form migrated onto it (behavior unchanged); transaction-form's plain-text loading state replaced with header + Skeleton placeholders mirroring the three-section layout; OtaUpdater snackbar copy switched to English ("A new update is ready. Restart the app to apply it.") per the English UI policy. Updates §1, §3.8, §4.4, §5.2, §5.7, Appendix A |
| 2026-08-21 | Fix | ANR on first launch after install/update (frozen splash icon → "kin-finance isn't responding"; kill + relaunch worked): in release builds expo-updates delays React instance creation until its controller finishes startup, so with the default `checkAutomatically: ON_LOAD` the first launch had to create the updates SQLite DB, copy + hash every embedded asset, and fetch the remote manifest from `u.expo.dev` before drawing the first frame — exceeding Android's ANR threshold on low-end devices; second launch hit the fast path (DB initialized). Fix: `app.json` sets `updates.checkAutomatically: "ON_ERROR_RECOVERY"` + `fallbackToCacheTimeout: 0` (cold boot never blocks on network); new `components/OtaUpdater.tsx` mounted in `app/_layout.tsx` checks for OTA updates 5 s after launch, downloads silently, and shows a Snackbar "Restart" prompt (update auto-applies at next cold start if dismissed; skipped in dev/Expo Go). Requires a new APK build to take effect. Updates §5.2, §5.7, §7 |
| 2026-08-21 | Fix | Keyboard covering input fields app-wide: RN `KeyboardAvoidingView` supports both platforms, but this app wired it iOS-only (`behavior={Platform.OS === "ios" ? "padding" : undefined}`), making it a no-op on Android; with `edgeToEdgeEnabled: true`, Android's native keyboard resize no longer reliably keeps bottom fields visible, so the device keyboard covered them — e.g. the login Password field when email was the last-used method (email inputs render below the Google CTA in that layout) and the transaction form's Note. Replaced `KeyboardAvoidingView` + `ScrollView` with `KeyboardAwareScrollView` from new dependency `react-native-keyboard-controller` 1.18 on all six input screens (`app/index.tsx`, `onboarding`, `transaction-form`, `account-form`, `category-form`, `budget-form`); added global `KeyboardProvider` and a `cssInterop` mapping (`className` → `style`, `contentContainerClassName` → `contentContainerStyle`) for it in `app/_layout.tsx`. Focused inputs now scroll above the keyboard on both platforms; runs in Expo Go SDK 54 without a native rebuild. Updates §4.4, §5.2, §7 |
| 2026-08-20 | UX | Transactions filter sheet now applies filters only on "Done": interactions inside the sheet (type chips, account/category checkboxes, select-all, Reset) edit a local draft and no longer re-query the list per tap; the committed filters update — and the list/header badge refresh — only when the user taps Done; closing the sheet without Done (backdrop tap or Android back) discards the draft. Updates §3.6, §4.9 |
| 2026-08-20 | Feature | Transactions filters: server-side `transactions.list` args `accountIds`/`categoryIds`/`type` (multi-select arrays; empty or full selection = no filter), backed by compound indexes (`by_household_account_date`, `by_household_category_date`, `by_household_type_date`) with a singleton dimension pinned to its index (narrowing the scan) and multi-value dimensions applied as a post-index `or` filter that may walk the full date window until the limit is collected; Transactions page header consolidated to a Date chip (This Month default / Last Month / Custom Range in a bottom-sheet modal) and a Filter chip (type chips + Account/Category multi-select comboboxes with tri-state header, select-all/unselect-all, search, checkbox rows, Reset); summary card and per-day net totals derive from the filtered query; filter-aware empty state; new `FilterSheet` + `MultiSelectField` components. Updates §2.1, §3.6, §4.9, §5.2, §6 |
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
- Split transactions; recurring transactions; attachments/receipts;
  CSV/PDF export.
- Budget rollover; weekly/yearly budgets; notifications; templates.
- Selection haptics — intentionally deferred (chip/field selection feedback not yet enabled).
- Reports/analytics beyond current Budget progress; full-text search beyond note substring (≥2 chars).
