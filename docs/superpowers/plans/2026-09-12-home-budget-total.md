# Home Budget Total Jar + Breakdown Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Home's 3 budget pills with one tappable total jar card (total + sisa + %) that opens a scrollable bottom-sheet breakdown in Budgets-page order.

**Architecture:** Extract pure aggregation `summarizeBudgets` to `utils/budgets.ts` (tested); add two focused UI components `BudgetTotalCard` and `BudgetBreakdownSheet` modeled on `BudgetCard` jar visuals and `FilterSheet` modal pattern; rewire `app/(tabs)/home.tsx` budgets section to card + sheet with no backend changes.

**Tech Stack:** Expo SDK 54, React Native 0.81, NativeWind v4 (`className`), expo-router, `expo-linear-gradient`, Convex `api.budgets.list` read-only, vitest.

## Global Constraints

- Styling uses NativeWind `className`, never `StyleSheet.create`.
- Never use `style` callback functions on `Pressable` (e.g. `style={({ pressed }) => [...]}`) — breaks NativeWind v4; use `useState` pressed + static `style`.
- Colors via `useThemeColors()` / `useThemeGradients()` from `@/constants/theme`, never hardcoded; icons `@expo/vector-icons/Feather`.
- Money renders via `formatNumber` (bare whole numbers, thousand separators, no currency symbol); English UI copy.
- Do NOT touch `convex/*.ts`, no schema/permission changes; no `npx convex codegen` needed.
- Path alias `@/*` maps to repo root; install deps only via `npx expo install <pkg>` (no new deps expected in this plan).
- Verify with `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest — required here because Task 1 touches a pure util).

---

## File Structure

- `utils/budgets.ts` (new): pure `summarizeBudgets` + `BudgetSummaryInput` / `BudgetSummary` types. One responsibility: aggregate totals exactly like `app/(tabs)/budgets.tsx`.
- `tests/budgets.summary.test.ts` (new): unit tests for the util including redacted/over/empty cases.
- `components/BudgetTotalCard.tsx` (new): single tappable total jar card. Consumes `BudgetSummary` + jar visual language from `BudgetCard`.
- `components/BudgetBreakdownSheet.tsx` (new): bottom-sheet list. Consumes full budget array + period label; modeled on `components/FilterSheet.tsx` modal pattern.
- `app/(tabs)/home.tsx` (modify, budgets section ~lines 54–206 `BudgetPill` + ~lines 470–484 `budgetPills`/`handleBudgetPillPress` + ~lines 899–946 budgets JSX): remove `BudgetPill`, wire card + sheet, add `sheetOpen` state.

---

### Task 1: Pure util `summarizeBudgets` + test

**Files:**
- Create: `utils/budgets.ts`
- Test: `tests/budgets.summary.test.ts`

**Interfaces:**
- Consumes: budget rows shaped `{ amount: number; spent?: number }` (subset of `api.budgets.list` items).
- Produces: `summarizeBudgets(budgets: BudgetSummaryInput[]): BudgetSummary` where `BudgetSummary = { budgeted: number; spent: number; hasRedacted: boolean; progress: number; honeyLevel: number; remaining: number }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { summarizeBudgets } from "../utils/budgets";

