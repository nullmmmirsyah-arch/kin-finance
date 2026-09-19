# Budget Suggestion Quick-Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show 3 tappable suggestion chips (last budget, last spent, 3-month average) in budget create form that autofill Amount.

**Architecture:** New Convex query `budgets.suggestion` computes prev-month budget + prev-month spent + 3-month average spent server-side (tz-aware via `utils/periodTime`); `app/budget-form.tsx` create-mode renders a suggestion box under Category that fills Amount on tap.

**Tech Stack:** Expo SDK 54, Convex (query + convex-test), React Native + NativeWind v4 (`className`), `useThemeColors`, vitest, `formatAmountInput`/`formatNumber`.

## Global Constraints

- Styling uses NativeWind `className`, never `StyleSheet.create`.
- Never use `style` callback functions on `Pressable` (e.g. `style={({ pressed }) => [...]}`) — breaks NativeWind v4; use `useState` pressed + static `style` if pressed styling is needed.
- Colors via `useThemeColors()` from `@/constants/theme`, never hardcoded; icons `@expo/vector-icons/Feather`.
- Money/amount inputs use shared `Input` with `amount` prop; fill via `formatAmountInput(String(n))`; never format ad hoc.
- After any change to `convex/*.ts`, run `npx convex codegen` first, then `npx tsc --noEmit`.
- Install deps only via `npx expo install <pkg>` (no new deps expected in this plan).
- Every `convex/*.ts` handler requires sign-in handling via `findUserAndMembership`/`getUserAndMembership` and throws `ConvexError` on operational errors.
- Path alias `@/*` maps to repo root.
- Verify with `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest — required because Task 1 touches a Convex function).

---

## File Structure

- `convex/budgets.ts` (modify, append new `suggestion` query ~line 220): one responsibility — suggestion computation (prev-month bounds, prev budget lookup, 3-month spent aggregation). Imports `getPrevPeriod`, `getMonthBounds`, `formatMonthLabel` from `../utils/periodTime` (relative import; precedent: `convex/transactionAnalytics.ts` line 6) and `validateTimezone` from `../constants/validation`.
- `tests/budgets.suggestion.test.ts` (new): convex-test coverage for the query (prevBudget present/absent, spent sums, average with empty month, isolation, unauthenticated).
- `app/budget-form.tsx` (modify, insert suggestion box between `SelectField` ~lines 229-237 and `Input Amount` ~lines 239-247): one responsibility — create-mode suggestion UI + tap-to-fill. Consumes `api.budgets.suggestion` via `useQuery` with `"skip"` when edit/no-category.

---

### Task 1: `budgets.suggestion` query + convex-test

**Files:**
- Modify: `convex/budgets.ts`
- Test: `tests/budgets.suggestion.test.ts`

**Interfaces:**
- Consumes: `findUserAndMembership(ctx)` from `./helpers`; `getPrevPeriod(start, tz, "monthly")`, `getMonthBounds(ts, tz)`, `formatMonthLabel(ts, tz)` from `../utils/periodTime`; `validateTimezone` from `../constants/validation`; existing indexes `by_category_period`, `by_household_date`.
- Produces: `suggestion(args: { categoryId: Id<"categories">, periodStart: number, timezone: string }) => { prevPeriodStart: number, prevLabel: string, prevBudget: number | null, prevSpent: number, avgSpent: number, hasHistory: boolean } | null`.

- [ ] **Step 1: Write the failing test**

```ts
/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { getMonthBounds, formatMonthLabel } from "../utils/periodTime";

const OWNER_TOKEN = "owner|suggestion-test";
const TZ = "Asia/Jakarta";

