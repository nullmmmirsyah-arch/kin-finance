# Kin Finance — Architecture

> Source of truth: `convex/schema.ts`, `convex/*.ts`, `app/**/*.tsx`, `CONTEXT.md`
> Product requirements: `docs/PRD.md`

---

## System Diagram

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

## Responsibilities

| Component | Responsibility |
|-----------|---------------|
| `app/_layout.tsx` | `SafeAreaProvider` + ThemeProvider, KeyboardProvider, ClerkProvider, ConvexProviderWithClerk, SnackbarProvider, `<OtaUpdater />` (background OTA `fetchUpdateAsync` only `ready` when `isNew`, `cancelled` guard) + `BrandedLoadingShell` (same bg/icon as native splash, optimistic progress, offline banner) — no `throw` on missing `EXPO_PUBLIC_*` (defensive `Configuration missing` screen, `hideAsync` after 500ms) + orchestrated auth gate (`preventAutoHideAsync`/`hideAsync` `setOptions fade 300`, `isLoaded`/`getActive` without login flash, fallback `hideAsync` after 3.5s when `isLoaded && isSignedIn && household===undefined`), `SafeAreaProvider` ensures `UpdateBanner` insets, root Stack |
| `app/index.tsx` | Signed-out entry (splash-icon 200x200 aligned with native splash + shell for seamless fade) |
| `app/(tabs)/home.tsx` | Swipeable dashboard (`react-native-pager-view` paging, 12 periods, `selectedPeriodStart` via `getPeriodBounds`/`buildPeriodWindow`, `<`/`>` + dots `formatPeriodLabel`, `pagerRef` + `hapticSuccess`): household card, **Period Balance** (`GradientCard` refined: `PERIOD BALANCE` pill + closing 28 + `Income/Expense` tinted circles via `periodBalances.get` + `timezone`), budget pills per `selectedPeriodStart`, Analytics below Budgets — `DeltaCard` (closing delta) + `SpendingDonut` (selected period); `BudgetPill` is `memo`, `PagerView` + `ScrollView` `RefreshControl` (`refreshKey`), stale derives from `balances === undefined` + `spendingRes === undefined` |
| `components/charts/*` | `DeltaCard` (GradientCard, `closingBalance` delta `currentClosing` vs `prevClosing` via `calcDelta`, `withSpring` scale, `Feather` trending icon), `SpendingDonut` (`react-native-svg` `Circle` `strokeDasharray` colored arcs, inner cutout, `FadeIn` + selectable highlight) — all `react-native-reanimated` + `Pressable` tooltip + `useThemeColors()` |
| `utils/periodTime.ts` (deep Period module) | Single deep `module` owning all wall-clock math. `interface`: `period(at,tz,type?) -> Period {start,end,label,prev,next,contains}` + `window(now,tz,count,type?) -> Window` + `validateTimezone`; convenience `currentPeriod(household)` / `adjacentPeriod(start,"prev"|"next",household)` / `sixMonthWindow(household)`. `implementation` hides DST double-iteration, week Mon-map, label branching. In-process `module` — shared by `app/(tabs)/home.tsx`, `reports.tsx`, `search.tsx` and `convex/periodBalances.ts`, `convex/transactions.ts` (Convex imports `utils/`). |
| `utils/analytics.ts` | `calcDelta(currentNet/CLOSING, prevNet/CLOSING)`, `maxBarValue(data)` — fed `periodBalances.closingBalance` for delta. `buildSixMonthWindow` deprecated — re-export shim from `./periodTime`. |
| `convex/periodBalances.ts` | Snapshot module (`recomputeAllForHousehold`/`recomputeFromForHousehold`, `get`/`listWindow`/`verify`/`reconcile`/`recomputeAll`/`backfill` + internal, single `by_household_date` scan group+upsert, `fresh` vs `carryOver` `computeOpeningClosing`, O(1) read, `findUserAndMembership` + `requireOwner`) |
| `app/(tabs)/reports.tsx` | Reports dashboard (swipable 12 periods, Category Ranking Card, Bill Ranking Card, Delta Card); income breakdown is fetched client-side and grouped by category (note: future improvement to move to server-side aggregate to avoid 1000-item cap) |
| `app/(tabs)/accounts.tsx` | Accounts list (filters, FAB, owner edit/delete); `FlatList` perf props (`removeClippedSubviews/windowSize/initialNumToRender`) |
| `app/(tabs)/transactions.tsx` | Transactions list (date + type/account/category filters, summary, day-grouped with net totals); `SectionList` perf props (`removeClippedSubviews/windowSize/initialNumToRender/maxToRenderPerBatch`) |
| `app/(tabs)/budgets.tsx` | Budgets list (month selector, progress); `FlatList` perf props |
| `app/(tabs)/settings.tsx` | Settings (single Households list -> `/members?householdId=` detail with inline set-active, Appearance, Categories, Sign Out — Balance Mode + Danger Zone moved to the household detail screen) |
| `constants/validation.ts` | Shared validation (`validatePeriodType`/`validateBalanceMode`, `PERIOD_TYPES`/`BALANCE_MODES`, + existing) — client + server single source, `isSafeInteger` amount |
| `constants/timezones.ts` | `resolveTimezone` (fallback `getCalendars()[0].timeZone` via `expo-localization`), curated IANA list with offset hints |
| `app/search.tsx` | Global cross-period search (Date first chip, default 14-day inclusive range `today - 13d` to `today`, 30/page FlatList, FilterSheet) |
| `app/onboarding.tsx` | Create/Join household |
| `app/members.tsx` | Household detail (`?householdId=` param-driven) — rename + timezone + balance-mode segmented control + "Set as Active" + members + invite code generation/revoke + Danger Zone |
| `app/account-form.tsx` / `category-form.tsx` / `transaction-form.tsx` / `budget-form.tsx` / `categories.tsx` | Feature CRUD screens; `transaction-form` persists `lastTransaction` via `lib/last-transaction.ts` + duplicate check against `transactions.recent`; amount inputs are integer-only |
| `lib/last-transaction.ts` | Persisted "Repeat last" store: `getLastTransaction`/`setLastTransaction` via `expo-secure-store` (`last-transaction` key), type `LastTransaction {type, amount, accountId, toAccountId?, categoryId?}` |
| `components/` | Reusable UI (Button, Input, Card, Fab, EmptyState, Snackbar with optional action, Skeleton, ThemeProvider, TransactionCard, Chip, DateField, GradientCard, SelectField with search, ConnectivityBanner, BrandedLoadingShell, UpdateBanner) + non-UI controllers (OtaUpdater) |
| `hooks/useDiscardGuard.ts` | Shared unsaved-changes guard: dirty flag in -> `handleBack` + `markIntentional` out; owns the `usePreventRemove` registration and discard Alert used by all four forms |
| `hooks/useConnectivity.ts` | NetInfo wrapper: subscribes to `@react-native-community/netinfo`, exposes `isConnected` (boolean \| null) for instant offline detection |
| `components/Auth/*` | Auth dumb components: `EmailField`, `PasswordField`, `CodeField`, `GoogleButton`, `ResetFlow` |
| `hooks/useAuthFlow.ts` / `hooks/useResetFlow.ts` | Clerk logic: sign-in/up, verification/MFA, Google SSO, password reset; orchestrated by `app/index.tsx` |
| `components/Input.tsx` | `secureToggle` prop: eye/eye-off 48px button toggles `secureTextEntry`; OTP fields use `oneTimeCode`/`sms-otp`; `amount` prop shows inline amber warning `wasDecimalTruncated` -> "Decimals are ignored" |
| `constants/theme.ts` | Theme tokens + `useThemeColors` / `useThemeGradients` |
| `lib/haptics.ts` | Safe haptics wrapper (`hapticSuccess`/`hapticWarning`/`hapticError` via `expo-haptics`) |
| `lib/errors.ts` | `getConvexErrorMessage` — user-friendly error extraction |
| `utils/format.ts` | `formatNumber`, `formatAmountInput` (integer-only, strips decimals/non-digits, thousand separators), `wasDecimalTruncated` / `detectAmountTruncation` (decimal warning), `sumNetExcludingTransfers` |
| `convex/schema.ts` | Database schema (source of truth) |
| `convex/helpers.ts` | Shared auth/scope helpers: `getUserAndMembership` (mutations, throws `ConvexError`), `findUserAndMembership` (queries, returns `{user, membership}` or `null`), `findUser` (user only), `requireOwner` (owner-gate check), `getScopedDoc` (fetch + household-scope guard) |
| `convex/transactionHelpers.ts` + `transactionQueries.ts` + `transactionAnalytics.ts` | Deep Transactions query module behind `seam` `ledger(householdId,{cursor,search,filters?})` / `cashflow(householdId,range?)` / `summary` / `spending` / `recent` (facade `convex/transactions.ts` hides `pinnedRangeQuery`, cursor `date+_id` tie, `SCAN_BUDGET` unification, hidden caches 6->1, `hydrate`/`matchesSearch`/`matchesFilters`) |
| `modules/icon-registry` (deep Icon module) | Single deep `module` `Icon({ref,size})` + `listIconRefs()` + `IconPicker` behind one `seam`. Hides `CATEGORY_STREAMLINE_MAP` + `ACCOUNT_STREAMLINE_MAP`, 50KB lazy, fallback chain. |
| `CONTEXT.md` | Domain language — Household, Period, PeriodBalance, Account, Category, Transaction, Budget, Icon, Search/Filter; `seam` names |

