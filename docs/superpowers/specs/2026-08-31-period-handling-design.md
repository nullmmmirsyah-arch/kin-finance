# Period Handling — Swipeable Home + CarryOver Balance (Materialized Snapshot) — Design Spec

> Status: Draft (awaiting review)
> Date: 2026-08-31
> Scope: Home period paging, household balanceMode & periodType, periodBalances snapshot table, extensible to weekly/yearly

---

## 1. Overview

### Purpose
Home saat ini selalu menampilkan **bulan berjalan** (`getMonthBounds(now, timezone)` di `app/(tabs)/home.tsx:172`) dan `Total Balance` adalah sum `accounts.balance` kumulatif global — tidak ada konsep "balance antar period". User meminta Home menampilkan sesuai **period** lalu jika di-slide maka akan berubah period; antar period ada balance dengan preferensi **fresh (reset tiap period) vs carryOver (melanjutkan dari period sebelumnya)** yang disimpan di DB sehingga fleksibel diubah. Saat ini period hanya monthly, nanti weekly/yearly.

### Goals
- Home jadi **pager horizontal full-screen per period** (swipe kiri/kanan) — semua section (Total Balance, Income/Expense/Net, Budgets pills, Analytics Delta/Cashflow/SpendingDonut, Recent Transactions, My Accounts contextual) ikut periode terpilih.
- Household-level preference `balanceMode` + `periodType` persisted di `households`, Owner-only edit, Member read-only.
- Balance & income/expense per period disimpan sebagai **materialized snapshot** `periodBalances` agar Home O(1) read, tetap hidden-aware & transfer-excluded, dengan `verify/reconcile` seperti `accounts`.
- Schema & utility extensible ke weekly/yearly tanpa rombak caller (UI tetap monthly di v1).

### Non-Goals
- Weekly/yearly UI selector (v1 disabled, "coming soon").
- Freeze audit/history per-account breakdown (hanya household aggregate `income/expense/opening/closing`).
- Multi-household switching.

### Constraints
- Expo SDK 54, `react-native-pager-view` (paging) + `reanimated 4.1.1` sudah ada, `Convex`, `Clerk`.
- Household timezone via `resolveTimezone(household.timezone)` — semua bounds pakai `zonedWallToUtc` agar konsisten dengan `budgets` & `transactions`.
- Hidden account/category & permission matrix tetap seperti `PRD.md §2.3`.

---

## 2. Schema & Storage

### 2.1 `convex/schema.ts`

```ts
households: defineTable({
  name: v.string(),
  timezone: v.optional(v.string()),
  periodType: v.optional(v.union(v.literal("monthly"), v.literal("weekly"), v.literal("yearly"))), // default "monthly"
  balanceMode: v.optional(v.union(v.literal("fresh"), v.literal("carryOver"))), // default "fresh" (isolated per period, matches PRD & periodBalances fallback)
  createdAt: v.number(),
  updatedAt: v.number(),
}),

periodBalances: defineTable({
  householdId: v.id("households"),
  periodType: v.union(v.literal("monthly"), v.literal("weekly"), v.literal("yearly")),
  periodStart: v.number(), // inclusive, start of period in household TZ
  periodEnd: v.number(),   // exclusive
  income: v.number(),      // sum +income amounts in period (hidden-excluded for snapshot? household-level snapshot is canonical owner view; member queries filter? see §4.2)
  expense: v.number(),     // sum |expense| in period
  openingBalance: v.number(),
  closingBalance: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_household_period", ["householdId", "periodType", "periodStart"])
  .index("by_household_type", ["householdId", "periodType"])
```

- `budgets.periodStart` tetap; kolom `budgets.periodType` disiapkan optional untuk future weekly/yearly tapi belum dipakai.
- Backfill: `periodBalances.backfill` menghitung snapshot untuk semua periode dari `household.createdAt` s/d now (step `getPeriodBounds`), idempotent, dijalankan sekali via `npx convex run`.

### 2.2 Validation (`constants/validation.ts`)

```ts
export type PeriodType = "monthly" | "weekly" | "yearly"
export type BalanceMode = "fresh" | "carryOver"
export function validatePeriodType(v: string|undefined): string|null
export function validateBalanceMode(v: string|undefined): string|null
```

---

## 3. Period Utility (`utils/period.ts` baru)

Abstraksi agar weekly/yearly tinggal isi helper tanpa ubah caller:

