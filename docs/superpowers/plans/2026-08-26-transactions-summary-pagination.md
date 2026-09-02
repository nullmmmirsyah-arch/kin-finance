# Transactions Server-Side Summary + Cursor Pagination — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the monthly summary computation server-side (`transactions.summary`) and make `transactions.list` cursor-paginated so the Transactions page infinite-scrolls and Home stops shipping ~1 000 rows per subscription tick.

**Architecture:** One unified paginated collection engine inside `transactions.list` (owner and member share it; they differ only by a visibility predicate), plus a new `summary` query that walks the same pinned-index strategy without hydration. Frontend swaps Home's month-list for `summary` and rebuilds the Transactions tab around page accumulation (30 rows/page) fed by `onEndReached`.

**Tech Stack:** Convex 1.43 queries (`convex-test` + vitest for backend tests), Expo SDK 54 / React Native / expo-router, NativeWind 4.

**Spec:** `docs/superpowers/specs/2026-08-26-transactions-summary-pagination-design.md`

## Global Constraints

- After any change to `convex/*.ts` run `npx convex codegen` before typechecking (regenerates `convex/_generated/`, gitignored).
- Verification gate per task: `npx tsc --noEmit`, then targeted `npx vitest run <file>` for backend tasks, `npm test` at the end, `npm run lint` for UI tasks.
- UI copy is English; NativeWind `className` styling only; never `style={({ pressed }) => [...]}` on `Pressable` (NativeWind v4 gotcha) — use `useState` pressed flags.
- Amounts are signed whole numbers (+income, −expense, +transfer magnitude); transfers are excluded from all summaries (existing convention).
- Member visibility invariant: transactions whose category is `hidden` are invisible to Members in BOTH `list` and `summary`. Hidden-account transactions remain visible to Members (existing behavior — do not change).
- Do not add code comments; do not reformat unrelated code.
- Commit style follows repo history: `feat(transactions): …`, `test(transactions): …`, `docs(prd): …`.
- Work on the current branch (`review`). Never push.

---

### Task 1: Backend — cursor-paginated `transactions.list`

**Files:**
- Modify: `convex/transactions.ts` (args of `list`, plus its handler body; add module-level helpers above `list`)
- Test: `tests/transactions.list.test.ts` (append new describe-level tests)

**Interfaces:**
- Consumes: existing `matchesFilters`, `hydrate`, `findUserAndMembership` in `convex/transactions.ts`.
- Produces: `api.transactions.list` accepting optional `cursor: { date: number; id: Id<"transactions"> }` and returning `{ transactions | null, isOwner, cursor?: { date; id }, hasMore: boolean }`. Task 2 reuses the new module helpers `normalizeListFilters` and `pickPinnedDim`; Task 4 consumes the public contract.

- [ ] **Step 1: Write the failing tests**

Append inside the existing top-level `describe("transactions.list", …)` block in `tests/transactions.list.test.ts`, after the last `it(...)` (before the closing `});` of the describe). The `seed` helper and identity constants already exist in this file — reuse them exactly as the existing tests do.