describe("summarizeBudgets", () => {
  it("sums budgeted and spent with remaining and honey level", () => {
    const s = summarizeBudgets([
      { amount: 1000, spent: 300 },
      { amount: 500, spent: 200 },
    ]);
    expect(s).toEqual({
      budgeted: 1500,
      spent: 500,
      hasRedacted: false,
      progress: 500 / 1500,
      honeyLevel: 1 - 500 / 1500,
      remaining: 1000,
    });
  });
  it("marks redacted when any spent is undefined and zeroes progress", () => {
    const s = summarizeBudgets([
      { amount: 1000, spent: undefined },
      { amount: 500, spent: 200 },
    ]);
    expect(s.budgeted).toBe(1500);
    expect(s.spent).toBe(200);
    expect(s.hasRedacted).toBe(true);
    expect(s.progress).toBe(0);
    expect(s.honeyLevel).toBe(0);
    expect(s.remaining).toBe(1300);
  });
  it("handles over-budget and empty list", () => {
    const over = summarizeBudgets([{ amount: 500, spent: 700 }]);
    expect(over.progress).toBe(700 / 500);
    expect(over.honeyLevel).toBe(0);
    expect(over.remaining).toBe(-200);
    const empty = summarizeBudgets([]);
    expect(empty).toEqual({
      budgeted: 0,
      spent: 0,
      hasRedacted: false,
      progress: 0,
      honeyLevel: 0,
      remaining: 0,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/budgets.summary.test.ts`
Expected: FAIL with "Failed to resolve import ../utils/budgets" / "does not provide export named summarizeBudgets".

- [ ] **Step 3: Write minimal implementation**

```ts
export type BudgetSummaryInput = { amount: number; spent?: number };

export type BudgetSummary = {
  budgeted: number;
  spent: number;
  hasRedacted: boolean;
  progress: number;
  honeyLevel: number;
  remaining: number;
};

export function summarizeBudgets(budgets: BudgetSummaryInput[]): BudgetSummary {
  if (budgets.length === 0) {
    return { budgeted: 0, spent: 0, hasRedacted: false, progress: 0, honeyLevel: 0, remaining: 0 };
  }
  let budgeted = 0;
  let spent = 0;
  let hasRedacted = false;
  for (const b of budgets) {
    budgeted += b.amount;
    if (b.spent === undefined) {
      hasRedacted = true;
    } else {
      spent += b.spent;
    }
  }
  const progress = hasRedacted ? 0 : budgeted > 0 ? spent / budgeted : 0;
  const honeyLevel = hasRedacted ? 0 : Math.max(1 - progress, 0);
  return { budgeted, spent, hasRedacted, progress, honeyLevel, remaining: budgeted - spent };
}
```

This mirrors `app/(tabs)/budgets.tsx` lines 117–142 exactly (same redacted/progress/honey/remaining semantics).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/budgets.summary.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add utils/budgets.ts tests/budgets.summary.test.ts
git commit -m "feat: add summarizeBudgets util for home total jar"
```

### Task 2: `BudgetTotalCard` component

**Files:**
- Create: `components/BudgetTotalCard.tsx`
- Test: manual via `npx tsc --noEmit` + visual check in Task 4 (UI component, no unit test).

**Interfaces:**
- Consumes: `BudgetSummary` from `@/utils/budgets`; `Radius, Shadow, useThemeColors` from `@/constants/theme`; `LinearGradient` from `expo-linear-gradient`; `Feather`; `formatNumber` from `@/utils/format`.
- Produces: `BudgetTotalCard(props: { summary: BudgetSummary; jarCount: number; onPress: () => void })`.

- [ ] **Step 1: Create component file**

```tsx
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { formatNumber } from "@/utils/format";
import type { BudgetSummary } from "@/utils/budgets";

type Props = {
  summary: BudgetSummary;
  jarCount: number;
  onPress: () => void;
};

export function BudgetTotalCard({ summary, jarCount, onPress }: Props) {
  const C = useThemeColors();
  const [pressed, setPressed] = useState(false);
  const { budgeted, spent, hasRedacted, progress, honeyLevel, remaining } = summary;
  const over = !hasRedacted && progress > 1;
  const status = hasRedacted ? "SOME PRIVATE" : over ? "OVER" : progress > 0.8 ? "ALMOST EMPTY" : "ON TRACK";
  const statusColor = hasRedacted ? C.textSecondary : over ? C.error : progress > 0.8 ? C.primary : C.textSecondary;
  const caption = hasRedacted
    ? "— left • some jars private"
    : remaining >= 0
      ? `${formatNumber(remaining)} left • ${Math.round(honeyLevel * 100)}% honey`
      : `${formatNumber(Math.abs(remaining))} over • empty`;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={`Total budget ${formatNumber(budgeted)}, ${caption}`}
      style={[Shadow.card, { backgroundColor: pressed ? C.surface : C.background, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border }]}
      className="flex-row items-center gap-4 px-4 py-4"
    >
      <View style={{ width: 56, alignItems: "center", gap: 4 }}>
        <View style={{ width: 48, height: 11, borderRadius: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, marginBottom: -5, zIndex: 1, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: over ? C.error : C.primary, opacity: honeyLevel > 0 ? 0.9 : 0.25 }} />
        </View>
        <View style={{ width: 48, height: 64, borderRadius: 14, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.jarGlass, overflow: "hidden", justifyContent: "flex-end" }}>
          <View style={{ position: "absolute", left: 6, top: 6, bottom: 6, width: 6, borderRadius: 999, backgroundColor: "white", opacity: 0.55 }} />
          {hasRedacted ? (
            <View style={{ flex: 1, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}>
              <Feather name="eye-off" size={14} color={C.textSecondary} />
            </View>
          ) : (
            <View style={{ height: `${honeyLevel * 100}%`, minHeight: honeyLevel > 0 ? 14 : 0, overflow: "hidden", borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
              <LinearGradient colors={over ? [C.error, C.overBudgetDeep] : [C.primaryLight, C.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
                <View style={{ height: 8, marginTop: -1, backgroundColor: "rgba(255,255,255,0.28)", borderBottomLeftRadius: 999, borderBottomRightRadius: 999, transform: [{ scaleX: 1.15 }] }} />
              </LinearGradient>
            </View>
          )}
        </View>
        <Text style={{ color: over ? C.error : honeyLevel < 0.3 ? C.primary : C.textSecondary }} className="text-[11px] font-bold tracking-[0.08em] leading-3">
          {hasRedacted ? "—" : over ? "EMPTY" : `${Math.round(honeyLevel * 100)}%`}
        </Text>
      </View>
      <View className="flex-1 gap-1.5">
        <View className="flex-row items-center justify-between">
          <Text className="text-[11px] font-semibold uppercase leading-3 tracking-[0.08em] text-text-secondary dark:text-text-secondary-dark">
            Total • {jarCount} {jarCount === 1 ? "jar" : "jars"}
          </Text>
          <Text style={{ color: statusColor }} className="text-[11px] font-semibold tracking-[0.08em] leading-3">{status}</Text>
        </View>
        <Text className="text-[28px] font-bold leading-7 tracking-[-0.02em] tabular-nums text-text-primary dark:text-text-primary-dark">
          {formatNumber(budgeted)}
        </Text>
        <Text className="text-[13px] leading-4 tracking-wide text-text-secondary dark:text-text-secondary-dark">{caption}</Text>
        {hasRedacted ? (
          <View style={{ height: 8, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderStyle: "dashed" }} />
        ) : (
          <View style={{ height: 8, borderRadius: 999, backgroundColor: C.jarGlass, borderWidth: 1, borderColor: C.border, overflow: "hidden", padding: 2 }}>
            <View style={{ flex: 1, borderRadius: 999, backgroundColor: C.surface, overflow: "hidden" }}>
              <LinearGradient colors={over ? [C.error, C.overBudgetDeep] : [C.primaryLight, C.primary]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ width: `${honeyLevel * 100}%`, flex: 1, borderRadius: 999 }} />
            </View>
          </View>
        )}
        <Text className="text-[13px] leading-4 tracking-wide text-text-secondary dark:text-text-secondary-dark">
          {hasRedacted ? "— spent • some jars private" : `Spent ${formatNumber(spent)}`}
        </Text>
      </View>
    </Pressable>
  );
}
```

Notes: jar block copies `components/BudgetCard.tsx` proportions (48×64, cap, glass highlight, honey gradient, dot); thresholds/copy match `app/(tabs)/budgets.tsx` total header. Static `style` array only — no Pressable style callback.

- [ ] **Step 2: Typecheck the new file**

Run: `npx tsc --noEmit`
Expected: PASS (no errors in `components/BudgetTotalCard.tsx`).

- [ ] **Step 3: Commit**

```bash
git add components/BudgetTotalCard.tsx
git commit -m "feat: add BudgetTotalCard for home total jar"
```

### Task 3: `BudgetBreakdownSheet` component

**Files:**
- Create: `components/BudgetBreakdownSheet.tsx`
- Test: manual via `npx tsc --noEmit` + visual check in Task 4 (UI component, no unit test).

**Interfaces:**
- Consumes: budget rows `{ _id: string; amount: number; spent?: number; category?: { name: string; hidden: boolean; icon?: string } }`; `useThemeColors`, `Shadow` from `@/constants/theme`; `Modal/Pressable/ScrollView/Text/View` from `react-native`; `CategoryIcon`; `formatNumber`; `hapticSuccess` from `@/lib/haptics` (optional, follow FilterSheet which does not haptic — keep sheet open/close haptic in Home handlers instead).
- Produces: `BudgetBreakdownSheet(props: { visible: boolean; budgets: Row[]; periodLabel: string; onClose: () => void; onViewAll: () => void })`. Row tap closes via `onClose`. Order is pass-through (no sort inside).

- [ ] **Step 1: Create component file**

```tsx
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { Shadow, useThemeColors } from "@/constants/theme";
import { CategoryIcon } from "@/components/CategoryIcon";
import { formatNumber } from "@/utils/format";

export type BreakdownRow = {
  _id: string;
  amount: number;
  spent?: number;
  category?: { name: string; hidden: boolean; icon?: string };
};

type Props = {
  visible: boolean;
  budgets: BreakdownRow[];
  periodLabel: string;
  onClose: () => void;
  onViewAll: () => void;
};

export function BudgetBreakdownSheet({ visible, budgets, periodLabel, onClose, onViewAll }: Props) {
  const C = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} accessibilityLabel="Budget breakdown">
      <Pressable className="flex-1 justify-end bg-black/40 px-5 pb-8" onPress={onClose}>
        <Pressable className="max-h-[80%] overflow-hidden rounded-2xl bg-background p-5 dark:bg-background-dark" style={Shadow.card} onPress={(e) => e.stopPropagation()}>
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
              Budget breakdown • {periodLabel}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close breakdown" className="h-12 w-12 items-center justify-center">
              <Feather name="x" size={18} color={C.textSecondary} />
            </Pressable>
          </View>
          <ScrollView className="mt-3 flex-grow" showsVerticalScrollIndicator={false}>
            <View className="gap-3 pb-2">
              {budgets.map((b) => {
                const spent = b.spent;
                const over = spent !== undefined && spent > b.amount;
                const used = spent === undefined ? 0 : b.amount > 0 ? Math.min(spent / b.amount, 1) : spent > 0 ? 1 : 0;
                const level = spent === undefined ? 0 : Math.max(1 - used, 0);
                const remaining = spent !== undefined ? b.amount - spent : b.amount;
                return (
                  <Pressable
                    key={b._id}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel={`${b.category?.name ?? "Budget"}: ${spent !== undefined ? `${formatNumber(spent)} of ${formatNumber(b.amount)}` : "details unavailable"}`}
                    style={{ borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.background }}
                    className="flex-row items-center gap-3 px-3 py-3"
                  >
                    <View style={{ width: 34, height: 44, borderRadius: 9, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.jarGlass, overflow: "hidden", justifyContent: "flex-end" }}>
                      {spent === undefined ? (
                        <View style={{ flex: 1, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}>
                          <Feather name="eye-off" size={12} color={C.textSecondary} />
                        </View>
                      ) : (
                        <View style={{ height: `${level * 100}%`, minHeight: level > 0 ? 8 : 0 }}>
                          <LinearGradient colors={over ? [C.error, C.overBudgetDeep] : [C.primaryLight, C.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
                        </View>
                      )}
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text numberOfLines={1} className="text-[15px] font-medium text-text-primary dark:text-text-primary-dark">
                        {b.category?.name ?? "Budget"}
                      </Text>
                      <Text className="text-[13px] text-text-secondary dark:text-text-secondary-dark">
                        {spent === undefined ? "Private • frosted" : over ? `${formatNumber(Math.abs(remaining))} over • ${formatNumber(spent)} / ${formatNumber(b.amount)}` : `${formatNumber(remaining)} left • ${formatNumber(spent)} / ${formatNumber(b.amount)}`}
                      </Text>
                    </View>
                    <Text style={{ color: over ? C.error : C.textSecondary }} className="text-[11px] font-bold">
                      {spent === undefined ? "—" : over ? "EMPTY" : `${Math.round(level * 100)}%`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <Pressable onPress={onViewAll} accessibilityRole="button" accessibilityLabel="View all budgets" style={{ backgroundColor: C.primary, borderRadius: 12 }} className="mt-3 h-12 items-center justify-center">
            <Text style={{ color: C.background }} className="text-[15px] font-bold">View all budgets</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

Pattern mirrors `components/FilterSheet.tsx` lines 101–200 (backdrop + `max-h-[80%]` panel + inner `stopPropagation` + footer button). `CategoryIcon` import is kept only if an icon chip is added during implementation — otherwise remove the unused import before committing (lint will flag it).

- [ ] **Step 2: Typecheck the new file**

Run: `npx tsc --noEmit`
Expected: PASS (no errors in `components/BudgetBreakdownSheet.tsx`).

- [ ] **Step 3: Commit**

```bash
git add components/BudgetBreakdownSheet.tsx
git commit -m "feat: add BudgetBreakdownSheet for home breakdown"
```

### Task 4: Wire Home — replace pills with card + sheet

**Files:**
- Modify: `app/(tabs)/home.tsx`

**Interfaces:**
- Consumes: `summarizeBudgets` (Task 1), `BudgetTotalCard` (Task 2), `BudgetBreakdownSheet` (Task 3), existing `monthBudgets`, `shortLabel`, `router`, `hapticSuccess`.
- Produces: no new exports; budgets section renders card + sheet; empty/skeleton states preserved.

- [ ] **Step 1: Replace BudgetPill block with card + sheet wiring**

Edits (line numbers refer to current `home.tsx`):
1. Delete the `BudgetPill` component (~lines 54–206) and remove now-unused imports it alone needed (`LinearGradient`, `AccountIcon` stays only if used elsewhere — it is used by My Accounts, keep it; drop `memo`/`useState` only if unused elsewhere — `useState` is used by many states, keep).
2. Add imports:
```tsx
import { BudgetTotalCard } from "@/components/BudgetTotalCard";
import { BudgetBreakdownSheet } from "@/components/BudgetBreakdownSheet";
import { summarizeBudgets } from "@/utils/budgets";
```
3. Add state near `filterOpen/pickerOpen` (~line 324): `const [sheetOpen, setSheetOpen] = useState(false);`
4. Replace `budgetPills` memo (~lines 470–480) and `handleBudgetPillPress` (~lines 482–484) with:
```tsx
const budgetSummary = useMemo(() => {
  const budgets = monthBudgets?.budgets;
  if (!budgets || budgets.length === 0) return null;
  return summarizeBudgets(budgets);
}, [monthBudgets]);

const openSheet = useCallback(() => {
  setSheetOpen(true);
  void hapticSuccess();
}, []);
const closeSheet = useCallback(() => setSheetOpen(false), []);
const viewAllBudgets = useCallback(() => {
  setSheetOpen(false);
  router.push("/budgets");
  void hapticSuccess();
}, [router]);
```
5. Replace the budgets list JSX (~lines 926–931 `budgetPills.map(...)`) with:
```tsx
{budgetSummary && monthBudgets?.budgets && monthBudgets.budgets.length > 0 ? (
  <View className="mt-3.5">
    <BudgetTotalCard summary={budgetSummary} jarCount={monthBudgets.budgets.length} onPress={openSheet} />
  </View>
) : null}
```
Keep the header row (`Budgets` + archive icon) and the `View all` chevron (still `router.push("/budgets")`); keep the `budgetPills.length > 0` guards rewritten against `monthBudgets?.budgets?.length`; keep the empty-state block unchanged.
6. Render the sheet next to `FilterSheet` (~line 1234):
```tsx
{monthBudgets?.budgets !== undefined && (
  <BudgetBreakdownSheet
    visible={sheetOpen}
    budgets={monthBudgets.budgets}
    periodLabel={shortLabel}
    onClose={closeSheet}
    onViewAll={viewAllBudgets}
  />
)}
```
Pass the array through untouched — no `.slice()`, no `.sort()` — so sheet order always equals the Budgets tab order for the same period.

- [ ] **Step 2: Typecheck + lint the edited file**

Run: `npx tsc --noEmit`
Run: `npm run lint -- app/\(tabs\)/home.tsx components/BudgetTotalCard.tsx components/BudgetBreakdownSheet.tsx utils/budgets.ts`
Expected: PASS (fix unused imports — e.g. `memo`, `LinearGradient` — if lint flags them; `LinearGradient` is still used by the `GradientCard` balance header? No — that comes from `GradientCard`; check and remove only truly unused imports).

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/home.tsx" components/BudgetTotalCard.tsx components/BudgetBreakdownSheet.tsx utils/budgets.ts
git commit -m "feat: home total budget jar card with breakdown sheet"
```

### Task 5: Final verification + manual matrix

**Files:** none (verification only; commit docs only if changed).

- [ ] **Step 1: Run full verification**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Run: `npm test`
Expected: PASS all three (if `lint`/`test` show pre-existing failures unrelated to `home.tsx`, `BudgetTotalCard`, `BudgetBreakdownSheet`, `budgets.summary`, record them in the summary without fixing out of scope).

- [ ] **Step 2: Manual check via `expo start`**

Matrix (record pass/fail in final summary): light + dark theme; 0 budgets (empty state + Set Budget CTA); 1 budget; many budgets (sheet scrolls, `max-h 80%`); over-budget card (red, OVER/EMPTY); member + hidden category (card SOME PRIVATE + dashed bar, private rows frosted); period swipe changes card + sheet label; tap jar opens; tap card info opens; row tap closes; backdrop/X/back-button close; `View all budgets` navigates to `/budgets`; sheet list order matches Budgets tab row-for-row.

- [ ] **Step 3: Confirm no doc updates needed**

PRD/ARCHITECTURE/DESIGN describe budgets behavior, not Home layout specifics — no doc edits required. If verification changed nothing on disk, no commit; otherwise commit with `docs:` prefix.

## Self-review

- Spec coverage: §1 card → Tasks 2+4; §2 bottom-sheet pattern → Task 3; §4 data flow (same query, same aggregation, pass-through order) → Tasks 1+4; §5 states (loading/empty/private/over/offline) → Tasks 2+3+4; §7 verification → Task 5; §8 out-of-scope respected (no sort/filter/edit in sheet, no convex changes).
- Placeholder scan: no TBD/TODO; every code step shows exact code; every run step states command + expected output; no "similar to Task N" without repeated code; all referenced symbols (`summarizeBudgets`, `BudgetTotalCard`, `BudgetBreakdownSheet`, `shortLabel`, `monthBudgets`) are defined in the cited tasks/files.
- Type consistency: `BudgetSummary` fields identical in Task 1 producer and Task 2 consumer; `BreakdownRow` matches `api.budgets.list` item subset used in Task 4 (`monthBudgets.budgets` passed directly); `periodLabel: string` fed from Home's existing `shortLabel`.