## Account Balance Auto-Update

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

opening balance (accounts.create):
  validated before insert; account.balance = openingBalance at insert,
  transaction inserted with same now/createdBy in same mutation — no runMutation
```

All operations within one mutation — atomic. The three code paths share two
helpers in `convex/transactions.ts` — `applyBalanceDelta` (safe per-account
patch, skips missing accounts) and `reverseBalances` (reverses a transaction's
effects) — so create/update/delete balance math cannot drift apart.

**Reconciliation:** `accounts.verify` / `accounts.reconcile` recompute expected balances from the full household transaction log (same signed logic + transfer `from -`/`to +`; caps at 10k txs) and patch drifted accounts — owner-only `reconcile`, read-only `verify` for any member (visible accounts filtered for Members, full for Owner). Exposed as amber banner + Recalculate in `app/(tabs)/accounts.tsx`.

## Error Handling Convention

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
- **Stale/offline:** NetInfo `isConnected===false` -> instant `ConnectivityBanner` ("You're offline — showing cached data" + Retry); fallback `undefined` >3s otherwise. Retry and pull-to-refresh (`RefreshControl`, 600ms, `primary` tint) on Home/Transactions/Accounts/Budgets bump a `refreshKey` to re-subscribe Convex queries (real re-query + haptic). Full-screen remains for non-member `null`.
- **Haptics:** `hapticSuccess` on create/update, `hapticWarning` on validation + duplicate detection, `hapticError` on mutation failure (all via `lib/haptics.ts`, safely no-ops in Expo Go/web).
- Client and server share one validation module, `constants/validation.ts`
  (path alias `@/constants/validation`), eliminating drift. Amount inputs enforce whole numbers at the keyboard (`number-pad` + `formatAmountInput` stripping, `Input amount` prop) so decimals are blocked before validation.

## Invitation Security Model

- 8-char random codes (~41 bits entropy), server-secret HMAC-SHA-256 digests
  only (no plaintext / unkeyed hashes persisted).
- 7-day expiry, single-use, owner-revocable, **atomic auto-revoke on new code within the same mutation** (previous active invites patched `revoked=true` before new insert, so invariant "at most one active invite per household" holds without race).
- Atomic redemption; per-code rate limit (5 attempts / 60s).

## Initial Balance Category Contract

Each household gets two reserved "Initial Balance" categories (income and
expense) at creation. The category name is the single shared constant
`RESERVED_CATEGORY_NAME` in `constants/categories.ts` — never a bare literal.
`accounts.create` with a non-zero opening balance posts a
transaction against the matching one **atomically**; it validates the category
**before** inserting the account and errors if it does not exist (no orphan
account), rather than creating it on the fly, and inserts both rows with the
same `now` timestamp in one mutation (no `ctx.runMutation`).
These categories are protected:
`categories.create` cannot duplicate them; update/delete reject rename/hide/
retype/delete; they never appear in user-facing category selection.

## Over-the-Air (OTA) Updates & Distribution

Updates ship via **EAS Update** (`updates.url`, `runtimeVersion` policy
`appVersion`) and the app binary via EAS Build APK (`eas.json` production:
`buildType: "apk"`, `distribution: internal`, `appVersionSource: remote`,
`environment: production` / `preview` / `development` **required** — without `environment` field `EXPO_PUBLIC_*` are not injected; `Plain` visibility required for `EXPO_PUBLIC_*`). No Play Store is required — internal distribution via `expo.dev` link is used for APK installs (Free tier: 15 Android builds/month, 1 000 MAU for updates).

**Splash & launch polish:** native splash (`expo-splash-screen` `imageWidth: 200`, `backgroundColor: #FFFBF5` light / `#1C1917` dark) fades 300ms into `components/BrandedLoadingShell` (same bg + centered `splash-icon.png` 200x200, progress bar `0->70%` in 400ms fast, `70->90%` while `Clerk isLoaded` + `households.getActive` resolve, `90->100%` on `SplashScreen.hideAsync()`; `hapticSuccess` on complete). `app/_layout.tsx` calls `preventAutoHideAsync()` + `setOptions({duration: 300, fade: true})` and only hides after `isLoaded` and the `Login`/`Onboarding`/`Home` branch is ready — returning signed-in users never see a login flash, signed-out users fade seamlessly into `Login` with the same 200px icon; defensive: no `throw` on missing `EXPO_PUBLIC_*` (shows `Configuration missing` screen, `hideAsync` after 500ms) and fallback `hideAsync` after 3.5s when `isLoaded && isSignedIn && household===undefined` (offline/Convex error) so `BrandedLoadingShell` with `Retry` is always visible, never stuck black splash; `SafeAreaProvider` at root + `UpdateBanner` uses `useSafeAreaInsets().top` (`paddingTop: insets.top`) to avoid `edgeToEdgeEnabled: true` status-bar overlap. Offline during launch pauses progress at 90% with `ConnectivityBanner` ("You're offline — showing cached data" + Retry) and honest copy (`Waiting for connection...` / `Can't reach Kin Finance`) — never a false spinner.