```ts
  it("owner pages through all rows with cursor continuation", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("transactions", {
          householdId: s.householdId,
          accountId: s.accountId,
          categoryId: s.visibleCatId,
          amount: -100,
          type: "expense",
          note: `tx-${i}`,
          date: 100 + i,
          createdBy: s.ownerId,
          updatedBy: s.ownerId,
          createdAt: 100 + i,
          updatedAt: 100 + i,
        });
      }
    });
    const page1 = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
    });
    expect(page1.transactions!.map((tx) => tx.note)).toEqual(["tx-4", "tx-3"]);
    expect(page1.hasMore).toBe(true);
    expect(page1.cursor).toBeDefined();

    const page2 = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
      cursor: page1.cursor,
    });
    expect(page2.transactions!.map((tx) => tx.note)).toEqual(["tx-2", "tx-1"]);
    expect(page2.hasMore).toBe(true);
    expect(page2.cursor).toBeDefined();

    const page3 = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
      cursor: page2.cursor,
    });
    expect(page3.transactions!.map((tx) => tx.note)).toEqual(["tx-0"]);
    expect(page3.hasMore).toBe(false);
    expect(page3.cursor).toBeUndefined();
  });

  it("cursor continuation has no duplicates or gaps on tied dates", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      for (let i = 0; i < 4; i++) {
        await ctx.db.insert("transactions", {
          householdId: s.householdId,
          accountId: s.accountId,
          categoryId: s.visibleCatId,
          amount: -100,
          type: "expense",
          note: `tie-${i}`,
          date: 100,
          createdBy: s.ownerId,
          updatedBy: s.ownerId,
          createdAt: 100,
          updatedAt: 100,
        });
      }
    });
    const page1 = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
    });
    const page2 = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
      cursor: page1.cursor,
    });
    const all = [...page1.transactions!, ...page2.transactions!].map((tx) => tx.note);
    expect(new Set(all).size).toBe(4);
    expect(all.sort()).toEqual(["tie-0", "tie-1", "tie-2", "tie-3"]);
    expect(page2.hasMore).toBe(false);
  });

  it("reports hasMore=false when the range is exhausted below the limit", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      for (let i = 0; i < 2; i++) {
        await ctx.db.insert("transactions", {
          householdId: s.householdId,
          accountId: s.accountId,
          categoryId: s.visibleCatId,
          amount: -100,
          type: "expense",
          note: `few-${i}`,
          date: 100 + i,
          createdBy: s.ownerId,
          updatedBy: s.ownerId,
          createdAt: 100 + i,
          updatedAt: 100 + i,
        });
      }
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 5,
    });
    expect(result.transactions!.length).toBe(2);
    expect(result.hasMore).toBe(false);
    expect(result.cursor).toBeUndefined();
  });

  it("fills the page despite many non-matching rows (multi-account filter)", async () => {
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
      for (let i = 0; i < 6; i++) {
        await ctx.db.insert("transactions", {
          householdId: s.householdId,
          accountId: bankId,
          categoryId: s.visibleCatId,
          amount: -200,
          type: "expense",
          note: `bank-${i}`,
          date: 100 + i,
          createdBy: s.ownerId,
          updatedBy: s.ownerId,
          createdAt: 100 + i,
          updatedAt: 100 + i,
        });
      }
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("transactions", {
          householdId: s.householdId,
          accountId: s.accountId,
          categoryId: s.visibleCatId,
          amount: -100,
          type: "expense",
          note: `cash-${i}`,
          date: 300 + i,
          createdBy: s.ownerId,
          updatedBy: s.ownerId,
          createdAt: 300 + i,
          updatedAt: 300 + i,
        });
      }
      return { ...s, bankId };
    });
    const page1 = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
      accountIds: [ids.accountId],
    });
    expect(page1.transactions!.map((tx) => tx.note)).toEqual(["cash-2", "cash-1"]);
    expect(page1.hasMore).toBe(true);
    expect(page1.cursor).toBeDefined();

    const page2 = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
      accountIds: [ids.accountId],
      cursor: page1.cursor,
    });
    expect(page2.transactions!.map((tx) => tx.note)).toEqual(["cash-0"]);
    expect(page2.hasMore).toBe(false);
  });

  it("member pages past hidden-category rows without duplicates or gaps", async () => {
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      for (let i = 0; i < 6; i++) {
        await ctx.db.insert("transactions", {
          householdId: s.householdId,
          accountId: s.accountId,
          categoryId: i % 2 === 0 ? s.hiddenCatId : s.visibleCatId,
          amount: -100,
          type: "expense",
          note: `m-${i}`,
          date: 100 + i,
          createdBy: s.ownerId,
          updatedBy: s.ownerId,
          createdAt: 100 + i,
          updatedAt: 100 + i,
        });
      }
    });
    const page1 = await member.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
    });
    expect(page1.transactions!.map((tx) => tx.note)).toEqual(["m-5", "m-3"]);

    const page2 = await member.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
      cursor: page1.cursor,
    });
    expect(page2.transactions!.map((tx) => tx.note)).toEqual(["m-1"]);
    expect(page2.hasMore).toBe(false);
  });

  it("returns cursor and hasMore fields on the default (no-cursor) call", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.visibleCatId,
        amount: -100,
        type: "expense",
        note: "only",
        date: 100,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 100,
        updatedAt: 100,
      });
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
    });
    expect(result.transactions!.length).toBe(1);
    expect(result.hasMore).toBe(false);
    expect(result.cursor).toBeUndefined();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/transactions.list.test.ts`
Expected: FAIL — TypeScript/validator rejects unknown arg `cursor` and missing properties `hasMore`/`cursor` on the result (e.g. "expected boolean" / unrecognized argument errors).

- [ ] **Step 3: Implement the paginated `list`**

In `convex/transactions.ts`:

3a. Add a cursor type and two shared helpers above the `list` export (below `matchesFilters`):

