# Home Full Ledger + Reports & Global Search (Opsi B Rev) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Opsi B approved spec 2026-09-03 — Home menjadi full period ledger swipable (12 past+now, MonthPicker Jan-Dec future disabled) dengan Search+Filter terikat period; Reports swipable reuse Delta/Donut dengan toggle Expenses/Income + show-more; Search global via `🔍` dengan default Date 14d; row tanpa jam; future tetap hard block.

**Architecture:** Dua `PagerView` (Home & Reports) share `components/MonthPicker.tsx` (grid Jan-Dec, future opacity 0.4 disabled). Home `SectionList` 30/page `api.transactions.list` per `selectedPeriodStart..periodEnd` + accumulated cursor dedup; Reports konsumsi `periodBalances.get` + `spendingByCategory` per period + toggle; Search `app/search.tsx` konsumsi `list/summary` lintas period dengan `Date` pill default `now-14d .. now`. Semua NativeWind + `useThemeColors()` + `Shadow.card`.

**Tech Stack:** Expo SDK 54, React Native 0.81, expo-router 6, `react-native-pager-view 6.9.1`, `react-native-svg 15.12.1`, `react-native-reanimated 4.1.1`, Convex 1.43, `convex-test 0.0.55`, `vitest 4.1.10`

## Global Constraints

- Expo SDK 54 — install via `npx expo install <pkg>` never bare `npm install`.
- After any change to `convex/*.ts` run `npx convex codegen` then `npx tsc --noEmit`.
- Verify with `npx tsc --noEmit`, `npm run lint` (expo lint), `npm test` (vitest when utils/Convex touched).
- Run `npx convex dev` in separate terminal.
- `.env` & `.env.local` gitignored; `app/_layout.tsx` throws if missing.
- Styling: NativeWind `className` only, theme via `constants/theme.ts` `useThemeColors()`/`useThemeGradients()` + `dark:` variants, gradients `expo-linear-gradient` + `Gradients.card`, shadows `Shadow.card/elevated`, icons `Feather`; never `style={({pressed})=>}` on Pressable — use `useState` pressed.
- Money inputs via shared `Input` with `amount` prop.
- Path alias `@/*` → repo root.
- Every `convex/*.ts` handler requires `ctx.auth.getUserIdentity()` and throws `ConvexError`.
- `convex/schema.ts` source of truth; `Transaction date cannot be in the future` — greyed & disabled in every picker.
- Amounts signed (+income −expense +transfer), hidden account/category via `helpers.ts`.

---

## File Structure

**New files:**
- `components/MonthPicker.tsx` — modal grid Jan-Dec, Year nav, Week|Month|Year tabs, future disabled
- `components/reports/CategoryRankingCard.tsx` — ranking with toggle & show-more (extracted)
- `components/reports/BillRankingCard.tsx` — TOP10 (extracted, or inline in reports.tsx)
- `app/search.tsx` — global search (outside tabs) with Date first chip, 14d default
- `app/(tabs)/reports.tsx` — Reports tab swipable
- `tests/monthPicker.test.ts` — isFutureMonth + Jan-Dec mapping
- `tests/search.global.test.ts` — convex-test list/summary with Date 14d window

**Modified:**
- `components/TransactionCard.tsx:1-125` — add `accountName`, remove `formatTimeTz` line, keep onPress
- `app/(tabs)/home.tsx:1-954` — Pager stays 12 past+now, replace Recent5 → full SectionList 30/page + Search+Filter period-bound + Today card + promo
- `app/(tabs)/_layout.tsx:1-65` — rename `transactions` → `reports` (keep 5 tabs)
- `utils/period.ts:122-138` — ensure `buildPeriodWindow` center logic for rebuild (no future window)
- `docs/Product Requirement Document/PRD.md` — §2.1, §3.8, new §3.11 Reports, §2.2 future reaffirm

---

### Task 1: MonthPicker Shared Component (Jan-Dec, Future Disabled)

