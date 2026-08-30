# P0-1 Dashboard Analytics — Design Spec

> Status: Draft (awaiting review)
> Date: 2026-08-30
> Scope: Home dashboard polish — 3 analytics cards below Budgets section

---

## 1. Overview

### Purpose
Home saat ini hanya menampilkan `Total Balance`, 3 `BudgetPills`, `My Accounts` (horizontal), dan `Recent Transactions` (`app/(tabs)/home.tsx:343-651`). User tidak mendapat insight "uang lari ke mana" dan "lebih boros/hemat vs bulan lalu". P0-1 menambah 3 kartu analytics di bawah Budgets (sesuai revisi penempatan) agar dashboard menjadi cashflow-aware tanpa menambah tab baru.

### Goals
- Cashflow trend 6 bulan (income vs expense per bulan) — bar chart.
- Spending by Category bulan ini — donut + legend.
- Net delta vs bulan lalu (income - expense) — card dengan % change.

### Non-Goals
- Tab Analytics terpisah (ditunda ke N-2).
- Recurring/scheduled tx (N-1).
- Export/report (N-3).

### Constraints
- Expo SDK 54, Convex, Clerk. `app/_layout.tsx` sudah ada `cssInterop`, `Shadow.card`, `Radius.md`, `Gradients.card`.
- No new native deps unless justified; pure Views + `react-native-reanimated` (sudah ada `4.1.1`) untuk animasi. `nativewind` v4 gotcha: `Pressable style` callback dilarang — pakai `useState pressed`.
- Household timezone: semua month boundaries via `getMonthBounds(ts, timezone)` (`utils/date.ts:133`) dan `resolveTimezone()` (`constants/timezones.ts`).
- Owner vs Member: hidden category `spent` redacted untuk Member (ikuti `convex/budgets.ts:73`); transaksi hidden category tidak terhitung di analytics Member.

---

## 2. Placement & Layout (Revisi: Below Budgets)

### Current Order (`home.tsx`):
```
Greeting → Household card → Total Balance (GradientCard)
→ Budgets (3 pills / Empty)
→ My Accounts (horizontal FlatList)
→ Recent Transactions
```

### New Order:
```
Greeting → Household card → Total Balance
→ Budgets (existing)
→ NEW: Analytics Section (below Budgets, above My Accounts)
     ├─ DeltaCard (full-width GradientCard, compact 1 row)
     ├─ CashflowBarChart Card (bg-background, Shadow.card, Radius.md)
     └─ SpendingDonut Card (bg-background, Shadow.card, Radius.md)
→ My Accounts
→ Recent Transactions
```

Rationale: Budgets tetap di atas (primary CTA bulanan); analytics adalah insight sekunder yang kontekstual setelah budget. Tidak mengganggu first-fold Total Balance.

All cards dalam `ScrollView contentContainerClassName="px-5 pb-10 pt-4"` existing. Chart width = `screenWidth - 40` (px-5 *2). Gap `mt-6` antar section (konsisten `home.tsx:373,407`).

---

## 3. Data Flow & Convex — Efficient (Min DB I/O)

### Problem Before (inefficient):
Loop 6x `transactions.summary` di client = 6 separate queries, masing-masing `pinnedRangeQuery` scan `by_household_date` dengan `SUMMARY_BATCH_SIZE 10000` → 6x read + hydration. Boros Convex read units & bandwidth, terutama household dengan >1k tx/6 bulan.

### Solution: Single-Scan Queries

Tambah 2 queries baru di `convex/transactions.ts` (atau `convex/analytics.ts` baru, prefer `transactions.ts` untuk co-lokasi):