```ts
type PageCursor = { date: number; id: Id<"transactions"> };

function normalizeListFilters(args: {
  accountIds?: Id<"accounts">[];
  categoryIds?: Id<"categories">[];
  type?: "income" | "expense" | "transfer";
}): ListFilters {
  const filters: ListFilters = {};
  if (args.accountIds !== undefined && args.accountIds.length > 0)
    filters.accountIds = args.accountIds;
  if (args.categoryIds !== undefined && args.categoryIds.length > 0)
    filters.categoryIds = args.categoryIds;
  if (args.type !== undefined) filters.type = args.type;
  return filters;
}

function pickPinnedDim(filters: ListFilters): "account" | "category" | "type" | "none" {
  if (filters.accountIds !== undefined && filters.accountIds.length === 1) return "account";
  if (filters.categoryIds !== undefined && filters.categoryIds.length === 1) return "category";
  if (filters.type !== undefined) return "type";
  return "none";
}

function pinnedRangeQuery(
  ctx: QueryCtx,
  householdId: Id<"households">,
  filters: ListFilters,
  pinnedDim: "account" | "category" | "type" | "none",
  startDate: number,
  endDate: number,
  cursorDate: number | undefined,
  atBoundary: boolean,
) {
  const base = ctx.db.query("transactions");
  if (pinnedDim === "account") {
    return base.withIndex("by_household_account_date", (q) => {
      let range = q
        .eq("householdId", householdId)
        .eq("accountId", filters.accountIds![0])
        .gte("date", startDate)
        .lt("date", endDate);
      if (cursorDate !== undefined) {
        range = atBoundary ? range.lt("date", cursorDate) : range.lte("date", cursorDate);
      }
      return range;
    });
  }
  if (pinnedDim === "category") {
    return base.withIndex("by_household_category_date", (q) => {
      let range = q
        .eq("householdId", householdId)
        .eq("categoryId", filters.categoryIds![0])
        .gte("date", startDate)
        .lt("date", endDate);
      if (cursorDate !== undefined) {
        range = atBoundary ? range.lt("date", cursorDate) : range.lte("date", cursorDate);
      }
      return range;
    });
  }
  if (pinnedDim === "type") {
    return base.withIndex("by_household_type_date", (q) => {
      let range = q
        .eq("householdId", householdId)
        .eq("type", filters.type!)
        .gte("date", startDate)
        .lt("date", endDate);
      if (cursorDate !== undefined) {
        range = atBoundary ? range.lt("date", cursorDate) : range.lte("date", cursorDate);
      }
      return range;
    });
  }
  return base.withIndex("by_household_date", (q) => {
    let range = q.eq("householdId", householdId).gte("date", startDate).lt("date", endDate);
    if (cursorDate !== undefined) {
      range = atBoundary ? range.lt("date", cursorDate) : range.lte("date", cursorDate);
    }
    return range;
  });
}
```

Note: `Expression` import may become unused after removing the old owner filter block — if so, delete the import.

3b. Extend `list` args with the optional cursor:

```ts
    cursor: v.optional(v.object({ date: v.number(), id: v.id("transactions") })),
```

3c. Replace the entire handler body of `list` (everything from `const result = await findUserAndMembership(ctx);` through the final `return`) with the unified engine. Keep the exported `query({...})` wrapper and existing arg validators otherwise untouched:

```ts
    const result = await findUserAndMembership(ctx);
    if (result === null) {
      return { transactions: null, isOwner: false, cursor: undefined, hasMore: false };
    }
    const { membership } = result;
    const isOwner = membership.role === "owner";

    const limit = Math.min(
      Math.max(Math.floor(args.limit ?? MAX_LIST_ROWS), 1),
      MAX_LIST_ROWS,
    );
    const SCAN_BUDGET = limit * 10;
    const filters = normalizeListFilters(args);
    const pinnedDim = pickPinnedDim(filters);
    const entityCache = new Map<
      string,
      Doc<"accounts"> | Doc<"categories"> | undefined
    >();

    let cursorDate = args.cursor?.date;
    let cursorId = args.cursor?.id;
    let atBoundary = false;
    let scanned = 0;
    let rangeExhausted = false;
    const collected: Doc<"transactions">[] = [];
    let lastCollected: Doc<"transactions"> | undefined;
    let lastScanned: Doc<"transactions"> | undefined;

    while (collected.length < limit && scanned < SCAN_BUDGET) {
      const batchSize = Math.min(SCAN_BUDGET - scanned, limit * 4);
      const rows = await pinnedRangeQuery(
        ctx,
        membership.householdId,
        filters,
        pinnedDim,
        args.startDate,
        args.endDate,
        cursorDate,
        atBoundary,
      )
        .order("desc")
        .take(batchSize);

      scanned += rows.length;
      if (rows.length < batchSize) rangeExhausted = true;

      let pastCursor = cursorDate === undefined || atBoundary;

      for (const row of rows) {
        lastScanned = row;
        if (!pastCursor) {
          if (row.date === cursorDate && row._id === cursorId) {
            pastCursor = true;
          }
          continue;
        }
        if (!matchesFilters(row, filters)) continue;
        const { category, account, toAccount } = await hydrate(ctx, row, entityCache);
        if (!isOwner && category !== undefined && category.hidden) continue;
        const enriched = { ...row, category, account, toAccount };
        collected.push(enriched);
        lastCollected = row;
        if (collected.length >= limit) break;
      }

      if (collected.length >= limit) break;
      if (rows.length < batchSize) break;
      if (!pastCursor) {
        atBoundary = true;
        continue;
      }

      const lastRow = rows[rows.length - 1];
      atBoundary = lastRow.date === cursorDate;
      cursorDate = lastRow.date;
      cursorId = lastRow._id;
    }

    const pageFilled = collected.length >= limit;
    const resumeRow = pageFilled ? lastCollected : lastScanned;
    const hasMore = !rangeExhausted && resumeRow !== undefined;
    return {
      transactions: collected,
      isOwner,
      cursor: hasMore ? { date: resumeRow.date, id: resumeRow._id } : undefined,
      hasMore,
    };
```