describe("budgets.suggestion", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed(ctx: any) {
    const householdId = await ctx.db.insert("households", {
      name: "Sugg HH",
      timezone: TZ,
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerId = await ctx.db.insert("users", {
      tokenIdentifier: OWNER_TOKEN,
      clerkUserId: "clerk-owner-sugg",
    });
    await ctx.db.insert("householdMemberships", { householdId, userId: ownerId, role: "owner" });
    const accountId = await ctx.db.insert("accounts", {
      householdId, name: "Cash", type: "asset", subType: "cash",
      balance: 0, hidden: false, createdAt: 1, updatedAt: 1,
    });
    const catId = await ctx.db.insert("categories", {
      householdId, name: "Food", type: "expense", hidden: false, createdAt: 1, updatedAt: 1,
    });
    return { householdId, ownerId, accountId, catId };
  }

  async function insertTx(ctx: any, s: any, date: number, amount: number) {
    await ctx.db.insert("transactions", {
      householdId: s.householdId, accountId: s.accountId, categoryId: s.catId,
      amount, type: "expense", date,
      createdBy: s.ownerId, updatedBy: s.ownerId, createdAt: 1, updatedAt: 1,
    });
  }

  it("returns prevBudget, prevSpent and 3-month average", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { s, periodStart } = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const now = Date.UTC(2026, 8, 15);
      const cur = getMonthBounds(now, TZ);
      const m1 = getMonthBounds(cur.start - 1, TZ);
      const m2 = getMonthBounds(m1.start - 1, TZ);
      const m3 = getMonthBounds(m2.start - 1, TZ);
      await ctx.db.insert("budgets", {
        householdId: s.householdId, categoryId: s.catId, periodStart: m1.start,
        amount: 900, createdBy: s.ownerId, updatedBy: s.ownerId, createdAt: 1, updatedAt: 1,
      });
      return { s, periodStart: cur.start, m1, m2, m3 };
    });
    const { m1, m2, m3 } = await t.run(async (ctx) => {
      const now = Date.UTC(2026, 8, 15);
      const cur = getMonthBounds(now, TZ);
      const m1 = getMonthBounds(cur.start - 1, TZ);
      const m2 = getMonthBounds(m1.start - 1, TZ);
      const m3 = getMonthBounds(m2.start - 1, TZ);
      return { m1, m2, m3 };
    });
    await t.run(async (ctx) => {
      await insertTx(ctx, s, m1.start + 1_000, -300);
      await insertTx(ctx, s, m2.start + 1_000, -600);
    });
    const res = await owner.query(api.budgets.suggestion, {
      categoryId: s.catId, periodStart, timezone: TZ,
    });
    expect(res!.prevBudget).toBe(900);
    expect(res!.prevSpent).toBe(300);
    expect(res!.avgSpent).toBe(Math.round((300 + 600 + 0) / 3));
    expect(res!.prevLabel).toBe(formatMonthLabel(m1.start, TZ));
    expect(res!.hasHistory).toBe(true);
  });

  it("returns null prevBudget and hasHistory false when no history", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { catId, periodStart } = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const cur = getMonthBounds(Date.UTC(2026, 8, 15), TZ);
      return { catId: s.catId, periodStart: cur.start };
    });
    const res = await owner.query(api.budgets.suggestion, {
      categoryId: catId, periodStart, timezone: TZ,
    });
    expect(res!.prevBudget).toBeNull();
    expect(res!.prevSpent).toBe(0);
    expect(res!.avgSpent).toBe(0);
    expect(res!.hasHistory).toBe(false);
  });

  it("returns null when unauthenticated", async () => {
    const anon = t.withIdentity({ tokenIdentifier: "anon|x", subject: "anon" });
    const { catId, periodStart } = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const cur = getMonthBounds(Date.UTC(2026, 8, 15), TZ);
      return { catId: s.catId, periodStart: cur.start };
    });
    const res = await anon.query(api.budgets.suggestion, {
      categoryId: catId, periodStart, timezone: TZ,
    });
    expect(res).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/budgets.suggestion.test.ts`
Expected: FAIL with "Property 'suggestion' does not exist" / "has no export named 'suggestion'".

- [ ] **Step 3: Write minimal implementation (append to `convex/budgets.ts`)**

```ts
import { getPrevPeriod, getMonthBounds, formatMonthLabel } from "../utils/periodTime";
import { validateTimezone } from "../constants/validation";