```ts
export type PeriodType = "monthly" | "weekly" | "yearly"
export function getPeriodBounds(ts:number, tz:string, type:PeriodType): {start:number,end:number}
  // monthly → getMonthBounds, weekly → Monday 00:00 tz via zonedWallToUtc, yearly → Jan 1 00:00 tz
export function getPrevPeriod(start:number, tz:string, type:PeriodType): number
export function getNextPeriod(start:number, tz:string, type:PeriodType): number
export function formatPeriodLabel(start:number, tz:string, type:PeriodType): string
  // monthly → formatMonthLabel, weekly → "3–9 Mar 2026", yearly → "2026"
export function buildPeriodWindow(now:number, tz:string, type:PeriodType, count:number): {startDate:number,endDate:number, periods:{periodStart:number,label:string}[]}
```

- Home/Budgets/Transactions/Analytics import dari `utils/period.ts`, bukan langsung `getMonthBounds`.
- `utils/date.ts` tetap source of truth untuk `zonedWallToUtc`/`zonedParts`; `period.ts` re-export `getMonthBounds` wrappers.

---

## 4. Backend Logic

### 4.1 `convex/households.ts` — new mutations

- `updateBalanceMode({householdId, balanceMode})` owner-only: `validateBalanceMode`, patch `households`, then `await recomputeAll(householdId, periodType, tz)` cascade.
- `updatePeriodType({householdId, periodType})` owner-only: v1 guard `if (periodType !== "monthly") throw ConvexError("Weekly/yearly coming soon")`, patch & recompute.

### 4.2 `convex/periodBalances.ts` (new module)

- `get(householdId, periodType, periodStart)` → single snapshot or null (Home Total Balance).
- `listWindow({householdId, periodType, startDate, endDate})` → array snapshots for Cashflow 6 periods.
- `verify` & `reconcile` (mirip `accounts.verify`): compare stored vs recomputed expected; owner-only `reconcile` patches drift.
- Internal `recomputeAll(householdId, periodType, tz)`:
  1. Scan `transactions` bounded 10k via `by_household_date` gte `household.createdAt` s/d now, hidden-cache (`category.hidden`), transfer excluded, `Initial Balance` included.
  2. Group by `getPeriodBounds(row.date, tz, periodType).start`.
  3. Fresh: `opening=0, closing=income-expense` per period.
  4. CarryOver: sort asc, `opening_0=0, closing_n = closing_{n-1}+income_n-expense_n` (opening_n = closing_{n-1}), cumulative.
  5. Upsert per period (patch if exists).
  - Hidden note: snapshot disimpan sebagai canonical owner view (semua tx termasuk hidden). Untuk Member, query tetap filter hidden? v1 snapshot owner-only; Home Member tetap pakai snapshot owner? Decision: snapshot canonical, tapi `get` untuk Member akan filter? Simpler: snapshot is household truth (owner view). Member's visible balance derived via filtered recompute on read? v1 keep canonical + Member's Home shows same closing (karena balance adalah household truth, bukan per-member). PRD akan clarify: balance antar period adalah household aggregate, bukan filtered per-member visibility (sesuai clarification "total income expense dan balance dari seluruh akun").
- `recomputeFrom(periodStart)` dipanggil dari `transactions.create/update/delete` & `accounts.create` — recompute periode itu + semua periode setelahnya hingga now (loop max 60 periods, aman).
- `backfill` mutation idempotent, batch 50 periods per run.

### 4.3 `convex/transactions.ts` integration

- Setelah `applyBalanceDelta` di `create/update/delete`, panggil internal helper `scheduleRecompute(tx.date)` (via `ctx.scheduler`? atau langsung `await` dalam mutation jika masih < limit 10k). Pilihan: langsung `await recomputeFrom` dalam mutation yang sama untuk atomicity (mirip `accounts.create` atomic), bukan `ctx.runMutation`.
- `list`/`recent` tetap; Home Recent sekarang pakai `list({startDate: periodStart, endDate: periodEnd, limit:5})` bukan `recent` global.

---

## 5. Home Swipe UI (`app/(tabs)/home.tsx`)

### State
```ts
const periodType = household?.periodType ?? "monthly"
const balanceMode = household?.balanceMode ?? "fresh"
const tz = resolveTimezone(household?.timezone)
const [selectedPeriodStart, setSelectedPeriodStart] = useState(() => getPeriodBounds(Date.now(), tz, periodType).start)
useEffect(() => { // sync when tz/periodType changes
  setSelectedPeriodStart(getPeriodBounds(selectedPeriodStart, tz, periodType).start)
}, [tz, periodType])
```