Behavioral notes (verify against these when reviewing):
- Old owner path applied `matchesFilters` inside a `.filter()` callback pre-`take`; the new engine applies the same predicate post-batch but pre-hydration — identical result sets, fewer hydration reads.
- Old member path hydrated before the hidden check; the new engine checks `matchesFilters` first — identical result sets.
- When the whole range fits in one batch (typical owner month view ≤ 4 000 rows), `rangeExhausted` makes `hasMore=false` truthfully even when the page filled.

- [ ] **Step 4: Regenerate codegen and run the tests**

Run: `npx convex codegen && npx vitest run tests/transactions.list.test.ts`
Expected: ALL PASS — the pre-existing tests (which omit `cursor` and only assert `transactions`/`isOwner`) must still pass unchanged.

- [ ] **Step 5: Typecheck and full test suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass (other suites exercise `create/update/remove/recent` — untouched).

- [ ] **Step 6: Commit**

```bash
git add convex/transactions.ts tests/transactions.list.test.ts
git commit -m "feat(transactions): cursor-paginated list with unified scan engine"
```

---

### Task 2: Backend — `transactions.summary` query

**Files:**
- Modify: `convex/transactions.ts` (add `summary` export after `list`)
- Test: `tests/transactions.summary.test.ts` (new file)

**Interfaces:**
- Consumes: `normalizeListFilters`, `pickPinnedDim`, `pinnedRangeQuery`, `matchesFilters`, `findUserAndMembership` (all from Task 1 / existing module).
- Produces: `api.transactions.summary` with args `{ startDate: number; endDate: number; accountIds?; categoryIds?; type? }` returning `{ income: number; expense: number; net: number } | null`. Tasks 3 and 4 call it with exactly these args.

- [ ] **Step 1: Write the failing tests**

Create `tests/transactions.summary.test.ts`:

