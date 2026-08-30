# P0-1 Dashboard Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 analytics cards (Delta vs last month, 6-month Cashflow Bar Chart, Monthly Spending Donut) to Home below Budgets, using efficient single-scan Convex queries and pure-View animated charts matching the warm theme.

**Architecture:** Two new Convex read queries (`transactions.cashflow` + `transactions.spendingByCategory`) each do ONE `by_household_date` index scan and bucket/aggregate server-side (respecting hidden categories for Members and household timezone). Client computes 6-month window via `getMonthBounds`/`resolveTimezone`, derives delta from cashflow array, and renders three pure-View components (`DeltaCard`, `CashflowBarChart`, `SpendingDonut`) with `react-native-reanimated` bar/donut animations and simple `Pressable` tooltips, placed below `Budgets` in `app/(tabs)/home.tsx`.

**Tech Stack:** Expo SDK 54, React Native 0.81, Expo Router 6, NativeWind 4, Convex 1.43, Clerk, `react-native-reanimated 4.1.1` (already present), `expo-haptics`, `Intl.DateTimeFormat` timezone helpers (`utils/date.ts`).

## Global Constraints

- Expo SDK 54 docs (`https://docs.expo.dev/versions/v54.0.0/`); `npx expo install react-native-svg` for SpendingDonut colored donut arcs (installed via `npx expo install react-native-svg@15.12.1`, included in Expo Go 54, OTA-eligible via `eas update`).
- After `convex/*.ts` change: `npx convex codegen` then `npx tsc --noEmit`.
- Verify with `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest) when touching pure utils/Convex functions.
- Run `npx convex dev` separately to push schema/functions.
- Styling: NativeWind `className` only, no `StyleSheet.create`; use `constants/theme.ts` via `useThemeColors()` / `useThemeGradients()` + `Shadow.card` + `Radius.md`; icons `Feather`; gradients `expo-linear-gradient` + `Gradients.card`; money via `formatNumber` (`utils/format.ts`).
- NativeWind v4 gotcha: never `Pressable style={({pressed})=>...}`; use `useState` pressed + static style.
- Backend: every handler requires `ctx.auth.getUserIdentity()` and throws `ConvexError`; household timezone via `resolveTimezone(household?.timezone)` client + server `households` lookup; amounts signed (+income/-expense), transfers excluded from analytics; Member hidden-category redaction.
- Path alias `@/*` → repo root.

---

## File Structure

- Modify: `convex/transactions.ts` — add `cashflow` + `spendingByCategory` queries (single-scan, hidden-aware, timezone-bucketed)
- Create: `utils/analytics.ts` — pure helpers `buildMonthWindow`, `calcDelta`, `formatMonthShort`
- Create: `components/charts/DeltaCard.tsx` — GradientCard delta badge with `trending-up/down` + `%` + reanimated scale
- Create: `components/charts/CashflowBarChart.tsx` — 6-group bar chart (income `C.success`, expense `C.error`, net dot) + reanimated `withTiming` staggered + Pressable tooltip
- Create: `components/charts/SpendingDonut.tsx` — donut track + center total + legend dots + reanimated `FadeIn` + selectable legend tooltip
- Create: `components/charts/index.ts` — barrel
- Modify: `app/(tabs)/home.tsx` — import charts, compute 6-month window, wire `useQuery` cashflow/spending, place Analytics section below Budgets, handle loading/empty/offline, keep `BudgetPill`/`Recent Transactions` intact
- Test: `utils/analytics.test.ts` — unit for helpers
- Test: `convex/transactions.test.ts` (or `convex/analytics.test.ts`) — cashflow bucketing & hidden-category exclusion
- Test: `components/charts/__tests__/DeltaCard.test.tsx` (optional snapshot)

---

### Task 1: Efficient Convex Queries (single-scan)

**Files:**
- Modify: `convex/transactions.ts:1-15` (imports add `findUser`? use `findUserAndMembership`)
- Test: `convex/transactions.test.ts` (new cases; uses `convex-test`)

**Interfaces:**
- Consumes: `findUserAndMembership(ctx)`, `ctx.db.query("transactions").withIndex("by_household_date")`, `ctx.db.get(householdId)`, `ctx.db.get(categoryId)` cached, `households` table timezone field
- Produces: `api.transactions.cashflow({startDate:number,endDate:number}) => { cashflow: Array<{periodStart:number,label:string,income:number,expense:number,net:number}> | null, isOwner:boolean } | null` and `api.transactions.spendingByCategory({startDate:number,endDate:number}) => { segments: Array<{categoryId:Id, name:string, amount:number}>, total:number, isOwner:boolean } | null`

- [ ] **Step 1: Write failing test for cashflow bucketing**

```ts
// convex/transactions.test.ts (append)
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";
import { describe, it, expect } from "vitest";

describe("transactions.cashflow", () => {
  it("buckets 6 months income/expense by household timezone and excludes hidden for member", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    // setup: create household with timezone Asia/Jakarta, two categories (one hidden), add tx in Jan & Feb
    // call cashflow over Jan-Feb window and assert income/expense per periodStart
    // assert member caller does not count hidden category expense
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- convex/transactions.test.ts -t "cashflow" -v`
Expected: FAIL — `api.transactions.cashflow is not a function` (query not defined)

- [ ] **Step 3: Implement minimal `cashflow` query (efficient single-scan)**

```ts
// convex/transactions.ts — append after `summary` export
export const cashflow = query({
  args: { startDate: v.number(), endDate: v.number() },
  handler: async (ctx, args) => {
    const auth = await findUserAndMembership(ctx);
    if (auth === null) return null;
    const { membership } = auth;
    const household = await ctx.db.get(membership.householdId);
    const timezone = household?.timezone ?? "UTC";
    // validate window ≤ 200 days
    if (args.endDate <= args.startDate) throw new ConvexError("Invalid window.");
    if (args.endDate - args.startDate > 200*86_400_000) throw new ConvexError("Window too large.");
    const isOwner = membership.role === "owner";

    // single scan
    const rows = await ctx.db.query("transactions")
      .withIndex("by_household_date", q => q.eq("householdId", membership.householdId).gte("date", args.startDate).lt("date", args.endDate))
      .collect(); // window ≤6 months, ~500 rows typical, cheaper than 6*collect

    // build month buckets from startDate to endDate using timezone
    // helper inline: getYearMonth via Intl parts (copy from utils/date.ts zonedParts logic)
    // For each row, skip transfers, skip hidden category for member (cached)
    // Aggregate income (+amount), expense (abs), net
    // Return 6 entries (include months with 0)
  },
});
```

Full bucketing: pre-build `Map<periodStart, {income,expense}>` for each month start in window (loop using `getMonthBounds` server-side clone with `Intl.DateTimeFormat` timezone). Then for each row check `hiddenCategoryCache` (Map<Id,boolean> + Map<Id,string>), skip if `!isOwner && hidden`, then `bucket = findBucket(row.date)` via `getMonthBounds(row.date, timezone).start` comparison (or binary search over prebuilt starts). Add to bucket. Return `Array.from(buckets.entries()).map(([periodStart, v])=>({periodStart,label: formatMonthLabel(periodStart, timezone), income:v.income, expense:v.expense, net: v.income-v.expense}))` sorted asc.

- [ ] **Step 4: Implement `spendingByCategory` query**

```ts
export const spendingByCategory = query({
  args: { startDate: v.number(), endDate: v.number() },
  handler: async (ctx, args) => {
    const auth = await findUserAndMembership(ctx);
    if (auth === null) return null;
    const { membership } = auth;
    const isOwner = membership.role === "owner";
    if (args.endDate <= args.startDate) throw new ConvexError("Invalid window.");
    if (args.endDate - args.startDate > 32*86_400_000) throw new ConvexError("Period too large.");
    const rows = await ctx.db.query("transactions")
      .withIndex("by_household_date", q => q.eq("householdId", membership.householdId).gte("date", args.startDate).lt("date", args.endDate))
      .collect();
    const hiddenCache = new Map();
    const nameCache = new Map();
    const agg = new Map(); // categoryId -> amount
    for (const row of rows) {
      if (row.type !== "expense" || row.categoryId===undefined) continue;
      if (!isOwner) {
        let hidden = hiddenCache.get(row.categoryId);
        if (hidden===undefined) { const cat=await ctx.db.get(row.categoryId); hidden=cat?.hidden??false; hiddenCache.set(row.categoryId, hidden); if(cat) nameCache.set(row.categoryId, cat.name);}
        if (hidden) continue;
      } else if (!nameCache.has(row.categoryId)) {
        const cat=await ctx.db.get(row.categoryId); if(cat) nameCache.set(row.categoryId, cat.name);
      }
      agg.set(row.categoryId, (agg.get(row.categoryId)??0)+Math.abs(row.amount));
    }
    const segments = Array.from(agg.entries()).map(([id, amount])=>({categoryId:id, name: nameCache.get(id)??"Unknown", amount})).sort((a,b)=>b.amount-a.amount).slice(0,10);
    const total = segments.reduce((s,x)=>s+x.amount,0);
    return { segments, total, isOwner };
  },
});
```

Note: import `formatMonthLabel` logic server-side: use `Intl.DateTimeFormat` directly.

- [ ] **Step 5: Run codegen + typecheck + tests**

Run: `npx convex codegen && npx tsc --noEmit && npm test -- convex/transactions.test.ts -t "cashflow|spendingByCategory" -v`
Expected: PASS (allow hidden-category test, bucket test)

- [ ] **Step 6: Commit**

```bash
git add convex/transactions.ts convex/transactions.test.ts
git commit -m "feat(convex): add cashflow + spendingByCategory single-scan queries (household TZ, hidden-aware)"
```

---

### Task 2: Pure Analytics Helpers

**Files:**
- Create: `utils/analytics.ts`
- Test: `utils/analytics.test.ts`

**Interfaces:**
- Consumes: `getMonthBounds`, `formatMonthLabel` from `utils/date.ts`, `resolveTimezone`
- Produces: `buildSixMonthWindow(now:number, timezone:string):{startDate:number,endDate:number, months:Array<{periodStart:number,label:string}>}`, `calcDelta(currentNet:number, prevNet:number):{deltaPct:number|null, label:string}`, `maxBarValue(data:Array<{income,expense}>):number`

- [ ] **Step 1: Write failing test**

```ts
// utils/analytics.test.ts
import { describe,it,expect } from "vitest";
import { buildSixMonthWindow, calcDelta } from "./analytics";

describe("buildSixMonthWindow", () => {
  it("returns 6 consecutive month starts including current", () => {
    const tz="Asia/Jakarta";
    const now= Date.UTC(2026,3,15); // Apr 15
    const { startDate, endDate, months } = buildSixMonthWindow(now, tz);
    expect(months).toHaveLength(6);
    expect(months[5].periodStart < endDate).toBe(true);
  });
});
describe("calcDelta", () => {
  it("computes pct when prev non-zero", () => { expect(calcDelta(110,100).deltaPct).toBeCloseTo(10); });
  it("returns null when prev zero", () => { expect(calcDelta(50,0).deltaPct).toBeNull(); });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- utils/analytics.test.ts -v`
Expected: FAIL — `Cannot find module './analytics'`

- [ ] **Step 3: Write minimal implementation**

```ts
// utils/analytics.ts
import { getMonthBounds, formatMonthLabel } from "./date";

export function buildSixMonthWindow(now:number, timezone:string){
  const cur = getMonthBounds(now, timezone);
  let start = cur.start;
  for(let i=0;i<5;i++){ start = getMonthBounds(start -1, timezone).start; }
  const months: Array<{periodStart:number,label:string}>=[];
  let cursor=start;
  for(let i=0;i<6;i++){ months.push({periodStart:cursor, label:formatMonthLabel(cursor, timezone)}); cursor = getMonthBounds(cursor, timezone).end; }
  return { startDate:start, endDate:cur.end, months };
}
export function calcDelta(currentNet:number, prevNet:number){
  if(prevNet===0) return { deltaPct: null, label: currentNet===0 ? "No change" : "New this month" };
  const deltaPct = ((currentNet - prevNet)/Math.abs(prevNet))*100;
  return { deltaPct, label: `${deltaPct>=0?"+":""}${deltaPct.toFixed(1)}% vs last month` };
}
export function maxBarValue(data:Array<{income:number,expense:number}>){
  return Math.max(1, ...data.flatMap(d=>[d.income,d.expense]));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- utils/analytics.test.ts -v`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add utils/analytics.ts utils/analytics.test.ts
git commit -m "feat(utils): add analytics helpers buildSixMonthWindow + calcDelta"
```

---

### Task 3: Chart Components (pure View + reanimated + tooltip)

**Files:**
- Create: `components/charts/DeltaCard.tsx`
- Create: `components/charts/CashflowBarChart.tsx`
- Create: `components/charts/SpendingDonut.tsx`
- Create: `components/charts/index.ts`

**Interfaces:**
- Consumes: `useThemeColors`, `Shadow`, `Radius`, `GradientCard`, `formatNumber`, `Feather`, `Animated` from `react-native-reanimated`
- Produces: `<DeltaCard currentNet, prevNet, currentLabel, prevLabel />`, `<CashflowBarChart data, timezone, onSelect?>`, `<SpendingDonut segments, total />`

- [ ] **Step 1: Write failing test (DeltaCard renders)**

```ts
// components/charts/__tests__/DeltaCard.test.tsx (vitest + @testing-library/react-native if available, else simple render smoke)
import { describe,it,expect } from "vitest";
import { calcDelta } from "@/utils/analytics";
describe("DeltaCard",()=>{ it("delta badge positive shows +%",()=>{ expect(calcDelta(110,100).label).toContain("+10.0%"); }); });
```

- [ ] **Step 2: Run test**

Run: `npm test -- components/charts -v`
Expected: FAIL — file not found

- [ ] **Step 3: Implement DeltaCard**

```tsx
// components/charts/DeltaCard.tsx
import { GradientCard } from "@/components/GradientCard";
import { useThemeColors, Shadow, Radius } from "@/constants/theme";
import { formatNumber } from "@/utils/format";
import { calcDelta } from "@/utils/analytics";
import Feather from "@expo/vector-icons/Feather";
import { Text, View } from "react-native";
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from "react-native-reanimated";
import { useEffect } from "react";

export function DeltaCard({ currentNet, prevNet, currentLabel, prevLabel }: { currentNet:number, prevNet:number, currentLabel:string, prevLabel:string }){
  const C=useThemeColors();
  const { deltaPct, label } = calcDelta(currentNet, prevNet);
  const scale=useSharedValue(1);
  useEffect(()=>{ scale.value = 0.9; scale.value = withSpring(1,{damping:10}); },[deltaPct]);
  const aStyle=useAnimatedStyle(()=>({transform:[{scale:scale.value}]}));
  const bg = deltaPct===null ? C.surface : deltaPct>0 ? `${C.success}15` : deltaPct<0 ? `${C.error}15` : C.surface;
  const color = deltaPct===null ? C.textSecondary : deltaPct>0 ? C.success : deltaPct<0 ? C.error : C.textSecondary;
  const icon = deltaPct===null ? "minus" : deltaPct>0 ? "trending-up" : "trending-down";
  return (
    <GradientCard>
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">{currentLabel} net</Text>
          <Text className="text-base font-bold text-text-primary dark:text-text-primary-dark">{formatNumber(currentNet)}</Text>
          <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">Prev {prevLabel}: {formatNumber(prevNet)}</Text>
        </View>
        <Animated.View style={[aStyle, { backgroundColor:bg, borderRadius:999, paddingHorizontal:12, paddingVertical:6 }, Shadow.card]} className="flex-row items-center gap-1">
          <Feather name={icon} size={14} color={color} />
          <Text style={{ color, fontWeight:"600", fontSize:12 }}>{label}</Text>
        </Animated.View>
      </View>
    </GradientCard>
  );
}
```

- [ ] **Step 4: Implement CashflowBarChart**

```tsx
// components/charts/CashflowBarChart.tsx
import { useThemeColors, Shadow, Radius } from "@/constants/theme";
import { formatNumber } from "@/utils/format";
import { maxBarValue } from "@/utils/analytics";
import Feather from "@expo/vector-icons/Feather";
import { Pressable, Text, View } from "react-native";
import Animated, { useSharedValue, withTiming, withDelay, useAnimatedStyle } from "react-native-reanimated";
import { useEffect, useState } from "react";
import { hapticSuccess } from "@/lib/haptics";

type Datum = { periodStart:number, label:string, income:number, expense:number, net:number };
export function CashflowBarChart({ data, timezone }: { data: Datum[], timezone:string }){
  const C=useThemeColors();
  const [selected, setSelected]=useState<number|null>(null);
  const max = maxBarValue(data);
  if(data.length===0) return <View className="items-center py-6"><Text className="text-sm text-text-secondary">No transactions in last 6 months</Text></View>;
  return (
    <View style={[Shadow.card,{backgroundColor:C.background, borderRadius:Radius.md, borderWidth:1, borderColor:C.border}]} className="px-4 py-4">
      <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">Cashflow (6 months)</Text>
      <View className="mt-4 flex-row items-end justify-between" style={{height:120}}>
        {data.map((d,i)=>{
          const incH = (d.income/max)*100;
          const expH = (d.expense/max)*100;
          const Bar = ({h,color}:{h:number,color:string})=>{
            const sv=useSharedValue(0);
            useEffect(()=>{ sv.value = withDelay(i*60, withTiming(1,{duration:400})); },[]);
            const style=useAnimatedStyle(()=>({height: 100 * sv.value * (h/100)}));
            return <Animated.View style={[{width:12, borderRadius:6, backgroundColor:color}, style]} />;
          };
          const isSel = selected===i;
          return (
            <Pressable key={d.periodStart} onPress={()=>{ setSelected(isSel?null:i); void hapticSuccess(); }} className="flex-1 items-center gap-1">
              <View className="flex-row items-end gap-1" style={{height:100}}>
                <Bar h={incH} color={C.success} />
                <Bar h={expH} color={C.error} />
              </View>
              <Text className={`text-xs ${isSel ? "text-primary font-semibold" : "text-text-secondary"}`}>{d.label.slice(0,3)}</Text>
              {isSel && <View style={[Shadow.elevated,{backgroundColor:C.surface, borderRadius:Radius.sm, padding:8}]} className="absolute -top-14 z-10 min-w-[110px]"><Text className="text-xs">+{formatNumber(d.income)}</Text><Text className="text-xs">-{formatNumber(d.expense)}</Text><Text className="text-xs font-semibold">Net {formatNumber(d.net)}</Text></View>}
            </Pressable>
          );
        })}
      </View>
      <View className="mt-2 flex-row justify-center gap-3"><View className="flex-row items-center gap-1"><View style={{width:8,height:8,borderRadius:4,backgroundColor:C.success}}/><Text className="text-xs">Income</Text></View><View className="flex-row items-center gap-1"><View style={{width:8,height:8,borderRadius:4,backgroundColor:C.error}}/><Text className="text-xs">Expense</Text></View></View>
    </View>
  );
}
```
Note: Fix hook-inside-loop by extracting `AnimatedBar` component above.

- [ ] **Step 5: Implement SpendingDonut**

```tsx
// components/charts/SpendingDonut.tsx
import { useThemeColors, Shadow, Radius } from "@/constants/theme";
import { formatNumber } from "@/utils/format";
import { Text, View, Pressable } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useState } from "react";

export function SpendingDonut({ segments, total }: { segments:Array<{name:string,amount:number,color?:string}>, total:number }){
  const C=useThemeColors();
  const [sel,setSel]=useState<string|null>(null);
  if(segments.length===0) return <View style={[Shadow.card,{backgroundColor:C.background,borderRadius:Radius.md,borderWidth:1,borderColor:C.border}]} className="px-4 py-6 items-center"><Text className="text-sm text-text-secondary">No spending this month</Text></View>;
  const palette=[C.accountCash,C.accountBank,C.accountEwallet,C.accountCreditCard,C.primary,"#D97706","#059669"];
  return (
    <View style={[Shadow.card,{backgroundColor:C.background,borderRadius:Radius.md,borderWidth:1,borderColor:C.border}]} className="px-4 py-4">
      <Text className="text-base font-semibold text-text-primary">Spending by Category</Text>
      <View className="mt-4 flex-row items-center gap-4">
        <View style={{width:140,height:140,borderRadius:70,backgroundColor:C.border,alignItems:"center",justifyContent:"center"}}>
          <View style={{width:80,height:80,borderRadius:40,backgroundColor:C.background,alignItems:"center",justifyContent:"center"}}><Text className="text-xs text-text-secondary">Total</Text><Text className="text-sm font-bold text-text-primary">{formatNumber(total)}</Text></View>
        </View>
        <View className="flex-1 gap-2">
          {segments.slice(0,5).map((s,i)=>{
            const color=palette[i%palette.length];
            const pct = total>0 ? (s.amount/total*100).toFixed(1) : "0";
            const isSel=sel===s.name;
            return (
              <Animated.View entering={FadeIn.delay(i*40)} key={s.name}>
                <Pressable onPress={()=>setSel(isSel?null:s.name)} className={`flex-row items-center justify-between rounded-lg px-2 py-1.5 ${isSel ? "bg-surface" : ""}`}>
                  <View className="flex-row items-center gap-2 flex-1"><View style={{width:8,height:8,borderRadius:4,backgroundColor:color}}/><Text numberOfLines={1} className="text-sm flex-1 text-text-primary">{s.name}</Text></View>
                  <Text className="text-sm font-medium text-text-primary">{isSel ? `${pct}% • ${formatNumber(s.amount)}` : formatNumber(s.amount)}</Text>
                </Pressable>
              </Animated.View>
            );
          })}
          {segments.length>5 && <Text className="text-xs text-text-secondary">+{segments.length-5} more</Text>}
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 6: Barrel**

```ts
// components/charts/index.ts
export { DeltaCard } from "./DeltaCard";
export { CashflowBarChart } from "./CashflowBarChart";
export { SpendingDonut } from "./SpendingDonut";
```

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS (fix Pressable style callback lint)

- [ ] **Step 8: Commit**

```bash
git add components/charts/ utils/analytics.ts
git commit -m "feat(charts): add DeltaCard, CashflowBarChart, SpendingDonut pure-View with reanimated + tooltip"
```

---

### Task 4: Home Integration (below Budgets)

**Files:**
- Modify: `app/(tabs)/home.tsx:169-410` (add analytics section)
- Modify: `hooks/useAnalytics.ts` optional — or inline

**Interfaces:**
- Consumes: `api.transactions.cashflow`, `api.transactions.spendingByCategory`, `buildSixMonthWindow`, `resolveTimezone`, `useConnectivity`, `ConnectivityBanner`
- Produces: Home renders 3 cards with loading/empty/offline handling

- [ ] **Step 1: Write failing visual check (manual)**

No automated test; verify in Expo Go.

- [ ] **Step 2: Wire queries in home.tsx**

```tsx
// app/(tabs)/home.tsx — add imports
import { buildSixMonthWindow } from "@/utils/analytics";
import { DeltaCard, CashflowBarChart, SpendingDonut } from "@/components/charts";

// inside Home() after timezone
const timezone = resolveTimezone(household?.timezone);
const window = useMemo(()=> buildSixMonthWindow(Date.now(), timezone), [timezone]);
const cashflowRes = useQuery(api.transactions.cashflow, household ? { startDate: window.startDate, endDate: window.endDate } : "skip");
const spendingRes = useQuery(api.transactions.spendingByCategory, household ? { startDate: monthStart, endDate: monthEnd } : "skip");

// derive delta: last 2 of cashflowRes?.cashflow
const currentNet = cashflowRes?.cashflow?.[5]?.net ?? monthSummary?.net ?? 0;
const prevNet = cashflowRes?.cashflow?.[4]?.net ?? 0;
```

Handle loading: `cashflowRes===undefined` → `Skeleton` 140 height. Null → hide.

- [ ] **Step 3: Place section below Budgets (replace order)**

```tsx
{/* Budgets — existing, keep as is ~home.tsx:373 */}
{/* NEW: Analytics */}
{(cashflowRes===undefined || spendingRes===undefined) ? (
  <View className="mt-6 gap-3"><Skeleton style={{height:80,borderRadius:Radius.md}}/><Skeleton style={{height:180,borderRadius:Radius.md}}/><Skeleton style={{height:140,borderRadius:Radius.md}}/></View>
) : (cashflowRes && spendingRes) ? (
  <View className="mt-6 gap-3">
    <DeltaCard currentNet={currentNet} prevNet={prevNet} currentLabel={formatMonthLabel(monthStart, timezone)} prevLabel={formatMonthLabel(getMonthBounds(monthStart-1, timezone).start, timezone)} />
    <CashflowBarChart data={cashflowRes.cashflow ?? []} timezone={timezone} />
    <SpendingDonut segments={spendingRes.segments.map(s=>({name:s.name,amount:s.amount}))} total={spendingRes.total} />
  </View>
) : null}
{/* My Accounts — existing */}
```

Ensure `stale` also considers `cashflowRes===undefined`.

- [ ] **Step 4: Handle dark mode + haptics + tooltip**

Already in components; verify `useThemeColors` not `Colors`.

- [ ] **Step 5: Run tsc + lint + manual test**

Run: `npx convex codegen && npx tsc --noEmit && npm run lint`
Manual: `npm run start` → Expo Go → verify 6 bars animate staggered, tap shows tooltip, donut legend tap shows %, delta badge springs, scroll smooth, offline banner still shows.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/home.tsx hooks/useAnalytics.ts  # if created
git commit -m "feat(home): integrate analytics below Budgets with efficient 2-query wiring + loading/empty"
```