### Paging
- `react-native-pager-view` (`npx expo install react-native-pager-view`) — Expo SDK 54 compat, no new native rebuild beyond EAS.
- Header sticky di luar PagerView: `<` `>` Pressable + `Text formatPeriodLabel(selectedPeriodStart, tz, periodType)` + dot indicator (3 dots, active scale with `withSpring`). Swipe handler `onPageSelected` sync `selectedPeriodStart = periods[position].start`.
- `periods` = `buildPeriodWindow(nowTick, tz, periodType, 6)` untuk PagerView children (initial 6, on-demand load prev/next via `getPrevPeriod`/`getNextPeriod`).
- Semua section bind ke `selectedPeriodStart`:
  - Total Balance card: `periodBalances.get` → show `closingBalance` (+ `openingBalance` subtle), `income/expense/net` dari snapshot.
  - Budgets pills: `budgets.list({periodStart, periodEnd: getPeriodBounds(selectedPeriodStart,tz,periodType).end})`.
  - Analytics: `DeltaCard` `closing_current - closing_prev`, `CashflowBarChart` `periodBalances.listWindow` 6 periods, `SpendingDonut` per `periodStart` window (tetap `spendingByCategory` dengan window periode atau derived dari snapshot? v1 tetap `spendingByCategory` per period window).
  - Recent Transactions: `transactions.list` filtered period.
  - My Accounts: tetap horizontal, tapi balance card tetap show live `accounts.balance`? Decision: keep live, karena my accounts adalah akun live, bukan per-period.
- Loading: `Skeleton` per page, `ConnectivityBanner` tetap.
- Memo: `PeriodPage` memo, `BudgetPill` memo existing.

### Conflicts
- PagerView vertical scroll via `ScrollView` inside each page; `PagerView` parent `flex:1`. Test on Android gesture.

---

## 6. Settings & Analytics Integration

### Settings (`app/(tabs)/settings.tsx` → Household card)
- Owner: segmented control `Fresh | Carry Over` (icons `refresh-cw` / `trending-up`), `onChange` → `households.updateBalanceMode` + `hapticSuccess` + `Snackbar` "Balance mode updated — recomputing periods…".
- Member: read-only badge `Balance: Fresh` with `info` tooltip.
- `Period Type` row disabled + `Monthly — Weekly/Yearly coming soon` label + `Chevron` disabled, prepared for future.

### Analytics
- `DeltaCard` now uses `periodBalances.closing` delta, not `net` only — label `+X% vs prev period`.
- `CashflowBarChart` data from `periodBalances.listWindow` (income/expense per snapshot).
- Timezone change: `households.updateTimezone` now also triggers `periodBalances.recomputeAll`.

### Testing & Verification
- `npx convex codegen` after schema, `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest).
- `tests/period.test.ts` (period bounds: monthly DST, weekly Monday, yearly Jan1).
- `tests/periodBalances.test.ts` via `convex-test`: fresh 2 periods, carryOver cascade, hidden exclusion (if applicable), recompute after transaction edit, owner-gate, backfill idempotent, verify/reconcile.
- Manual: create Jan tx +10k/-6k, Feb +5k; Fresh: Feb closing 5k; CarryOver: Feb closing 9k; toggle mode & verify Home Total Balance updates.

---

## 7. PRD Update Task (required)

Plan harus include explicit task **"Update `docs/Product Requirement Document/PRD.md` atas perubahan ini"** (sesuai instruksi user):
- §2.1 Household row tambah `periodType/balanceMode`.
- §2.1 baru `Period Balances` row.
- §2.2 validation rules `periodType/balanceMode`.
- §2.3 permission `Update Balance Mode` Owner-only.
- §3.2 Household extended, §3.8 Home swipeable period, §3.10 Period Balances baru.
- §6 Database Schema: `households` + `periodBalances`.
- §8 Change Log entry 2026-08-31.

---

## 8. Out of Scope / Future

- Weekly/yearly UI, recurring, export, per-account period breakdown.

---

## 9. Change Log

- 2026-08-31: Initial period-handling spec (B — materialized snapshot) — Home swipe, household balanceMode, periodBalances table, period utility extensible.