export const suggestion = query({
  args: {
    categoryId: v.id("categories"),
    periodStart: v.number(),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await findUserAndMembership(ctx);
    if (auth === null) return null;
    const { membership } = auth;

    const tzErr = validateTimezone(args.timezone);
    if (tzErr) throw new ConvexError(tzErr);

    const category = await ctx.db.get(args.categoryId);
    if (category === null || category.householdId !== membership.householdId) {
      throw new ConvexError("Category not found.");
    }

    const m1Start = getPrevPeriod(args.periodStart, args.timezone, "monthly");
    const m2Start = getPrevPeriod(m1Start, args.timezone, "monthly");
    const m3Start = getPrevPeriod(m2Start, args.timezone, "monthly");
    const m1 = getMonthBounds(m1Start, args.timezone);
    const m2 = getMonthBounds(m2Start, args.timezone);
    const m3 = getMonthBounds(m3Start, args.timezone);

    const prevBudgetDoc = await ctx.db
      .query("budgets")
      .withIndex("by_category_period", (q) =>
        q.eq("categoryId", args.categoryId).eq("periodStart", m1.start),
      )
      .first();

    const rows = await ctx.db
      .query("transactions")
      .withIndex("by_household_date", (q) =>
        q
          .eq("householdId", membership.householdId)
          .gte("date", m3.start)
          .lt("date", m1.end),
      )
      .collect();

    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    for (const tx of rows) {
      if (tx.type !== "expense" || tx.categoryId !== args.categoryId) continue;
      const v = Math.abs(tx.amount);
      if (tx.date >= m1.start && tx.date < m1.end) s1 += v;
      else if (tx.date >= m2.start && tx.date < m2.end) s2 += v;
      else if (tx.date >= m3.start && tx.date < m3.end) s3 += v;
    }

    const prevBudget = prevBudgetDoc ? prevBudgetDoc.amount : null;
    const avgSpent = Math.round((s1 + s2 + s3) / 3);
    return {
      prevPeriodStart: m1.start,
      prevLabel: formatMonthLabel(m1.start, args.timezone),
      prevBudget,
      prevSpent: s1,
      avgSpent,
      hasHistory: prevBudget !== null || s1 > 0 || avgSpent > 0,
    };
  },
});
```

Notes: `getScopedDoc` is NOT used here because it requires `MutationCtx`; the manual `ctx.db.get` + household check above matches the existing `get` query pattern. Hidden categories are deliberately NOT redacted (aggregate only — same visibility exception as `budgets.list`). Imports must be relative (`../utils/periodTime`), never `@/...`, in `convex/`.

- [ ] **Step 4: Regenerate + run test to verify it passes**

Run: `npx convex codegen`
Run: `npx vitest run tests/budgets.suggestion.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/budgets.ts tests/budgets.suggestion.test.ts
git commit -m "feat: add budgets.suggestion query for budget quick-fill"
```

### Task 2: Suggestion box UI in `app/budget-form.tsx` (create-only)

**Files:**
- Modify: `app/budget-form.tsx`

**Interfaces:**
- Consumes: `api.budgets.suggestion` (Task 1); existing `timezone`, `periodStart`, `selectedCategoryId`, `isEdit`, `setAmount`; `formatAmountInput` from `@/utils/format`; `formatNumber` from `@/utils/format`; `useThemeColors`, `Radius` from `@/constants/theme`; `hapticSuccess` from `@/lib/haptics`.
- Produces: no new exports; create-mode renders suggestion box; tap fills Amount.

- [ ] **Step 1: Add suggestion query + tap handler + box JSX**

Edits (all in `app/budget-form.tsx`):

1. Add imports:

```tsx
import { formatNumber } from "@/utils/format";
import { hapticSuccess } from "@/lib/haptics";
```

(`formatAmountInput` is already imported on line 21; extend that import line if preferred: `import { formatAmountInput, formatNumber } from "@/utils/format";`.)

2. After the `periodStart` / `monthTs` block (~lines 64-70), add the reactive query (skip on edit or no category):

```tsx
const suggestion = useQuery(
  api.budgets.suggestion,
  !isEdit && selectedCategoryId
    ? {
        categoryId: selectedCategoryId as Id<"categories">,
        periodStart,
        timezone,
      }
    : "skip",
);
```

3. Add fill helper near `handleSubmit` (~line 98):

```tsx
const fillFromSuggestion = (value: number) => {
  setError(null);
  setAmount(formatAmountInput(String(value)));
  void hapticSuccess();
};
```

4. Insert the box between `SelectField` (~lines 229-237) and `Input Amount` (~lines 239-247), create-mode only:

```tsx
{!isEdit && selectedCategoryId !== null ? (
  suggestion === undefined ? (
    <Text className="text-[13px] leading-4 text-text-secondary dark:text-text-secondary-dark">
      Memuat saran…
    </Text>
  ) : suggestion !== null && suggestion.hasHistory ? (
    <View className="gap-2">
      <Text className="text-[14px] font-semibold tracking-[0.02em] leading-5 text-text-primary dark:text-text-primary-dark">
        Saran cepat
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {suggestion.prevBudget !== null ? (
          <Pressable
            onPress={() => fillFromSuggestion(suggestion.prevBudget!)}
            accessibilityRole="button"
            accessibilityLabel={`Gunakan budget bulan lalu ${formatNumber(suggestion.prevBudget)}`}
            style={{ borderColor: C.border, backgroundColor: C.surface, borderRadius: Radius.sm, borderWidth: 1 }}
            className="px-3 py-2"
          >
            <Text className="text-[13px] font-semibold text-text-primary dark:text-text-primary-dark">
              Budget {suggestion.prevLabel}: {formatNumber(suggestion.prevBudget)}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => fillFromSuggestion(suggestion.prevSpent)}
          accessibilityRole="button"
          accessibilityLabel={`Gunakan spent bulan lalu ${formatNumber(suggestion.prevSpent)}`}
          style={{ borderColor: C.border, backgroundColor: C.surface, borderRadius: Radius.sm, borderWidth: 1 }}
          className="px-3 py-2"
        >
          <Text className="text-[13px] font-semibold text-text-primary dark:text-text-primary-dark">
            Spent {suggestion.prevLabel}: {formatNumber(suggestion.prevSpent)}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => fillFromSuggestion(suggestion.avgSpent)}
          accessibilityRole="button"
          accessibilityLabel={`Gunakan rata-rata 3 bulan ${formatNumber(suggestion.avgSpent)}`}
          style={{ borderColor: C.border, backgroundColor: C.surface, borderRadius: Radius.sm, borderWidth: 1 }}
          className="px-3 py-2"
        >
          <Text className="text-[13px] font-semibold text-text-primary dark:text-text-primary-dark">
            Rata-rata 3 bln: {formatNumber(suggestion.avgSpent)}
          </Text>
        </Pressable>
      </View>
    </View>
  ) : null
) : null}
```

Rules honored: static `style` objects only (no Pressable style callback); colors via `C` (`useThemeColors` already in file as `C`); `Radius.sm` matches Month/Category boxes; non-null assertion `suggestion.prevBudget!` is safe inside the `!== null` guard. If `avgSpent`/`prevSpent` is 0 the chip still shows (history exists via another value) — tapping fills `""`? No: `formatAmountInput("0")` returns `"0"`, which fails `validateBudgetAmount` (min 1) at submit with the existing inline error — acceptable, no special-casing.

- [ ] **Step 2: Typecheck + lint the edited file**

Run: `npx tsc --noEmit`
Run: `npm run lint -- app/budget-form.tsx convex/budgets.ts`
Expected: PASS (fix unused imports if lint flags them).

- [ ] **Step 3: Commit**

```bash
git add app/budget-form.tsx
git commit -m "feat: add budget suggestion quick-fill chips to create form"
```

### Task 3: Final verification + manual matrix

**Files:** none (verification only; commit only if verification dirties tracked files).

- [ ] **Step 1: Run full verification**

Run: `npx convex codegen`
Run: `npx tsc --noEmit`
Run: `npm run lint`
Run: `npm test`
Expected: PASS all four (if `lint`/`test` show pre-existing failures unrelated to `convex/budgets.ts`, `tests/budgets.suggestion.test.ts`, `app/budget-form.tsx`, record them in the summary without fixing out of scope).

- [ ] **Step 2: Manual check via `expo start`**

Matrix (record pass/fail in final summary): create form → select category with history → 3 chips appear with correct label/values → tap each chip fills Amount (thousand separators) → manual edit after fill still works → submit creates budget; new category (no history) → box hidden; edit mode → no box; member + hidden category → suggestion still shows (aggregate only); future-month create → suggestions relative to form month; dark mode chips readable.

- [ ] **Step 3: Confirm no doc updates needed**

PRD/ARCHITECTURE/DESIGN describe budgets behavior, not form suggestion specifics — no doc edits required. If verification changed nothing on disk, no commit.

## Self-review

- Spec coverage: §Backend (query args/behavior/return, no schema change) → Task 1; §UI (position, 3 chips, tap-to-fill, loading/hidden states, NativeWind+theme) → Task 2; §Data Flow (create-only reactive query) → Task 2; §Edge Cases (no-history hidden, prevBudget-null chip hidden, future month, hidden-category aggregate, whole-number amounts, tz fallback) → Tasks 1+2; §Verification → Task 3.
- Placeholder scan: no TBD/TODO; every code step shows exact code; every run step states command + expected output; no "similar to Task N" without repeated code; all referenced symbols (`suggestion`, `fillFromSuggestion`, `formatNumber`, `hapticSuccess`, `Radius`, `C`) are defined in the cited files.
- Type consistency: `suggestion` return fields (`prevPeriodStart`, `prevLabel`, `prevBudget`, `prevSpent`, `avgSpent`, `hasHistory`) identical in Task 1 producer and Task 2 consumer; `categoryId: Id<"categories">` cast matches `createBudget` call pattern; `timezone: string` fed from existing `timezone` const.

## Amendments (post-merge, on `review`)

- **Adaptive average divisor:** `avgSpent` is now `round(sum / spentMonths)` where `spentMonths` = number of prior months with spending > 0 (0 when no history), instead of fixed `/ 3`. Test expectation updated (`(300+600)/2`) + new single-month case.
- **Chip validity gating:** each chip renders only when its value is `>= BUDGET_AMOUNT_MIN`; the box renders only when `hasUsableSuggestion` (replaces the `hasHistory` gate in Task 2 step 4). Zero-value chips can no longer fill an invalid Amount.
- Task 3 Step 3 is superseded: PRD §3.7 + §4.7, ARCHITECTURE function table + `budget-form` row, DESIGN components table, and the 2026-08-10 budgets spec now document the suggestion feature.