```ts
/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|summary-test";
const MEMBER_TOKEN = "member|summary-test";

describe("transactions.summary", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed(ctx: any) {
    const householdId = await ctx.db.insert("households", {
      name: "Summary HH",
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerId = await ctx.db.insert("users", {
      tokenIdentifier: OWNER_TOKEN,
      clerkUserId: "clerk-owner-summary",
    });
    const memberId = await ctx.db.insert("users", {
      tokenIdentifier: MEMBER_TOKEN,
      clerkUserId: "clerk-member-summary",
    });
    await ctx.db.insert("householdMemberships", {
      householdId,
      userId: ownerId,
      role: "owner",
    });
    await ctx.db.insert("householdMemberships", {
      householdId,
      userId: memberId,
      role: "member",
    });
    const accountId = await ctx.db.insert("accounts", {
      householdId,
      name: "Cash",
      type: "cash",
      balance: 0,
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const bankId = await ctx.db.insert("accounts", {
      householdId,
      name: "Bank",
      type: "bank",
      balance: 0,
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const hiddenCatId = await ctx.db.insert("categories", {
      householdId,
      name: "Hidden Cat",
      type: "expense",
      hidden: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const visibleCatId = await ctx.db.insert("categories", {
      householdId,
      name: "Visible Cat",
      type: "expense",
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const incomeCatId = await ctx.db.insert("categories", {
      householdId,
      name: "Salary",
      type: "income",
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    return {
      householdId,
      accountId,
      bankId,
      hiddenCatId,
      visibleCatId,
      incomeCatId,
      ownerId,
    };
  }

  async function insertTx(ctx: any, s: any, overrides: Record<string, unknown>) {
    await ctx.db.insert("transactions", {
      householdId: s.householdId,
      accountId: s.accountId,
      categoryId: s.visibleCatId,
      amount: -100,
      type: "expense",
      note: undefined,
      date: 100,
      createdBy: s.ownerId,
      updatedBy: s.ownerId,
      createdAt: 100,
      updatedAt: 100,
      ...overrides,
    });
  }

  it("returns null for an unauthenticated caller", async () => {
    const result = await t.query(api.transactions.summary, {
      startDate: 0,
      endDate: 1_000_000_000_000,
    });
    expect(result).toBeNull();
  });

  it("sums income, expense, and net over the full range; excludes transfers", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      await insertTx(ctx, s, { amount: 500, type: "income", categoryId: s.incomeCatId, date: 100 });
      await insertTx(ctx, s, { amount: -200, type: "expense", date: 200 });
      await insertTx(ctx, s, { amount: -50, type: "expense", date: 300 });
      await insertTx(ctx, s, {
        amount: 75,
        type: "transfer",
        toAccountId: s.bankId,
        categoryId: undefined,
        date: 400,
      });
    });
    const result = await owner.query(api.transactions.summary, {
      startDate: 0,
      endDate: 1_000_000_000_000,
    });
    expect(result).toEqual({ income: 500, expense: 250, net: 250 });
  });

  it("covers the entire range beyond any row cap", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      for (let i = 0; i < 30; i++) {
        await insertTx(ctx, s, { amount: -10, type: "expense", date: 100 + i });
      }
    });
    const result = await owner.query(api.transactions.summary, {
      startDate: 0,
      endDate: 1_000_000_000_000,
    });
    expect(result).toEqual({ income: 0, expense: 300, net: -300 });
  });

  it("member excludes hidden-category transactions", async () => {
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      await insertTx(ctx, s, { amount: -80, type: "expense", categoryId: s.hiddenCatId, date: 100 });
      await insertTx(ctx, s, { amount: -20, type: "expense", categoryId: s.visibleCatId, date: 200 });
      await insertTx(ctx, s, { amount: 90, type: "income", categoryId: s.incomeCatId, date: 300 });
    });
    const result = await member.query(api.transactions.summary, {
      startDate: 0,
      endDate: 1_000_000_000_000,
    });
    expect(result).toEqual({ income: 90, expense: 20, net: 70 });
  });

  it("applies type, account, and category filters like list", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      await insertTx(ctx, s, { amount: 100, type: "income", categoryId: s.incomeCatId, date: 100 });
      await insertTx(ctx, s, { amount: -40, type: "expense", date: 200, accountId: s.bankId });
      await insertTx(ctx, s, { amount: -60, type: "expense", date: 300 });
      return s;
    });
    const byType = await owner.query(api.transactions.summary, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      type: "expense",
    });
    expect(byType).toEqual({ income: 0, expense: 100, net: -100 });

    const byAccount = await owner.query(api.transactions.summary, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      accountIds: [ids.bankId],
    });
    expect(byAccount).toEqual({ income: 0, expense: 40, net: -40 });

    const byEmptyArrays = await owner.query(api.transactions.summary, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      accountIds: [],
      categoryIds: [],
    });
    expect(byEmptyArrays).toEqual({ income: 100, expense: 100, net: 0 });
  });

  it("returns zeros for an empty range", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      await insertTx(ctx, s, { amount: -100, type: "expense", date: 500 });
    });
    const result = await owner.query(api.transactions.summary, {
      startDate: 0,
      endDate: 400,
    });
    expect(result).toEqual({ income: 0, expense: 0, net: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/transactions.summary.test.ts`
Expected: FAIL — `api.transactions.summary` does not exist (import/property error).

- [ ] **Step 3: Implement `summary`**

Add after the `list` export in `convex/transactions.ts`:

```ts
const SUMMARY_BATCH_SIZE = 500;

export const summary = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    accountIds: v.optional(v.array(v.id("accounts"))),
    categoryIds: v.optional(v.array(v.id("categories"))),
    type: v.optional(transactionType),
  },
  handler: async (ctx, args) => {
    const result = await findUserAndMembership(ctx);
    if (result === null) return null;
    const { membership } = result;
    const isOwner = membership.role === "owner";

    const filters = normalizeListFilters(args);
    const pinnedDim = pickPinnedDim(filters);

    let income = 0;
    let expense = 0;
    const hiddenCategoryCache = new Map<Id<"categories">, boolean>();

    let cursorDate: number | undefined;
    let cursorId: Id<"transactions"> | undefined;
    let atBoundary = false;

    for (;;) {
      const rows = await pinnedRangeQuery(
        ctx,
        membership.householdId,
        filters,
        pinnedDim,
        args.startDate,
        args.endDate,
        cursorDate,
        atBoundary,
      )
        .order("desc")
        .take(SUMMARY_BATCH_SIZE);

      if (rows.length === 0) break;

      let pastCursor = cursorDate === undefined || atBoundary;

      for (const row of rows) {
        if (!pastCursor) {
          if (row.date === cursorDate && row._id === cursorId) {
            pastCursor = true;
          }
          continue;
        }
        if (!isOwner && row.categoryId !== undefined) {
          let hidden = hiddenCategoryCache.get(row.categoryId);
          if (hidden === undefined) {
            const category = await ctx.db.get(row.categoryId);
            hidden = category?.hidden ?? false;
            hiddenCategoryCache.set(row.categoryId, hidden);
          }
          if (hidden) continue;
        }
        if (!matchesFilters(row, filters)) continue;
        if (row.type === "income") {
          income += row.amount;
        } else if (row.type === "expense") {
          expense += Math.abs(row.amount);
        }
      }

      if (rows.length < SUMMARY_BATCH_SIZE) break;

      const lastRow = rows[rows.length - 1];
      atBoundary = lastRow.date === cursorDate;
      cursorDate = lastRow.date;
      cursorId = lastRow._id;
    }

    return { income, expense, net: income - expense };
  },
});
```

