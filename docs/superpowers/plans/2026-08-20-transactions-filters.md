# Transactions Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side filtering (type / account / category) plus a consolidated date filter (This Month / Last Month / Custom Range) behind two header chips on the Transactions page.

**Architecture:** Extend the `transactions.list` Convex query with optional `accountId`/`categoryId`/`type` args, pushed into new compound indexes so a filter never scans the whole date window. The page derives summary and day-net totals from the (already filtered) query result, so they stay consistent automatically.

**Tech Stack:** TypeScript 5.9, Expo SDK 54 / React Native 0.81, Expo Router 6, NativeWind 4, Convex, vitest + `convex-test`.

## Global Constraints

- After any change to `convex/*.ts` or `convex/schema.ts`, run `npx convex codegen` FIRST, then `npx tsc --noEmit`.
- Verify with: `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest).
- **NativeWind v4 gotcha:** never use `style={({ pressed }) => [...]}` on `Pressable` — it breaks `className`. Use `useState` for pressed state + static style/className.
- Use NativeWind `className`, not `StyleSheet.create`. Import theme from `constants/theme.ts` — never hardcode colors. Dark mode via `useThemeColors()` + `dark:` variants.
- Icons: `@expo/vector-icons/Feather`.
- English UI copy.
- Do NOT add code comments unless the codebase's surrounding code already has them.
- The user has authorized git commits per task on the `review` branch during this execution. Commit with a concise conventional message (e.g. `feat: ...`, `test: ...`) after each task's steps pass.

---

### Task 1: Add compound indexes to `transactions`

**Files:**
- Modify: `convex/schema.ts:52-70` (transactions table)

**Interfaces:**
- Consumes: nothing
- Produces: three new index names used by Task 2: `by_household_account_date`, `by_household_category_date`, `by_household_type_date`.

- [ ] **Step 1: Add the three compound indexes**

In `convex/schema.ts`, change the `transactions` table block (currently has `by_householdId`, `by_household_date`, `by_accountId`, `by_toAccountId`, `by_categoryId`) to add three index entries after `by_household_date`:

```ts
  transactions: defineTable({
    householdId: v.id("households"),
    accountId: v.id("accounts"),
    categoryId: v.optional(v.id("categories")),
    toAccountId: v.optional(v.id("accounts")),
    amount: v.number(),
    type: v.union(v.literal("income"), v.literal("expense"), v.literal("transfer")),
    note: v.optional(v.string()),
    date: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_householdId", ["householdId"])
    .index("by_household_date", ["householdId", "date"])
    .index("by_household_account_date", ["householdId", "accountId", "date"])
    .index("by_household_category_date", ["householdId", "categoryId", "date"])
    .index("by_household_type_date", ["householdId", "type", "date"])
    .index("by_accountId", ["accountId"])
    .index("by_toAccountId", ["toAccountId"])
    .index("by_categoryId", ["categoryId"]),
```

- [ ] **Step 2: Regenerate generated code and verify**

Run:
```bash
npx convex codegen
npx tsc --noEmit
```
Expected: codegen succeeds; tsc reports no errors.

- [ ] **Step 3: Confirm schema still loads under test**

Run:
```bash
npm test
```
Expected: all existing vitest suites pass (they import the schema, so a broken schema fails here).

---

### Task 2: Server-side filters on `transactions.list`

**Files:**
- Modify: `convex/transactions.ts` (add args, index-selection, predicates to `list`)
- Test: `tests/transactions.list.test.ts`

**Interfaces:**
- Consumes: the three index names from Task 1; existing `findUserAndMembership`, `hydrate`, `transactionType`, `MAX_LIST_ROWS`.
- Produces: `transactions.list` now accepts optional `accountId: Id<"accounts">`, `categoryId: Id<"categories">`, `type: "income" | "expense" | "transfer"`. Task 4's UI passes these args. Return shape unchanged: `{ transactions, isOwner }`.

- [ ] **Step 1: Write failing tests**

Append the following tests inside the existing `describe("transactions.list", ...)` block in `tests/transactions.list.test.ts` (the shared `seed` helper already creates household, owner, member, `accountId`, `hiddenCatId`, `visibleCatId`; add these tests after the "member sees only transactions with visible categories" test):

```ts
  it("owner filters by account", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const bankId = await ctx.db.insert("accounts", {
        householdId: s.householdId,
        name: "Bank",
        type: "bank",
        balance: 0,
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.visibleCatId,
        amount: -100,
        type: "expense",
        note: "cash-tx",
        date: 100,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 100,
        updatedAt: 100,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: bankId,
        categoryId: s.visibleCatId,
        amount: -200,
        type: "expense",
        note: "bank-tx",
        date: 200,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 200,
        updatedAt: 200,
      });
      return { ...s, bankId };
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      accountId: ids.accountId,
    });
    expect(result.transactions!.length).toBe(1);
    expect(result.transactions![0].note).toBe("cash-tx");
  });

  it("owner filters by category and excludes transfers", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const toAccountId = await ctx.db.insert("accounts", {
        householdId: s.householdId,
        name: "Bank",
        type: "bank",
        balance: 0,
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.visibleCatId,
        amount: -100,
        type: "expense",
        note: "cat-expense",
        date: 100,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 100,
        updatedAt: 100,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.hiddenCatId,
        amount: -50,
        type: "expense",
        note: "hidden-expense",
        date: 150,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 150,
        updatedAt: 150,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        toAccountId,
        amount: 300,
        type: "transfer",
        note: "transfer-tx",
        date: 200,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 200,
        updatedAt: 200,
      });
      return { ...s, toAccountId };
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      categoryId: ids.visibleCatId,
    });
    expect(result.transactions!.length).toBe(1);
    expect(result.transactions![0].note).toBe("cat-expense");
  });

  it("owner filters by type", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.visibleCatId,
        amount: -100,
        type: "expense",
        note: "expense-tx",
        date: 100,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 100,
        updatedAt: 100,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.visibleCatId,
        amount: 50,
        type: "income",
        note: "income-tx",
        date: 200,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 200,
        updatedAt: 200,
      });
      return s;
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      type: "income",
    });
    expect(result.transactions!.length).toBe(1);
    expect(result.transactions![0].note).toBe("income-tx");
  });

  it("owner combines type and account filters", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const bankId = await ctx.db.insert("accounts", {
        householdId: s.householdId,
        name: "Bank",
        type: "bank",
        balance: 0,
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.visibleCatId,
        amount: -100,
        type: "expense",
        note: "cash-expense",
        date: 100,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 100,
        updatedAt: 100,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: bankId,
        categoryId: s.visibleCatId,
        amount: -200,
        type: "expense",
        note: "bank-expense",
        date: 200,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 200,
        updatedAt: 200,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: bankId,
        categoryId: s.visibleCatId,
        amount: 50,
        type: "income",
        note: "bank-income",
        date: 300,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 300,
        updatedAt: 300,
      });
      return { ...s, bankId };
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      type: "expense",
      accountId: ids.bankId,
    });
    expect(result.transactions!.length).toBe(1);
    expect(result.transactions![0].note).toBe("bank-expense");
  });

  it("member filtering a hidden category returns empty", async () => {
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.hiddenCatId,
        amount: -100,
        type: "expense",
        note: "hidden-tx",
        date: 100,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 100,
        updatedAt: 100,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.visibleCatId,
        amount: -50,
        type: "expense",
        note: "visible-tx",
        date: 200,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 200,
        updatedAt: 200,
      });
      return s;
    });
    const result = await member.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      categoryId: ids.hiddenCatId,
    });
    expect(result.transactions!.length).toBe(0);
  });

  it("respects the limit cap after filtering", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("transactions", {
          householdId: s.householdId,
          accountId: s.accountId,
          categoryId: s.visibleCatId,
          amount: -100,
          type: "expense",
          note: `match-${i}`,
          date: 100 + i,
          createdBy: s.ownerId,
          updatedBy: s.ownerId,
          createdAt: 100 + i,
          updatedAt: 100 + i,
        });
      }
      return s;
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      type: "expense",
      limit: 2,
    });
    expect(result.transactions!.length).toBe(2);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- transactions.list
