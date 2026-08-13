# Home Recent Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the last 5 household transactions on the Home dashboard, grouped by day with daily totals and a "See All" link.

**Architecture:** Add a `recent` query to `convex/transactions.ts` that returns the newest N transactions for the current user's household (descending by date via the `by_household_date` index), joined with category/account/toAccount and filtered for member hidden-category rules. Update `app/(tabs)/home.tsx` to query it, group results by day with `formatDateHeader`, render a daily total per group, and reuse the existing `TransactionCard` component.

**Tech Stack:** Convex (`convex v1.43`), Expo SDK 54 / React Native, NativeWind, expo-router, TypeScript.

## Global Constraints

- No test framework exists. Verification = `npx convex codegen` (after any `convex/*.ts` change) + `npx tsc --noEmit` + `npm run lint`.
- Use NativeWind `className` only — never `StyleSheet.create`.
- Import theme via `useThemeColors()` from `constants/theme`; never hardcode colors.
- Never use `style` callback functions on `Pressable`; use `useState` pressed state + static style.
- Do not add code comments.
- Path alias `@/*` → repo root.
- Mirrors the visibility rules in `api.transactions.list`: non-owners do not see transactions on hidden categories.
- `docs/` is gitignored — do not `git add` anything under `docs/`.

---

### Task 1: Add `recent` query to `convex/transactions.ts`

**Files:**
- Modify: `convex/transactions.ts` (insert between `list`, ending at line 274, and `get`, starting at line 276)

**Interfaces:**
- Consumes: existing `query`/`v` imports already in the file; `by_household_date` index on `transactions` (schema.ts:66).
- Produces: `api.transactions.recent` with args `{ limit?: number }`; returns `{ transactions: (Transaction & { category, account, toAccount })[] | null, isOwner: boolean }`. When identity/user/membership is missing, returns `{ transactions: null, isOwner: false }`.

- [ ] **Step 1: Insert the query**

Insert the following block into `convex/transactions.ts` after the closing of `list` (after the `return { transactions, isOwner };` and its closing `},` / `});`) and before the `export const get = query({` line:

```ts
export const recent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return { transactions: null, isOwner: false };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      return { transactions: null, isOwner: false };
    }

    const membership = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (membership === null) {
      return { transactions: null, isOwner: false };
    }

    const isOwner = membership.role === "owner";
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 5), 1), 20);
    const rows = await ctx.db
      .query("transactions")
      .withIndex("by_household_date", (q) =>
        q.eq("householdId", membership.householdId),
      )
      .order("desc")
      .take(limit);

    const transactions = [];
    for (const row of rows) {
      const category =
        row.categoryId === undefined
          ? undefined
          : ((await ctx.db.get(row.categoryId)) ?? undefined);
      if (!isOwner && category !== undefined && category.hidden) {
        continue;
      }
      const account = (await ctx.db.get(row.accountId)) ?? undefined;
      const toAccount =
        row.toAccountId === undefined
          ? undefined
          : ((await ctx.db.get(row.toAccountId)) ?? undefined);
      transactions.push({ ...row, category, account, toAccount });
    }

    return { transactions, isOwner };
  },
});
```

- [ ] **Step 2: Regenerate generated types**

Run: `npx convex codegen`
Expected: succeeds, regenerating `convex/_generated/` including `api.transactions.recent`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add convex/transactions.ts
git commit -m "feat: add recent transactions query"
```

---

### Task 2: Render Recent Transactions on Home

**Files:**
- Modify: `app/(tabs)/home.tsx` (imports at lines 1-14; add query + grouping after `accountData` at line 27; replace placeholder section at lines 199-213)

**Interfaces:**
- Consumes: `api.transactions.recent` with `{ limit: 5 }` from Task 1; `TransactionCard` from `@/components/TransactionCard` (props: `categoryName: string | null`, `isTransfer: boolean`, `toAccountName?: string`, `note: string | null`, `amount: number`, `type`, `date: number`, `onPress: () => void`); `formatDateHeader` from `@/utils/date`; `formatNumber` from `@/utils/format`.
- Produces: Home screen section rendering grouped recent transactions with per-day totals.

- [ ] **Step 1: Update imports**

In `app/(tabs)/home.tsx`, change line 5:

```tsx
import { useCallback, useEffect, useState } from "react";
```

to:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
```

Add after the `GradientCard` import (line 10):

```tsx
import { TransactionCard } from "@/components/TransactionCard";
```

Add after the `formatNumber` import (line 14):

```tsx
import { formatDateHeader } from "@/utils/date";
```

- [ ] **Step 2: Add query and grouping**

After the `accountData` query (line 27), add:

```tsx
const recent = useQuery(api.transactions.recent, { limit: 5 });
```

After the `totalBalance` computation (line 83-85), add:

```tsx
const recentGroups = useMemo(() => {
  const transactions = recent?.transactions ?? null;
  if (transactions === null) return null;
  const groups = new Map<string, typeof transactions>();
  for (const tx of transactions) {
    const key = formatDateHeader(tx.date);
    const list = groups.get(key);
    if (list) {
      list.push(tx);
    } else {
      groups.set(key, [tx]);
    }
  }
  return Array.from(groups.entries()).map(([title, data]) => ({
    title,
    data,
    total: data.reduce((sum, tx) => sum + tx.amount, 0),
  }));
}, [recent]);
```

- [ ] **Step 3: Replace the placeholder section**

Replace the entire block at lines 199-213 (the `<View className="mt-8">` containing the static "Recent Transactions" text and empty-state placeholder) with:

```tsx
        <View className="mt-8">
          <View className="flex-row items-center justify-between">
            <Text className="mb-1 text-xl font-semibold text-text-primary dark:text-text-primary-dark">
              Recent Transactions
            </Text>
            <Pressable
              onPress={() => router.push("/transactions")}
              accessibilityRole="button"
              className="min-h-12 items-center justify-center"
            >
              <Text className="text-sm font-medium text-primary dark:text-primary-dark">See All</Text>
            </Pressable>
          </View>
          <View
            style={{ backgroundColor: C.background }}
            className="mt-2 rounded-[16px]"
          >
            {recent === undefined ? (
              <View className="items-center px-4 py-4">
                <ActivityIndicator size="small" color={C.primary} />
              </View>
            ) : recentGroups === null || recentGroups.length === 0 ? (
              <EmptyState
                icon="book-open"
                title="No transactions yet"
                description="Start by recording your first transaction"
              />
            ) : (
              recentGroups.map((group) => (
                <View key={group.title} className="py-1">
                  <View className="flex-row items-center justify-between px-4 pb-1 pt-2">
                    <Text className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                      {group.title}
                    </Text>
                    <Text
                      className="text-sm font-semibold"
                      style={{
                        color:
                          group.total > 0
                            ? C.success
                            : group.total < 0
                              ? C.error
                              : C.textSecondary,
                      }}
                    >
                      {group.total > 0 ? "+" : ""}
                      {formatNumber(group.total)}
                    </Text>
                  </View>
                  {group.data.map((tx) => (
                    <TransactionCard
                      key={tx._id}
                      categoryName={tx.category?.name ?? null}
                      isTransfer={tx.type === "transfer"}
                      toAccountName={tx.toAccount?.name}
                      note={tx.note ?? null}
                      amount={tx.amount}
                      type={tx.type}
                      date={tx.date}
                      onPress={() =>
                        router.push({
                          pathname: "/transaction-form",
                          params: { id: tx._id },
                        })
                      }
                    />
                  ))}
                </View>
              ))
            )}
          </View>
        </View>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/home.tsx"
git commit -m "feat: show recent transactions on home"
```