- [ ] **Step 4: Regenerate codegen and run the tests**

Run: `npx convex codegen && npx vitest run tests/transactions.summary.test.ts`
Expected: ALL PASS.

- [ ] **Step 5: Typecheck and full suite**

Run: `npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add convex/transactions.ts tests/transactions.summary.test.ts
git commit -m "feat(transactions): server-side range summary query"
```

---

### Task 3: Frontend — Home uses `summary`

**Files:**
- Modify: `app/(tabs)/home.tsx`

**Interfaces:**
- Consumes: `api.transactions.summary` (Task 2), `getMonthBounds`/`resolveTimezone` (existing imports).
- Produces: nothing downstream; standalone screen change.

- [ ] **Step 1: Swap the month-list query for the summary query**

In `app/(tabs)/home.tsx`, replace:

```tsx
  const monthTransactions = useQuery(api.transactions.list, {
    startDate: monthStart,
    endDate: monthEnd,
  });
```

with:

```tsx
  const monthSummary = useQuery(api.transactions.summary, {
    startDate: monthStart,
    endDate: monthEnd,
  });
```

Delete the entire `monthlySummary` `useMemo` block (lines computing `income`/`expense`/`net` from `monthTransactions`). `useMemo` remains imported — other memos use it.

- [ ] **Step 2: Rewire the Total Balance card's net line**

Replace the `monthlySummary ? (...) : (...)` conditional inside `GradientCard` with:

```tsx
            {monthSummary !== undefined ? (
              <Text
                className="text-center text-sm font-medium"
                style={{
                  color: monthSummary.net >= 0 ? C.success : C.error,
                }}
              >
                {monthSummary.net >= 0 ? "+" : ""}
                {formatNumber(monthSummary.net)} this month
              </Text>
            ) : (
              <Skeleton style={{ width: 120, height: 14 }} />
            )}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. Confirm no leftover references to `monthTransactions` or `monthlySummary` exist in the file.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/home.tsx"
git commit -m "feat(home): derive monthly net from server-side summary"
```

---

### Task 4: Frontend — Transactions tab paging + server summary + complete-day totals

**Files:**
- Modify: `app/(tabs)/transactions.tsx`

**Interfaces:**
- Consumes: `api.transactions.list` paginated contract (Task 1: `cursor`, `hasMore`) and `api.transactions.summary` (Task 2).
- Produces: nothing downstream; standalone screen change.

- [ ] **Step 1: Add page-size constant**

Below the existing `DATE_OPTIONS` declaration add:

```tsx
const PAGE_SIZE = 30;
```

- [ ] **Step 2: Replace the single-shot query with paged accumulation**

Inside `Transactions()`, keep `queryArgs` exactly as-is (it already carries range + normalized filters and no limit). Then replace:

```tsx
  const result = useQuery(api.transactions.list, queryArgs);
```

with the paging state, the two subscriptions, and the accumulation machinery below (state must precede the `list` call because the query args read `activeCursor`; the `Tx` alias mirrors the derivation pattern already used in `app/(tabs)/home.tsx`):