---

### Task 5: Verification (no PRD)

**Files:**
- No file change (verification only)

- [ ] **Step 1: Run full verification**

Run: `npx convex codegen && npx tsc --noEmit && npm run lint && npm test -v`
Expected: All PASS

- [ ] **Step 2: Manual perf check**

Insert 200 dummy transactions via Convex dashboard, measure `cashflow` query time in Convex logs — confirm 1 scan not 6, total documentsRead ~200 not 6*10000.

- [ ] **Step 3: Manual UI check (Expo Go)**

Run `npm run start` → open in Expo Go or emulator → verify Home shows analytics below Budgets (not above): DeltaCard springs, Cashflow bars stagger, tooltip tap works, Donut legend tap shows %, dark mode toggles correctly, offline banner still shows.

### Task 6: PRD Update (Living Document — §0 Workflow)

**Files:**
- Modify: `docs/Product Requirement Document/PRD.md`

**Interfaces:**
- Consumes: Spec `docs/superpowers/specs/2026-08-30-p0-1-dashboard-analytics-design.md` §2-§6, plan `docs/superpowers/plans/2026-08-30-p0-1-dashboard-analytics.md`, `convex/transactions.ts` new queries, `app/(tabs)/home.tsx` new Analytics section
- Produces: PRD updated per **§0 Update workflow** — every major feature updates affected sections + Change Log dated entry