**Startup policy:** `app.json` sets
`updates.checkAutomatically: "ON_ERROR_RECOVERY"` with
`fallbackToCacheTimeout: 0`. Cold boot therefore launches the embedded or
cached update immediately and never blocks on a network manifest check.

**Background check:** `components/OtaUpdater.tsx` (mounted in
`app/_layout.tsx` inside `SnackbarProvider` + `SafeAreaProvider`) runs once per session, 5s after
launch: `checkForUpdateAsync()` -> if available, `fetchUpdateAsync()` (only `ready` when `result.isNew === true`, preserves `cancelled` guard) with `UpdateBanner` states `downloading` (progress 0->100) -> `ready` ("New update ready" + **Restart now** + **Later**). If `runtimeVersion` changed (native update required), a blocking dialog "New version available — Download" (`Linking.openURL(downloadUrl)`) links to the EAS artifact. Skipped entirely when `__DEV__` or `!Updates.isEnabled` (Expo Go). Failures are swallowed silently.

**Release rule:** changes to native config (anything in `app.json` plugins,
`updates`, dependencies with native code) require a new build + APK
redistribution; JS-only changes can ship via `eas update --channel production`. NetInfo is native — changes require new EAS Build APK, not just `eas update`.

**Environment variables (manual):** `expo.dev` > `kin-finance` > Environment Variables **per environment** (`production`/`preview`/`development`) must contain `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_CONVEX_URL` (both **Plain** visibility — `Sensitive` is not inlined to JS for `EXPO_PUBLIC_*`); `eas.json` must have `environment: production/preview/development` on each build profile or vars are not injected. `CONVEX_DEPLOYMENT` is local-only; `CLERK_JWT_ISSUER_DOMAIN` / `CLERK_FRONTEND_API_URL` are set in Convex Cloud, not EAS.