```tsx
  const [activeCursor, setActiveCursor] = useState<
    { date: number; id: Id<"transactions"> } | undefined
  >(undefined);

  const result = useQuery(api.transactions.list, {
    ...queryArgs,
    limit: PAGE_SIZE,
    ...(activeCursor !== undefined ? { cursor: activeCursor } : {}),
  });
  const summaryResult = useQuery(api.transactions.summary, queryArgs);

  type Tx = NonNullable<NonNullable<typeof result>["transactions"]>[number];

  const [nextCursor, setNextCursor] = useState<
    { date: number; id: Id<"transactions"> } | undefined
  >(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pagedTransactions, setPagedTransactions] = useState<Tx[] | null>(null);

  const activeCursorRef = useRef(activeCursor);
  activeCursorRef.current = activeCursor;
  const pagedRef = useRef(pagedTransactions);
  pagedRef.current = pagedTransactions;
  const isLoadingMoreRef = useRef(isLoadingMore);
  isLoadingMoreRef.current = isLoadingMore;

  const queryKey = useMemo(() => JSON.stringify(queryArgs), [queryArgs]);

  useEffect(() => {
    setActiveCursor(undefined);
    setNextCursor(undefined);
    setHasMore(false);
    setIsLoadingMore(false);
    setPagedTransactions(null);
  }, [queryKey]);

  useEffect(() => {
    if (result === undefined) return;
    if (result.transactions === null) {
      setPagedTransactions(null);
      setHasMore(false);
      setNextCursor(undefined);
      setIsLoadingMore(false);
      return;
    }
    const isFirstPage = activeCursorRef.current === undefined;
    const base =
      isFirstPage || pagedRef.current === null ? [] : pagedRef.current;
    const merged = isFirstPage ? [...result.transactions] : [...base, ...result.transactions];
    setPagedTransactions(merged);
    setNextCursor(result.cursor ?? undefined);
    setHasMore(result.hasMore);
    setIsLoadingMore(false);
  }, [result]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMoreRef.current || nextCursor === undefined) return;
    if (pagedTransactions === null) return;
    setIsLoadingMore(true);
    setActiveCursor(nextCursor);
  }, [hasMore, nextCursor, pagedTransactions]);
```

Add `useRef` to the React import at the top of the file (the file already imports `ComponentProps, useMemo, useState` from `"react"`; extend that import list with `useCallback, useEffect, useRef`).

Remove the now-dead `Id` import usage if it becomes unused — `Id` is imported from `@/convex/_generated/dataModel` and is still needed for the cursor state typing above; keep it.

- [ ] **Step 3: Rework derived sections with complete-day totals**

Replace the `sections` and `summary` memos with:

```tsx
  const sections = useMemo(() => {
    const transactions = pagedTransactions;
    if (transactions === null) return null;
    const groups = new Map<string, typeof transactions>();
    for (const tx of transactions) {
      const key = formatDateHeaderTz(tx.date, timezone);
      const list = groups.get(key);
      if (list) {
        list.push(tx);
      } else {
        groups.set(key, [tx]);
      }
    }
    const entries = Array.from(groups.entries()).map(([title, data]) => ({
      title,
      data,
      total: sumNetExcludingTransfers(data),
    }));
    return entries.map((entry, index) => ({
      ...entry,
      completeDay: index < entries.length - 1 || !hasMore,
    }));
  }, [pagedTransactions, timezone, hasMore]);

  const summary = summaryResult ?? { income: 0, expense: 0, net: 0 };
```

- [ ] **Step 4: Update guard clauses and rendering**

4a. Replace the loading/not-member guards (previously keyed on `result === undefined` / `result.transactions === null`) with:

```tsx
  if (result !== undefined && result.transactions === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6 dark:bg-background-dark">
        <Text className="text-center text-sm text-text-secondary dark:text-text-secondary-dark">
          You are not a member of a household.
        </Text>
      </SafeAreaView>
    );
  }

  if (pagedTransactions === null) {
    // keep the existing full-screen loading skeleton JSX from the old
    // `result === undefined` branch, byte-for-byte
  }
```

(The skeleton JSX stays exactly as it is today — only the enclosing condition changes.)

4b. Header pill area, Date chip, Filter chip: unchanged.

4c. Summary card body: the existing `<GradientCard>` block already renders `summary.income` / `summary.expense` / `summary.net` — leave the JSX untouched (it now reads from `summaryResult` via the Step 3 fallback).

4d. Section header total: wrap the total `<Text>` so incomplete days hide their net:

```tsx
              {section.completeDay ? (
                <Text
                  className="text-sm font-semibold"
                  style={{
                    color:
                      section.total > 0
                        ? C.success
                        : section.total < 0
                          ? C.error
                          : C.textSecondary,
                  }}
                >
                  {section.total > 0 ? "+" : ""}
                  {formatNumber(section.total)}
                </Text>
              ) : null}
```

4e. SectionList paging props — add to the `<SectionList … />`:

```tsx
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingMore ? (
              <View className="items-center py-4">
                <ActivityIndicator color={C.primary} />
              </View>
            ) : null
          }
```