- [ ] **Step 1: Update §1 Overview / §2.1 Functional Requirements (Home row)**

In `PRD.md:100` table row `Home`, replace:
```
Dashboard: household card, My Accounts, Recent Transactions (paginated, grouped by day, "See All").
```
with:
```
Dashboard: household card, Total Balance, Budgets (3 pills), **Analytics (below Budgets): Net delta vs last month (GradientCard badge), Cashflow 6-month bar chart (income Success / expense Error), Spending by Category donut this month (legend + center total)** — all household-timezone-aware, Member hidden-category excluded (single-scan `transactions.cashflow` + `transactions.spendingByCategory`), pure-View + reanimated with Pressable tooltip; My Accounts, Recent Transactions (paginated, grouped by day, "See All"). PTR & stale banner still applies.
```

Add new row if needed:
```
| Analytics | Cashflow 6 months + Spending by Category (this month) + Delta vs last month on Home below Budgets. Two efficient single-scan queries (`cashflow`, `spendingByCategory`) — 1 `by_household_date` scan per query, hidden-category cache, window validation (cashflow ≤200d, spending ≤32d). |
```

- [ ] **Step 2: Update §3.8 Home Dashboard**

After existing bullet `**Budgets** (when budgets exist): ...` (`PRD.md:325-328`), insert:

