# Home Full Ledger + Reports & Global Search (Opsi B) — Design Spec

> Status: Approved brainstorming — implements reference bear-app parity with Opsi B constraints (5 tabs, future blocked, reuse existing charts)
> Date: 2026-09-03
> Source: Screenshots Home Sep/Aug/Oct + Reports Sep/Aug + Input + Date Picker + Search global, discussions 2026-09-03

## 1. Goal & Constraints

**Goal:** Transform Kin from `Home Recent 5 + Transactions tab` to reference model:
- Home = full period ledger swipable (daily groups) with period-bound Search/Filter
- Tab `Transactions` → `Reports` swipable (reuse Delta/Donut, toggle Expenses/Income, show-more)
- Global Search via header `🔍` with Date default last 14 days
- Consistent future-blocked UX (greyed & disabled) in all pickers

**Constraints (verbatim from AGENTS.md/PRD):**
- Expo SDK 54 (`npx expo install`), `npx convex codegen` → `npx tsc --noEmit` → `npm run lint` → `npm test`
- NativeWind `className` only, theme `useThemeColors()`/`useThemeGradients()` `dark:` variants, `Shadow.card`, `Feather`, no `style={({pressed})=>}`
- Amounts signed (+income −expense +transfer), whole-number `Input amount` with `formatAmountInput` thousand-separator, no currency symbol (PRD §Constraints)
- `Transaction date cannot be in the future` (PRD §2.2) — must be **hard block** (greyed & disabled, not tappable) in every picker
- Path alias `@/*`, every Convex handler needs `ctx.auth.getUserIdentity()` + `ConvexError`
- `convex/schema.ts` source of truth

## 2. Architecture

- **Period Engine:** `utils/period.ts` `getPeriodBounds`/`getPrevPeriod`/`getNextPeriod`/`formatPeriodLabel`/`buildPeriodWindow` + `zonedMonthStart` stays. Home window = **12 past + now** (`buildPeriodWindow(now, tz, monthly, 12)` with `now` = last period). Reports window same. No future window. Picker jump outside window → rebuild window centered on selected (if selected <= now, else blocked).
- **Data:** `convex/periodBalances.ts` stays `lt(now)` bounded scan, no future snapshot creation. `convex/transactions.ts` keeps `list/summary/spendingByCategory`; reuse for Home ledger & Reports; `search` global uses `list` without fixed window but with `Date` pill (default 14d). Hidden account/category filtering unchanged (`helpers.ts`).
- **UI:** Two `PagerView` instances (Home & Reports) share MonthPicker modal component. Search is separate `app/search.tsx` route (not tab). Layout stays 5 tabs.

## 3. Navigation

- `app/(tabs)/_layout.tsx` 5 tabs: `home` (home), `reports` (bar-chart-2), `accounts` (credit-card), `budgets` (pie-chart), `settings` (settings). Remove `transactions` screen.
- `app/transactions.tsx` redirect → `app/search.tsx` for backward deep-links (or delete + redirect).
- Header `🔍` + `📅` (calendar) in Home/Reports top bar (right). `🔍` → `router.push("/search")`. `MonthPicker` triggered by tap `Sep ▼` centered header.

## 4. MonthPicker Modal (shared)

- Props: `visible, tz, periodType, selectedPeriodStart, onSelect(periodStart), onClose`
- Layout: tabs `Week | Month | Year` (header row, `Month` active yellow underline, `Week/Year` disabled grey `Coming soon`). Middle: `◀ 2026 ▶` year nav (`<`/`>` 44px, `Shadow.card`). Grid 3x4 months `Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec` (not `1-12`), `useThemeColors`, `Radius.md`. Future months (`periodStart > getPeriodBounds(now, tz, monthly).start`) => `opacity 0.4`, `disabled` (no `onPress`), greyed as in Img Sep `4-30` greyed. Past months pressable yellow select ring. Bottom `✕` / `✓` (Feather x/check, 48px).
- Behavior: `onSelect` sets `selectedPeriodStart = zonedMonthStart(year, month, tz)` via `utils/period.ts`, closes modal, `hapticSuccess`, parent `setSelectedPeriodStart` + `pagerRef.setPage(index)`.

## 5. Home — Full Ledger per Period

- **Header outside PagerView:** `◀` `▶` chevrons (44x44, `Shadow.card`, `C.border`, `isPrevDisabled` at window start, `isNextDisabled` true for `next > curStart` — future blocked, disabled 0.4 opacity) + centered `formatPeriodLabel(selectedPeriodStart, tz, monthly)` + dots `12` (`w16 primary` vs `w6 border`).
- **Content per page (isSelected only):**
  - `GradientCard Period Balance` (income/expense/balance `periodBalances.get`) + `Today` header? Keep existing `GradientCard` refined pill.
  - `Budgets` 3 pills or `promo Create a budget... > 🐻` card (Shadow.card, row, bear emoji) when `monthBudgets.budgets.length===0`
  - **Search+Filter (period-bound):** `TextInput` draft + `Search` pill primary (explicit commit `searchCommitted` >=2) + `Filter` pill `Filter · N` (badge) → `FilterSheet` (Type/Account/Category draft → Done). Query `api.transactions.list` with `{startDate:selectedPeriodStart, endDate:periodEnd, limit:30, cursor?, accountIds?, categoryIds?, type?, search?}` accumulated paginated (dedup by `_id`, `hasMore`/`nextCursor`, `onEndReached` loadMore). No `This Month/Last Month` chip (replaced by Pager).
  - **SectionList daily groups:** `sections = Map(formatDateHeaderTz)` each `{title:"Sep 1 Tue", data:[txs], total: sumNetExcludingTransfers}` header row `title left` + `total right` colored `C.success/C.error`. `renderItem` → `TransactionCard` with `accountName` (`item.account?.name`) subtitle `Category • Account` **without time** (Section 5). Amount `-Rp` hidden (keep bare `formatNumber`), color `error/success`. `ListEmptyComponent`: if `today` within period → card `No record for today` + `+` yellow circle button (Pressable → `/transaction-form`); else generic `EmptyState No transactions yet`.
  - `My Accounts` horizontal FlatList same as now below ledger.