#### 3.1 `transactions.cashflow` (new)
```ts
export const cashflow = query({
  args: { startDate: v.number(), endDate: v.number() }, // 6-month window
  handler: async (ctx, args) => {
    const auth = await findUserAndMembership(ctx);
    if (!auth) return null;
    const { membership } = auth;
    const isOwner = membership.role === "owner";
    // Validate window ≤ 200 days (~6.5 months) to cap read
    if (args.endDate - args.startDate > 200*86400000) throw ConvexError;
    // Single scan: by_household_date gte start lt end, order asc, collect
    // Bucket in-memory by month via getYearMonth/zonedMonthStart in JS (server JS, no TZ lib needed - compute via Intl parts)
    // BUT: server does not know household timezone string? It does: membership -> household doc fetch -> household.timezone
    // Resolve timezone server-side (households.get -> timezone or "UTC" fallback)
    // Hidden category: same cache as summary (hiddenCategoryCache Map)
    // Return: Array<{ periodStart: number, label: string, income: number, expense: number, net: number }>
    // Uses ONE index scan + optional hiddenCategory lookups (cached, ≤ distinct categories)
  }
})
```
- **I/O**: 1 `withIndex("by_household_date")` scan over 6 months (1 read stream), not 6. Documents read = total tx in window (e.g. 500 tx) vs 6*10000 budgeted reads before. Category hidden checks cached (≤ 20 distinct). No per-tx `hydrate` (only `categoryId` lookup for hidden flag).
- **Fallback**: If household.timezone undefined, use "UTC" server-side; client label formatting still uses `resolveTimezone` for display consistency.

#### 3.2 `transactions.spendingByCategory` (new)
```ts
export const spendingByCategory = query({
  args: { startDate: v.number(), endDate: v.number() },
  handler: async (ctx, args) => {
    // Similar single scan over current month window
    // Filter: type === "expense", respects hidden category (skip if !isOwner && hidden)
    // Hydrate category name via cached ctx.db.get(categoryId) (Map)
    // Aggregate: Map<categoryId, { name, amount }>
    // Return sorted desc by amount, limit 10
  }
})
```
- **I/O**: 1 scan over 1 month window. Amount aggregated server-side; client receives ≤10 rows, not full tx list.

#### 3.3 Reuse `transactions.summary` for Delta?
Option A: reuse `cashflow` result for delta (last 2 entries) — no extra query.
Option B: still call `summary` for this vs last month — 2 extra scans. Choose A: delta derived from `cashflow` array in client: `delta = cashflow[5].net - cashflow[4].net`.

**Client Hook (`hooks/useAnalytics.ts` or inline `home.tsx`):**
```ts
const timezone = resolveTimezone(household?.timezone);
const now = Date.now();
const sixMonthWindow = useMemo(() => {
  const cur = getMonthBounds(now, timezone);
  const start = getMonthBounds(cur.start - 1, timezone).start; // will compute 5 months back loop
  // compute start = zonedMonthStart 5 months before cur.start
  return { startDate: fiveMonthsAgoStart, endDate: cur.end };
}, [timezone]);
const cashflow = useQuery(api.transactions.cashflow, { startDate, endDate });
const spending = useQuery(api.transactions.spendingByCategory, getMonthBounds(now, timezone));
```
- 2 queries total vs 6+ before. Reactive (Convex live query) — updates on new tx without manual invalidate.

---

## 4. UI Components — Theme-Uniform + Simple Animation + Tooltip

### Design Tokens (reuse `constants/theme.ts`)
- Income bar: `C.success` (`#065F46` light / `#34D399` dark)
- Expense bar: `C.error` (`#991B1B` / `#F87171`)
- Net dot/line: `C.primary` (`#92400E` / `#F59E0B`)
- Card: `Shadow.card`, `Radius.md`, `backgroundColor: C.background`, `borderColor: C.border`, `className="px-4 py-4"` (same as BudgetCard `components/BudgetCard.tsx:27-38`)
- Donut palette: cycle `C.accountCash, C.accountBank, C.accountEwallet, C.accountCreditCard, C.primary` + muted tints.

### 4.1 `components/charts/CashflowBarChart.tsx`
Props: `{ data: { periodStart: number, label: string, income: number, expense: number, net: number }[], onSelectMonth?: (d)=>void }`
- Layout: horizontal row, 6 groups, each group has 2 bars (income left, expense right) + month label `MMM` (e.g. "Mar") via `formatMonthLabel(periodStart, timezone).slice(0,3)`.
- Bar scaling: `maxVal = max(...data.flatMap(d=>[d.income, d.expense])) || 1`; bar height `h = (value/maxVal)*100` (max 100px container). Bars `width 12px`, `borderRadius 6px`.
- **Animation**: on mount / data change, `useSharedValue` + `withTiming(1, {duration: 400})` (reanimated) animate height from 0 → h, staggered by `delay = index * 60ms` via `withDelay`. Respects `prefersReducedMotion`? Skip if `__DEV__`? Simple.
- **Tooltip (interactive)**: tap a month group → local `selectedIndex` state → tooltip `View` absolute above bars showing `Income: +{formatNumber(income)}` `Expense: -{formatNumber(expense)}` `Net: {formatNumber(net)}` with `Shadow.elevated`. Tap outside / tap same month clears. Uses `Pressable` with `useState pressed` (no style callback). Tooltip content also triggers `hapticSuccess` light.
- Empty: if all income/expense 0 → show dashed baseline + `Text "No transactions in last 6 months"`.