## Architecture Deepening (2026-09-04) — no UX break

Internal refactor only — no user-visible change. `interface` is the test surface.

| Candidate | Before (shallow/leaky) | After (deep) | `seam` | `adapter` | `leverage` / `locality` |
|-----------|------------------------|--------------|--------|-----------|--------------------------|
| **1 Period/Time** | `zonedParts`/`zonedOffsetMs`/`zonedWallToUtc`/`getMonthBounds` copied 3x; `buildSixMonthWindow` vs `buildPeriodWindow` duplicate loop; DST fix touches 3 sites — no `locality` | One deep `periodTime` `module` `period()`+`window()` hides DST double-iteration, week Mon-map, label branching | In-process — single `seam` at `period()`; Convex imports `utils/` | None — In-process always deepenable; `Intl` stays private | `leverage`: one `interface` for 5 call sites; `locality`: DST fix in one private `wallToUtc` |
| **2 Transactions query** | 9 exports, 3 pagination copies, 6 hidden-visibility caches, `hydrate`/`matchesSearch` drift | Deep `transactionHelpers.ts` + `transactionQueries.ts` + `transactionAnalytics.ts` facade `transactions.ts` hides `pinnedRangeQuery`, cursor `date+_id` tie, `SCAN_BUDGET` unification, hidden 6->1, `hydrate` | Local-substitutable — `convex-test` is the `adapter` | `now:()=>Date` in-process clock for `cashflow` | `leverage`: `ledger(householdId)` 1 arg (was 6 params); `locality`: `hasMore` fix once |
| **3 Icon registry** | 6 shallow `module`s; dead PNG requires, duplicate `getStreamlineIconName`, `isAccountType` leak into form primitive | One deep `modules/icon-registry` `Icon`+`listIconRefs`+`IconPicker` hides 56 Streamline map, account map, 50KB lazy, fallback chain | In-process — single `seam` name->`SvgXml` | None | `leverage`: 28-line grid -> `<IconPicker>` 1 line; `locality`: icon mapping fix in one `module`; delete ~80 LOC + 56 dead requires |