- **PTR & stale:** keep `RefreshControl` + `ConnectivityBanner` (NetInfo). `stale` derives from `txResult === undefined`.

## 6. Reports — Swipable Reuse

- Same `PagerView` + MonthPicker + chevrons/dots as Home but separate state `selectedReportStart`.
- Per page (isSelected):
  - Header `Aug ▼` + `Filter` text top-right (placeholder, non-func or future pills).
  - `Category Ranking` card: header `Category Ranking` left + pills `Expenses ⇌` yellow (press toggles `type` state `expenses/income` → `spendingByCategory` re-query with `type`? Note `spendingByCategory` currently only expense — will filter client: if toggle to `Income`, query `spendingByCategory` still expense but we map to income segments via separate query or client filter `rows type===income` — need add `spendingByCategory` income support or new `incomeByCategory` query; for design we toggle `expenses/income` and show corresponding donut). Second pill `Top level category ⇌` dummy. Donut `SpendingDonut` (reuse) with legend 5 top + `∨` show-more expand to rest (state `expanded` boolean, collapse `∧`). Row: icon + `1 Car 25.8%` + `-Rp300,000 1 bill` (for expenses) or `+Rp` for income, progress bar `h-1` palette. Empty → `No spending`.
  - `Bill Amount Ranking TOP 10` card: list `TOP10` from `segments.slice(0,10)` sorted `amount desc`, each row icon + name + amount + bill count, header pill `Expenses ⇌` sync with above toggle.
  - `DeltaCard` below (or above) to show period delta — reuse from Home analytics (now removed from Home, lives here).
- No Daily Line Chart (per user: reuse existing).

## 7. Search Global — `app/search.tsx`

- Trigger: `🔍` header Home/Reports.
- UI: back `<` + `TextInput placeholder "Categories, amount, tags, etc., separated by ','"` + chips scroll `Date ▼` `Bill type ▼` `Category ▼` `Ledger ▼` `Account ▼` `Tags ▼` `Amount ▼` (only `Date/Category/Account/Bill type(=`type`)` functional initially, rest dummy disabled opacity). `Date` is **first chip** (requested) with default **`start = today -14d (20 Aug), end = today (3 Sep)`** for `Sep 3` example, computed `getDayBounds(today-14d, tz).start` to `getDayBounds(today, tz).end`. Subtle hint below chips: `Showing 20 Aug – 3 Sep • tap Date to change` (`text-xs C.textSecondary`). Tapping `Date` opens `DateField` range picker (From/To with `maximumDate today`, future greyed disabled).
- Summary card: `Records N  ↑Expenses Rp  ↓Income Rp` (from `api.transactions.summary` with same filters + `search`).
- List: flat `FlatList` (not SectionList) of 7 rows as in Img (cross-period, `Oct 1` to `Aug 31`), each `TransactionCard` **without time** but with date `Oct 1 05:48`? For global, show date `Oct 1` (since time removed per Section5, show `Oct 1` not `05:48`). Use same `TransactionCard` but `timezone` prop. Pagination `30/page` cursor.
- Deemphasize period — no Pager, just `Date` filter controls window.

## 8. Transaction Row Update

- `components/TransactionCard.tsx` add `accountName?:string`, subtitle `Text categoryName ?? "Transfer" + " • " + accountName` (if transfer show `accountName → toAccountName`). **Remove `formatTimeTz` display** (no jam, per Section5). Keep icon, amount, press to `/transaction-form`.

## 9. Validation & Period Consistency

- Keep `validateTransactionDate` block future in all pickers: `DateField maximumDate={today}` + MonthPicker/Table future cells disabled. Home/Reports picker future `disabled`.
- `periodBalances` window unchanged (lt now). No future snapshot.

## 10. Testing

- `tests/daily?`: no daily chart now — keep existing `tests/period.test.ts` + add `tests/monthPicker.test.ts` (future disabled logic: `isFutureMonth(2026,10,tz) -> true when now Sep`). `tests/search.global.test.ts` convex-test for global search with `Date` default 14d (verify `list` with `startDate=now-14d` returns correct).
- Manual checklist `tests/home-period.manual.md` update: verify Home swipe, MonthPicker Jan-Dec future greyed, ledger daily groups, Today empty, Filter+Search period-bound, Reports toggle Expenses/Income + show-more, Search global Date 14d default.

## 11. PRD Update (Task last)

- PRD §2.1 Transactions: add `Search global` via header, Date chip now `Date` first, default last 14 days hint.
- PRD §3.8 Home: full ledger not recent, Search+Filter period-bound, Today card.
- New §3.11 Reports: swipable with MonthPicker Jan-Dec, Expenses↔Income toggle, show-more.
- §2.2 Transaction date: reaffirm `cannot be in the future (enforced greyed & disabled in MonthPicker & DateField)`.
- §8 Change Log `2026-09-03: Opsi B Home full ledger + Reports swipable + Global Search Date 14d`.

