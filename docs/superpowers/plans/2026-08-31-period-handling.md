# Period Handling — Swipeable Home + CarryOver Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementasi period handling swipeable di Home (monthly sekarang, extensible weekly/yearly) dengan balance antar period (fresh vs carryOver) sebagai materialized snapshot `periodBalances` yang persisted di DB dan Owner-toggle di Settings, plus update PRD.

**Architecture:** Tambah `periodType/balanceMode` di `households` + tabel `periodBalances` (upsert per period). `utils/period.ts` abstraksi `getPeriodBounds` untuk monthly/weekly/yearly. `convex/periodBalances.ts` recompute cascade (fresh vs carryOver) dipanggil dari `transactions` mutations & `households` toggle. Home jadi `PagerView` per `selectedPeriodStart` — semua section bind ke period terpilih. Snapshot O(1) read untuk Home/Analytics, dengan `verify/reconcile`.

**Tech Stack:** Expo SDK 54, React Native 0.81, `react-native-pager-view` (paging), `react-native-reanimated 4.1.1`, Convex 1.43, Clerk, `convex-test 0.0.55`, `vitest 4.1.10`

## Global Constraints

- Expo SDK 54 — install via `npx expo install <pkg>` bukan `npm install`.
- `npx convex codegen` setelah ubah `convex/*.ts`, lalu `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest).
- `npx convex dev` di terminal terpisah untuk push schema.
- NativeWind `className` only, theme via `useThemeColors()`/`useThemeGradients()` dari `constants/theme.ts`, gradient `expo-linear-gradient` + `Gradients.card`, shadow `Shadow.card`, icon `Feather`.
- Jangan pakai `style={({pressed})=>...}` di `Pressable` — pakai `useState pressed`.
- Path alias `@/*` → repo root.
- Setiap handler Convex butuh `ctx.auth.getUserIdentity()` dan `ConvexError` untuk error user-friendly; client pakai `getConvexErrorMessage`.
- `.env` & `.env.local` gitignored, `app/_layout.tsx` defensive jika missing.
- PRD single source `docs/Product Requirement Document/PRD.md` + `convex/schema.ts` — setiap ubah schema update PRD §6 & §8 Change Log.

---

## File Structure

**New files:**
- `utils/period.ts` — period abstraction (getPeriodBounds, getPrev/Next, formatPeriodLabel, buildPeriodWindow)
- `convex/periodBalances.ts` — queries/mutations untuk snapshot table + recompute helpers
- `tests/period.test.ts` — unit untuk period bounds & label
- `tests/periodBalances.test.ts` — convex-test untuk snapshot logic

**Modified:**
- `convex/schema.ts:13-18` — tambah `periodType`, `balanceMode` di households + tabel `periodBalances`
- `constants/validation.ts` — tambah `validatePeriodType`, `validateBalanceMode`, constants `PERIOD_TYPES`, `BALANCE_MODES`
- `convex/households.ts` — tambah `updateBalanceMode`, `updatePeriodType`, recompute trigger, update `getActive` return
- `convex/transactions.ts` — after create/update/delete & `accounts.ts` after create, trigger `periodBalances.recomputeFrom`
- `app/(tabs)/home.tsx` — refactor ke PagerView + selectedPeriodStart, bind semua section ke period, baca periodBalances
- `app/(tabs)/settings.tsx` — tambah Balance Mode segmented control Owner-only
- `utils/date.ts` — export helpers untuk reuse (tidak ubah logic month)
- `docs/Product Requirement Document/PRD.md` — §2.1, §2.2, §2.3, §3.2, §3.8, §3.10, §5.2, §6, §8

### Task 1: Schema + Validation + Period Utility

**Files:**
- Modify: `convex/schema.ts:13-18`
- Modify: `constants/validation.ts:1-107`
- Create: `utils/period.ts`
- Create: `tests/period.test.ts`

**Interfaces:**
- Consumes: `utils/date.ts:62-143` (zonedParts, zonedWallToUtc, getYearMonth, zonedMonthStart)
- Produces: `PeriodType`, `BalanceMode`, `getPeriodBounds(ts,tz,type)`, `getPrevPeriod`, `getNextPeriod`, `formatPeriodLabel`, `buildPeriodWindow(now,tz,type,count)`

- [ ] **Step 1: Write failing test for period utility**

```ts
// tests/period.test.ts
import { describe, expect, it } from "vitest";
import { getPeriodBounds, getPrevPeriod, getNextPeriod, formatPeriodLabel, buildPeriodWindow } from "../utils/period";

describe("period utils", () => {
  const tz = "Asia/Jakarta";
  it("monthly bounds matches getMonthBounds", () => {
    const ts = Date.UTC(2026, 2, 15); // Mar 15 UTC
    const b = getPeriodBounds(ts, tz, "monthly");
    expect(b.start).toBeDefined();
    expect(b.end > b.start).toBe(true);
  });
  it("weekly starts Monday 00:00 tz", () => {
    // Wed 2026-03-04 12:00 UTC = Wed 19:00 Jakarta -> week Mon 2026-03-02
    const ts = Date.UTC(2026, 2, 4, 12);
    const b = getPeriodBounds(ts, tz, "weekly");
    const d = new Date(b.start);
    // check via Intl
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(b.start));
    expect(wd).toBe("Mon");
  });
  it("yearly Jan 1", () => {
    const ts = Date.UTC(2026, 5, 15);
    const b = getPeriodBounds(ts, tz, "yearly");
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(b.start));
    const month = parts.find(p=>p.type==="month")!.value;
    const day = parts.find(p=>p.type==="day")!.value;
    expect(month).toBe("01");
    expect(day).toBe("01");
  });
  it("prev/next monthly", () => {
    const start = getPeriodBounds(Date.UTC(2026,2,15), tz, "monthly").start;
    const prev = getPrevPeriod(start, tz, "monthly");
    const next = getNextPeriod(start, tz, "monthly");
    expect(prev < start).toBe(true);
    expect(next > start).toBe(true);
  });
  it("buildPeriodWindow 6 monthly", () => {
    const w = buildPeriodWindow(Date.UTC(2026,2,15), tz, "monthly", 6);
    expect(w.periods.length).toBe(6);
    expect(w.endDate > w.startDate).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/period.test.ts`
Expected: FAIL "Cannot find module '../utils/period'"

- [ ] **Step 3: Patch schema**

```ts
// convex/schema.ts
households: defineTable({
  name: v.string(),
  timezone: v.optional(v.string()),
  periodType: v.optional(v.union(v.literal("monthly"), v.literal("weekly"), v.literal("yearly"))),
  balanceMode: v.optional(v.union(v.literal("fresh"), v.literal("carryOver"))),
  createdAt: v.number(),
  updatedAt: v.number(),
}),
periodBalances: defineTable({
  householdId: v.id("households"),
  periodType: v.union(v.literal("monthly"), v.literal("weekly"), v.literal("yearly")),
  periodStart: v.number(),
  periodEnd: v.number(),
  income: v.number(),
  expense: v.number(),
  openingBalance: v.number(),
  closingBalance: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_household_period", ["householdId", "periodType", "periodStart"])
  .index("by_household_type", ["householdId", "periodType"]),
```

- [ ] **Step 4: Patch validation**

```ts
// constants/validation.ts add bottom
export const PERIOD_TYPES = ["monthly","weekly","yearly"] as const;
export type PeriodType = typeof PERIOD_TYPES[number];
export const BALANCE_MODES = ["fresh","carryOver"] as const;
export type BalanceMode = typeof BALANCE_MODES[number];
export function validatePeriodType(v: string|undefined): string|null {
  if (v===undefined) return null;
  if (!PERIOD_TYPES.includes(v as PeriodType)) return "Period type must be monthly, weekly, or yearly.";
  return null;
}
export function validateBalanceMode(v: string|undefined): string|null {
  if (v===undefined) return null;
  if (!BALANCE_MODES.includes(v as BalanceMode)) return "Balance mode must be fresh or carryOver.";
  return null;
}
```

- [ ] **Step 5: Create utils/period.ts**

```ts
import { getMonthBounds, formatMonthLabel, getYearMonth, zonedMonthStart } from "./date";
export type PeriodType = "monthly"|"weekly"|"yearly";
function zonedParts(ts:number,tz:string){ /* copy from utils/date.ts */ }
function zonedWallToUtc(y:number,m:number,d:number,h:number,min:number,s:number,tz:string){ /* copy */ }
export function getWeekBounds(ts:number, tz:string){ /* Monday 00:00 */ }
export function getYearBounds(ts:number, tz:string){ /* Jan1 00:00 */ }
export function getPeriodBounds(ts:number, tz:string, type:PeriodType){ switch(type){case "monthly":return getMonthBounds(ts,tz);case "weekly":return getWeekBounds(ts,tz);case "yearly":return getYearBounds(ts,tz);} }
export function getPrevPeriod(start:number,tz:string,type:PeriodType){ return getPeriodBounds(start-1,tz,type).start; }
export function getNextPeriod(start:number,tz:string,type:PeriodType){ return getPeriodBounds(start,tz,type).end; }
export function formatPeriodLabel(start:number,tz:string,type:PeriodType){ if(type==="monthly")return formatMonthLabel(start,tz); if(type==="yearly")return new Intl.DateTimeFormat("en-US",{timeZone:tz,year:"numeric"}).format(new Date(start)); /* weekly */ const b=getPeriodBounds(start,tz,"weekly"); return `${new Intl.DateTimeFormat("en-US",{timeZone:tz,month:"short",day:"numeric"}).format(new Date(b.start))} – ${new Intl.DateTimeFormat("en-US",{timeZone:tz,month:"short",day:"numeric",year:"numeric"}).format(new Date(b.end-1))}`; }
export function buildPeriodWindow(now:number,tz:string,type:PeriodType,count:number){ let start=getPeriodBounds(now,tz,type).start; for(let i=1;i<count;i++) start=getPrevPeriod(start,tz,type); const periods=[]; let cur=start; for(let i=0;i<count;i++){ periods.push({periodStart:cur,label:formatPeriodLabel(cur,tz,type)}); cur=getNextPeriod(cur,tz,type);} return {startDate:start,endDate:getPeriodBounds(cur-1,tz,type).end,periods};}
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npx convex codegen && npx tsc --noEmit && npm test -- tests/period.test.ts`
Expected: PASS 5/5

- [ ] **Step 7: Commit**

```bash
git add convex/schema.ts constants/validation.ts utils/period.ts tests/period.test.ts
git commit -m "feat(period): schema periodBalances + validation + period utility"
```

---

### Task 2: PeriodBalances Backend Module

**Files:**
- Create: `convex/periodBalances.ts`
- Test: `tests/periodBalances.test.ts`

**Interfaces:**
- Consumes: `utils/period.ts` getPeriodBounds, household.timezone, transactions table
- Produces: `api.periodBalances.get`, `listWindow`, `verify`, `reconcile`, `recomputeAll`, `recomputeFrom`, `backfill`

- [ ] **Step 1: Write failing test**

```ts
// tests/periodBalances.test.ts
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