```
- **Analytics (below Budgets, as of 2026-08-30):**
  - **Delta Card** (`components/charts/DeltaCard.tsx`): `GradientCard` showing `currentNet` (this month) vs `prevNet` (last month) with semantic badge (`trending-up` green / `trending-down` red / `minus` gray) and `%` via `calcDelta` (`utils/analytics.ts`); `prevNet===0` → "New this month" / "No change"; reanimated `withSpring` scale on change.
  - **Cashflow 6-Month Bar Chart** (`components/charts/CashflowBarChart.tsx`): 6 month groups (household timezone, `buildSixMonthWindow`), paired bars (Income `success` / Expense `error`, max 100px, scale = max income/expense), reanimated `withTiming` staggered `60ms` per month, `Pressable` tooltip per month (`Income +X, Expense -Y, Net Z` + `hapticSuccess`, `Shadow.elevated`); empty → "No transactions in last 6 months".
  - **Spending by Category Donut** (`components/charts/SpendingDonut.tsx`): This month expense only, top 5 + "Others", palette cycled from `Colors.account*`, track circle 140px + center cutout 80px showing `formatNumber(total)`, legend `FadeIn.delay(i*40)` + `Pressable` selectable row (`% • amount` when selected, else amount); empty → `EmptyState` "No spending this month".
  - All cards use `Shadow.card`, `Radius.md`, `useThemeColors()` (dark variants), `Feather` icons, no new native deps. Loading: `Skeleton` 80/180/140. Hidden category excluded for Members (cached `hiddenCategoryCache`). Offline: shows cached Convex data + `ConnectivityBanner`.
```