## CI/CD & Development Workflow

**Branches & channels:** `review` -> `development` (internal APK, `eas.json:development` `developmentClient:true`, `channel:development`, `APP_VARIANT=development`), `main` -> `production` (APK internal via `release.yml`). Feature branches `feat/*` are short-lived.

**Development workflow (`.github/workflows/development.yml`):** `workflow_dispatch` only — full manual (no fingerprint; fingerprint lokal vs EAS selalu beda karena env mismatch, jadi gate manual lebih jujur). 2 inputs: `run_build` (default `false` — build APK native) + `publish_update` (default `false` — OTA JS). `concurrency: group: development-review, cancel-in-progress: false` (queue). JS-only cukup `expo start`, hemat MAU; OTA ideal tetap jalan jika butuh share ke dev build tanpa kabel (EAS Update `how-it-works`).

1. `check` (`needs: —`): `npm ci` -> `npx tsc --noEmit` + `npm run lint` (Node 22, `actions/checkout@v4` `persist-credentials:false`, `actions/setup-node@v4` cache npm).
2. `build` (`needs: check`, `if: inputs.run_build == true`): `expo/expo-github-action@v8` (`eas-version: latest`, `EXPO_TOKEN`), `npm ci`, `eas build --platform android --profile development --non-interactive --no-wait` dengan `EXPO_TOKEN` + `EXPO_PUBLIC_CONVEX_URL`/`EXPO_PUBLIC_CONVEX_SITE_URL`/`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Jika `run_build==false` -> skip (JS-only).
3. `publish-update` (`needs: [check, build]`, `if: always() && publish_update && check==success && build!=failure`): `eas update --channel development --message "Dev update from ${{ github.sha }}" --auto` (secrets `EXPO_PUBLIC_*`). `channel development` auto-link ke branch `development`, `runtimeVersion` `appVersion` harus sama.

Preview native via dev build `com.kinfinance.app.dev` + `expo start`; `branch development` optional (hanya jika butuh share tanpa laptop). File disync ke `main` agar `Run workflow` muncul dari default branch (GitHub requirement).

**PR gate (`.github/workflows/pr-check.yml`, opsi A):** `on: pull_request: branches: [review]` + `merge_group` — lightweight `check` (`tsc`/`lint`/`vitest run`) tanpa EAS/secrets, `concurrency: pr-check-${{ github.ref }}` `cancel-in-progress: true` untuk fast feedback sebelum merge ke `review`.

**Release workflow (`.github/workflows/release.yml`):** `workflow_dispatch` only, `concurrency: group: release`. 3 inputs: `run_build` (default `false` — build APK baru, pakai kuota), `deploy_convex` (default `true`), `publish_update` (default `true`).

1. `check`: `tsc` + `lint` (sama seperti development).
2. `convex-deploy` (`needs: check`, `if: deploy_convex`): `npx convex deploy` dengan `CONVEX_DEPLOY_KEY`.
3. `build-apk` (`needs: check`, `if: run_build`): `eas build --platform android --profile production --non-interactive` (secrets `EXPO_PUBLIC_*`).
4. `publish-update` (`needs: [build-apk, convex-deploy]`, `if: always() && publish_update && !cancelled() && convex-deploy != failure && build-apk != failure`): `eas update --channel production --message "Release from ${{ github.sha }}" --auto`.

Source of truth for CI is `.github/workflows/development.yml` + `release.yml` (GitHub Actions — chosen over EAS Workflows for `check` visibility, `jq` fingerprint diff, and reuse of `secrets.EXPO_TOKEN`).

---

## Database Schema

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
activeHouseholdId: id<households> | undefined  // server-side active household; follows across devices; unset = read-time fallback to oldest
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

### `periodBalances`

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
type: "asset" | "debt"
subType: "cash" | "bank" | "ewallet" | "credit_card" | "other"   // must pair with type
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
| `households` | `create` | mutation | Create + owner membership + reserved categories; records device IANA timezone (server-validated); sets `users.activeHouseholdId` only for the first-ever household |
| `households` | `getActive` | query | Current user's household (server-side active, fallback to oldest) |
| `households` | `listMine` | query | All memberships oldest-first as `{household, role, isActive}` |
| `households` | `switchActive` | mutation | Set active household; requires membership in that household |
| `households` | `update` | mutation | Rename (owner only) |
| `households` | `updateTimezone` | mutation | Set timezone (owner only); accepts `timezone: string \| undefined` (undefined = match device); server rejects non-IANA identifiers |
| `households` | `listMembers` | query | Member list (owner + members) |
| `households` | `removeMember` | mutation | Owner only; cannot remove owner |
| `households` | `updateBalanceMode` | mutation | Owner only; `balanceMode fresh\|carryOver` |
| `households` | `updatePeriodType` | mutation | Owner only; `periodType monthly\|weekly\|yearly`; `weekly`/`yearly` throws `Weekly/yearly coming soon` |
| `periodBalances` | `get` | query | Snapshot by `periodStart`+`periodType` |
| `periodBalances` | `listWindow` | query | Window `{startDate,endDate,periodType?}` -> `{balances,isOwner}` |
| `periodBalances` | `verify` | query | Diff stored vs expected, returns `{discrepancies,isOwner}` |
| `periodBalances` | `reconcile` | mutation | Owner only; full recompute + return `{fixed}` |
| `periodBalances` | `recomputeAll` | mutation | Owner only; full cascade |
| `periodBalances` | `backfill` | mutation | Owner only; full cascade from `createdAt` |
| `periodBalances` | `recomputeFrom` | mutation | Owner only; `fromDate` -> full cascade |
| `invitations` | `create` | mutation | Generate code (owner), auto-revokes previous |
| `invitations` | `revoke` | mutation | Owner only |
| `invitations` | `redeem` | mutation | Atomic join; rate limited |
| `invitations` | `listActive` | query | Active invites for the requested household; owner only |
| `accounts` | `list` | query | Visibility-filtered accounts + `isOwner` |
| `accounts` | `create` | mutation | Owner; optional opening balance |
| `accounts` | `update` | mutation | Owner; name/type/hidden |
| `accounts` | `remove` | mutation | Owner; guarded by referencing transactions |
| `accounts` | `verify` | query | Read-only diff `{discrepancies, totalStored, totalExpected, isOwner}`; 10k cap; returns `null` when not member |
| `accounts` | `reconcile` | mutation | **Owner only**; recomputes expected balances and patches drifted accounts; 10k cap |
| `categories` | `list` | query | Filtered, excludes reserved categories |
| `categories` | `create` | mutation | Owner |
| `categories` | `update` | mutation | Owner; type change guarded |
| `categories` | `remove` | mutation | Owner; guarded by references |
| `transactions` | `create` | mutation | Validates sign/type/category/transfer |
| `transactions` | `update` | mutation | Reverse old + apply new balances |
| `transactions` | `remove` | mutation | Reverse balances |
| `transactions` | `list` | query | Date-range + optional filters/search; cursor-paginated; cached hydration |
| `transactions` | `summary` | query | Range totals `{income, expense, net}`; same filters as `list`; transfers excluded |
| `transactions` | `recent` | query | Latest N with cursor pagination |
| `transactions` | `get` | query | Single transaction (hidden-category aware) |
| `budgets` | `list` | query | `{periodStart, periodEnd}`; spent + progress; redacted for Members on hidden categories |
| `budgets` | `get` | query | Single budget |
| `budgets` | `categoryOptions` | query | Expense categories for budget form |
| `budgets` | `create` | mutation | Member-ok; unique per category/month |
| `budgets` | `update` | mutation | Member-ok; amount only |
| `budgets` | `remove` | mutation | Member-ok |
| `transactions` | `cashflow` | query | Single-scan 6-month window, buckets by household timezone, transfers excluded |
| `transactions` | `spendingByCategory` | query | Single-scan 1-month window, expense only, top 10 + total |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo SDK 54, React Native 0.81 |
| Navigation | Expo Router 6 |
| Auth | Clerk (`@clerk/expo`) |
| Backend | Convex (`convex` 1.43) |
| Styling | NativeWind 4 (Tailwind CSS 3.4), `global.css`, `cssInterop` for `LinearGradient` |
| Animation | React Native Reanimated 4.1 |
| Pager | `react-native-pager-view` (Home swipeable period, paging, dots, chevrons) |
| Charts / SVG | `react-native-svg` 15.12.1 (`SpendingDonut` donut arcs via `Circle` `strokeDasharray` + `CategoryIcon` `SvgXml` for Streamline vector icons; included in Expo Go 54) |
| Keyboard handling | `react-native-keyboard-controller` (`KeyboardProvider` global + `KeyboardAwareScrollView` on input screens) |
| Language | TypeScript 5.9 |
| Persistence (device) | `expo-secure-store` (theme preference, last-transaction via `lib/last-transaction.ts`) |
| OTA updates | `expo-updates` 29 (EAS Update, `checkAutomatically: ON_ERROR_RECOVERY` + background check via `components/OtaUpdater.tsx`) |
| Date picker | `@react-native-community/datetimepicker` |
| Device locale / timezone | `expo-localization` (`getCalendars()[0].timeZone`) |
| Clipboard / Share / Haptics | `expo-clipboard`, native share sheet, `expo-haptics` |
| Icons | `@expo/vector-icons` Feather (UI) + Streamline Ultimate Color via Iconify (CC BY 4.0, 998 icons, `react-native-svg` `SvgXml` offline) |
