# Kin Finance — Product Specification

> Status: Living document
> Last updated: 2026-09-04 (Household delete/leave/transfer — Account fixed icons Streamline 4 via Iconify CC BY 4.0 + Category 56 vectors — Architecture deepening Period/Time · Transactions query · Icon registry, no UX break)
> Source of truth: `convex/schema.ts`, `convex/*.ts`, `app/**/*.tsx`, `CONTEXT.md`

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
  Feather (UI) + Streamline Ultimate Color via Iconify (CC BY 4.0, category vectors via `CategoryIcon`), 48px controls. See §3.9 Design System.

### Constraints

- One Household per user in MVP; no household switching or multiple households.
- Transaction dates cannot be in the future (enforced greyed & disabled in MonthPicker, DateField, Search Date; future periods not selectable); amounts are signed
  (+income / −expense / +transfer magnitude).
- **No currency symbol by design:** amounts render as bare whole numbers with
  thousand separators only. Kin Finance is currency-agnostic — household
  amounts are not tied to one currency, so no symbol or locale-currency
  formatting is applied anywhere in the UI.
- Data can only be accessed by Household members.
- Category icons: Streamline Ultimate Color 998 via Iconify — CC BY 4.0 requires attribution to Streamline (https://icon-sets.iconify.design/streamline-ultimate-color/); credit retained in PRD + About/Settings.

---

## 2. Requirements

### 2.1 Functional Requirements (by feature)

| Feature | Requirements |
|---------|--------------|
| Authentication | Sign in, sign up (with confirm password), email verification, MFA email code, Google SSO, forgot-password reset (Clerk). Last-used method remembered per device (SecureStore) and leads the login CTA order. Auth gate in `app/_layout.tsx`. Password fields have visibility toggle (eye/eye-off, 48px); verification/MFA/reset codes use `oneTimeCode`/`sms-otp` autofill. |
| Household | Create (first user becomes Owner), get active household, rename (Owner only), list members, remove member (Owner only; owner cannot be removed), delete/leave/transfer — Owner `households.deleteHousehold` hard-deletes cascade (`households` + `householdMemberships` + `accounts` + `categories` + `transactions` + `budgets` + `periodBalances` + `invitations` + memberships), Member `households.leaveHousehold` removes own membership only (transactions/budgets remain), Owner `households.transferOwnership` swaps `owner↔member` roles. Danger Zone in Settings + Members (`isOwner ? Delete Household : Leave Household` + transfer picker via Alert). Preference `periodType` (`monthly` default, extensible `weekly`/`yearly` — `weekly`/`yearly` coming soon via `households.updatePeriodType`) and `balanceMode` (`fresh` default vs `carryOver`) — Owner-only mutations `households.updateBalanceMode`/`updatePeriodType` (validated via `validateBalanceMode`/`validatePeriodType`, patch `households` + recompute cascade `periodBalances`). |
| Period Balances | Materialized snapshot per `periodType` (`monthly`/`weekly`/`yearly`) — table `periodBalances` (`householdId`, `periodType`, `periodStart`/`periodEnd`, `income`/`expense`/`openingBalance`/`closingBalance`) — `fresh`: `opening 0`, `closing = net` per period; `carryOver`: `opening = prev closing`, `closing = opening + net` (cascade from `household.createdAt` to now, single `by_household_date` scan, upsert per period, O(1) read via `by_household_period`/`by_household_type`, `verify`/`reconcile`/`recomputeAll`/`backfill`, extensible to weekly/yearly). |
| Invitations | Owner generates invite code (8 alphanumeric chars, HMAC-SHA-256 hash stored, 7-day expiry, single-use). Owner can revoke. Generating a new code atomically auto-revokes all previous active codes within the same mutation (`invitations.create` patches `revoked=true` before insert, so at most one active code exists). Member joins by redeeming a code. Rate limited: max 5 attempts/code/min. |
| Accounts | Create (optional opening balance → auto "Initial Balance" transaction atomically in the same mutation: reserved category validated before `accounts.insert`, account `balance` set directly to `openingBalance`, transaction inserted with same `now` timestamp), edit (name/type/hidden), delete (guarded if referenced by transactions), list (visibility-filtered). Owner-only management. Verify/reconcile: Owner can verify stored vs expected balances and recalculate all balances from transaction history (atomic per-account patch) when drift is detected (`accounts.verify` / `accounts.reconcile`, 10k tx cap, banner + Recalculate in Accounts tab). Icon fixed per type via Streamline Ultimate Color (CC BY 4.0) — bank saving-bank-1, cash cash-payment-bill, ewallet wireless-payment-credit-card-dollar, credit_card credit-card-1 — rendered offline via AccountIcon SvgXml 24x24 palette:true, derive at render (no DB field). |
| Categories | Create, edit (name/type/icon/hidden; type change guarded), delete (guarded if referenced), list (visibility-filtered). Icon chosen from 56 names (`constants/categoryIconNames.ts` allowlist, same DB keys as before) rendered via Streamline Ultimate Color 998 icons via Iconify — CC BY 4.0 Streamline (https://icon-sets.iconify.design/streamline-ultimate-color/, https://github.com/webalys-hq/streamline-vectors), offline bundled as `constants/streamlineIconData.json` + `constants/streamlineIconMap.ts` → `components/CategoryIcon.tsx` (`react-native-svg` `SvgXml`, 24x24 palette:true, `getStreamlineIconName` fallback `other` → `tags-1`). DB still stores `icon?: string` allowlist (`isValidCategoryIcon`), PNG fallback (`assets/icons` + `getCategoryIconSource`) kept for legacy offline but primary render is SVG. Two reserved "Initial Balance" categories per household are protected. Owner-only management. Icon displayed in `CategoryCard`, `TransactionCard` and all category surfaces (`transaction-form` selector, budgets, `SelectField`) via `CategoryIcon`. |
| Transactions | Create/edit/delete income, expense, transfer. Account balance(s) auto-update (reverse old, apply new). Transfers move between two accounts, no category. Members respect hidden account/category rules. `list` returns at most 1 000 rows per page (server cap, optional `limit`). `list` is cursor-paginated (`cursor`/`hasMore`); **Home ledger** is period-bound 30/page with Search+Filter (per `selectedPeriodStart..periodEnd`, daily groups, Today card, `TransactionCard` subtitle `Category • Account` no time) + **Search global** cross-period via `app/search.tsx` (Date first chip, default last 14 days `20 Aug–3 Sep` hint, 30/page, `maximumDate today` future greyed & disabled). A `summary` query computes range income/expense/net server-side (transfers excluded; Members' hidden-category rows excluded). Supports server-side filtering by transaction type, account, and category; a consolidated date filter (This Month / Last Month / Custom Range) sits behind one header chip for period-bound views, while Search uses global Date range. Supports server-side substring search by note, amount string, account name and category name (≥2 chars) on `list` and `summary` (committed only after user taps **Search** button or submits via keyboard `returnKeyType="search"` — no auto debounce, bounded scan; Members' hidden rows excluded; `list` matches after hydration via `matchesSearch` including absolute amount string without commas, `account.name`, `toAccount.name`, `category.name`; `summary` uses cached name lookups); pull-to-refresh (RefreshControl) and stale-data banner (ConnectivityBanner + Retry) on Home/Search/Accounts/Budgets — refresh/retry re-queries via Convex reactive subscription (visual spinner + stale clear, no manual cache invalidation needed). Amount input is whole-number only (`number-pad` + `formatAmountInput` strips decimals/non-digits, thousand-separator display; decimal input shows inline amber warning "Decimals are ignored — whole numbers only" via `wasDecimalTruncated` in `Input` instead of silent truncation); duplicate detection warns if same amount+account+category/type exists within 24h (confirmation Alert); "Repeat last" persists the last created transaction via SecureStore (`lib/last-transaction.ts`) and survives unmount/restart with contextual copy. |
| Search | Global cross-period search via `app/search.tsx` with Date first chip, default last 14 days (`20 Aug–3 Sep` hint, `Showing {dateLabel} • tap Date to change`), 30/page `FlatList` cross-period, Future dates greyed & disabled (`maximumDate today` in `DateField`), `FilterSheet` for bill type/category/account; summary `Records N` with income/expense totals. |
| Budgets | Create/edit/delete monthly budgets per expense category. List for a month with spent/progress. Members can fully manage. Budgets for hidden categories stay visible to Members. |
| Home | Dashboard (swipeable period — `PagerView` 12 periods, `<`/`>` + dots + `formatPeriodLabel` from `utils/period.ts`, `MonthPicker` Jan-Dec future disabled (greyed `opacity 0.4` disabled), `selectedPeriodStart` binding): household card, **Period Balance** (Income/Expense/Balance per period via `periodBalances.get` with `openingBalance`/`closingBalance` and `currentLabel`, refined `GradientCard` with tinted `trending-up`/`trending-down` circles), Budgets (3 pills per `selectedPeriodStart`), **Full SectionList 30/page daily groups** (period-bound via `transactions.list` `{startDate: selectedPeriodStart, endDate: periodEnd, limit:30}`, grouped by day with day net total, deduped cursor, `onEndReached` loadMore) + **Today card** (`No record for today` + `+` when today within period and empty) + **My Accounts** + **Search+Filter period-bound** (rounded search bar + `Filter · N` pill, `Search` primary pill, `FilterSheet`) — all household-timezone-aware via `getPeriodBounds` (`monthly`/`weekly`/`yearly`), Member hidden-category excluded (periodBalances snapshot O(1) read), pure-View + reanimated with Pressable tooltip; `TransactionCard` rows show `Category • Account` (transfer `Account → ToAccount`) with no time. PTR & stale banner still applies. |
| Analytics | Spending by Category (selected period) + Delta closing vs prev closing on Home below Budgets. `periodBalances.get` (period snapshot) + `spendingByCategory` (1 `by_household_date` scan per query, hidden-category cache, window validation). Delta uses `periodBalances.closingBalance` vs `prevClosing` (`balanceMode` aware: `fresh` closing=net, `carryOver` cumulative). |
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
| Category icon | Optional; must be one of 56 allowlist names in `constants/categoryIconNames.ts` / `assets/icons/manifest.json` (validated via `isValidCategoryIcon`); defaults to `other`; rendered via Streamline Ultimate Color (Iconify CC BY 4.0) `CATEGORY_STREAMLINE_MAP` + `CategoryIcon` (`SvgXml` offline `streamlineIconData.json`), fallback `other` → `tags-1` (vector); legacy PNG `other.png` via `getCategoryIconSource` kept as fallback for cached data |
| Transaction amount | Whole number; non-zero; positive for income, negative for expense, positive magnitude for transfer; \|amount\| ≥ 1; client enforces via `number-pad` + `formatAmountInput` (strips decimals/non-digits, thousand separators) so decimals never reach validation; client shows amber inline warning "Decimals are ignored — whole numbers only" when a decimal is truncated (`utils/format.ts:wasDecimalTruncated` → `Input` warning) |
| Transaction account | Required; visible for Member on create; reassignment requires visible account |
| Transfer accounts | Both required, must differ, same household |
| Transaction category | Required for income/expense; must match transaction type; visible for Member |
| Transaction date | Required; cannot be in the future (enforced greyed & disabled in MonthPicker, DateField, Search Date; future periods not selectable) |
| Note | Optional; ≤ 200 chars |
| Budget amount | Positive whole number ≥ 1 |
| Budget category | Required; must be **expense** type; unique per (household, category, month) |
| Invite code | 8 alphanumeric chars; case-normalized before hashing |
| Household periodType | `monthly` \| `weekly` \| `yearly`; optional (default `monthly`); `weekly`/`yearly` coming soon — server throws `Weekly/yearly coming soon` if not `monthly` (`households.updatePeriodType`, `validatePeriodType`) |
| Household balanceMode | `fresh` \| `carryOver`; optional (default `fresh`); `fresh` each period starts 0, `carryOver` carries prev closing (`validateBalanceMode`) |

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
| Update Balance Mode (`households.updateBalanceMode` fresh/carryOver) | ✅ | ❌ |
| Update Period Type (`households.updatePeriodType` monthly/weekly/yearly) | ✅ | ❌ (weekly/yearly coming soon for all) |
| Delete Household (`households.deleteHousehold` cascade) | ✅ | ❌ |
| Leave Household (`households.leaveHousehold` remove own membership) | ❌ | ✅ |
| Transfer Ownership (`households.transferOwnership`) | ✅ | ❌ |

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

**Period handling (as of 2026-08-31):** each household stores `periodType` (`monthly` default, `weekly`/`yearly` extensible — `validatePeriodType`, `PERIOD_TYPES` in `constants/validation.ts` and `utils/period.ts` `PeriodType`) and `balanceMode` (`fresh` default vs `carryOver` — `validateBalanceMode`, `BALANCE_MODES`). `fresh`: each period's `openingBalance 0`, `closingBalance = net (income-expense)` isolated; `carryOver`: `openingBalance = prev closing`, `closingBalance = opening + net` cumulative (cascade from `household.createdAt` to now). Both are Owner-only via `households.updateBalanceMode`/`updatePeriodType` (requireOwner, patch `households` + trigger `periodBalances.recomputeAllForHousehold`). `updatePeriodType` currently throws `Weekly/yearly coming soon` if not `monthly` (extensible via `utils/period.ts` `getWeekBounds`/`getYearBounds`/`getPeriodBounds`). Period boundaries use `utils/period.ts` `getPeriodBounds(ts,tz,type)` — `monthly` via `getMonthBounds` (tz-aware), `weekly` Monday 00:00 tz, `yearly` Jan 1 00:00 tz — with `getPrevPeriod`/`getNextPeriod`/`formatPeriodLabel`/`buildPeriodWindow`. Settings exposes a segmented control (Fresh / Carry Over) Owner-only (`app/(tabs)/settings.tsx` `BALANCE_MODE_OPTIONS`, `useMutation` + `hapticSuccess` + `Snackbar`, Member read-only badge). Snapshot table `periodBalances` (see §3.10, §6) persists per-period aggregates for O(1) Home/Analytics reads.

**Delete / Leave / Transfer (as of 2026-09-04):** Owner `households.deleteHousehold({householdId})` (requireOwner, householdId match) hard-deletes cascade via `cascadeDelete` — `transactions` → `budgets` → `periodBalances` (filter scan) → `accounts` → `categories` → `invitations` → `householdMemberships` → `households`; all members lose access and can create/join new household. Member `households.leaveHousehold({householdId})` (member-only, owner blocked `Owners cannot leave. Transfer ownership or delete the household.`) deletes own `householdMemberships` only, transactions/budgets remain. Owner `households.transferOwnership({householdId, newOwnerUserId})` validates target is member of same household, swaps roles (`owner→member`, `member→owner`). UI Danger Zone in `app/(tabs)/settings.tsx` and `app/members.tsx` (`Shadow.card` `border #FCA5A5` + `alert-triangle` `C.error`, role-aware `Delete Household` vs `Leave Household` `variant="danger"` + subtitle, `hapticSuccess`/`hapticError` + `Snackbar` + `router.replace("/onboarding")`); owner flow offers Transfer picker (Alert list of non-owner members → `transferOwnership`) or Delete with double confirm. Verified by `tests/households.deleteLeaveTransfer.test.ts` 8 cases.

### 3.3 Multi-Member & Invites

- Owner generates an invite code from the Members screen. Codes are
  cryptographically random, 8 alphanumeric chars; only an HMAC-SHA-256 digest
  keyed by the server secret is stored (plaintext never persisted).
- Codes expire after 7 days, are single-use, can be revoked, and generating a
  new code atomically invalidates all previous active ones **within the same mutation** (`convex/invitations.ts:40` — `invitations.create` collects `by_householdId` and patches `revoked=true` for every active invite before inserting the new one, so `listActive` never returns >1 row; verified by `tests/invitations.autoRevoke.test.ts:1`).
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
through the standard path **atomically in one mutation** (`convex/accounts.ts:43` — validates the reserved category **before** `accounts.insert`, inserts the account with `balance: openingBalance` and `createdAt/updatedAt: now`, then inserts the `Initial Balance` transaction with the same `now`/`createdBy`; no `ctx.runMutation` so no orphan account if the transaction would fail; verified by `tests/accounts.atomicOpeningBalance.test.ts:1`). Opening balances are whole numbers. Owner edits
name/type and toggles visibility. Owner
deletes accounts only when no transactions reference them.

Icons are fixed per type via ACCOUNT_STREAMLINE_MAP + AccountIcon (SvgXml offline streamlineIconData.json), displayed in AccountCard 44/32, Home 40/28, SelectField 24, account-form 20 — no Feather tinted circles, neutral C.surface container.

**Balance Reconciliation (as of 2026-08-30):** Owner can call `accounts.verify` (read-only diff: compares stored `accounts.balance` vs recomputed expected from full household transaction log — income/expense signed, transfer `from -amount` / `to +amount`; returns `{discrepancies, totalStored, totalExpected, isOwner}`, caps at 10k txs) and `accounts.reconcile` (owner-only mutation, patches drifted accounts with `balance: expected` + `updatedAt: now`, returns `{fixed, discrepancies}`) — exposed in `app/(tabs)/accounts.tsx:41` as an amber discrepancy banner + Recalculate action (Alert confirm → Snackbar + `hapticSuccess`/`hapticError`). Verified by `tests/accounts.reconcile.test.ts:1` (6 cases: no drift, drift detected + fixed, owner-only gate, outsider null, transfer arithmetic, opening-balance atomic).

### 3.5 Categories

Labels for classifying transactions, typed `income` or `expense`. Owner manages
them. Each category stores an optional `icon` key (`constants/categoryIconNames.ts` `ALL_CATEGORY_ICONS` 56 names, default `other`, validated via `isValidCategoryIcon`; DB key unchanged). Rendering migrated 2026-09-04 from PNG `CATEGORY_ICON_MAP` (`assets/icons` 56×56, `expo-image`, `getCategoryIconSource` → `other.png`) to **Streamline Ultimate Color 998** via Iconify (CC BY 4.0, https://icon-sets.iconify.design/streamline-ultimate-color/, author Streamline https://github.com/webalys-hq/streamline-vectors, commercial allowed with attribution) — offline bundle `constants/streamlineIconData.json` (fetched via `https://api.iconify.design/streamline-ultimate-color.json?icons=...`, palette:true 24×24) + `constants/streamlineIconMap.ts` (`CATEGORY_STREAMLINE_MAP` 56→ Iconify names, e.g. `shopping_bag`→`shopping-bag-check`, `income`→`money-bag-dollar`, `other`→`tags-1`) + `components/CategoryIcon.tsx` (`react-native-svg` `SvgXml`, `size` prop, fallback `other`). The picker in `app/category-form.tsx` shows a 4-column grid of 56 vectors (32px `CategoryIcon` in 56×56 circle, selected border 2px `C.primary`); `components/CategoryCard.tsx` (44px/32px), `components/TransactionCard.tsx` (40px/28px) and all category surfaces (`transaction-form`/`budget-form` `SelectField` 24px, `BudgetCard` 24px) render the SVG via `CategoryIcon` (PNG path kept as legacy fallback via `getCategoryIconSource`). Two reserved system-managed categories per household — "Initial Balance"
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
  integer-only thousand-separator formatting (`number-pad` + `formatAmountInput` strips decimals/non-digits with inline amber warning `wasDecimalTruncated` → "Decimals are ignored — whole numbers only" in `components/Input.tsx:29` when a decimal is typed, instead of silent truncation), contextual sign-convention hint, "Repeat last"
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

**Search (as of 2026-08-30 — extended, fixes silent amount/account gap; 2026-08-30 explicit commit):** Text input + **Search** button (`app/(tabs)/transactions.tsx:385`, `returnKeyType="search"`, `onSubmitEditing` + `Pressable` primary `Search` pill next to the input; bar shows `searchDraft` vs committed `searchCommitted` split) above filter chips (placeholder "Search notes, amounts, accounts, categories…"); committed search (≥2 chars, trimmed, lowercased via `normalizeSearch`) is sent as `search` to `list`/`summary` **only after user taps Search or submits via keyboard** (no 300ms auto debounce — explicit commit via `commitSearch` / `clearSearch` + `hapticSuccess`, `Keyboard.dismiss()`); typing alone does not re-query; `list` matches after hydration via `matchesSearch` — `note` substring, absolute `amount` string without commas (`Math.abs(row.amount).toString().includes(searchDigits)` + signed), `account.name`, `toAccount.name`, `category.name` (all lowercased, bounded by existing SCAN_BUDGET = limit×10, no new index, hidden-category rows excluded for Members); `summary` matches hydration-light via cached `accountNameCache`/`categoryNameCache` lookups before aggregating income/expense; empty shows “No results for …” with Clear action (`clearSearch` resets both draft+committed). Search <2 chars is treated as no filter. Verified by `tests/transactions.search.test.ts:1` (5 cases) + ad-hoc extSearch (amount/account/category).

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

### 3.8 Home Dashboard (as of 2026-09-03 — Opsi B full ledger)

- Greeting uses the user's first name (from Clerk `user.firstName`, falling back
  to profile name, then email prefix with dots replaced by spaces).
- Household card (name + " Household", no member count).
- **Period navigation (as of 2026-09-03 — swipeable 12 past+now, MonthPicker Jan-Dec):** header outside `PagerView` with `<` `>` chevrons (44×44, `Shadow.card`, `Radius.md`, `C.border`, disabled at current period `next > curStart` and at window start `selectedPeriodStart <= pagerPeriods[0].periodStart` for Previous via `isPrevDisabled`/`isNextDisabled` — prevents selecting outside `buildPeriodWindow` 12-period window) + centered tappable `formatPeriodLabel(selectedPeriodStart, tz, periodType)` (`utils/period.ts`) with `▼` that opens `MonthPicker` + dots (12 periods via `buildPeriodWindow(now, tz, periodType, 12)`, active `w 16 C.primary` vs `w 6 C.border`). **MonthPicker** (`components/MonthPicker.tsx`): modal grid Jan-Dec (`MONTH_LABELS` Jan–Dec), Year nav (`chevron-left`/`chevron-right`, right disabled when `year >= curYear` `opacity 0.4`), tabs `Week | Month | Year` (Month active `bg ${C.primary}22`, Week/Year `opacity 0.4` + "Coming soon"), `isFutureMonth(year, month, tz, now)` via `zonedMonthStart` vs `getPeriodBounds(now, tz, "monthly").start` — future months greyed `opacity 0.4` `disabled`; selection calls `onSelect(ps)` + `onClose` + `pagerRef.setPage(idx)`. Swipeable `react-native-pager-view` `PagerView` (paging, `initialPage selectedIndex` + `offscreenPageLimit={1}` + `setPageWithoutAnimation` sync via `useEffect([selectedIndex,pagerPeriods])`, `onPageSelected` → `setSelectedPeriodStart` + `hapticSuccess`), each page renders full dashboard only for `isSelected` (`p.periodStart===selectedPeriodStart`) else lightweight placeholder (`View flex1 bg`, `collapsable={false}`) so non-selected pages don’t mount `selectedPeriodStart`-bound queries. `currentPeriodBounds.end` rollover timer capped `MAX_TIMEOUT 2147483647-1000` and re-armed via `[currentPeriodBounds.end, nowTick]` dep — capped delays schedule another timeout after each early `nowTick` until actual boundary, so yearly 31d+ delays don’t overflow. All sections bind to `selectedPeriodStart`: `periodEnd = getPeriodBounds(selectedPeriodStart, tz, periodType).end`. `periodType = household.periodType ?? "monthly"`, `timezone = resolveTimezone(household.timezone)` (device IANA, persisted at onboarding `getCalendars()[0].timeZone ?? "UTC"`). Extensible `periodType` `monthly`/`weekly`/`yearly` (weekly Monday 00:00, yearly Jan 1 00:00) via `utils/period.ts` (B).
- **Total Balance**: gradient card showing the sum of all account balances, with a secondary line showing **selected period's net** (`periodBalances.get` `income-expense` for `selectedPeriodStart`, `currentNet` vs `prevNet` from `prevBalances`, or `closingBalance` delta when `carryOver`) in semantic color (green for positive, red for negative). Fallback `balances === null` → "No data for this period", `=== undefined` → `Skeleton`.
- **Budgets** (when budgets exist): up to 3 budget pills showing category name,
  spent/budgeted amounts, and a color-threshold progress bar (`C.success` → `C.chartAmber` → `C.error`, `useThemeColors()`-aware: `#D97706` light / `#F59E0B` dark for amber, via `app/(tabs)/home.tsx:88` `BudgetPill`). `monthBudgets = useQuery(api.budgets.list, {periodStart: selectedPeriodStart, periodEnd})` per selected period. "See All" links to the Budgets tab. When no budgets exist, the empty state's "Create Budget" action is available to Owners and Members alike.
- **Search+Filter period-bound (as of 2026-09-03):** below Period Balance/Budgets, rounded search bar (`Feather search` + `TextInput` `searchDraft` `placeholder "Search notes, amounts, accounts…"`, `returnKeyType="search"` `onSubmitEditing={commitSearch}`, clear `X` → `clearSearch`) + primary pill `Search` (`C.primary`, `borderRadius 999`, `hapticSuccess`, `Keyboard.dismiss()`) → `searchCommitted` (≥2 chars, `normalizeSearch`) scoped to period via `queryArgs` `{startDate: selectedPeriodStart, endDate: periodEnd, search, type, accountIds, categoryIds}`; `Filter` pill (`Filter` vs `Filter · N` when `activeFilterCount>0`, `FilterSheet` draft → `Done` applies) — both period-bound (not global), reset on period change via `queryArgsKey`.
- **Full SectionList 30/page daily groups (as of 2026-09-03 — replaces Recent 5 + See All):** `transactions.list` per `selectedPeriodStart..periodEnd` with `limit:30` + `cursor` + deduped `pagesMapRef` + `onEndReached` `loadMore` (`hasMore`/`nextCursor`); `transactions.summary` same filters for header totals; `sections` via `formatDateHeaderTz` grouped by day with day net total (`sumNetExcludingTransfers`, transfers excluded, sign-colored) and `Today` header; `TransactionCard` rows show subtitle `Category • Account` (expense/income) or `Account → ToAccount` (transfer) with **no time** (removed `formatTimeTz` line, `date` prop kept but not displayed, `accountName` prop added); tap → `transaction-form`. `ListEmptyComponent` shows `EmptyState` or **Today card** when `today` within `[selectedPeriodStart, periodEnd)` and empty (`No record for today` card `Shadow.card` `rounded-[16px]` + `+` `Feather plus` `bg #facc15` → `router.push("/transaction-form")`), with `Filter` empty `Clear filters` action. `My Accounts` horizontal cards remain above/below ledger (tinted icons, `Add Account` for Owner, `Manage` link).
- **My Accounts**: horizontal account cards with type-specific tinted icon
  backgrounds (green for cash, amber for bank, blue for e-wallet, red for credit
  card); "Add Account" card for Owner; "Manage" link to the Accounts tab. For
  Members, tapping a card goes to the Accounts tab (owner-only edit/delete stays
  in the Accounts tab).
- **Analytics (below Budgets, retained for Reports reference, cashflow removed 2026-08-31):** Delta/donut moved to Reports as of 2026-09-03; Home now focuses on ledger. Legacy analytics (Delta `closingBalance` vs `prevClosing` via `periodBalances.get` + `SpendingDonut` via `spendingByCategory`) remain in `app/(tabs)/reports.tsx`.
- **PTR & stale real (as of 2026-08-28):** 4 tabs use hooks/useConnectivity (NetInfo) — banner appears instantly when isConnected===false, fallback undefined >3s otherwise; RefreshControl and banner Retry show a 600ms spinner, clear stale state, and trigger haptic, relying on Convex reactive subscription for fresh data (no manual cache invalidation). Requires native rebuild for NetInfo. Home pager keeps `selectedIndex = pagerPeriods.findIndex(p.periodStart===selectedPeriodStart) ?? last` and `stale` derives from `balances === undefined` (period snapshot) + `summary === undefined` (ledger).
- Empty states include action CTAs (e.g., "Add Transaction" on empty transaction
  list, "Add Account" for Owners vs. Owner-hint for Members on empty accounts).
- FAB uses reanimated spring animation (scale on press) for tactile feedback.
- Haptics: `hapticSuccess` on create/update, `hapticWarning` on validation, `hapticError` on failure (via `lib/haptics.ts`).
- Sign-out is accessible only via the Settings tab, not the home header.

### 3.11 Reports (as of 2026-09-03 — Opsi B)

Swipable 12 past+now per `buildPeriodWindow(nowTick, tz, "monthly", 12)` with `nowTick/setNowTick` + `currentPeriodBounds` rollover timer capped `MAX_TIMEOUT 2147483647-1000` (matching Home) ensuring `pagerPeriods`, `isNextDisabled` and `handleNext` use refreshed `currentPeriodBounds.start` so `selectedPeriodStart` stays in window after month boundaries, `selectedPeriodStart` + `MonthPicker` Jan-Dec future disabled (same `MonthPicker` as Home, header `currentLabel ▼` + `<`/`>` chevrons disabled at window bounds, dots).

- **Header:** `<`/`>` `44×44` `Shadow.card` `Radius.md` `C.border` (`isPrevDisabled` `selectedPeriodStart <= pagerPeriods[0].periodStart`, `isNextDisabled` `getNextPeriod(...) > curStart` via `currentPeriodBounds.start` `opacity 0.4` disabled) + centered `currentLabel ▼` (tap → `MonthPicker`) + dots (`w 16` active vs `w 6`).
- **PagerView:** `pagerRef` `initialPage selectedIndex` + `offscreenPageLimit={1}` + `setPageWithoutAnimation` sync, `onPageSelected` → `setSelectedPeriodStart` + `hapticSuccess`; per-page `isSelected` renders `ScrollView` else placeholder.
- **Category Ranking Card** (`components/reports/CategoryRankingCard.tsx`): `type "expenses"|"income"` toggle (`Expenses ⇌` pill `bg #fde68a` → `toggleType` + `hapticSuccess`), `segments` + `total` + `othersAmount` via `spendingByCategory` (expenses) or `transactions.list` aggregation (income, `Math.abs` per category, sorted desc, top 10 + others); donut via `SpendingDonut` (colored arcs `react-native-svg` `Circle` `strokeDasharray`, `r 15.915`, `opacity 0.35` dim, `strokeWidth 8.5` when selected, inner cutout 80px `Total`); list rows `1..N` `name` left `formatNumber(amount)` right; **5 top + show-more** (`sorted = [...segments].sort((a,b)=>b.amount-a.amount)`, `visible = expanded ? sorted : sorted.slice(0,5)` sorted descending, `Feather chevron-down/up` toggle when `segments.length>5`).
- **Bill Ranking Card** (`components/reports/BillRankingCard.tsx`): `Bill Amount Ranking TOP 10` (`type` pill `Expenses`/`Income` `bg #fde68a`), `[...segments].sort((a,b)=>b.amount-a.amount).slice(0,10)` sorted descending rows `name` + `formatNumber(amount)`, `Shadow.card` `rounded-md`.
- **Delta Card** (`components/charts/DeltaCard.tsx`): `currentClosing` vs `prevClosing` (`periodBalances.get` `closingBalance` fallback `income-expense`, `calcDelta` `periodNoun` `month`), `currentLabel`/`prevLabel`.
- Loading: `Skeleton` placeholders for ranking/bill/delta; empty → `No data`. `useThemeColors()` + `Shadow.card`.

### 3.12 Search — Global Cross-Period (as of 2026-09-03 — Opsi B)

Global search via `app/search.tsx` (outside tabs, `router.push("/search")` from Home `🔍`, `app/(tabs)/transactions.tsx` redirects to `/search`).

- **Default 14d window:** `today = new Date()`, `defaultEnd = getDayBounds(today, tz).end`, `defaultStart = getDayBounds(new Date(today.getTime()-14*86400000), tz).start` (inclusive, 20 Aug–3 Sep when today 3 Sep Jakarta, hint `Showing 20 Aug – 3 Sep • tap Date to change`). `startDate`/`endDate` state with `draftFrom`/`draftTo` (`Date` objects) synced on `dateSheetOpen`.
- **Top bar:** back `chevron-left` `40×40` `border C.border` + rounded search input (`Feather search` + `TextInput` `placeholder "Categories, amount, tags, etc., separated by ','"` `returnKeyType="search"` `onSubmitEditing={commitSearch}` → `setSearch(searchDraft.trim())` `Keyboard.dismiss()`, clear `X` → `clearSearch`) — committed search ≥2 chars `search` sent to `list`/`summary`.
- **Chips row (horizontal `ScrollView`):** **Date first** (`dateLabel` `formatDateShortTz(startDate)` – `formatDateShortTz(endDate-1)` `▼`, `C.primary` `Shadow.card` `999`, tap → date sheet) + `Bill type ▼` (active `C.primary14` when `typeFilter!=="all"`) + `Category ▼` (`categoryIds.length>0`) + dummy `Ledger` `opacity 0.4` + `Account ▼` + dummy `Tags`/`Amount` `opacity 0.4`; `FilterSheet` handles bill type/category/account.
- **Date sheet modal:** `Modal` `transparent` `bg-black/40` + `Shadow.card` `rounded-2xl`, `Select date range` + `Future dates are disabled`, two `DateField` (`From`/`To`) with `maximumDate={new Date()}` future greyed & disabled (enforced), `Cancel` + `Apply` (`C.primary`) → `getDayBounds` `start`/`end` clamped to `todayEnd` (`Math.min(newEnd, getDayBounds(new Date(), tz).end)`), validates `newStart < clampedEnd`; if invalid, swaps earlier/later dates (`fromStart/toStart` via `getDayBounds`, preserves both selections, keeps sheet open) instead of fixed 24h offset.
- **Summary card:** `Records N` (`pagedTransactions.length` vs `summary` `–` when undefined) + `trending-up` `C.success` `summary.income` + `trending-down` `C.error` `summary.expense` (`formatNumber`).
- **FlatList 30/page cross-period:** `transactions.list` `{startDate, endDate, search, type, accountIds, categoryIds, limit:30, cursor}` + `summary` same `queryArgs` global (no period bound); deduped `pagesMapRef` + `hasMore`/`nextCursor`/`loadMore` `onEndReached 0.5`; `TransactionCard` rows `Category • Account` no time; `EmptyState` `search` `No results` + `Try adjusting your date or filters`; stale via `result === undefined`.
- Search is global cross-period with Date default 14d; Home ledger remains period-bound.

### 3.10 Period Balances (as of 2026-08-31 — swipeable Home + carryOver snapshot)

Materialized per-period snapshot powering Home/Analytics O(1) reads, extensible to `weekly`/`yearly` (B).

- **Table `periodBalances`** (`convex/schema.ts:22`): `householdId`, `periodType` (`monthly`|`weekly`|`yearly`), `periodStart`/`periodEnd` (epoch ms, tz-aware via `getPeriodBounds`), `income`/`expense` (aggregated per period, transfers excluded), `openingBalance`/`closingBalance` (derived, see balanceMode), `createdAt`/`updatedAt`. Indexes `by_household_period` (`householdId`,`periodType`,`periodStart`) unique lookup, `by_household_type` (`householdId`,`periodType`) window scan.
- **Balance modes:** `fresh` (default, matches PRD & `periodBalances` fallback `resolveHouseholdConfig`): `opening 0`, `closing = income-expense` isolated; `carryOver`: `opening = prev closing`, `closing = opening + net` cumulative cascade (sorted `periodStart` from 12-month window + earliestTxStart, guard 500, `computeOpeningClosing`). Verified by `tests/periodBalances.test.ts:1`.
- **Recompute cascade:** `convex/periodBalances.ts:114` `recomputeAllForHousehold` — explicit bounded `by_household_date` scan `lt now` `take(10001)` (if `>10000` throw `ConvexError Too many transactions`); no `gte household.createdAt` so history before creation (Aug household Juli) included; hidden **account** and hidden **category** excluded for `isOwner=false` via `hiddenAccountCache` + `hiddenCategoryCache` (cached `ctx.db.get` per `accountId`/`categoryId`, skip before `income`/`expense` aggregation — review fix 2026-09-01, previously only category was filtered); `fresh`/`carryOver` via `computeOpeningClosing` where `carryOver` seeds opening of first retained period from **all** prior history `totalBefore = sum net where pStart < firstStart` (including transactions beyond 2y `earliestTxStart` cap), so prior history preserved while snapshots remain bounded; ordered `firstStart` = 12-month window + `earliestTxStart` (cap 2y) via `getNextPeriod` guard 500, upsert + delete obsolete (`!withBalances.has(periodStart)` → `delete`). `recomputeFromForHousehold` delegates to full recompute. Canonical timezone via `resolveHouseholdConfig` (persisted device IANA at `households.create` `getCalendars()[0].timeZone ?? "UTC"`, validated via `validateTimezone` + `Intl.DateTimeFormat`, legacy fallback `UTC`) and `resolveEffectiveTimezone(household.timezone, args.timezone)` in `get`/`listWindow` so stored snapshot keys (`getPeriodBounds(tx.date, tz, type).start`) match requested `periodStart` keys — no `UTC` vs device mismatch. Fallback in `get`/`listWindow` with `timezone` param computes on-the-fly; `get` non-owner absent `compM` → `null` not `snap`. Triggers: `households.updateBalanceMode`/`updatePeriodType`, `transactions.create/update/delete`, `accounts.create`, plus `recomputeAll`/`reconcile`/`backfill` owner mutations. `verify` compares stored vs expected.
- **Queries:** `periodBalances.get({periodStart, periodType?, timezone?})` → snapshot or virtual computed fallback; non-owner absent `compM` → `null` not owner `snap` (explicit `return null` at `259`, prevents leak); `periodBalances.listWindow({startDate,endDate,periodType?, timezone?})` → `{balances, isOwner}` filtered sorted, fallback computed if empty + member visibility-scoped recompute (`isOwner=false` with `hiddenAccountCache`/`hiddenCategoryCache` — both account and category hidden filtered, review fix 2026-09-01); `verify`/`reconcile`/`backfill`/`recomputeAll` as above. `effectiveTz = resolveEffectiveTimezone(household.timezone, args.timezone)` validated via `validateTimezone` ensures requested `periodStart` matches stored UTC keys. `utils/period.ts` `validatePeriodType`/`validateBalanceMode` guard inputs; `constants/validation.ts` `PERIOD_TYPES`/`BALANCE_MODES` shared.
- **Client:** Home `selectedPeriodStart` (see §3.8) reads `periodBalances.get` + `prevBalances` for Delta, `spendingByCategory` per period for donut (cashflow removed from Home as of 2026-08-31); **Period Balance card** refined `GradientCard` with `PERIOD BALANCE` pill + closing `28` bold + `Income/Expense` tinted circles `trending-up`/`trending-down`; Settings segmented control toggles `balanceMode` (see §3.2). Weekly/yearly `getWeekBounds`/`getYearBounds` wired but blocked (`Weekly/yearly coming soon`).

### 3.9 Design System

| Token | Value |
|-------|-------|
| Colors | stone/amber warm palette — primary `#92400E`, background `#FFFBF5`, surface `#FEF3C7`, success `#065F46`, error `#991B1B`, chartAmber `#D97706`/`#F59E0B` dark, chartEmerald `#059669`/`#34D399` dark; full dark-mode variants in `constants/theme.ts` (`C.chartAmber`/`C.chartEmerald` via `useThemeColors()`, no hardcoded hex in `app/**/*.tsx`) |
| Typography | H1 28 bold, H2 20 semibold, Body 16, Caption 14, Small 12 |
| Spacing | XS 4 / SM 8 / MD 16 / LG 24 / XL 32 |
| Radius | SM 12 / MD 16 / LG 24 |
| Shadow | Card `0 2 8 rgba(0,0,0,0.04)`, Elevated `0 4 16 rgba(0,0,0,0.08)` |
| Components | Button (48px, full width, solid), Input (48px outlined), Card (gradient, 16px radius), Header, Skeleton (pulse loading placeholder) |
| Icons | Feather (UI, 24px) + Streamline Ultimate Color 998 via Iconify (CC BY 4.0, palette:true, 24×24) rendered as SVG via `react-native-svg` `SvgXml` for category icons (56 allowlist → `CATEGORY_STREAMLINE_MAP`, offline `streamlineIconData.json`) + AccountIcon 4 fixed (ACCOUNT_STREAMLINE_MAP: bank saving-bank-1, cash cash-payment-bill, ewallet wireless-payment-credit-card-dollar, credit_card credit-card-1, SvgXml offline same bundle, 44/32/40/28/24/20) + png legacy fallback |
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
  → validate account name uniqueness + openingBalance isSafeInteger
  → if openingBalance != 0, lookup reserved "Initial Balance" category by sign (income/expense)
    → if missing, throw "Initial Balance category not found." (no account inserted — atomic)
  → account inserted with balance = openingBalance, createdAt = updatedAt = now
  → if openingBalance != 0, insert "Initial balance" transaction server-side with same now
    (householdId, accountId, categoryId, amount=openingBalance, type by sign, createdBy)
    within the SAME atomic mutation — no ctx.runMutation
  → account appears with opening balance reflected
```

The opening-balance transaction is created internally by `accounts.create`
(against the reserved "Initial Balance" category matching the balance sign),
not by a separate client call, and **atomically** in one `ctx.db` transaction
with the account insert (same `now` timestamp for both rows). A zero opening
balance skips the transaction entirely. Verified by
`tests/accounts.atomicOpeningBalance.test.ts:1` (code invariant `no runMutation`,
balance equality, shared timestamp, no orphan on missing category).

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
  transactions" with `maximumDate={new Date()}` future greyed & disabled (enforced in `MonthPicker`, `DateField`, Search Date; future periods not selectable).
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
  → atomically auto-revoke ALL previous active invites within same mutation
    (collect by_householdId, patch revoked=true where !revoked && expiresAt > now && useCount < maxUses)
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

## 5. Architecture

### 5.1 System Diagram

```text
┌───────────────────────────────────────────────┐
│              MOBILE APP (Expo)                 │
│  Expo Router screens  •  Clerk (sign in/out)   │
│  PagerView (Home swipeable period)             │
│        └──────────┬───────────┘                │
│           ConvexProviderWithClerk               │
│           (real-time sync, live queries)        │
└───────────────────┬────────────────────────────┘
                    │
┌───────────────────▼────────────────────────────┐
│            CONVEX BACKEND                       │
│   Auth (Clerk JWT)  •  Queries  •  Mutations    │
│   Tables: users, households, periodBalances,    │
│   householdMemberships, invitations, accounts,  │
│   categories, transactions, budgets             │
└────────────────────────────────────────────────┘
```

### 5.2 Responsibilities

| Component | Responsibility |
|-----------|---------------|
| `app/_layout.tsx` | `SafeAreaProvider` + ThemeProvider, KeyboardProvider, ClerkProvider, ConvexProviderWithClerk, SnackbarProvider, `<OtaUpdater />` (background OTA `fetchUpdateAsync` only `ready` when `isNew`, `cancelled` guard) + `BrandedLoadingShell` (same bg/icon as native splash, optimistic progress, offline banner, `useSafeAreaInsets` not needed) — no `throw` on missing `EXPO_PUBLIC_*` (defensive `Configuration missing` screen, `hideAsync` after 500ms) + orchestrated auth gate (`preventAutoHideAsync`/`hideAsync` `setOptions fade 300`, `isLoaded`/`getActive` without login flash, fallback `hideAsync` after 3.5s when `isLoaded && isSignedIn && household===undefined`), `SafeAreaProvider` ensures `UpdateBanner` insets, root Stack |
| `app/index.tsx` | Signed-out entry (splash-icon 200×200 aligned with native splash + shell for seamless fade) |
| `app/(tabs)/home.tsx` | Swipeable dashboard (`react-native-pager-view` paging, 12 periods, `selectedPeriodStart` via `getPeriodBounds`/`buildPeriodWindow`, `<`/`>` + dots `formatPeriodLabel`, `pagerRef` + `hapticSuccess`): household card (`household.name + " Household"`, no member count), **Period Balance** (`GradientCard` refined: `PERIOD BALANCE` pill + closing `28` + `Income/Expense` tinted circles via `periodBalances.get` + `timezone`), budget pills per `selectedPeriodStart` (+ `periodEnd`), Analytics below Budgets — `DeltaCard` (closing delta) + `SpendingDonut` (selected period) (Cashflow removed from Home `e882171`); `BudgetPill` is `memo`, `PagerView` + `ScrollView` `RefreshControl` (`refreshKey`), stale derives from `balances === undefined` + `spendingRes === undefined` |
| `components/charts/*` | `DeltaCard` (GradientCard, `closingBalance` delta `currentClosing` vs `prevClosing` via `calcDelta`, `withSpring` scale, `Feather` trending icon, no chip), `SpendingDonut` (`react-native-svg` `Circle` `strokeDasharray` colored arcs, inner cutout, `FadeIn` + selectable highlight) — all `react-native-reanimated` + `Pressable` tooltip + `useThemeColors()`; `CashflowBarChart` retained in repo but not rendered in Home since `e882171` |
| `utils/periodTime.ts` (deep Period module) | Single deep `module` owning all wall-clock math. `interface`: `period(at,tz,type?) → Period {start,end,label,prev,next,contains}` + `window(now,tz,count,type?) → Window` + `validateTimezone`; convenience `currentPeriod(household)` / `adjacentPeriod(start,"prev"|"next",household)` / `sixMonthWindow(household)` over same `seam`. `implementation` hides `zonedParts`/`zonedOffsetMs`/`zonedWallToUtc` double-iteration DST fix, `getWeekBounds` Mon 00:00, `getYearBounds`, `formatPeriodLabel`, window loop. Replaces duplicated `utils/date.ts:62` ↔ `utils/period.ts:9` ↔ `convex/transactions.ts:543` copies and `utils/analytics.ts:3` `buildSixMonthWindow` vs `buildPeriodWindow:122` duplicate. In-process `module` — no `adapter` — shared by `app/(tabs)/home.tsx`, `reports.tsx`, `search.tsx` and `convex/periodBalances.ts`, `convex/transactions.ts` (Convex imports `utils/`). `utils/period.ts` + `utils/date.ts` wall helpers collapsed here; `legacy utils/period.ts` re-exports shim until migration completes. |
| `utils/analytics.ts` | `calcDelta(currentNet/CLOSING, prevNet/CLOSING)` (`null` when `prev 0` → "New this month"/"No change", else `+X.X% vs last month`), `maxBarValue(data)` — fed `periodBalances.closingBalance` for delta. `buildSixMonthWindow` deprecated — remains as re-export shim from `./periodTime` until call sites migrate to `window(...,6)` from `utils/periodTime.ts`. `calcDelta`/`maxBarValue` are `in-process` pure leaves; remain co-located with `DeltaCard`/`CashflowBarChart` or via `periodTime` shim |
| `convex/periodBalances.ts` | Snapshot module (`recomputeAllForHousehold`/`recomputeFromForHousehold`, `get`/`listWindow`/`verify`/`reconcile`/`recomputeAll`/`backfill` + internal, single `by_household_date` scan group+upsert, `fresh` vs `carryOver` `computeOpeningClosing`, O(1) read, `findUserAndMembership` + `requireOwner`) |
| `app/(tabs)/accounts.tsx` | Accounts list (filters, FAB, owner edit/delete); `FlatList` perf props (`removeClippedSubviews/windowSize/initialNumToRender`) |
| `app/(tabs)/transactions.tsx` | Transactions list (date + type/account/category filters, summary, day-grouped with net totals); `SectionList` perf props (`removeClippedSubviews/windowSize/initialNumToRender/maxToRenderPerBatch`) |
| `app/(tabs)/budgets.tsx` | Budgets list (month selector, progress); `FlatList` perf props |
| `app/(tabs)/settings.tsx` | Settings (Household + Balance Mode Owner-only segmented `Fresh`/`Carry Over` `BALANCE_MODE_OPTIONS` `updateBalanceMode` + `hapticSuccess`/`Snackbar`, Appearance, Categories, Sign Out) |
| `constants/validation.ts` | Shared validation (`validatePeriodType`/`validateBalanceMode`, `PERIOD_TYPES`/`BALANCE_MODES`, + existing) — client + server single source, `isSafeInteger` amount |
| `constants/timezones.ts` | `resolveTimezone` (fallback `getCalendars()[0].timeZone` via `expo-localization`), curated IANA list with offset hints |
| `app/onboarding.tsx` | Create/Join household |
| `app/members.tsx` | Members + rename + invite code generation/revoke |
| `app/account-form.tsx` / `category-form.tsx` / `transaction-form.tsx` / `budget-form.tsx` / `categories.tsx` | Feature CRUD screens; `transaction-form` now persists `lastTransaction` via `lib/last-transaction.ts` + duplicate check against `transactions.recent`; amount inputs are integer-only |
| `lib/last-transaction.ts` | Persisted "Repeat last" store: `getLastTransaction`/`setLastTransaction` via `expo-secure-store` (`last-transaction` key), type `LastTransaction {type, amount, accountId, toAccountId?, categoryId?}` |
| `components/` | Reusable UI (Button, Input, Card, Fab, EmptyState, Snackbar with optional action, Skeleton, ThemeProvider, TransactionCard, Chip, DateField, GradientCard, SelectField with search, ConnectivityBanner, BrandedLoadingShell, UpdateBanner (`useSafeAreaInsets.top` to avoid status-bar overlap with `edgeToEdgeEnabled: true`)) + non-UI controllers (OtaUpdater — `isNew` guard, `cancelled` guard) |
| `hooks/useDiscardGuard.ts` | Shared unsaved-changes guard: dirty flag in → `handleBack` + `markIntentional` out; owns the `usePreventRemove` registration and discard Alert used by all four forms |
| `hooks/useConnectivity.ts` | NetInfo wrapper: subscribes to `@react-native-community/netinfo`, exposes `isConnected` (boolean \| null) for instant offline detection |
| `components/Auth/*` | Auth dumb components: `EmailField`, `PasswordField`, `CodeField`, `GoogleButton`, `ResetFlow` |
| `hooks/useAuthFlow.ts` / `hooks/useResetFlow.ts` | Clerk logic: sign-in/up, verification/MFA, Google SSO, password reset; orchestrated by `app/index.tsx` |
| `components/Input.tsx` | `secureToggle` prop: eye/eye-off 48px button toggles `secureTextEntry` with accessible label; OTP fields use `oneTimeCode`/`sms-otp`; `amount` prop shows inline amber warning `wasDecimalTruncated` → "Decimals are ignored — whole numbers only" when a decimal is typed |
| `constants/theme.ts` | Theme tokens + `useThemeColors` / `useThemeGradients` |
| `lib/haptics.ts` | Safe haptics wrapper (`hapticSuccess`/`hapticWarning`/`hapticError` via `expo-haptics`) |
| `lib/errors.ts` | `getConvexErrorMessage` — user-friendly error extraction |
| `utils/format.ts` | `formatNumber`, `formatAmountInput` (integer-only, strips decimals/non-digits, thousand separators), `wasDecimalTruncated` / `detectAmountTruncation` (decimal warning), `sumNetExcludingTransfers` |
| `convex/schema.ts` | Database schema (source of truth) |
| `convex/helpers.ts` | Shared auth/scope helpers: `getUserAndMembership` (mutations, throws `ConvexError`), `findUserAndMembership` (queries, returns `{user, membership}` or `null`), `findUser` (user only, returns `null` when signed out), `requireOwner` (owner-gate check), `getScopedDoc` (fetch + household-scope guard that throws `"<Entity> not found."`) |
| `convex/transactionHelpers.ts` + `transactionQueries.ts` + `transactionAnalytics.ts` (deep Transactions query module, facade `convex/transactions.ts`) | Single deep `module` behind `seam` `ledger(householdId,{cursor,search,filters?})` / `cashflow(householdId,range?)` / `summary` / `spending` / `recent` (C facade over internal `query(spec)` discriminant A). `implementation` hides `pinnedRangeQuery:270`, cursor `date+_id` tie, `SCAN_BUDGET=limit*10` unification, hidden-visibility caches (`periodBalances.ts:84` `hiddenAccountCache`/`hiddenCategoryCache`) 6× → one (`transactionHelpers.ts:8`), `hydrate:74`/`matchesSearch:53`/`matchesFilters:40`, timezone `543-612` (now via `periodTime`), `recent:745` 60 LOC fork unified + `hasMore 889 vs 420` fix. Local-substitutable `module` — `convex-test` is the `adapter` (no explicit `TransactionStore` `port`; `now:()=>Date` injected for `cashflow` default month). `convex/transactions.ts:319/435/614/689/745` facade re-exports queries/analytics (api path `api.transactions.*` unchanged). |
| `modules/icon-registry` (deep Icon module) | Single deep `module` `Icon({ref,size})` + `listIconRefs()` + `IconPicker` behind one `seam`. `implementation` hides `CATEGORY_STREAMLINE_MAP` (`constants/streamlineIconMap.ts:7`) + `ACCOUNT_STREAMLINE_MAP` (`constants/accountIcons.ts:2`), dead `CATEGORY_ICON_MAP:12` 56 PNG `require` deleted, `streamlineIconData.json:1` 50KB lazy, duplicate `getStreamlineIconName:66`, shadow `CATEGORY_ICONS:8` in `TransactionCard.tsx:6`, `isAccountType` branch in `SelectField.tsx:65`. In-process `module` — no `adapter`. `components/CategoryIcon.tsx:6` + `AccountIcon.tsx:3` collapsed to one `Icon`. |
| `CONTEXT.md` | Domain language — Household, Period, PeriodBalance, Account, Category, Transaction, Budget, Icon, Search/Filter; `seam` names |
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

opening balance (accounts.create, P0-2):
  validated before insert; account.balance = openingBalance at insert,
  transaction inserted with same now/createdBy in same mutation — no runMutation
```

All operations within one mutation — atomic. The three code paths share two
helpers in `convex/transactions.ts` — `applyBalanceDelta` (safe per-account
patch, skips missing accounts) and `reverseBalances` (reverses a transaction's
effects) — so create/update/delete balance math cannot drift apart.
`accounts.create` opening balance follows the same atomicity guarantee
(`convex/accounts.ts:43`, verified by `tests/accounts.atomicOpeningBalance.test.ts:1`).

**Reconciliation:** `accounts.verify` / `accounts.reconcile` recompute expected balances from the full household transaction log (same signed logic + transfer `from -`/`to +`; caps at 10k txs) and patch drifted accounts — owner-only `reconcile`, read-only `verify` for any member (visible accounts filtered for Members, full for Owner). Exposed as amber banner + Recalculate in `app/(tabs)/accounts.tsx:41` (verified by `tests/accounts.reconcile.test.ts:1`).

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
- 7-day expiry, single-use, owner-revocable, **atomic auto-revoke on new code within the same mutation** (`convex/invitations.ts:40` — previous active invites patched `revoked=true` before new insert, so invariant "at most one active invite per household" holds without race; verified by `tests/invitations.autoRevoke.test.ts:1`).
- Atomic redemption; per-code rate limit (5 attempts / 60s).

### 5.6 Initial Balance Category Contract

Each household gets two reserved "Initial Balance" categories (income and
expense) at creation. The category name is the single shared constant
`RESERVED_CATEGORY_NAME` in `constants/categories.ts` — never a bare literal.
`accounts.create` with a non-zero opening balance posts a
transaction against the matching one **atomically**; it validates the category
**before** inserting the account and errors if it does not exist (no orphan
account), rather than creating it on the fly, and inserts both rows with the
same `now` timestamp in one mutation (`convex/accounts.ts:43`, no
`ctx.runMutation`; verified by `tests/accounts.atomicOpeningBalance.test.ts:1`).
These categories are protected:
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

### 5.8 Architecture Deepening (2026-09-04) — no UX break

Internal refactor only — no user-visible change. `interface` is the test surface.

| Candidate | Before (shallow/leaky) | After (deep) | `seam` | `adapter` | `leverage` / `locality` |
|-----------|------------------------|--------------|--------|-----------|--------------------------|
| **1 Period/Time** `utils/date.ts:62` · `utils/period.ts:9` · `convex/transactions.ts:543` · `utils/analytics.ts:3` | `zonedParts`/`zonedOffsetMs`/`zonedWallToUtc`/`getMonthBounds` copied 3×; `buildSixMonthWindow` vs `buildPeriodWindow` duplicate loop; `validatePeriodType` dup `constants/validation.ts:109` ↔ `utils/period.ts:139`; DST fix touches 3 sites — no `locality` | One deep `periodTime` `module` `period()`+`window()` (+ `currentPeriod`/`adjacentPeriod`/`sixMonthWindow` shims) hides DST double-iteration, week Mon-map, label branching | In-process — single `seam` at `period()`; Convex imports `utils/` (`periodBalances.ts:4` already does) | None — In-process always deepenable; `Intl` stays private (private `intl.ts` for `vi.mock`, not public `port`) | `leverage`: one `interface` for 5 call sites (`home.tsx:130`, `reports.tsx:14`, `search.tsx:40`, `periodBalances.ts:103`, `transactions:543`); `locality`: DST fix in one private `wallToUtc` |
| **2 Transactions query** `convex/transactions.ts:1-1105` god module | 9 exports, 3 pagination copies (`list:359` `SCAN_BUDGET`, `summary:464` `SUMMARY_BATCH_SIZE`, `recent:745` 60 LOC fork `hasMore` `889` vs `420` bug), 6 hidden-visibility caches (`list:345`, `summary:455`, `cashflow:654`), `hydrate:74`/`matchesSearch:53` drift | Deep `transactionHelpers.ts:8` + `transactionQueries.ts:1` (`query(spec)` A) + `transactionAnalytics.ts:1` (`cashflow`/`spendingByCategory`) facade `transactions.ts:1` hides `pinnedRangeQuery:270`, cursor `date+_id` tie, `SCAN_BUDGET` unification, hidden 6→1, `hydrate` | Local-substitutable — `convex-test` is the `adapter` (no explicit `TransactionStore` `port`) | `now:()=>Date` in-process clock for `cashflow` default month (only slice of D) | `leverage`: `ledger(householdId)` 1 arg for Home 30/page ledger (was 6 params); `locality`: `hasMore` fix once |
| **3 Icon registry** `constants/categoryIcons.ts:1` · `streamlineIconMap.ts:7` · `accountIcons.ts:2` · `CategoryIcon.tsx:6` vs `AccountIcon.tsx:3` · `SelectField.tsx:65` | 6 shallow `module`s `interface≈implementation`; dead `CATEGORY_ICON_MAP:12` 56 PNG requires (no consumer), duplicate `getStreamlineIconName:66`, `CATEGORY_ICONS:8` shadow Feather map, `isAccountType` leak into form primitive | One deep `modules/icon-registry` `Icon`+`listIconRefs`+`IconPicker` hides 56 Streamline map, account map, 50KB lazy, fallback chain; `SelectField.tsx:65` becomes `icon?:string` | In-process — single `seam` name→`SvgXml` | None | `leverage`: `category-form.tsx:216` 28-line grid → `<IconPicker>` 1 line; `locality`: icon mapping fix in one `module`; delete ~80 LOC + 56 dead requires |

**User experience:** zero break — same 5 tabs, same ledger 30/page, same Reports 12-period `PagerView`, same `TransactionCard` `Category • Account` no time, same search 14d default; gains are correctness (period bucket never off-by-1 at DST, hidden visibility consistent, `hasMore` truthful) and performance (bundle −56 requires, `period` single scan, lazy 50KB). Verified via `npx convex codegen && npx tsc --noEmit && npm test` + `convex-test` at deep `interface` (replace-don't-layer). Domain terms in `CONTEXT.md`.

### 5.9 CI/CD & Development Workflow

**Branches & channels:** `review` → `development` (internal APK, `eas.json:development` `developmentClient:true`, `channel:development`, `APP_VARIANT=development`), `main` → `production` (APK internal via `release.yml`). Feature branches `feat/*` are short-lived.

**Development workflow (`.github/workflows/development.yml`):** `workflow_dispatch` only — full manual (no fingerprint; fingerprint lokal vs EAS selalu beda karena env mismatch, jadi gate manual lebih jujur). 2 inputs: `run_build` (default `false` — build APK native) + `publish_update` (default `false` — OTA JS). `concurrency: group: development-review, cancel-in-progress: false` (queue). JS-only cukup `expo start`, hemat MAU; OTA ideal tetap jalan jika butuh share ke dev build tanpa kabel (EAS Update `how-it-works`).

1. `check` (`needs: —`): `npm ci` → `npx tsc --noEmit` + `npm run lint` (Node 22, `actions/checkout@v4` `persist-credentials:false`, `actions/setup-node@v4` cache npm).
2. `build` (`needs: check`, `if: inputs.run_build == true`): `expo/expo-github-action@v8` (`eas-version: latest`, `EXPO_TOKEN`), `npm ci`, `eas build --platform android --profile development --non-interactive --no-wait` dengan `EXPO_TOKEN` + `EXPO_PUBLIC_CONVEX_URL`/`EXPO_PUBLIC_CONVEX_SITE_URL`/`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Jika `run_build==false` → skip (JS-only).
3. `publish-update` (`needs: [check, build]`, `if: always() && publish_update && check==success && build!=failure`): `eas update --channel development --message "Dev update from ${{ github.sha }}" --auto` (secrets `EXPO_PUBLIC_*`). Sesuai `how-it-works` — `channel development` auto-link ke branch `development`, `runtimeVersion` `appVersion` harus sama.

Preview native via dev build `com.kinfinance.app.dev` + `expo start`; `branch development` optional (hanya jika butuh share tanpa laptop). File disync ke `main` agar `Run workflow` muncul dari default branch (GitHub requirement).

**PR gate (`.github/workflows/pr-check.yml`, opsi A):** `on: pull_request: branches: [review]` + `merge_group` — lightweight `check` (`tsc`/`lint`/`vitest run`) tanpa EAS/secrets, `concurrency: pr-check-${{ github.ref }}` `cancel-in-progress: true` untuk fast feedback sebelum merge ke `review`.

**Release workflow (`.github/workflows/release.yml`):** `workflow_dispatch` only, `concurrency: group: release`. 3 inputs: `run_build` (default `false` — build APK baru, pakai kuota), `deploy_convex` (default `true`), `publish_update` (default `true`).

1. `check`: `tsc` + `lint` (sama seperti development).
2. `convex-deploy` (`needs: check`, `if: deploy_convex`): `npx convex deploy` dengan `CONVEX_DEPLOY_KEY`.
3. `build-apk` (`needs: check`, `if: run_build`): `eas build --platform android --profile production --non-interactive` (secrets `EXPO_PUBLIC_*`).
4. `publish-update` (`needs: [build-apk, convex-deploy]`, `if: always() && publish_update && !cancelled() && convex-deploy != failure && build-apk != failure`): `eas update --channel production --message "Release from ${{ github.sha }}" --auto`.

Source of truth for CI is `.github/workflows/development.yml` + `release.yml` (GitHub Actions — chosen over EAS Workflows for `check` visibility, `jq` fingerprint diff, and reuse of `secrets.EXPO_TOKEN`; EAS Workflows would duplicate quota with less log control).

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
periodType: "monthly" | "weekly" | "yearly" | undefined  // default monthly; weekly/yearly coming soon (B)
balanceMode: "fresh" | "carryOver" | undefined  // default fresh; fresh isolated, carryOver cumulative
createdAt: number
updatedAt: number
```

### `periodBalances` (as of 2026-08-31)

```text
householdId: id<households>
periodType: "monthly" | "weekly" | "yearly"
periodStart: number      // epoch ms, tz-aware start (monthly: 1st 00:00 tz, weekly: Mon 00:00 tz, yearly: Jan 1 00:00 tz)
periodEnd: number        // exclusive end (getPeriodBounds)
income: number           // sum income per period (transfers excluded)
expense: number          // sum expense |amount| per period
openingBalance: number   // fresh 0, carryOver = prev closing
closingBalance: number   // fresh net, carryOver opening+net
createdAt: number
updatedAt: number
```
**Indexes:** `by_household_period` on `["householdId", "periodType", "periodStart"]` (upsert lookup), `by_household_type` on `["householdId", "periodType"]` (window scan)

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
| `households` | `updateBalanceMode` | mutation | Owner only; `balanceMode fresh\|carryOver` (`validateBalanceMode`), patches household + `recomputeAllForHousehold` |
| `households` | `updatePeriodType` | mutation | Owner only; `periodType monthly\|weekly\|yearly` (`validatePeriodType`); `weekly`/`yearly` throws `Weekly/yearly coming soon` (B); patches + recompute |
| `periodBalances` | `get` | query | Snapshot by `periodStart`+`periodType` (`by_household_period`) |
| `periodBalances` | `listWindow` | query | Window `{startDate,endDate,periodType?}` → `{balances,isOwner}` filtered `periodStart>=startDate && <endDate` sorted |
| `periodBalances` | `verify` | query | Diff stored vs expected (`fresh`/`carryOver` cascade), returns `{discrepancies,isOwner}` |
| `periodBalances` | `reconcile` | mutation | Owner only; `recomputeAllForHousehold` + return `{fixed}` |
| `periodBalances` | `recomputeAll` | mutation | Owner only; full cascade |
| `periodBalances` | `backfill` | mutation | Owner only; full cascade from `createdAt` |
| `periodBalances` | `recomputeFrom` | mutation | Owner only; `fromDate` → full cascade (carryOver correctness) |
| `invitations` | `create` | mutation | Generate code (owner), auto-revokes previous |
| `invitations` | `revoke` | mutation | Owner only |
| `invitations` | `redeem` | mutation | Atomic join; rate limited |
| `invitations` | `listActive` | query | Active invites; owner only |
| `accounts` | `list` | query | Visibility-filtered accounts + `isOwner` |
| `accounts` | `create` | mutation | Owner; optional opening balance |
| `accounts` | `update` | mutation | Owner; name/type/hidden |
| `accounts` | `remove` | mutation | Owner; guarded by referencing transactions |
| `accounts` | `verify` | query | Owner-visible read-only diff `{discrepancies, totalStored, totalExpected, isOwner}`; recomputes expected balances from tx log (10k cap); returns `null` when not member |
| `accounts` | `reconcile` | mutation | **Owner only**; recomputes expected balances and patches drifted accounts (`balance: expected`, `updatedAt: now`); returns `{fixed, discrepancies}`; 10k cap |
| `categories` | `list` | query | Filtered, excludes reserved categories |
| `categories` | `create` | mutation | Owner |
| `categories` | `update` | mutation | Owner; type change guarded |
| `categories` | `remove` | mutation | Owner; guarded by references |
| `transactions` | `create` | mutation | Validates sign/type/category/transfer |
| `transactions` | `update` | mutation | Reverse old + apply new balances |
| `transactions` | `remove` | mutation | Reverse balances |
| `transactions` | `list` | query | Date-range + optional `accountIds`/`categoryIds`/`type`/`search` (≥2 chars, note + amount + account/category substring via `matchesSearch` after hydration) filtered (index-driven + post-index search); optional `limit` (default/max 1 000) per page; optional `cursor` continuation; returns `cursor`/`hasMore`; cached hydration |
| `transactions` | `summary` | query | Range totals `{income, expense, net}`; same filters as `list` including `search`; transfers excluded; uncapped walk; hidden-category aware for Members (search checks `note` + amount + cached `account`/`category` names) |
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
| Pager | `react-native-pager-view` (Home swipeable period, paging, dots, `<`/`>` chevrons) |
| Charts / SVG | `react-native-svg` 15.12.1 (`SpendingDonut` donut arcs via `Circle` `strokeDasharray` + `CategoryIcon` `SvgXml` for Streamline vector icons; included in Expo Go 54) |
| Keyboard handling | `react-native-keyboard-controller` (`KeyboardProvider` global + `KeyboardAwareScrollView` on input screens) |
| Language | TypeScript 5.9 |
| Persistence (device) | `expo-secure-store` (theme preference, last-transaction `last-transaction` key via `lib/last-transaction.ts`) |
| OTA updates | `expo-updates` 29 (EAS Update, `checkAutomatically: ON_ERROR_RECOVERY` + background check via `components/OtaUpdater.tsx`) |
| Date picker | `@react-native-community/datetimepicker` |
| Device locale / timezone | `expo-localization` (`getCalendars()[0].timeZone`) |
| Clipboard / Share / Haptics | `expo-clipboard`, native share sheet, `expo-haptics` |
| Icons | `@expo/vector-icons` Feather (UI) + Streamline Ultimate Color via Iconify (`icon-sets.iconify.design/streamline-ultimate-color`, CC BY 4.0, 998 icons, `react-native-svg` `SvgXml` offline via `constants/streamlineIconData.json` + `components/CategoryIcon.tsx` + `components/AccountIcon.tsx` 4 fixed: ACCOUNT_STREAMLINE_MAP bank saving-bank-1, cash cash-payment-bill, ewallet wireless-payment-credit-card-dollar, credit_card credit-card-1, shares same bundle, SvgXml 24x24 palette:true — AccountIcon 44/32/40/28/24/20) |

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
| 2026-09-04 | Refactor | **Architecture deepening Period/Time · Transactions query · Icon registry — no UX break** — **1 Period/Time** `utils/periodTime.ts:1` deep `period()`+`window()` (+ `currentPeriod`/`adjacentPeriod`/`sixMonthWindow` shims) collapses `utils/date.ts:62` ↔ `utils/period.ts:9` ↔ `convex/transactions.ts:543` zoned copies + `utils/analytics.ts:3` `buildSixMonthWindow` vs `buildPeriodWindow:122` duplicate + `constants/validation.ts:109` vs `utils/period.ts:139` `validatePeriodType` dup; In-process single `seam` (no `adapter`, Convex imports `utils/`), DST double-iteration `locality` in one `wallToUtc`, `leverage` one `interface` for 5 call sites. **2 Transactions query** `convex/transactionHelpers.ts:1`+`transactionQueries.ts:1`+`transactionAnalytics.ts:1` deep (facade `convex/transactions.ts:1` preserves `api.transactions.*`) — `ledger`/`cashflow` facade over internal `query(spec)` hides `pinnedRangeQuery:270`, cursor `date+_id`, `SCAN_BUDGET` unification, 6 hidden caches `list:345`/`summary:455`/`cashflow:654` → one, `hydrate:74`/`matchesSearch:53`, `recent:745` 60 LOC fork + `hasMore 889 vs 420` fix; Local-substitutable (`convex-test` `adapter`, `now:()=>Date` only slice of ports & adapters), full split 1105 LOC → ~370 facade + 3 deep modules. **3 Icon registry** `modules/icon-registry:1` deep `Icon`+`listIconRefs`+`IconPicker` hides `CATEGORY_STREAMLINE_MAP`+`ACCOUNT_STREAMLINE_MAP`, dead `CATEGORY_ICON_MAP:12` 56 PNG requires deleted, `streamlineIconData.json:1` 50KB lazy, duplicate `getStreamlineIconName:66`, shadow `CATEGORY_ICONS:8`, `SelectField.tsx:65` `isAccountType` leak; In-process single `seam`. Zero UX break (same 5 tabs, 30/page ledger, 12-period `PagerView`, `Category • Account` no time, 14d search); gains correctness/performance (period bucket DST, hidden visibility, `hasMore` truthful, bundle −56 requires). `CONTEXT.md:1` added (Household/Period/PeriodBalance/Icon seams). Verified `npx convex codegen && npx tsc --noEmit && npm test` 154/154 + `npm run lint` (replace-don't-layer). Updates §5.2/§5.8/§8 + `CONTEXT.md`. |
| 2026-09-04 | Feature | **Household delete/leave/transfer** — `convex/households.ts` adds `deleteHousehold` (owner cascade `transactions→budgets→periodBalances→accounts→categories→invitations→householdMemberships→households`), `leaveHousehold` (member remove own membership only, owner blocked), `transferOwnership` (owner swaps `owner↔member` roles, validates target member) + `cascadeDelete` helper; UI Danger Zone in `app/(tabs)/settings.tsx` + `app/members.tsx` (`Shadow.card` `border #FCA5A5` `alert-triangle` `C.error`, role-aware `Delete Household` vs `Leave Household` `variant danger` + transfer picker Alert list, double confirm for delete, `hapticSuccess`/`hapticError` + `Snackbar` + `router.replace("/onboarding")`); `tests/households.deleteLeaveTransfer.test.ts` 8 cases. Updates §2.1/§2.3/§3.2/§8 |
| 2026-09-04 | Feature | **Account fixed icons Streamline** — `constants/accountIcons.ts` (`ACCOUNT_STREAMLINE_MAP` bank saving-bank-1, cash cash-payment-bill, ewallet wireless-payment-credit-card-dollar, credit_card credit-card-1, `getAccountIconName` fallback saving-bank-1, `isAccountType`) + `constants/streamlineIconData.json` 2 bodies extended + `components/AccountIcon.tsx` (`SvgXml` offline, `getAccountIconXml`) + migrasi `AccountCard` 44/32, Home 40/28, `SelectField` 24, `account-form` 20 from Feather tinted circles to vector neutral `C.surface`; derive at render (no DB field) — same as Task 1-4 — Updates §2.1/§3.4/§3.9/§7/§8 |
| 2026-09-04 | Feature | **Category icons → Streamline Ultimate Color via Iconify (CC BY 4.0)**: `constants/streamlineIconMap.ts` (`CATEGORY_STREAMLINE_MAP` 56→ Iconify names, `getStreamlineIconName`) + `constants/streamlineIconData.json` (55 SVGs offline bundle via `https://api.iconify.design/streamline-ultimate-color.json?icons=...`, 24×24 palette:true) + `components/CategoryIcon.tsx` (`SvgXml` `width/height` `viewBox 0 0 24 24`, fallback `tags-1`), migrasi `CategoryCard` (44/32), `TransactionCard` (40/28), `category-form` grid, `BudgetCard` (24), `SelectField` (24), `budget-form` dari `expo-image` PNG `getCategoryIconSource`/`CATEGORY_ICON_MAP` ke vector SVG; DB allowlist tetap 56 (`isValidCategoryIcon`), PNG `assets/icons` + `getCategoryIconSource` dipertahankan sebagai legacy fallback. Verifikasi CC BY 4.0 free (998 icons, commercial allowed, attribution required) via `https://icon-sets.iconify.design/streamline-ultimate-color/` + `api.iconify.design/collection?prefix=streamline-ultimate-color` + Context7 `/iconify/icon-sets` (Licences: free/open-source). Updates §1 Brand/Constraints, §2.1/2.2 Category icon, §3.5 Categories, §3.9 Icons, §7 Tech Stack, §8. |
| 2026-09-03 | Feature | **Category custom icons (56 PNG)**: `constants/categoryIconNames.ts` (allowlist 56, `isValidCategoryIcon`, `DEFAULT other`) + `constants/categoryIcons.ts` (`CATEGORY_ICON_MAP` 56 static `require` with try-catch Node fallback, `getCategoryIconSource` → `other.png` for legacy/undefined), `convex/schema.ts:60` `icon?: string` + `convex/categories.ts` validate allowlist on `create`/`update`, `components/CategoryCard.tsx` `icon?: string` PNG 32px/44px, `components/TransactionCard.tsx` `categoryIcon?: string` PNG 28px/40px with transfer arrow preserved, `app/category-form.tsx` 4-col grid picker 56×56 (selected 2px `C.primary`) + `icon` state/default `other` + dirty/submit, `components/SelectField.tsx` `icon?: string` 24px + `app/transaction-form.tsx`/`budget-form.tsx` category options with icon, `components/BudgetCard.tsx` `categoryIcon` 24px + `convex/budgets.ts` adds `icon` to `category` returns, `app/(tabs)/home.tsx`/`app/search.tsx` pass `categoryIcon`, `app/categories.tsx` pass `icon`, `tests/categories.icons.test.ts` 4/4. Updates §2.1 Categories, §2.2 Category icon, §3.5 Categories, §8. |
| 2026-09-03 | Fix | **Review fixes (Home, MonthPicker, Reports, Search)**: `app/(tabs)/home.tsx:704` PERIOD BALANCE `balances === null → No data for this period` (align PRD §3.8, `tests/home-period.manual.md:31`) + remove redundant stale `useEffect` (keep comprehensive `household/accountData/balances/monthBudgets/result` with offline + timer), `components/MonthPicker.tsx:108` add `dark:bg-surface-dark` to year nav `bg-surface` buttons, `app/(tabs)/reports.tsx:23` add `nowTick/setNowTick` + `currentPeriodBounds` rollover timer `MAX_TIMEOUT 2147483647-1000` (matching Home) + `pagerPeriods/isNextDisabled/handleNext` use refreshed `currentPeriodBounds.start` so `selectedPeriodStart` stays in window, remove inactive `Filter` dummy header, `components/reports/CategoryRankingCard.tsx:27` sort `sorted = [...segments].sort((a,b)=>b.amount-a.amount)` before `visible` + remove dummy `Top level category` pill, `components/reports/BillRankingCard.tsx:17` sort `[...segments].sort(...).slice(0,10)`, `app/search.tsx:198` swap earlier/later dates via `getDayBounds` preserving both selections (keep sheet open). Updates §3.11, §3.12, §3.8. |
| 2026-09-03 | Feature | **Opsi B Home full ledger + Reports + Global Search (MonthPicker Jan-Dec future disabled, Expenses toggle, Date 14d, row no time)**: `components/MonthPicker.tsx` shared modal Jan-Dec (`MONTH_LABELS` Jan–Dec, `isFutureMonth` via `zonedMonthStart` vs `getPeriodBounds` `monthly` cur start, future `opacity 0.4` disabled, Year nav + `Week/Month/Year` tabs), `components/TransactionCard.tsx` add `accountName` prop → subtitle `Category • Account` (transfer `Account → ToAccount`) remove `formatTimeTz` line (row no time), `app/(tabs)/home.tsx` replace Recent 5 + See All with full `SectionList` 30/page period-bound (`selectedPeriodStart..periodEnd`, daily groups + day total, Today card `No record for today` + `+`, deduped cursor `pagesMapRef`) + `MonthPicker` header `▼` + Search+Filter period-bound (rounded bar + `Filter · N`), `components/reports/CategoryRankingCard.tsx` + `BillRankingCard.tsx` + `app/(tabs)/reports.tsx` swipable 12 past+now `PagerView` per `buildPeriodWindow` + `MonthPicker` Jan-Dec + `Expenses↔Income` toggle + 5 top + `show-more` (`chevron-down/up`) + Bill TOP10 + `DeltaCard`, `app/search.tsx` global cross-period `Date` first chip default 14d (`20 Aug–3 Sep` hint `Showing {dateLabel} • tap Date to change`, `getDayBounds` `maximumDate today` future greyed & disabled in `DateField` + `MonthPicker` + Search Date, `FilterSheet`, `FlatList` 30/page), `app/(tabs)/_layout.tsx` 5 tabs `Home\|Reports\|Accounts\|Budgets\|Settings` + `transactions.tsx` redirect to `/search`. Updates §1 Constraints, §2.1 Transactions+Search, §2.2 `maximumDate today`, §3.8 Home, new §3.11 Reports, §3.12 Search, §4.4 `maximumDate today` future greyed disabled, §8. |
| 2026-09-02 | Docs | **CI/CD dev EAS Update OTA (how-it-works)**: `development.yml:7` tambah input `publish_update` (default `false`) + job `publish-update` (`needs: [check,build]` `always() && publish_update && check==success && build!=failure` → `eas update --channel development --auto --message "Dev update from ${{ github.sha }}"` dengan `EXPO_PUBLIC_*`) — sesuai `how-it-works` channel↔branch auto-link + runtimeVersion `appVersion`; OTA ideal tetap jalan walau ada build (JS-only share tanpa kabel). Update `PRD.md:679` §5.9 + header. |
| 2026-09-02 | Docs | **CI/CD full manual + PR check (opsi A)**: `docs/Product Requirement Document/PRD.md:679` §5.9 hapus fingerprint (selalu beda env mismatch) → `development.yml:5` full manual `workflow_dispatch` `run_build` + `check` (`tsc`/`lint`) → `build` (`if: run_build` → `eas build --profile development`), JS-only `expo start` cukup; tambah `pr-check.yml:5` `pull_request: [review]` + `merge_group` lightweight `check` (`tsc`/`lint`/`vitest run`) `cancel-in-progress: true`; sync `development.yml`+`pr-check.yml` ke `main` agar `Run workflow` muncul dari default branch (GitHub requirement). Prev docs sync fingerprinted workflow superseded. |
| 2026-09-02 | Docs | **CI/CD docs sync — manual trigger only**: `docs/Product Requirement Document/PRD.md:679` sync §5.9 to live workflows — `development.yml:5` `on: workflow_dispatch` only (hapus `on.push:[review]`/`on.pull_request` + `paths` filter, manual `run_build` default false, `concurrency: development-review` queue), `check` (`tsc`/`lint` Node 22), `fingerprint` (`fingerprint:generate` awk strip prefix + `jq .hash` → `current_hash`, `build:list --limit 1 --status finished` retry 3× + `actions/cache` `/tmp/fp-cache` fallback, `fingerprint:compare` debug, `need_build` logic `[]→true` / `current!=last→true` / else `false`), `build` (`if: inputs.run_build==true` → `eas build --profile development --no-wait` dengan `EXPO_PUBLIC_*`); `release.yml:4` `workflow_dispatch` 3 inputs (`run_build` false / `deploy_convex` true / `publish_update` true, `concurrency: release`), `check` → `convex-deploy` (`npx convex deploy` `CONVEX_DEPLOY_KEY`) + `build-apk` (`eas build --profile production`) → `publish-update` (`always() && publish_update`, `eas update --channel production --auto`); update `Last updated` header. Source of truth `.github/workflows/*.yml` verified. |
| 2026-09-01 | Polish | **Accounts FAB label**: `app/(tabs)/accounts.tsx:319` add `label="Add Account"` to `Fab` (pill with plus + text, `components/Fab.tsx:34` labeled variant) to match `transactions` `Fab label="Add Transaction"`; owner-only. PRD §3.4. |
| 2026-09-01 | Polish | **Home household card — name + Household, remove member count**: `app/(tabs)/home.tsx:453` change `{household.name}` → `{household.name} Household` and remove `members` query + badge (`Feather users` + `memberLabel` "N members", `C.surface` pill); household card now centered name + " Household" only. PRD §3.8, §5.2. |
| 2026-09-01 | Feature | **CI/CD development workflow**: add `.github/workflows/development.yml` — `on.pull_request.branches:[review]` + `on.push.branches:[review]` (+ `workflow_dispatch`), `check` (`tsc`/`lint`), `fingerprint` (`eas fingerprint:generate --environment development` vs `eas build:list --status finished` + `fingerprint:compare`, `need_build` via `jq` + `awk` JSON extract for stdout prefix), `build` (`eas build --profile development`) when native changed else `update` (`eas update --channel development`); GitHub Actions chosen over EAS Workflows (log diff, reuse `secrets.EXPO_TOKEN`). Document in §5.8 (PR feat→review → fingerprint guard → update/build → manual test via dev-client Extensions/QR → merge) + §8. |
| 2026-09-01 | Fix | **CodeRabbit review batch (4 major + 2 minor)**: `convex/periodBalances.ts:48` add `hiddenAccountCache` alongside `hiddenCategoryCache` — member `buildExpectedMap` now skips `account.hidden` before `category.hidden` (prevents member leak on hidden accounts, review major 52-60); `periodBalances.ts:10-35` introduce `validateTimezone` + `resolveEffectiveTimezone(household.timezone, args.timezone)` in `get`/`listWindow` and persist concrete IANA at `households.create` (`getCalendars()[0].timeZone ?? "UTC"`) so stored `periodStart` keys (`getPeriodBounds`) match requested keys (review major timezone 17); `app/(tabs)/home.tsx:147` period timer now deps `[currentPeriodBounds.end, nowTick]` re-arms capped `MAX_TIMEOUT` via `nowTick` updates until actual boundary (review major 153-155); `home.tsx:363` add `isPrevDisabled` (`selectedPeriodStart <= pagerPeriods[0].periodStart`) + guard `handlePrev` and `disabled`/`opacity 0.4` on Previous chevron (review major 541 — prevents selecting outside 12-period `buildPeriodWindow` window); `docs/superpowers/specs/2026-08-31-period-handling-design.md:129` `balanceMode ?? "carryOver"` → `?? "fresh"` to match `households.balanceMode` default + `periodBalances` fallback; `tests/home-period.manual.md:17` relax `+` prefix requirement for period net text while retaining closingBalance match. Updates §3.8, §3.10, verification `npx tsc --noEmit` + `npm run lint` + `npm test` + `coderabbit review --agent` clean. |
| 2026-08-31 | Fix | **CarryOver opening from predating history (beyond 2y bound)**: `convex/periodBalances.ts:76-77` `buildExpectedMap` now computes `totalBefore = sum net where pStart < firstStart` for `carryOver` and `computeOpeningClosing` seeds `prevClosing = totalBefore`, so transactions predating 12-month/2y window still seed opening balance while snapshots remain bounded to retained window; preserves prior history. Updates §3.10. |
| 2026-08-31 | Fix | **Review batch — bounded scan + member leak + pager/timer/DeltaCard**: `convex/periodBalances.ts:43` explicit bounded `take(10001)` with `ConvexError` when `>10000` (replaces unbounded `collect`); `periodBalances.ts:259` non-owner absent `compM` → `null` not `snap` (prevents owner unfiltered leak, preserves owner snap + member-scoped when present); `app/(tabs)/home.tsx:153` rollover timer capped `MAX_TIMEOUT 2147483647-1000` re-armed, `523` `setPageWithoutAnimation` sync, `533` `offscreenPageLimit={1}` + per-page `isSelected` placeholder (`collapsable={false}`); `app/(tabs)/settings.tsx:198` inactive tab `transparent` → `C.background`; `components/charts/DeltaCard.tsx:24` + `utils/analytics.ts:21` `calcDelta` now `periodNoun` (`week`/`month`/`year`) via `periodType`; `convex/periodBalances.ts:21` hardcoded `Asia/Jakarta` → `UTC` canonical + `timezone` param, `140` delete obsolete snapshots, `225` member visibility-scoped via `hiddenCache`. Verified `tcs 0`, `131/131`. |
| 2026-08-31 | Fix | **Period Balance refined + cashflow removal + history & timezone fix**: `app/(tabs)/home.tsx` Period Balance card refined — generic bordered boxes (`AI slop`) → `GradientCard` with `PERIOD BALANCE` pill (`${C.primary}10`) + closing `28` bold tracking-tight + `currentLabel • Opening` + divider + `Income/Expense` tinted 36px circles `Feather trending-up/down` (`${C.success}14`/`error14`) + tracking-widest labels; removed `CashflowBarChart` from Home (`e882171`) — deleted `analyticsWindow`/`cashflowRes`/`cashflowData` + import/JSX + stale `cashflowRes`, analytics now `DeltaCard` + `SpendingDonut` only (backend `transactions.cashflow` retained but not rendered); fixed `convex/periodBalances.ts` timezone mismatch (Home `Asia/Jakarta` vs server `UTC` 7h → `1785488400000` vs `1785542400000` miss) by adding `timezone` param to `get`/`listWindow` and default `Asia/Jakarta` when `household.timezone` missing (`1f1ebb3`), plus fallback on-the-fly for empty snapshots; fixed history before household creation (`49e96ee`) — removed `gte household.createdAt` filter so Aug household input Juli for analysis now counted and extended ordered to `earliestTxStart` + 12 months back so swipe to previous period shows actual (was 0). Deployed `npx convex dev --once`. Updates §2.1 (Home/Analytics), §3.8, §3.10, §5.2, §8. |
| 2026-08-31 | Feature | **Period handling — swipeable Home, household periodType/balanceMode, periodBalances snapshot (fresh/carryOver), extensible to weekly/yearly (B)**: `convex/schema.ts` adds `households.periodType` (`monthly`/`weekly`/`yearly` opt, default `monthly`) + `balanceMode` (`fresh`/`carryOver` opt, default `fresh`) and new table `periodBalances` (`householdId`, `periodType`, `periodStart`/`periodEnd`, `income`/`expense`/`openingBalance`/`closingBalance`, indexes `by_household_period` + `by_household_type`); `constants/validation.ts` adds `PERIOD_TYPES`/`BALANCE_MODES` + `validatePeriodType`/`validateBalanceMode` (`utils/period.ts` mirrors types + `getPeriodBounds` switch `monthly`/`weekly` Monday 00:00 /`yearly` Jan1 00:00, `getPrevPeriod`/`getNextPeriod`/`formatPeriodLabel`/`buildPeriodWindow`, `zonedParts`/`zonedWallToUtc` copy from `utils/date.ts`, tests `tests/period.test.ts:1` 5/5); `convex/periodBalances.ts:1` new module `recomputeAllForHousehold` (single `by_household_date` `gte createdAt lt now` `take 10001` cap, group `getPeriodBounds`, ordered `firstStart..currentStart` `getNextPeriod` guard 500, `fresh` `0/net` vs `carryOver` cascade) + `get`/`listWindow`/`verify`/`reconcile`/`recomputeAll`/`backfill`/`recomputeFromInternal` (`findUserAndMembership`/`requireOwner`, tests `tests/periodBalances.test.ts:1` fresh vs carryOver + owner gate); `convex/households.ts:226` `updateBalanceMode`/`updatePeriodType` owner-only (validate + patch + recompute, `weekly`/`yearly` `Weekly/yearly coming soon`); `convex/transactions.ts` + `convex/accounts.ts` trigger `recomputeFrom` after create/update/delete; `app/(tabs)/home.tsx:1` refactor to `PagerView` swipeable (`selectedPeriodStart`, `periodEnd`, `prevPeriodStart`, `analyticsWindow`, `pagerPeriods` 12, `pagerRef` `selectedIndex` dots, `<`/`>` chevrons `useState pressed` + `Shadow.card` `Radius.md`, `balances`/`prevBalances` via `periodBalances.get`, `monthBudgets` per period, `cashflowRes` via `periodBalances.listWindow` O(1), `spendingRes` per period, `recent` per period; `DeltaCard` now `currentClosing`/`prevClosing` (`closingBalance` delta, `balanceMode` aware), `CashflowBarChart` data from `listWindow`); `app/(tabs)/settings.tsx:26` `Balance Mode` segmented Owner-only `Fresh`/`Carry Over` (`hapticSuccess`+`Snackbar`, Member read-only badge+`Feather info`); `react-native-pager-view` installed via `npx expo install`; `npx convex codegen` + `npx tsc --noEmit` + `npm run lint` + `npm test` (vitest) all PASS. Updates §2.1 (Household + Period Balances), §2.2, §2.3, §3.2, §3.8 (swipeable), §3.10 new, §5.2, §6, §7, §8. |
| 2026-08-30 | Fix | **detectAmountTruncation equal-length + grouping/leading-zero normalization**: `utils/format.ts:22` `detectAmountTruncation` previously required `raw.length !== formatted.length` + `raw.replace(/,/g,"") !== formatted.replace(/,/g,"")`, so equal-length truncation like `raw="12a34"` (5) → `formatted="1,234"` (5) was missed. Fix: normalize both values by stripping grouping commas and leading zeros (`replace(/,/g,"").replace(/^0+(?=\d)/,"")`) then compare; also normalize digit strings with leading-zero strip for `rawDigits`/`formattedDigits` check. Preserves `decimal` / `nonDigit` reasons. Verified `npx tsc --noEmit` (0), `vitest` 120/120 (`tests/format.decimalHint.test.ts:1` 4/4). |
| 2026-08-30 | Feature | **P0-1 Balance reconciliation + P0-2 Extended search + P0-3 Decimal hint — 3 polishes**: **P0-1**: `convex/accounts.ts:211` added `verify` (query, `findUserAndMembership` → null if not member, recomputes expected balances from `transactions` `by_householdId` up to 10k, `computeExpectedBalances` helper handling income/expense signed + transfer `from -`/`to +`, returns `{discrepancies, totalStored, totalExpected, isOwner}` filtered visible for Members) + `reconcile` (mutation, `requireOwner`, same compute, patches drifted `balance: expected` with `updatedAt: now`, returns `{fixed, discrepancies}`); UI `app/(tabs)/accounts.tsx:34` amber `Shadow.card` banner `Feather alert-triangle` "N account(s) out of sync" + Recalculate `Pressable` `Confirm Alert` → `reconcile` → Snackbar + haptics, owner-only visible. Tests `tests/accounts.reconcile.test.ts:1` (6/6). **P0-2**: `convex/transactions.ts:39` extended search — new `matchesSearch(row, search, hydrated)` checking `note` + absolute `amount` string (digits stripped of commas, `Math.abs`) + `account.name` + `toAccount.name` + `category.name` lowercased; `list` now hydrates before search; `summary` uses `accountNameCache`/`categoryNameCache`/`toAccountNameCache` + `hiddenCategoryCache`; placeholder `app/(tabs)/transactions.tsx:391` → "Search notes, amounts, accounts, categories…". Tests `tests/transactions.search.test.ts:1` still 5/5 + extSearch amount/account/category 1/1. **P0-3**: `utils/format.ts:18` added `wasDecimalTruncated`/`detectAmountTruncation`; `components/Input.tsx:29` `amount` mode tracks `decimalWarning` via `wasDecimalTruncated(raw)` and shows amber `C.chartAmber` text "Decimals are ignored — whole numbers only." (error takes priority). Tests `tests/format.decimalHint.test.ts:1` (4/4). Updates §2.1, §2.2, §3.4, §3.6, §5.3, §6, §7. |
| 2026-08-30 | Fix | **Search explicit commit (button)**: `app/(tabs)/transactions.tsx:124` removed 300ms `useEffect` debounce (`setTimeout` → `searchCommitted`) — search was firing on every keystroke; now uses split `searchDraft` (typing) vs `searchCommitted` (query) with explicit `commitSearch` ( `Keyboard.dismiss()` + `setSearchCommitted(searchDraft.trim())` + `hapticSuccess`) and `clearSearch` (resets both); UI replaces auto-search with a primary pill **Search** `Pressable` (`C.primary`, `borderRadius 999`, `min-h-12 px-5`) next to the rounded input bar (flex-row `gap-2`, input `returnKeyType="search"` + `onSubmitEditing={commitSearch}`, clear X now calls `clearSearch`); `clearFilters` also uses `clearSearch`; PRD §2.1/§3.6 updated from "debounced 300ms" to "committed only after Search tap / submit (no auto debounce)". |
| 2026-08-30 | Fix | **P0-1 Invite auto-revoke atomic**: `convex/invitations.ts:40` `create` sebelumnya hanya `insert` tanpa revoke — bisa punya >1 active code, melanggar PRD "auto-revokes previous active codes". Fix: sebelum generate code, collect `by_householdId` dan patch `revoked=true` untuk semua `!revoked && expiresAt > now && useCount < maxUses` dalam **same mutation** sebelum insert baru, sehingga `listActive` max 1. Tests `tests/invitations.autoRevoke.test.ts:1` (3 cases: single revoke, multi revoke, expired/ revoked untouched). Updates §2.1, §3.3, §4.5, §5.5. |
| 2026-08-30 | Fix | **P0-2 Atomic opening balance**: `convex/accounts.ts:43` sebelumnya `insert account balance:0` lalu `ctx.runMutation(api.transactions.create)` — tidak atomic (orphan account jika inner gagal, 2 timestamp, cross-mutation). Fix: validasi reserved category **sebelum** insert, insert account dengan `balance: openingBalance` dan `now` tunggal, lalu `ctx.db.insert("transactions")` langsung dengan same `now`/`createdBy` dalam **same mutation** (hapus `import {api}` + `runMutation`). Tests `tests/accounts.atomicOpeningBalance.test.ts:1` (5 cases: code invariant no runMutation, positive/negative balance atomic shared timestamp, no orphan on missing category, zero balance no tx) + existing `tests/accounts.create.test.ts:1` tetap 6/6. Updates §2.1, §3.4, §4.3, §5.3, §5.6. |
| 2026-08-30 | Fix | **P0-5 Delta no-chip**: `components/charts/DeltaCard.tsx:31-68` badge was pill `Shadow.card` + `backgroundColor C.deltaPositiveBg/Border` (`#DCFCE7`/`#86EFAC` → wash `#065F4614`/`33`) + `Radius.md` + `borderWidth 1`. Dihapus — sekarang hanya `Feather trending-up/down/minus` + `Text label` dengan `color deltaColor (C.success/C.error/C.textSecondary)` dan `withSpring` scale, tanpa `bg/border/radius/shadow`. Lebih nyambung dengan `GradientCard` warm bg, tidak ada shape/chip. `constants/theme.ts:17-20` `delta*` tetap ada tapi tidak dipakai DeltaCard (reserved untuk chart lain). Verified `npx tsc --noEmit` (0), `expo lint` (0), `vitest` (102/102). Updates §3.8. |
| 2026-08-30 | Fix | **P0-5 Hardcoded amber → theme token**: `app/(tabs)/home.tsx:88` `BudgetPill` progress bar third color was hardcoded `"#D97706"` (light amber only, wrong in dark mode where amber is `#F59E0B`). Replaced with `C.chartAmber` via `useThemeColors()` (`constants/theme.ts:21` `#D97706` / `DarkColors.chartAmber` `#F59E0B`). Now amber threshold `>0.8` is dark-mode-aware and consistent with `components/charts/SpendingDonut.tsx:25` palette (`C.chartAmber`/`C.chartEmerald`). Verified `npx tsc --noEmit` (0 errors), `expo lint` (0 errors), `vitest` (102/102). Updates §3.8, §3.9. |
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

- Multiple Households per user; household switching/archiving (single-household delete/leave/transfer implemented as of 2026-09-04).
- Email-based invitations.
- Account/category colors; multi-currency; archiving/merging.
- Split transactions; recurring transactions; attachments/receipts;
  CSV/PDF export.
- Budget rollover; weekly/yearly budgets; notifications; templates.
- Selection haptics — intentionally deferred (chip/field selection feedback not yet enabled).
- Reports/analytics beyond current Budget progress; full-text search beyond note substring (≥2 chars).