```
Expected: the new tests FAIL (args `accountId`/`categoryId`/`type` are not yet accepted, so filtering is ignored and result counts mismatch).

- [ ] **Step 3: Implement the filter args and predicates**

In `convex/transactions.ts`, add a filter type and a JS predicate helper at module level (after `const MAX_LIST_ROWS = 1000;`):

```ts
type ListFilters = {
  accountId?: Id<"accounts">;
  categoryId?: Id<"categories">;
  type?: "income" | "expense" | "transfer";
};

function matchesFilters(row: Doc<"transactions">, filters: ListFilters): boolean {
  if (filters.accountId !== undefined && row.accountId !== filters.accountId) return false;
  if (filters.categoryId !== undefined && row.categoryId !== filters.categoryId) return false;
  if (filters.type !== undefined && row.type !== filters.type) return false;
  return true;
}
```

Replace the whole `list` query (lines 184-290) with:

```ts
export const list = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    limit: v.optional(v.number()),
    accountId: v.optional(v.id("accounts")),
    categoryId: v.optional(v.id("categories")),
    type: v.optional(transactionType),
  },
  handler: async (ctx, args) => {
    const result = await findUserAndMembership(ctx);
    if (result === null) {
      return { transactions: null, isOwner: false };
    }
    const { membership } = result;

    const isOwner = membership.role === "owner";
    const limit = Math.min(
      Math.max(Math.floor(args.limit ?? MAX_LIST_ROWS), 1),
      MAX_LIST_ROWS,
    );
    const entityCache = new Map<
      string,
      Doc<"accounts"> | Doc<"categories"> | undefined
    >();

    const filters: ListFilters = {};
    if (args.accountId !== undefined) filters.accountId = args.accountId;
    if (args.categoryId !== undefined) filters.categoryId = args.categoryId;
    if (args.type !== undefined) filters.type = args.type;

    const activeFilterCount =
      (filters.accountId !== undefined ? 1 : 0) +
      (filters.categoryId !== undefined ? 1 : 0) +
      (filters.type !== undefined ? 1 : 0);

    if (isOwner) {
      let queryBuilder = ctx.db.query("transactions");
      if (filters.accountId !== undefined) {
        queryBuilder = queryBuilder.withIndex("by_household_account_date", (q) =>
          q
            .eq("householdId", membership.householdId)
            .eq("accountId", filters.accountId as Id<"accounts">)
            .gte("date", args.startDate)
            .lt("date", args.endDate),
        );
      } else if (filters.categoryId !== undefined) {
        queryBuilder = queryBuilder.withIndex("by_household_category_date", (q) =>
          q
            .eq("householdId", membership.householdId)
            .eq("categoryId", filters.categoryId as Id<"categories">)
            .gte("date", args.startDate)
            .lt("date", args.endDate),
        );
      } else if (filters.type !== undefined) {
        queryBuilder = queryBuilder.withIndex("by_household_type_date", (q) =>
          q
            .eq("householdId", membership.householdId)
            .eq("type", filters.type as "income" | "expense" | "transfer")
            .gte("date", args.startDate)
            .lt("date", args.endDate),
        );
      } else {
        queryBuilder = queryBuilder.withIndex("by_household_date", (q) =>
          q
            .eq("householdId", membership.householdId)
            .gte("date", args.startDate)
            .lt("date", args.endDate),
        );
      }

      let rows: Doc<"transactions">[];
      if (activeFilterCount > 1) {
        rows = await queryBuilder
          .filter((q) =>
            q.and(
              filters.type !== undefined
                ? q.eq(q.field("type"), filters.type)
                : q.eq(q.field("_id"), q.field("_id")),
              filters.accountId !== undefined
                ? q.eq(q.field("accountId"), filters.accountId)
                : q.eq(q.field("_id"), q.field("_id")),
              filters.categoryId !== undefined
                ? q.eq(q.field("categoryId"), filters.categoryId)
                : q.eq(q.field("_id"), q.field("_id")),
            ),
          )
          .order("desc")
          .take(limit);
      } else {
        rows = await queryBuilder.order("desc").take(limit);
      }

      const transactions = [];
      for (const row of rows) {
        const { category, account, toAccount } = await hydrate(ctx, row, entityCache);
        transactions.push({ ...row, category, account, toAccount });
      }

      return { transactions, isOwner };
    }

    const SCAN_BUDGET = limit * 10;
    let scanned = 0;
    let cursorDate: number | undefined;
    let cursorId: Id<"transactions"> | undefined;
    let atBoundary = false;
    const collected = [];

    while (collected.length < limit && scanned < SCAN_BUDGET) {
      const batchSize = Math.min(SCAN_BUDGET - scanned, limit * 4);
      const rows = await ctx.db
        .query("transactions")
        .withIndex("by_household_date", (q) => {
          const base = q
            .eq("householdId", membership.householdId)
            .gte("date", args.startDate);
          if (cursorDate === undefined) {
            return base.lt("date", args.endDate);
          }
          return atBoundary
            ? base.lt("date", cursorDate)
            : base.lte("date", cursorDate);
        })
        .order("desc")
        .take(batchSize);

      scanned += rows.length;
      let pastCursor = cursorDate === undefined || atBoundary;
      let cursorFound = pastCursor;

      for (const row of rows) {
        if (!pastCursor) {
          if (row.date === cursorDate && row._id === cursorId) {
            pastCursor = true;
            cursorFound = true;
          }
          continue;
        }

        const { category, account, toAccount } = await hydrate(ctx, row, entityCache);
        if (category !== undefined && category.hidden) {
          continue;
        }
        if (!matchesFilters(row, filters)) {
          continue;
        }
        collected.push({ ...row, category, account, toAccount });

        if (collected.length >= limit) break;
      }

      if (collected.length >= limit) break;
      if (rows.length < batchSize) break;
      if (!cursorFound) {
        atBoundary = true;
        continue;
      }

      const lastRow = rows[rows.length - 1];
      atBoundary = lastRow.date === cursorDate;
      cursorDate = lastRow.date;
      cursorId = lastRow._id;
    }

    return { transactions: collected, isOwner };
  },
});
```

- [ ] **Step 4: Regenerate and run tests**

Run:
```bash
npx convex codegen
npx tsc --noEmit
npm test -- transactions.list
```
Expected: tsc clean; the new filter tests PASS and all pre-existing tests PASS.

- [ ] **Step 5: Run the full suite**

Run:
```bash
npm test
```
Expected: all suites pass.

**Deviation from spec §3.2 (accepted):** the design called for a small local
helper centralizing index selection plus a dedicated unit test (spec item 8).
The implementation uses an inline `if/else` chain inside `list` instead; the
index-selection mapping is behaviorally covered by the per-filter tests
("owner filters by account", "owner filters by category and excludes transfers",
"owner filters by type", "owner combines type and account filters"). Accepted.

---

### Task 3: Create the `FilterSheet` component

**Files:**
- Create: `components/FilterSheet.tsx`

**Interfaces:**
- Consumes: nothing at module level.
- Produces: exported `FilterSheet`, `TransactionType`, `TypeFilter` used by Task 4. Props:

```ts
type Props = {
  visible: boolean;
  typeFilter: TypeFilter;                                   // "all" | "income" | "expense" | "transfer"
  accountFilter: Id<"accounts"> | null;
  categoryFilter: Id<"categories"> | null;
  accounts: Doc<"accounts">[];
  categories: Doc<"categories">[];
  onTypeFilterChange: (type: TypeFilter) => void;
  onAccountFilterChange: (id: Id<"accounts"> | null) => void;
  onCategoryFilterChange: (id: Id<"categories"> | null) => void;
  onReset: () => void;
  onClose: () => void;
};
```

- [ ] **Step 1: Write the component**

Create `components/FilterSheet.tsx` with the full implementation below. It is a bottom-sheet Modal (mirroring the `SelectField` modal pattern: `Shadow.card` sheet, backdrop `bg-black/40`, `keyboardShouldPersistTaps="handled"` on the list). Option lists are rendered inline (NOT nested `SelectField` modals) to avoid stacked-Modal jank on Android. Search shows automatically when >8 options.

```tsx
import Feather from "@expo/vector-icons/Feather";
import { Shadow, useThemeColors } from "@/constants/theme";
import { useMemo, useState } from "react";
import { Keyboard, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { Doc, Id } from "@/convex/_generated/dataModel";

export type TransactionType = "income" | "expense" | "transfer";
export type TypeFilter = "all" | TransactionType;

const TYPE_OPTIONS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "income", label: "Income" },
  { id: "expense", label: "Expense" },
  { id: "transfer", label: "Transfer" },
];