### 4.2 `components/charts/SpendingDonut.tsx`
Props: `{ segments: { name: string, amount: number, color: string }[], total: number }`
- Donut: **SVG colored arcs via `react-native-svg 15.12.1`** (`npx expo install react-native-svg`, Expo Go 54, OTA-eligible) — `Svg viewBox 0 0 42 42`, track `Circle r=15.915 stroke C.border w7`, arcs `Circle r=15.915 stroke segmentColor w7→8.5 when selected` with `strokeDasharray="dash gap"` (`dash=pct*100`, `gap=100-dash`, `offset=25-cumulative*100` start at top), `opacity 0.35` dim non-selected; outer 140×140, inner cutout `View 80 r40 C.background` showing `formatNumber(total)`; palette `C.chartAmber/C.chartEmerald` + `C.account*` (via `useThemeColors` tokens, not hardcoded), "Others" aggregated when segments>5 (overflow slice `C.textSecondary`).
- **Animation**: legend rows `FadeIn.delay(index*40)`, arc highlight via `strokeWidth` change. Total static.
- **Tooltip/Interactive**: tap legend row (or Others) → highlight row (`C.surface`) + dim other arcs + show `% • amount` trailing; tap again clears. Selection `useState`.
- Empty: card "No spending this month" (no donut).

### 4.3 `components/charts/DeltaCard.tsx`
Props: `{ currentNet: number, prevNet: number, currentLabel: string, prevLabel: string }`
- Uses `GradientCard` (`components/GradientCard.tsx:11`) for premium feel (same as Total Balance). Layout: row `justify-between`: left `Net this month` value + `This month` label, right delta badge.
- Delta badge: `View` `borderRadius 999`, `backgroundColor: delta>0 ? C.success+"15" : delta<0 ? C.error+"15" : C.surface`, `Feather` `trending-up/down/minus`, text `+12.3% vs last month` (format `delta.toFixed(1)%`). Color semantic.
- **Animation**: delta badge scale `withSpring` on data change. Number `formatNumber` no animation needed.
- Edge: prevNet === 0 → show "— vs last month" or "New this month" if prev 0 but current >0.

### 4.4 `components/charts/index.ts` barrel + `hooks/useAnalytics.ts` (optional helper).

All components respect dark mode via `useThemeColors()` (not `Colors` direct) and `dark:` variants where className used.

---

## 5. Error / Loading / Offline

- Loading: `Skeleton` `height 140` (Cashflow), `140` (Donut), `80` (Delta) — same pattern `home.tsx:574`.
- Error (query throws): show `Text` `getConvexErrorMessage` fallback inside card, not crash ScrollView.
- Stale/Offline: reuse existing `useConnectivity` + `ConnectivityBanner`; charts show cached last value (Convex reactive) while banner visible.
- Household null (not member): hide analytics section (return null), same as `home.tsx:278`.

---

## 6. Testing & Verification

- **Validation**: `npx convex codegen` after new queries, then `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest). Queries: `convex/transactions.test.ts` add 2 test suites: `cashflow buckets by month in household timezone` + `spendingByCategory excludes hidden for member`.
- **Unit**: `utils/cashflow.test.ts` — `calcDelta`, `buildLabels`, `getFiveMonthStart`.
- **Manual**: Add 3 transactions across 2 months, verify bar heights, donut legend %, delta badge. Test Member with hidden category: spendingByCategory should not include hidden.

---

## 7. Out of Scope / Future (N-2)

- Analytics tab full report (12 months, yearly, export) — next spec.
- Recurring, notifications, goals.

---

## 8. Change Log

- 2026-08-30: Initial P0-1 spec created (placement below Budgets, efficient single-scan queries, pure View animation + tooltip).