Extend the `react-native` import at the top of the file with `ActivityIndicator` (imports currently: Modal, Pressable, SectionList, Text, View).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. Manual sanity check in a dev session (`npx convex dev` + `npx expo start`): scroll to bottom loads next 30 rows; day header of the oldest loaded group shows no total until an older group appears or the end is reached; changing filters resets to page one.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/transactions.tsx"
git commit -m "feat(transactions): infinite scroll paging with server-computed summary"
```

---

### Task 5: PRD documentation

**Files:**
- Modify: `docs/Product Requirement Document/PRD.md`

**Interfaces:**
- Consumes: shipped behavior from Tasks 1–4.
- Produces: documentation only.

- [ ] **Step 1: Update §2.1 Transactions row**

Append to the Transactions requirements cell, after the sentence about `list` returning at most 1 000 rows:

> `list` is cursor-paginated (`cursor`/`hasMore`); the Transactions page loads 30 rows per page. A `summary` query computes range income/expense/net server-side (transfers excluded; Members' hidden-category rows excluded).

Adjust the existing "`list` returns at most 1 000 rows per call (server cap, optional `limit`)" wording to note it now refers to a single page.

- [ ] **Step 2: Update §3.6 Filtering subsection tail**

After the paragraph ending "…distinguishes 'no transactions at all' from 'no transactions match your filters' (with a Clear filters action)." add:

> **Pagination & server-side summary (as of 2026-08-26):** `transactions.list` accepts an optional `cursor {date, id}` and returns `cursor`/`hasMore`; owner and member share one bounded-scan engine (SCAN_BUDGET = limit × 10) with the same pinned-index priority as before. The Transactions page accumulates 30-row pages on scroll; the summary card uses `transactions.summary`, which walks the entire range uncapped (hydration-free; members skip hidden categories via a cached lookup). Day-group net totals render only for completed days — an older group has loaded, or `hasMore` is false.

- [ ] **Step 3: Update §3.8 Home Dashboard**

Change the bullet "- **Total Balance**: gradient card showing the sum of all account balances, with a secondary line showing this month's net income/expense in semantic color (green for positive, red for negative)." to:

> - **Total Balance**: gradient card showing the sum of all account balances, with a secondary line showing this month's net income/expense (from `transactions.summary`, server-computed) in semantic color (green for positive, red for negative).

- [ ] **Step 4: Update §6 Convex Functions table**

Modify the `transactions.list` row Notes to: "Date-range + optional `accountIds`/`categoryIds`/`type` filtered (index-driven); optional `limit` (default/max 1 000) per page; optional `cursor` continuation; returns `cursor`/`hasMore`; cached hydration". Insert a new row beneath it:

> | `transactions` | `summary` | query | Range totals `{income, expense, net}`; same filters as `list`; transfers excluded; uncapped walk; hidden-category aware for Members |

- [ ] **Step 5: Prepend Change Log entry**

Insert at the top of the §8 table (below the header row, above the 2026-08-26 Fix row about discard-guards):

> | 2026-08-26 | Feature | Transactions paging + server-side summary: `transactions.list` unified owner/member scan engine gains `cursor {date,id}` continuation and truthful `hasMore` (SCAN_BUDGET now also covers filtered owner scans, fixing potential under-fill); new `transactions.summary` computes uncapped range income/expense/net (transfers excluded, member hidden-category aware, hydration-free). Home's "net this month" and the Transactions summary card switched to `summary`; the Transactions list loads 30-row pages on scroll and shows day-net totals only for completed days (older group loaded or `hasMore=false`). Updates §2.1, §3.6, §3.8, §6 |

- [ ] **Step 6: Verify and commit**

Run: `npm test && npx tsc --noEmit` (final gate; docs-only change but confirms repo health)
Expected: pass.

```bash
git add "docs/Product Requirement Document/PRD.md"
git commit -m "docs(prd): transactions pagination and server-side summary"
```

---

## Self-Review (completed)

- **Spec coverage:** §3.1 paginated list → Task 1; §3.2 summary → Task 2; §4.1 Home → Task 3; §4.2 Transactions tab (paging, summary card, complete-day totals, unchanged sheets/states) → Task 4; §5 tests → embedded per task (list continuation/ties/under-fill/hasMore/back-compat; summary owner/member/filters/empty); §6 PRD → Task 5.
- **Placeholder scan:** Step 4a of Task 4 explicitly instructs reusing the existing skeleton JSX byte-for-byte rather than deferring it; no TBD/TODO anywhere.
- **Type consistency:** `PageCursor`-shaped state in Task 4 matches Task 1's returned `cursor` (`{date: number, id: Id<"transactions">}`); `summaryResult` fallback shape `{income, expense, net}` matches Task 2's return; helper names (`normalizeListFilters`, `pickPinnedDim`, `pinnedRangeQuery`) consistent across Tasks 1–2.