const SEARCH_THRESHOLD = 8;

type Props = {
  visible: boolean;
  typeFilter: TypeFilter;
  accountFilter: Id<"accounts"> | null;
  categoryFilter: Id<"categories"> | null;
  accounts: Doc<"accounts">[];
  categories: Doc<"categories">[];
  onTypeFilterChange: (type: TypeFilter) => void;
  onAccountFilterChange: (id: Id<"accounts"> | null) => void;
  onCategoryFilterChange: (id: Id<"categories"> | null) => void;
  onReset: () => void;
  onClose: () => void;
};

function OptionList({
  title,
  options,
  selectedId,
  onSelect,
  disabled,
}: {
  title: string;
  options: { _id: string; name: string }[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const C = useThemeColors();
  const showSearch = options.length > SEARCH_THRESHOLD;

  const filtered = useMemo(() => {
    if (!showSearch || search.trim() === "") return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, showSearch, search]);

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
        {title}
      </Text>
      {showSearch ? (
        <TextInput
          placeholder="Search…"
          placeholderTextColor={C.textSecondary}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
        />
      ) : null}
      <View className="max-h-52 overflow-hidden rounded-xl border border-border dark:border-border-dark">
        <ScrollView keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              onSelect(null);
            }}
            disabled={disabled}
            accessibilityRole="button"
            className="min-h-12 flex-row items-center justify-between px-4 py-3"
          >
            <Text
              className={`text-base ${
                selectedId === null
                  ? "text-primary dark:text-primary-dark"
                  : "text-text-primary dark:text-text-primary-dark"
              }`}
            >
              All {title.toLowerCase() === "account" ? "accounts" : "categories"}
            </Text>
            {selectedId === null ? <Feather name="check" size={18} color={C.primary} /> : null}
          </Pressable>
          {filtered.map((option) => (
            <Pressable
              key={option._id}
              onPress={() => {
                Keyboard.dismiss();
                onSelect(option._id);
              }}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: option._id === selectedId }}
              className="min-h-12 flex-row items-center justify-between px-4 py-3"
            >
              <Text
                className={`text-base ${
                  option._id === selectedId
                    ? "text-primary dark:text-primary-dark"
                    : "text-text-primary dark:text-text-primary-dark"
                }`}
              >
                {option.name}
              </Text>
              {option._id === selectedId ? <Feather name="check" size={18} color={C.primary} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

export function FilterSheet({
  visible,
  typeFilter,
  accountFilter,
  categoryFilter,
  accounts,
  categories,
  onTypeFilterChange,
  onAccountFilterChange,
  onCategoryFilterChange,
  onReset,
  onClose,
}: Props) {
  const categoryOptions = useMemo(() => {
    if (typeFilter === "transfer") return [];
    if (typeFilter === "all") return categories;
    return categories.filter((c) => c.type === typeFilter);
  }, [categories, typeFilter]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityLabel="Filter transactions"
    >
      <Pressable className="flex-1 justify-end bg-black/40 px-5 pb-8" onPress={onClose}>
        <Pressable
          className="max-h-[80%] overflow-hidden rounded-2xl bg-background p-5 dark:bg-background-dark"
          style={Shadow.card}
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
            Filter
          </Text>

          <View className="mt-4">
            <Text className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
              Type
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => onTypeFilterChange(opt.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: typeFilter === opt.id }}
                  className={`min-h-12 items-center justify-center rounded-full border px-4 ${
                    typeFilter === opt.id
                      ? "border-primary bg-primary dark:border-primary-dark dark:bg-primary-dark"
                      : "border-border bg-background dark:border-border-dark dark:bg-background-dark"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      typeFilter === opt.id
                        ? "text-background dark:text-background-dark"
                        : "text-text-secondary dark:text-text-secondary-dark"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mt-4">
            <OptionList
              title="Account"
              options={accounts}
              selectedId={accountFilter}
              onSelect={(id) => onAccountFilterChange(id as Id<"accounts"> | null)}
            />
          </View>

          <View className="mt-4">
            <OptionList
              title="Category"
              options={categoryOptions}
              selectedId={categoryFilter}
              onSelect={(id) => onCategoryFilterChange(id as Id<"categories"> | null)}
              disabled={typeFilter === "transfer"}
            />
          </View>

          <View className="mt-5 flex-row gap-3">
            <Pressable
              onPress={onReset}
              accessibilityRole="button"
              className="h-12 flex-1 items-center justify-center rounded-xl border border-error"
            >
              <Text className="text-sm font-medium text-error">Reset</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              className="h-12 flex-1 items-center justify-center rounded-xl border border-border bg-background dark:border-border-dark dark:bg-background-dark"
            >
              <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                Done
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2: Verify**

Run:
```bash
npx tsc --noEmit
npm run lint
```
Expected: no errors.

---

### Task 4: Rework the Transactions page (two-chip header, date modal, filter wiring)

**Files:**
- Modify: `app/(tabs)/transactions.tsx`

**Interfaces:**
- Consumes: `FilterSheet`, `TypeFilter` from Task 3; new `transactions.list` args from Task 2; existing `api.accounts.list` / `api.categories.list` for filter options.
- Produces: the reworked page. No new external interfaces.

- [ ] **Step 1: Update imports and add filter state**

In `app/(tabs)/transactions.tsx`:

Replace the top imports with:

```tsx
import { ComponentProps, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  SectionList,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import Feather from "@expo/vector-icons/Feather";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Radius, useThemeColors } from "@/constants/theme";
import { Fab } from "@/components/Fab";
import { TransactionCard } from "@/components/TransactionCard";
import { EmptyState } from "@/components/EmptyState";
import { DateField } from "@/components/DateField";
import { GradientCard } from "@/components/GradientCard";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/Button";
import { FilterSheet, TypeFilter } from "@/components/FilterSheet";
import { formatNumber, sumNetExcludingTransfers } from "@/utils/format";
import {
  formatDateHeaderTz,
  formatDateShortTz,
  getDayBounds,
  getMonthBounds,
  startOfDay,
} from "@/utils/date";
import { resolveTimezone } from "@/constants/timezones";
```

Replace the `type DateFilter = ...` + `FILTERS` const block with:

```tsx
type DateFilter = "thisMonth" | "lastMonth" | "custom";

const DATE_OPTIONS: { id: DateFilter; label: string }[] = [
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "custom", label: "Custom Range" },
];

function HeaderPill({
  icon,
  label,
  active,
  onPress,
}: {
  icon: ComponentProps<typeof Feather>["name"];
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const C = useThemeColors();
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      className={`min-h-12 flex-row items-center gap-2 rounded-full border px-4 ${
        active
          ? "border-primary dark:border-primary-dark"
          : "border-border bg-background dark:border-border-dark dark:bg-background-dark"
      }`}
      style={pressed ? { opacity: 0.85 } : undefined}
    >
      <Feather name={icon} size={16} color={active ? C.primary : C.textSecondary} />
      <Text
        className={`text-sm font-medium ${
          active
            ? "text-primary dark:text-primary-dark"
            : "text-text-primary dark:text-text-primary-dark"
        }`}
      >
        {label}
      </Text>
      <Feather name="chevron-down" size={16} color={active ? C.primary : C.textSecondary} />
    </Pressable>
  );
}
```

- [ ] **Step 2: Add filter state and query args**

Inside the `Transactions` component, after the existing `customTo` state line, add:

```tsx
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [accountFilter, setAccountFilter] = useState<Id<"accounts"> | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<Id<"categories"> | null>(null);
```

Replace the existing `const result = useQuery(api.transactions.list, range);` with:

```tsx
  const accountsResult = useQuery(api.accounts.list);
  const categoriesResult = useQuery(api.categories.list);

  const queryArgs = useMemo(
    () => ({
      ...range,
      ...(typeFilter !== "all" ? { type: typeFilter } : {}),
      ...(accountFilter !== null ? { accountId: accountFilter } : {}),
      ...(categoryFilter !== null ? { categoryId: categoryFilter } : {}),
    }),
    [range, typeFilter, accountFilter, categoryFilter],
  );

  const result = useQuery(api.transactions.list, queryArgs);
```

Add derived values after `summary`:

```tsx
  const filtersActive =
    typeFilter !== "all" || accountFilter !== null || categoryFilter !== null;
  const activeFilterCount =
    (typeFilter !== "all" ? 1 : 0) +
    (accountFilter !== null ? 1 : 0) +
    (categoryFilter !== null ? 1 : 0);

  const dateLabel = useMemo(() => {
    if (dateFilter === "thisMonth") return "This Month";
    if (dateFilter === "lastMonth") return "Last Month";
    return `${formatDateShortTz(startOfDay(customFrom).getTime(), timezone)} – ${formatDateShortTz(startOfDay(customTo).getTime(), timezone)}`;
  }, [dateFilter, customFrom, customTo, timezone]);

  const clearFilters = () => {
    setTypeFilter("all");
    setAccountFilter(null);
    setCategoryFilter(null);
  };
```

Note: rename the existing state variable `filter` → `dateFilter` and `setFilter` → `setDateFilter` **everywhere it appears** in the component: the state declaration, the `invalidCustomRange` check (`dateFilter === "custom"`), and the `range` useMemo dependency array (`[dateFilter, customFrom, customTo, invalidCustomRange, timezone]`). The old `FILTERS` constant and its `setFilter(f.id)` render block are fully replaced in Step 3, so no other references remain.

- [ ] **Step 3: Replace the header chips row**

Replace the block rendering `FILTERS.map(...)` (the date-chip row) and the inline `filter === "custom"` DateField row with:

```tsx
      <View className="mt-4 flex-row gap-2 px-5">
        <HeaderPill
          icon="calendar"
          label={dateLabel}
          active={false}
          onPress={() => setDateSheetOpen(true)}
        />
        <HeaderPill
          icon="filter"
          label={activeFilterCount > 0 ? `Filter · ${activeFilterCount}` : "Filter"}
          active={activeFilterCount > 0}
          onPress={() => setFilterSheetOpen(true)}
        />
      </View>
```

- [ ] **Step 4: Make the empty state filter-aware**

Replace the `sections.length === 0` branch with:

```tsx
      {sections !== null && sections.length === 0 ? (
        <View className="mt-6 flex-1 px-5">
          <View
            style={{ backgroundColor: C.background }}
            className="rounded-[16px]"
          >
            {filtersActive ? (
              <EmptyState
                icon="filter"
                title="No transactions match your filters"
                description="Try adjusting or clearing your filters."
                actionLabel="Clear filters"
                onAction={clearFilters}
              />
            ) : (
              <EmptyState
                icon="book-open"
                title="No transactions yet"
                description="Start by recording your first transaction."
                actionLabel="Add Transaction"
                onAction={() => router.push("/transaction-form")}
              />
            )}
          </View>
        </View>
      ) : (
```

- [ ] **Step 5: Add the Date modal and wire the FilterSheet**

Before the closing `</SafeAreaView>`, add the Date modal and the FilterSheet (place them right after the `<Fab ... />` element):

```tsx
      <Modal
        visible={dateSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDateSheetOpen(false)}
        accessibilityLabel="Select date range"
      >
        <Pressable
          className="flex-1 justify-end bg-black/40 px-5 pb-8"
          onPress={() => setDateSheetOpen(false)}
        >
          <Pressable
            className="max-h-[70%] overflow-hidden rounded-2xl bg-background p-5 dark:bg-background-dark"
            style={Shadow.card}
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
              Date Range
            </Text>
            <View className="mt-3">
              {DATE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    setDateFilter(opt.id);
                    if (opt.id !== "custom") setDateSheetOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: dateFilter === opt.id }}
                  className="min-h-12 flex-row items-center justify-between"
                >
                  <Text className="text-base text-text-primary dark:text-text-primary-dark">
                    {opt.label}
                  </Text>
                  {dateFilter === opt.id ? (
                    <Feather name="check" size={18} color={C.primary} />
                  ) : null}
                </Pressable>
              ))}
            </View>
            {dateFilter === "custom" ? (
              <View className="mt-2 flex-row gap-3">
                <View className="flex-1">
                  <DateField
                    label="From"
                    value={customFrom}
                    maximumDate={new Date()}
                    onChange={setCustomFrom}
                  />
                </View>
                <View className="flex-1">
                  <DateField
                    label="To"
                    value={customTo}
                    maximumDate={new Date()}
                    error={
                      invalidCustomRange
                        ? "To date must be on or after the From date."
                        : null
                    }
                    onChange={setCustomTo}
                  />
                </View>
              </View>
            ) : null}
            <View className="mt-5">
              <Button title="Done" onPress={() => setDateSheetOpen(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <FilterSheet
        visible={filterSheetOpen}
        typeFilter={typeFilter}
        accountFilter={accountFilter}
        categoryFilter={categoryFilter}
        accounts={accountsResult?.accounts ?? []}
        categories={categoriesResult?.categories ?? []}
        onTypeFilterChange={(type) => {
          setTypeFilter(type);
          if (type === "transfer") setCategoryFilter(null);
        }}
        onAccountFilterChange={setAccountFilter}
        onCategoryFilterChange={setCategoryFilter}
        onReset={clearFilters}
        onClose={() => setFilterSheetOpen(false)}
      />
```

Note: `Shadow` must be imported from `@/constants/theme` (add it to the existing `Radius, useThemeColors` import → `import { Radius, Shadow, useThemeColors } from "@/constants/theme";`).

Also update the loading skeleton (the `result === undefined` branch) to render 2 pills instead of 3 chips:

```tsx
        <View className="mt-4 flex-row gap-2 px-5">
          {[0, 1].map((i) => (
            <Skeleton key={i} style={{ width: 120, height: 40, borderRadius: 999 }} />
          ))}
        </View>
```

- [ ] **Step 6: Verify**

Run:
```bash
npx tsc --noEmit
npm run lint
```
Expected: no errors.

---

### Task 5: Update the PRD

**Files:**
- Modify: `docs/Product Requirement Document/PRD.md`

**Interfaces:**
- Consumes: the feature as built (indexes, list args, two-chip UI).
- Produces: updated PRD sections.

- [ ] **Step 1: Update §2.1 Functional Requirements**

In the Transactions row (line 94), append to the cell:

```text
Supports server-side filtering by transaction type, account, and category; a consolidated date filter (This Month / Last Month / Custom Range) sits behind one header chip.
```

- [ ] **Step 2: Update §3.6 Transactions**

Add a new paragraph at the end of §3.6:

```markdown
**Filtering (as of 2026-08-20):** the Transactions page filters the visible list
server-side by **type** (income/expense/transfer), **account**, and **category**,
with the date range (This Month / Last Month / Custom Range) consolidated behind a
single Date chip. The summary card and per-day net totals derive from the filtered
query result, so they always match the visible rows. Category options are
contextual to the selected type (income → income categories, expense → expense
categories); selecting type `transfer` clears an active category filter, since
transfers have no category. Filtering is pushed into compound indexes
(`by_household_account_date`, `by_household_category_date`, `by_household_type_date`)
so a filter never scans the full date window. The empty state distinguishes
"no transactions at all" from "no transactions match your filters" (with a Clear
filters action).
```

- [ ] **Step 3: Add §4.9 Filter Transactions flow**

After §4.8 ("Change Appearance Theme"), add a new subsection §4.9 "Filter Transactions" (do NOT renumber the other §4.x subsections):

````markdown
### 4.9 Filter Transactions

```text
Transactions tab → Date chip (default This Month) → Last Month / Custom Range (From/To) → Done
  → Filter chip → Type chips (All/Income/Expense/Transfer) + Account/Category lists
    (search when >8 options; Reset clears all)
  → list, summary card, and per-day net totals reflect the active filters
```
````

- [ ] **Step 4: Update §5.2 Responsibilities**

Change the `app/(tabs)/transactions.tsx` row to:

```text
| `app/(tabs)/transactions.tsx` | Transactions list (date + type/account/category filters, summary, day-grouped with net totals) |
```

- [ ] **Step 5: Update §6 Database Schema**

Change the `transactions` index line to:

```text
**Indexes:** `by_householdId`, `by_household_date`, `by_household_account_date`
(`["householdId", "accountId", "date"]`), `by_household_category_date`
(`["householdId", "categoryId", "date"]`), `by_household_type_date`
(`["householdId", "type", "date"]`), `by_accountId`, `by_toAccountId`,
`by_categoryId`
```

Change the `transactions.list` row in the Convex Functions table to:

```text
| `transactions` | `list` | query | Date-range + optional `accountId`/`categoryId`/`type` filtered (index-driven); optional `limit` (default/max 1 000); cached hydration |
```

- [ ] **Step 6: Add §8 Change Log entry**

Insert at the top of the change-log table (below the header row):

```text
| 2026-08-20 | Feature | Transactions filters: server-side `transactions.list` args `accountId`/`categoryId`/`type`, backed by three new compound indexes (`by_household_account_date`, `by_household_category_date`, `by_household_type_date`) so filters never scan the full date window; Transactions page header consolidated to a Date chip (This Month default / Last Month / Custom Range in a bottom-sheet modal) and a Filter chip (type chips + account/category option lists with search, Reset); summary card and per-day net totals derive from the filtered query; filter-aware empty state; new `FilterSheet` component. Updates §2.1, §3.6, §4.9, §5.2, §6 |
```

- [ ] **Step 7: Verify**

Read the changed sections back to confirm formatting (tables intact, no broken markdown).

---

### Task 6: Full verification pass

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: all tasks above.

- [ ] **Step 1: Regenerate and run all checks**

Run:
```bash
npx convex codegen
npx tsc --noEmit
npm run lint
npm test
```
Expected: all four commands succeed.

- [ ] **Step 2: Sanity-review the diff**

Run:
```bash
git status
git diff --stat
```
Confirm the expected files changed: `convex/schema.ts`, `convex/transactions.ts`, `tests/transactions.list.test.ts`, `components/FilterSheet.tsx` (new), `app/(tabs)/transactions.tsx`, `docs/Product Requirement Document/PRD.md`.