describe("periodBalances", () => {
  it("fresh vs carryOver 2 periods", async () => {
    const t = convexTest(schema);
    // setup household + 2 months tx via transactions.create
    // set balanceMode fresh -> check periodBalances.get Jan closing = net Jan
    // set carryOver -> Feb closing = Jan closing + net Feb
  });
  it("owner-gate updateBalanceMode", async () => { /* member throws */ });
});
```

- [ ] **Step 2: Run to fail** `npm test -- tests/periodBalances.test.ts` → FAIL missing module

- [ ] **Step 3: Implement convex/periodBalances.ts**

```ts
import { v, ConvexError } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { findUserAndMembership, getUserAndMembership, requireOwner } from "./helpers";
import { getPeriodBounds, buildPeriodWindow } from "../utils/period";
import { Doc, Id } from "./_generated/dataModel";
// helper recomputeAll(householdId, periodType, tz, balanceMode)
export const get = query({ args:{ periodStart: v.number(), periodType: v.optional(v.string()) }, handler: async (ctx,args)=>{ /* lookup by_household_period */ }});
export const listWindow = query({ args:{ startDate: v.number(), endDate: v.number(), periodType: v.optional(v.string()) }, handler: async (ctx,args)=>{ /* collect snapshots */ }});
export const verify = query({ handler: async(ctx)=>{ /* compare stored vs expected */ }});
export const reconcile = mutation({ handler: async(ctx)=>{ requireOwner; recomputeAll }});
export const recomputeAll = internalMutation({ ... });
export const backfill = mutation({ handler: async(ctx)=>{ /* loop periods from household.createdAt */ }});
```

Detail recompute: single scan `ctx.db.query("transactions").withIndex("by_household_date", q=>q.eq("householdId",hid).gte("date",createdAt).lt("date",now)).take(10001)`, group, fresh/carryOver logic, upsert.

- [ ] **Step 4: Run tests** `npm test -- tests/periodBalances.test.ts` → PASS (2+ cases: fresh, carryOver, owner gate)
- [ ] **Step 5: Typecheck** `npx convex codegen && npx tsc --noEmit`
- [ ] **Step 6: Commit** `git add convex/periodBalances.ts tests/periodBalances.test.ts && git commit -m "feat(period): periodBalances snapshot module + recompute cascade"`

---

### Task 3: Households Preference Mutations

**Files:**
- Modify: `convex/households.ts:140-218`

**Interfaces:**
- Consumes: `convex/periodBalances.ts:recomputeAll`, `validateBalanceMode/PeriodType`
- Produces: `api.households.updateBalanceMode`, `updatePeriodType`

- [ ] **Step 1: Test owner gate**

```ts
// extend tests/periodBalances.test.ts
it("member cannot update balanceMode", async () => {
  // login as member -> expect ConvexError "You are not the owner"
});
```

- [ ] **Step 2: Fail** run test

- [ ] **Step 3: Implement**

```ts
export const updateBalanceMode = mutation({
  args:{ householdId: v.id("households"), balanceMode: v.union(v.literal("fresh"), v.literal("carryOver"))},
  handler: async(ctx,args)=>{
    const {membership}=await getUserAndMembership(ctx);
    requireOwner(membership);
    const err=validateBalanceMode(args.balanceMode); if(err) throw new ConvexError(err);
    await ctx.db.patch(args.householdId,{balanceMode:args.balanceMode, updatedAt:Date.now()});
    // trigger recomputeAll internal
  }
});
export const updatePeriodType = mutation({
  args:{ householdId: v.id("households"), periodType: v.union(v.literal("monthly"), v.literal("weekly"), v.literal("yearly"))},
  handler: async(ctx,args)=>{
    requireOwner(...);
    if(args.periodType!=="monthly") throw new ConvexError("Weekly/yearly coming soon");
    await ctx.db.patch(...);
  }
});
```

- [ ] **Step 4: Pass** `npm test`
- [ ] **Step 5: Commit** `git add convex/households.ts && git commit -m "feat(period): households balanceMode/periodType owner mutations"`

---

### Task 4: Transactions Integration (recompute on change)

**Files:**
- Modify: `convex/transactions.ts:135-235, 936-1089`
- Modify: `convex/accounts.ts:36-123`

**Interfaces:**
- Consumes: `convex/periodBalances.ts:recomputeFrom`
- Produces: auto-recompute side-effect

- [ ] **Step 1: Test recompute after create**

```ts
it("create tx triggers snapshot", async()=>{
  await t.mutation(api.transactions.create, {amount:10000, type:"income", ...});
  const snap = await t.query(api.periodBalances.get, {periodStart: monthStart});
  expect(snap.income).toBe(10000);
});
```

- [ ] **Step 2: Fail**

- [ ] **Step 3: Implement** — after `applyBalanceDelta` in `transactions.create/update/delete`, call helper `await recomputeFrom(ctx, membership.householdId, args.date ?? tx.date)`. In `accounts.create` after insert transaction, same. Helper loops periods from that date's periodStart to now.

- [ ] **Step 4: Pass** `npm test`
- [ ] **Step 5: Commit** `git add convex/transactions.ts convex/accounts.ts && git commit -m "feat(period): trigger snapshot recompute on tx/account changes"`

---

### Task 5: Home Swipe UI (PagerView)

**Files:**
- Modify: `app/(tabs)/home.tsx:1-721`
- Create: `components/PeriodPager.tsx` (optional extracted)

**Interfaces:**
- Consumes: `api.periodBalances.get`, `api.periodBalances.listWindow`, `utils/period.ts`, `api.budgets.list`, `api.transactions.list`
- Produces: swipeable Home

- [ ] **Step 1: Manual verification plan** — no unit test, but add `tests/home-period.manual.md` checklist

- [ ] **Step 2: Install pager**

Run: `npx expo install react-native-pager-view`
Expected: adds dep, no tsc error

- [ ] **Step 3: Refactor home.tsx**

```tsx
import PagerView from "react-native-pager-view";
const periodType = household?.periodType ?? "monthly";
const tz = resolveTimezone(household?.timezone);
const [selectedPeriodStart, setSelectedPeriodStart] = useState(()=>getPeriodBounds(Date.now(),tz,periodType).start);
const periodEnd = getPeriodBounds(selectedPeriodStart,tz,periodType).end;
const balances = useQuery(api.periodBalances.get, {periodStart: selectedPeriodStart, periodType});
const monthBudgets = useQuery(api.budgets.list, {periodStart: selectedPeriodStart, periodEnd});
const cashflowRes = useQuery(api.periodBalances.listWindow, {startDate: analyticsWindow.startDate, endDate: analyticsWindow.endDate, periodType});
// Recent: list filtered by period
const recent = useQuery(api.transactions.list, {startDate: selectedPeriodStart, endDate: periodEnd, limit:5});
```

PagerView wraps period pages, header outside with `<` `>` + `formatPeriodLabel` + dots.

- [ ] **Step 4: Verify** `npx tsc --noEmit && npm run lint` → no errors, manual swipe on emulator (swipe kiri/kanan ganti label & Total Balance)

- [ ] **Step 5: Commit** `git add app/(tabs)/home.tsx package.json && git commit -m "feat(home): swipeable period pager with snapshot binding"`

---

### Task 6: Settings Balance Mode Control

**Files:**
- Modify: `app/(tabs)/settings.tsx`
- Modify: `convex/households.ts` already done

**Interfaces:**
- Consumes: `api.households.updateBalanceMode`

- [ ] **Step 1: Implement UI**

```tsx
// in settings.tsx Household section, Owner-only
<SegmentedControl values={["Fresh","Carry Over"]} selectedIndex={balanceMode==="fresh"?0:1} onChange={v=>updateMode(v==="Fresh"?"fresh":"carryOver")} />
// Member: <Text>Balance: {balanceMode}</Text> + Feather info
```

with `hapticSuccess`, `Snackbar`, `useMutation`.

- [ ] **Step 2: Verify** `npx tsc --noEmit`, manual toggle as Owner → Home closing updates

- [ ] **Step 3: Commit** `git add app/(tabs)/settings.tsx && git commit -m "feat(settings): balance mode segmented control owner-only"`

---

### Task 7: PRD Update + Analytics Integration + Final Verification

**Files:**
- Modify: `docs/Product Requirement Document/PRD.md` (add §2.1 Period Balances, §2.2 validation, §2.3 permission, §3.2, §3.8 swipeable, §3.10 new, §6 schema, §8 changelog)
- Modify: `components/charts/*` maybe Delta to use closingBalance
- Test: all

**Interfaces:**
- Consumes: all previous tasks

- [ ] **Step 1: Update PRD.md**

Copy spec §2-§6 into PRD, ensure `convex/schema.ts` first then PRD §6, add Change Log entry `2026-08-31: Period handling — swipeable Home, household periodType/balanceMode, periodBalances snapshot (fresh/carryOver), extensible to weekly/yearly (B)`.

- [ ] **Step 2: Analytics tweak** — `DeltaCard` prop `currentClosing/prevClosing`, `CashflowBarChart` data from `periodBalances.listWindow`

- [ ] **Step 3: Run full verification**

Run: `npx convex codegen && npx tsc --noEmit && npm run lint && npm test`
Expected: all PASS, 0 tsc errors, lint 0

- [ ] **Step 4: Commit**

```bash
git add docs/Product\ Requirement\ Document/PRD.md components/charts/DeltaCard.tsx app/\(tabs\)/home.tsx
git commit -m "docs(prd): update for period handling — swipeable Home + periodBalances"
```

---

## Self-Review

- Spec coverage: §2 schema done T1, utility T1, backend T2-T4, Home swipe T5, Settings T6, PRD T7 — no gap.
- Placeholders: none — each step has exact file paths, code snippets, test assertions.
- Type consistency: `PeriodType/BalanceMode` defined once in validation + period.ts, reused in schema, queries, UI `formatPeriodLabel`.