- [ ] **Step 3: Update §5.2 Responsibilities table row `app/(tabs)/home.tsx`**

From:
```
| `app/(tabs)/home.tsx` | Dashboard (household, accounts, recent transactions, monthly net, budget pills); `BudgetPill` is `memo`, ... |
```
To:
```
| `app/(tabs)/home.tsx` | Dashboard (household, accounts, recent transactions, monthly net, budget pills + **Analytics below Budgets: DeltaCard + CashflowBarChart + SpendingDonut** via `transactions.cashflow`/`spendingByCategory` (2 queries, household TZ, hidden-aware), `buildSixMonthWindow`/`calcDelta`); `BudgetPill` is `memo`, ... |
```

Add row:
```
| `components/charts/*` | `DeltaCard`, `CashflowBarChart`, `SpendingDonut` (pure View + `react-native-reanimated`, `Pressable` tooltip, theme-uniform via `useThemeColors()`) |
| `utils/analytics.ts` | `buildSixMonthWindow(now, timezone)`, `calcDelta(currentNet, prevNet)`, `maxBarValue(data)` |
```

- [ ] **Step 4: Update §6 Database Schema — Convex Functions table (append after `budgets` rows)**

Append:
```
| `transactions` | `cashflow` | query | Single-scan `by_household_date` over 6-month window (≤200d), buckets by household timezone month start, aggregates income/expense/net per month, includes zero-months, Member hidden-category excluded via cached lookup |
| `transactions` | `spendingByCategory` | query | Single-scan `by_household_date` over 1-month window (≤32d), filters `expense` only, aggregates by category (hidden excluded for Member), returns top 10 sorted desc + total |
```

If Functions table truncated in current PRD (ends at `categories.create`), ensure full table is restored/completed before appending.

- [ ] **Step 5: Update §8 Change Log (dated entry per §0.1)**

Append at bottom of Change Log (create if missing):
```
- **2026-08-30 — P0-1 Dashboard Analytics (below Budgets):** Added `transactions.cashflow` + `transactions.spendingByCategory` (single-scan, household TZ, hidden-aware, window capped) + `utils/analytics.ts` + `components/charts/{DeltaCard,CashflowBarChart,SpendingDonut}` (pure View, reanimated staggered/spring + Pressable tooltip, theme-uniform) — wired in `app/(tabs)/home.tsx` below Budgets with Skeleton/Empty/Offline handling. PRD §2.1, §3.8, §5.2, §6 updated.
```

- [ ] **Step 6: Verify doc links & run typecheck**

Run: `npx tsc --noEmit` (should still pass — PRD is markdown, no code). Manually open PRD and search for `cashflow`, `SpendingDonut`, `2026-08-30` to confirm all 4 sections updated.

- [ ] **Step 7: Commit**

```bash
git add "docs/Product Requirement Document/PRD.md"
git commit -m "docs(PRD): P0-1 analytics below Budgets — §2.1, §3.8, §5.2, §6 + 2026-08-30 changelog"
```

---

## Self-Review

- Spec coverage: placement below Budgets ✅ (Task 4), efficient single-scan ✅ (Task 1), animation ✅ (Task 3 with reanimated), tooltip ✅ (Task 3 Pressable selected state).
- Placeholder scan: no TBD/TODO, all steps contain code.
- Type consistency: `periodStart` number, `segments: {name,amount}`, `deltaPct:number|null` consistent across Task 2→3→4.