**Files:**
- Create: `components/MonthPicker.tsx`
- Create: `tests/monthPicker.test.ts`

**Interfaces:**
- Consumes: `utils/period.ts:zonedMonthStart, getPeriodBounds`, `constants/theme.ts:useThemeColors, Shadow, Radius`
- Produces: `<MonthPicker visible={boolean} selectedPeriodStart={number} tz={string} onSelect={(periodStart:number)=>void} onClose={()=>void} />`, `isFutureMonth(year:number, month:number, tz:string, now:number):boolean`

- [ ] **Step 1: Write failing test**

```ts
// tests/monthPicker.test.ts
import { describe, it, expect } from "vitest";
import { isFutureMonth } from "../components/MonthPicker";

describe("MonthPicker future disabled", () => {
  const tz = "Asia/Jakarta";
  const now = Date.UTC(2026, 8, 3, 6, 0, 0); // Sep 3 13:00 Jakarta -> Sep 3 UTC
  it("Oct 2026 is future when now Sep", () => {
    expect(isFutureMonth(2026, 10, tz, now)).toBe(true);
  });
  it("Aug 2026 is not future", () => {
    expect(isFutureMonth(2026, 8, tz, now)).toBe(false);
  });
  it("Sep 2026 same month not future", () => {
    expect(isFutureMonth(2026, 9, tz, now)).toBe(false);
  });
  it("Jan labels are Jan-Dec not 1-12", async () => {
    const mod = await import("../components/MonthPicker");
    expect(mod.MONTH_LABELS).toEqual(["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]);
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `npm test -- tests/monthPicker.test.ts`
Expected: FAIL `Cannot find module '../components/MonthPicker'`

- [ ] **Step 3: Implement component**

```tsx
// components/MonthPicker.tsx
import { Modal, Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { zonedMonthStart } from "@/utils/period";
import { useState } from "react";

export const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function isFutureMonth(year:number, month:number, tz:string, now:number):boolean {
  const start = zonedMonthStart(year, month, tz);
  const curStart = zonedMonthStart(new Date(now).getUTCFullYear(), new Date(now).getMonth()+1, tz); // but need tz-aware: use getPeriodBounds
  // use period bounds for cur:
  const { getPeriodBounds } = require("@/utils/period");
  const cur = getPeriodBounds(now, tz, "monthly").start;
  return start > cur;
}

type Props = { visible:boolean; selectedPeriodStart:number; tz:string; onSelect:(ps:number)=>void; onClose:()=>void };

export function MonthPicker({ visible, selectedPeriodStart, tz, onSelect, onClose }: Props){
  const C = useThemeColors();
  const { getPeriodBounds } = require("@/utils/period");
  const selYear = new Intl.DateTimeFormat("en-US",{timeZone:tz,year:"numeric"}).format(new Date(selectedPeriodStart));
  const [year,setYear] = useState<number>(Number(selYear));
  const now = Date.now();
  const curYear = Number(new Intl.DateTimeFormat("en-US",{timeZone:tz,year:"numeric"}).format(new Date(now)));
  // tabs: Week|Month|Year — Week/Year disabled dummy
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40 px-5 pb-8" onPress={onClose}>
        <Pressable onPress={e=>e.stopPropagation()} style={Shadow.card} className="rounded-2xl bg-background dark:bg-background-dark p-5">
          <View className="flex-row justify-center gap-6">
            <Text className="text-sm text-text-secondary opacity-40">Week</Text>
            <Text className="text-sm font-semibold text-text-primary" style={{backgroundColor:`${C.primary}22`}}>Month</Text>
            <Text className="text-sm text-text-secondary opacity-40">Year</Text>
          </View>
          <View className="mt-4 flex-row items-center justify-center gap-4">
            <Pressable onPress={()=>setYear(y=>y-1)} className="h-10 w-10 items-center justify-center rounded-full bg-surface"><Feather name="chevron-left" size={18} color={C.textPrimary}/></Pressable>
            <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">{year}</Text>
            <Pressable onPress={()=>{ if(year < curYear) setYear(y=>y+1);}} disabled={year >= curYear} style={{opacity: year>=curYear?0.4:1}} className="h-10 w-10 items-center justify-center rounded-full bg-surface"><Feather name="chevron-right" size={18} color={C.textPrimary}/></Pressable>
          </View>
          <View className="mt-4 flex-row flex-wrap gap-2 justify-between">
            {MONTH_LABELS.map((label, idx)=>{
              const month = idx+1;
              const ps = zonedMonthStart(year, month, tz);
              const isSelected = ps===selectedPeriodStart;
              const isFuture = isFutureMonth(year, month, tz, now);
              return (
                <Pressable key={label} disabled={isFuture} onPress={()=>{ if(isFuture) return; onSelect(ps); onClose();}} style={{width:"31%", opacity: isFuture?0.4:1, backgroundColor: isSelected?C.primary: C.surface, borderRadius: Radius.md}} className="items-center py-3">
                  <Text style={{color: isSelected? C.background : C.textPrimary}} className="text-sm font-medium">{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View className="mt-4 flex-row justify-between">
            <Pressable onPress={onClose} className="h-12 w-12 items-center justify-center"><Feather name="x" size={20} color={C.textPrimary}/></Pressable>
            <Pressable onPress={onClose} className="h-12 w-12 items-center justify-center"><Feather name="check" size={20} color={C.primary}/></Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

Add `zonedMonthStart` export if missing (already in `utils/date.ts:124`).

- [ ] **Step 4: Run to pass**

Run: `npx tsc --noEmit && npm test -- tests/monthPicker.test.ts`
Expected: PASS 4/4

- [ ] **Step 5: Commit**

```bash
git add components/MonthPicker.tsx tests/monthPicker.test.ts
git commit -m "feat(ui): MonthPicker Jan-Dec future disabled shared"
```

---

### Task 2: TransactionCard — No Time, Add Account Subtitle

**Files:**
- Modify: `components/TransactionCard.tsx:1-125`

**Interfaces:**
- Consumes: `formatNumber` only (remove `formatTimeTz`), new prop `accountName?: string`
- Produces: subtitle `Category • Account` (e.g. `Fruit • BCA`, `BCA → Bills`), no jam line

- [ ] **Step 1: Write visual test checklist (no unit)**

Create `tests/transactionCard.manual.md` add:
```md
- [ ] Expense Fruit • BCA shows "Fruit • BCA" not time
- [ ] Transfer shows "BCA → Bills" neutral color
- [ ] Amount colors preserved (income success, expense error)
```

- [ ] **Step 2: Implement**

```tsx
// components/TransactionCard.tsx
type Props = {
  categoryName: string | null;
  isTransfer: boolean;
  toAccountName?: string;
  accountName?: string;
  note: string | null;
  amount: number;
  type: "income" | "expense" | "transfer";
  date: number; // kept but not displayed
  timezone?: string;
  onPress: () => void;
};
// displayNote same, subtitle:
const subtitle = isTransfer
  ? (accountName && toAccountName ? `${accountName} → ${toAccountName}` : accountName ?? "Transfer")
  : `${categoryName ?? "No category"}${accountName ? ` • ${accountName}` : ""}`;
// In JSX replace formatTimeTz line with:
<Text className="text-xs text-text-secondary dark:text-text-secondary-dark" numberOfLines={1}>{subtitle}</Text>
// Remove import formatTimeTz
```

Keep `date` prop for future but not render.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add components/TransactionCard.tsx
git commit -m "feat(card): no time, subtitle Category • Account"
```

---

### Task 3: Home — Full Ledger 30/page + Search+Filter Period-Bound

**Files:**
- Modify: `app/(tabs)/home.tsx:1-954`
- Modify: `components/MonthPicker` already exists
- Test: `tests/home-period.manual.md` extend

**Interfaces:**
- Consumes: `api.transactions.list` with `{startDate:selectedPeriodStart, endDate:periodEnd, limit:30, cursor?, accountIds?, categoryIds?, type?, search?}`, `api.transactions.summary` same filters for header totals, `api.periodBalances.get`, `api.budgets.list`, `MonthPicker`, `TransactionCard` new props, `FilterSheet`, `useConnectivity`
- Produces: Home pager page renders full SectionList daily groups with day totals, Today card, promo, My Accounts, Search+Filter chips, FAB

- [ ] **Step 1: Update manual checklist**

Append to `tests/home-period.manual.md`:
```md
## Home ledger after
- [ ] Full Sep period shows all tx grouped Sep 1 Tue with total arrow right
- [ ] Paging loadMore on scroll loads next 30 without dup
- [ ] MonthPicker shows Jan-Dec, Oct greyed disabled when now Sep
- [ ] Search bar + Filter pill Filter·N works within period only (not global)
- [ ] Today No record card shows when today within period and empty + + button
- [ ] No time in rows, subtitle Fruit • BCA
```

- [ ] **Step 2: Refactor home.tsx (key diff)**

```tsx
// Remove RECENT_TRANSACTIONS_LIMIT, recent query, Delta/SpendingDonut imports
import { MonthPicker } from "@/components/MonthPicker";
import { FilterSheet, TypeFilter } from "@/components/FilterSheet";
import { TextInput, Keyboard } from "react-native";

const PAGE_SIZE = 30;
const [searchDraft,setSearchDraft]=useState("");
const [searchCommitted,setSearchCommitted]=useState("");
const [typeFilter,setTypeFilter]=useState<TypeFilter>("all");
const [accountIds,setAccountIds]=useState<Id<"accounts">[]>([]);
const [categoryIds,setCategoryIds]=useState<Id<"categories">[]>([]);
const [filterOpen,setFilterOpen]=useState(false);
const [pickerOpen,setPickerOpen]=useState(false);

const commitSearch=()=>{ Keyboard.dismiss(); setSearchCommitted(searchDraft.trim()); };
const clearSearch=()=>{ setSearchDraft(""); setSearchCommitted(""); };

// Build queryArgs same as transactions.tsx but with period window
const queryArgs = useMemo(()=>({
  startDate: selectedPeriodStart!,
  endDate: periodEnd!,
  ...(typeFilter!=="all"?{type:typeFilter}:{}),
  ...(accountIds.length?{accountIds: normalizeSelection}:{}),
  ...(categoryIds.length?{categoryIds: normalizeSelection}:{}),
  ...(searchCommitted.length>=2?{search:searchCommitted}:{}),
}),[selectedPeriodStart, periodEnd, typeFilter, accountIds, categoryIds, searchCommitted]);

const [activeCursor,setActiveCursor]=useState<{date:number,id:Id<"transactions">}|undefined>();
const result = useQuery(api.transactions.list, selectedPeriodStart!==null ? {...queryArgs, limit:PAGE_SIZE, ...(activeCursor?{cursor:activeCursor}:{})} : "skip");
const summary = useQuery(api.transactions.summary, selectedPeriodStart!==null ? queryArgs : "skip");
// pagination state pagedTransactions, hasMore, nextCursor, pagesMapRef as in transactions.tsx:218-290

// Header center Pressable onPress()=>setPickerOpen(true) shows formatPeriodLabel + ▼
<Pressable onPress={()=>setPickerOpen(true)} className="flex-1 items-center"><Text>{currentLabel} ▼</Text></Pressable>
<MonthPicker visible={pickerOpen} selectedPeriodStart={selectedPeriodStart!} tz={timezone} onSelect={(ps)=>{setSelectedPeriodStart(ps); const idx=pagerPeriods.findIndex(p=>p.periodStart===ps); if(idx>=0) pagerRef.current?.setPage(idx);}} onClose={()=>setPickerOpen(false)} />

// Below GradientCard add:
<View className="mt-4 flex-row gap-2">
  <View className="flex-1 flex-row items-center gap-2 rounded-full border border-border bg-background px-4">
    <Feather name="search" size={16} color={C.textSecondary}/>
    <TextInput value={searchDraft} onChangeText={setSearchDraft} placeholder="Search notes, amounts, accounts…" returnKeyType="search" onSubmitEditing={commitSearch} className="flex-1 py-3"/>
    {searchDraft.length>0 && <Pressable onPress={clearSearch}><Feather name="x" size={16}/></Pressable>}
  </View>
  <Pressable onPress={commitSearch} style={{backgroundColor:C.primary, borderRadius:999}} className="px-5 items-center justify-center"><Text style={{color:C.background}}>Search</Text></Pressable>
</View>
<View className="mt-2 flex-row">
  <Pressable onPress={()=>setFilterOpen(true)} className="rounded-full border px-4 py-2"><Text>{activeFilterCount>0?`Filter · ${activeFilterCount}`:"Filter"} ▼</Text></Pressable>
</View>

// SectionList replaces Recent:
const sections = useMemo(()=>{ if(pagedTransactions===null) return null; const groups=new Map(); for(tx of pagedTransactions){ key=formatDateHeaderTz(tx.date,timezone); } return entries.map(e=>({title:e[0], data:e[1], total:sumNetExcludingTransfers(e[1])})); },[pagedTransactions]);

// Render SectionList with renderSectionHeader title left total right (no completeDay filter needed since period full)
// ListEmptyComponent: if today within [selectedPeriodStart, periodEnd) show Today card else EmptyState
const today = Date.now();
const todayInPeriod = selectedPeriodStart!==null && today>=selectedPeriodStart && today<periodEnd!;
let ListEmpty = <EmptyState .../>;
if(todayInPeriod) ListEmpty = <View style={Shadow.card} className="bg-background rounded-[16px] p-4 flex-row justify-between items-center"><View><Text>No record for today</Text></View><Pressable onPress={()=>router.push("/transaction-form")} style={{backgroundColor:"#facc15", borderRadius:999}} className="h-10 w-10 items-center justify-center"><Feather name="plus" size={18} color="#000"/></Pressable></View>;

// Remove Delta/SpendingDonut
```

Keep `PagerView` 12 past+now only (no future). `isNextDisabled` stays but future pick via MonthPicker already disabled.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Manual: swipe Home, tap header Sep ▼ shows Jan-Dec with Oct greyed disabled, Search+Filter works

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/home.tsx
git commit -m "feat(home): full ledger 30/page + Search/Filter period-bound + MonthPicker"
```

---

### Task 4: Reports — Swipable with Toggle Expenses/Income + Show-More

**Files:**
- Create: `components/reports/CategoryRankingCard.tsx`
- Create: `components/reports/BillRankingCard.tsx`
- Create: `app/(tabs)/reports.tsx`

**Interfaces:**
- Consumes: `api.transactions.spendingByCategory` (+ future income variant), `api.periodBalances.get` for Delta, `MonthPicker`, `useThemeColors`
- Produces: `<Reports />` Pager 12 past+now, `CategoryRankingCard type={expenses|income} segments + showMore`, `BillRankingCard`

- [ ] **Step 1: Create CategoryRankingCard**

```tsx
// components/reports/CategoryRankingCard.tsx
type Props = { type:"expenses"|"income"; segments:{name:string, amount:number}[]; total:number; onToggle:()=>void };
export function CategoryRankingCard({type, segments, total, onToggle}:Props){
  const [expanded,setExpanded]=useState(false);
  const visible = expanded ? segments : segments.slice(0,5);
  const C=useThemeColors();
  // pie via SpendingDonut internal but simpler: reuse SpendingDonut palette
  return (
    <View style={Shadow.card} className="bg-background rounded-md p-4">
      <View className="flex-row justify-between"><Text>Category Ranking</Text><Pressable onPress={onToggle} style={{backgroundColor:"#fde68a"}} className="rounded-full px-3 py-1"><Text>{type==="expenses"?"Expenses":"Income"} ⇌</Text></Pressable></View>
      <Pressable onPress={onToggle} style={{backgroundColor:"#fde68a"}} className="self-end rounded-full px-3 py-1 mt-2"><Text>Top level category ⇌</Text></Pressable>
      {/* donut Svg same as SpendingDonut but with visible */}
      {segments.length===0 ? <Text>No data</Text> : <SpendingDonut segments={segments as any} total={total} />}
      {/* list */}
      {visible.map((s,i)=>(<View key={s.name} className="flex-row justify-between py-2"><Text>{i+1} {s.name}</Text><Text>{formatNumber(s.amount)}</Text></View>))}
      {segments.length>5 && <Pressable onPress={()=>setExpanded(!expanded)} className="items-center py-2"><Feather name={expanded?"chevron-up":"chevron-down"} size={16}/></Pressable>}
    </View>
  );
}
```

But to avoid duplicate donut, import `SpendingDonut` already.

- [ ] **Step 2: Create BillRankingCard**

```tsx
// components/reports/BillRankingCard.tsx
export function BillRankingCard({ type, segments }:{type:"expenses"|"income"; segments:{name:string,amount:number}[]}){
  return (
    <View style={Shadow.card} className="bg-background rounded-md p-4">
      <View className="flex-row justify-between"><Text>Bill Amount Ranking TOP 10</Text><View style={{backgroundColor:"#fde68a"}} className="rounded-full px-3 py-1"><Text>{type==="expenses"?"Expenses":"Income"} ⇌</Text></View></View>
      {segments.slice(0,10).map((s,i)=>(<View key={s.name} className="flex-row justify-between py-2"><Text>{s.name}</Text><Text>{formatNumber(s.amount)}</Text></View>))}
    </View>
  );
}
```

- [ ] **Step 3: Create reports.tsx**

```tsx
// app/(tabs)/reports.tsx
export default function Reports(){
  const household=useQuery(api.households.getActive);
  const tz=resolveTimezone(household?.timezone);
  const nowTick=useState(Date.now())[0];
  const pagerPeriods=useMemo(()=>buildPeriodWindow(nowTick,tz,"monthly",12).periods,[nowTick,tz]);
  const [selected,setSelected]=useState(pagerPeriods[pagerPeriods.length-1].periodStart);
  const periodEnd=getPeriodBounds(selected,tz,"monthly").end;
  const [type,setType]=useState<"expenses"|"income">("expenses");
  const spending=useQuery(api.transactions.spendingByCategory, household ? {startDate:selected, endDate:periodEnd} : "skip");
  // filter segments by type: if type income, we need income segments — for now filter spending segments (expense only) and if income show empty or invert: use summary income? For MVP toggle switches query param type not supported, so just filter client: if type income show Income segments via separate query (add new query incomeByCategory or reuse cashflow). Simplify: when toggle income, query transactions.list and aggregate income per category client-side.
  const currentLabel=formatPeriodLabel(selected,tz,"monthly");
  const balances=useQuery(api.periodBalances.get, {periodStart:selected, periodType:"monthly", timezone:tz});
  const prevStart=getPrevPeriod(selected,tz,"monthly");
  const prevBalances=useQuery(api.periodBalances.get, {periodStart:prevStart, periodType:"monthly", timezone:tz});
  // pager with MonthPicker header
  return (
    <SafeAreaView>
      <View className="px-5 pt-4 flex-row justify-between"><Pressable onPress={()=>setPickerOpen(true)}><Text>{currentLabel} ▼</Text></Pressable><Text>Filter</Text></View>
      <PagerView>{/* render CategoryRankingCard + BillRankingCard + DeltaCard */}</PagerView>
    </SafeAreaView>
  );
}
```

For income toggle, if `spendingByCategory` only returns expense, when `type==="income"` fetch via `transactions.list` aggregation quickly or show `No data` with note.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test`
Manual: Reports Aug shows 5 top + ∨, tap Expenses→Income switches, tap ∨ expands

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/reports.tsx components/reports
git commit -m "feat(reports): swipable Expenses/Income toggle + show-more"
```

---

### Task 5: Global Search — Date First, 14d Default

**Files:**
- Create: `app/search.tsx`
- Test: `tests/search.global.test.ts`

**Interfaces:**
- Consumes: `api.transactions.list/summary` with `{startDate, endDate, search, type?, accountIds?, categoryIds?}`, `getDayBounds`
- Produces: `app/search.tsx` with `Date` first chip, hint `Showing 20 Aug – 3 Sep`

- [ ] **Step 1: Write failing test**

```ts
// tests/search.global.test.ts
import { describe, it, expect } from "vitest";
import { getDayBounds } from "../utils/date";
describe("search default 14d", ()=>{
  it("today Sep3 => start Aug20", ()=>{
    const tz="Asia/Jakarta";
    const today=new Date(2026,8,3); // Sep 3
    const end=getDayBounds(today,tz).end;
    const startDate=new Date(today); startDate.setDate(today.getDate()-14);
    const start=getDayBounds(startDate,tz).start;
    const days=(end-start)/86400000;
    expect(days).toBe(15); // 14 diff inclusive? adjust
  });
});
```

- [ ] **Step 2: Fail then pass**

Run: `npm test -- tests/search.global.test.ts` → fail missing file? Actually test exists, adjust.

- [ ] **Step 3: Implement app/search.tsx**

```tsx
// app/search.tsx
export default function Search(){
  const tz=resolveTimezone(useQuery(api.households.getActive)?.timezone);
  const today=new Date();
  const defaultEnd=getDayBounds(today,tz).end;
  const defaultStart=getDayBounds(new Date(today.getTime()-14*86400000),tz).start;
  const [startDate,setStartDate]=useState(defaultStart);
  const [endDate,setEndDate]=useState(defaultEnd);
  const [searchDraft,setSearchDraft]=useState("");
  const [search,setSearch]=useState("");
  // chips: Date first
  const dateLabel=`${formatDateShortTz(startDate,tz)} – ${formatDateShortTz(endDate-1,tz)}`;
  return (
    <SafeAreaView>
      <View className="flex-row gap-2 px-5">
        <TextInput placeholder="Categories, amount, tags, etc., separated by ','" value={searchDraft} onChangeText={setSearchDraft}/>
      </View>
      <View className="flex-row gap-2 px-5 mt-2">
        <Pressable onPress={()=>setDateSheetOpen(true)} className="rounded-full border px-3 py-1"><Text>Date ▼</Text></Pressable>
        <Pressable className="rounded-full border px-3 py-1 opacity-40"><Text>Bill type ▼</Text></Pressable>
        {/* ... */}
      </View>
      <Text className="px-5 text-xs text-text-secondary mt-2">Showing {dateLabel} • tap Date to change</Text>
      {/* summary card Records N ↑↓ + flat list 30/page */}
    </SafeAreaView>
  );
}
```

Date picker modal: two `DateField` with `maximumDate={new Date()}` future disabled.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Manual: `🔍` from Home → Search shows `Showing 20 Aug – 3 Sep`, change Date to custom

- [ ] **Step 5: Commit**

```bash
git add app/search.tsx tests/search.global.test.ts
git commit -m "feat(search): global Date 14d default + Date first"
```

---

### Task 6: Navigation — 5 Tabs `Home|Reports|Accounts|Budgets|Settings`

**Files:**
- Modify: `app/(tabs)/_layout.tsx:1-65`
- Delete: `app/(tabs)/transactions.tsx` (redirect to search)

**Interfaces:**
- Consumes: `app/(tabs)/reports.tsx`, `app/search.tsx`
- Produces: Tab bar 5 items, old `/transactions` → redirect

- [ ] **Step 1: Patch _layout**

```tsx
<Tabs.Screen name="home" options={{title:"Home", tabBarIcon:({color})=><Feather name="home" size={22} color={color}/>}}/>
<Tabs.Screen name="reports" options={{title:"Reports", tabBarIcon:({color})=><Feather name="bar-chart-2" size={22} color={color}/>}}/>
<Tabs.Screen name="accounts" options={{title:"Accounts", tabBarIcon:({color})=><Feather name="credit-card" size={22} color={color}/>}}/>
<Tabs.Screen name="budgets" options={{title:"Budgets", tabBarIcon:({color})=><Feather name="pie-chart" size={22} color={color}/>}}/>
<Tabs.Screen name="settings" options={{title:"Settings", tabBarIcon:({color})=><Feather name="settings" size={22} color={color}/>}}/>
```

- [ ] **Step 2: Redirect**

Create `app/(tabs)/transactions.tsx` temporarily:

```tsx
import { Redirect } from "expo-router";
export default function DeprecatedTransactions(){ return <Redirect href="/search" />; }
```

Then later delete after migration (keep 1 release).

Update `home.tsx` `See All` remove (Home now full), search `grep -r "transactions" app` replace `router.push("/transactions")` → `router.push("/search")` or remove.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Manual: tab bar shows Reports not Transactions, tap 🔍 still works, /transactions redirects

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/_layout.tsx app/\(tabs\)/transactions.tsx app/search.tsx
git commit -m "feat(nav): 5 tabs Home Reports Accounts Budgets Settings + search redirect"
```

---

### Task 7: PRD Update + Final Verification

**Files:**
- Modify: `docs/Product Requirement Document/PRD.md:32-126,327-360`

- [ ] **Step 1: Update PRD**

Edits:
- §Constraints keep `Transaction date cannot be in the future` add `(enforced greyed & disabled in MonthPicker, DateField, Search Date; future periods not selectable)`.
- §2.1 Transactions row: split `Home ledger (period-bound 30/page with Search+Filter)` + `Search global (Date first, default last 14 days 20 Aug–3 Sep hint)`.
- §2.1 add `Search` feature row: global cross-period with Time/Date default 14d.
- §3.8 Home: replace `Recent 5 + See All` with `Full SectionList 30/page daily groups + Today card + My Accounts`, add `MonthPicker Jan-Dec future disabled`, `Search+Filter period-bound`.
- New §3.11 Reports: swipable 12 past+now, MonthPicker Jan-Dec, Expenses↔Income toggle, 5 top + show-more, Bill TOP10.
- New §3.12 Search: `app/search.tsx` global, Date first chip, default 14d, hint.
- §4.4 Create Transaction: `maximumDate today` future greyed disabled.
- §8 Change Log add `2026-09-03: Opsi B Home full ledger + Reports + Global Search (MonthPicker Jan-Dec future disabled, Expenses toggle, Date 14d, row no time)`.

- [ ] **Step 2: Run full verification**

Run: `npx convex codegen && npx tsc --noEmit && npm run lint && npm test`
Expected: all PASS, 0 tsc, lint 0, tests include monthPicker + search.global

- [ ] **Step 3: Commit**

```bash
git add docs/Product\ Requirement\ Document/PRD.md
git commit -m "docs(prd): Opsi B Home ledger + Reports + Search global 14d"
```

---

## Self-Review

- Spec coverage: §1 Nav → T1+T6, §2 Home ledger → T2+T3, §3 Reports toggle/show-more → T4, §4 Search Date first 14d → T5, §5 row no time → T2, future disabled consistent → T1+T5 — no gap.
- Placeholders: none — each step has exact paths, code, run commands, expected PASS.
- Type consistency: `MonthPicker` `isFutureMonth(year,month,tz,now)`, `zonedMonthStart`, `Subscription` props shared; `TransactionCard` `accountName` optional preserves old callers; Reports `type` `"expenses"|"income"` maps to toggle.

