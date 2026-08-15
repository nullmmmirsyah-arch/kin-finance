# Technical Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement technical hardening points 1–5 (shared validation module, `transactions.list` N+1 + cap, discard-guard fix for edit mode, authorization/PRD compliance, render side-effect removal) and update the PRD.

**Architecture:** A pure shared validation module `constants/validation.ts` consumed by both Convex server handlers and Expo client screens; targeted server-side fixes in `convex/transactions.ts`, `convex/budgets.ts`, `convex/invitations.ts`; client fixes in the transaction form, budget screen/card, members, and settings; three new convex-test specs; PRD updated.

**Tech Stack:** TypeScript, Convex (`convex/values`, `convex-test`), Expo React Native, Vitest.

## Global Constraints

- Amounts are signed: `+income`, `−expense`, `+transfer magnitude`; whole numbers only. Server uses `Number.isSafeInteger`.
- Validation messages are user-facing English copy; keep exact existing wording.
- `constants/validation.ts` must be pure TS — no `react-native`, no `convex/*` imports (safe for both client and server bundling).
- Convex files import shared code via relative path: `../constants/validation`. Client files use `@/constants/validation`.
- Every `convex/*.ts` handler requires a signed-in identity via `ctx.auth.getUserIdentity()` and throws `ConvexError` with a plain string.
- After any change to `convex/*.ts`: run `npx convex codegen`, then `npx tsc --noEmit`. Never commit `convex/_generated/` (gitignored).
- Verification commands: `npx tsc --noEmit`, `npm test`, `npm run lint`.
- Tests live in `tests/` using `vitest` + `convex-test`; pattern established by `tests/transactions.recent.test.ts`.

---

### Task 1: Create shared validation module

**Files:**
- Create: `constants/validation.ts`

**Interfaces:**
- Produces (used by every later task): constants `ACCOUNT_NAME_MIN`, `ACCOUNT_NAME_MAX`, `CATEGORY_NAME_MIN`, `CATEGORY_NAME_MAX`, `HOUSEHOLD_NAME_MIN`, `HOUSEHOLD_NAME_MAX`, `NOTE_MAX_LENGTH`, `AMOUNT_MIN_ABS`, `BUDGET_AMOUNT_MIN`, `INVITE_CODE_LENGTH`, `INVITE_CHARSET`; type `TransactionType = "income" | "expense" | "transfer"`; validators `validateAccountName`, `validateCategoryName`, `validateHouseholdName`, `validateNote`, `validateTransactionAmount`, `validateTransactionDate`, `validateBudgetAmount`, `validateInviteCode` — all `(…) => string | null`.

- [ ] **Step 1: Create the module**

```ts
export const ACCOUNT_NAME_MIN = 2;
export const ACCOUNT_NAME_MAX = 30;
export const CATEGORY_NAME_MIN = 2;
export const CATEGORY_NAME_MAX = 30;
export const HOUSEHOLD_NAME_MIN = 3;
export const HOUSEHOLD_NAME_MAX = 50;
export const NOTE_MAX_LENGTH = 200;
export const AMOUNT_MIN_ABS = 1;
export const BUDGET_AMOUNT_MIN = 1;
export const INVITE_CODE_LENGTH = 8;
export const INVITE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export type TransactionType = "income" | "expense" | "transfer";

export function validateAccountName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Account name is required.";
  if (trimmed.length < ACCOUNT_NAME_MIN)
    return `Account name must be at least ${ACCOUNT_NAME_MIN} characters.`;
  if (trimmed.length > ACCOUNT_NAME_MAX)
    return `Account name must be at most ${ACCOUNT_NAME_MAX} characters.`;
  return null;
}

export function validateCategoryName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Category name is required.";
  if (trimmed.length < CATEGORY_NAME_MIN)
    return `Category name must be at least ${CATEGORY_NAME_MIN} characters.`;
  if (trimmed.length > CATEGORY_NAME_MAX)
    return `Category name must be at most ${CATEGORY_NAME_MAX} characters.`;
  return null;
}

export function validateHouseholdName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Household name is required.";
  if (trimmed.length < HOUSEHOLD_NAME_MIN)
    return `Household name must be at least ${HOUSEHOLD_NAME_MIN} characters.`;
  if (trimmed.length > HOUSEHOLD_NAME_MAX)
    return `Household name must be at most ${HOUSEHOLD_NAME_MAX} characters.`;
  return null;
}

export function validateNote(note: string | undefined): string | null {
  if (note !== undefined && note.length > NOTE_MAX_LENGTH)
    return `Note must be at most ${NOTE_MAX_LENGTH} characters.`;
  return null;
}

export function validateTransactionAmount(
  amount: number,
  type: TransactionType,
): string | null {
  if (!Number.isFinite(amount)) return "Amount must be a finite number.";
  if (!Number.isSafeInteger(amount)) return "Amount must be a whole number.";
  if (amount === 0) return "Amount must be a non-zero number.";
  if (type === "income" && amount <= 0)
    return "Amount must be positive for income transactions.";
  if (type === "expense" && amount >= 0)
    return "Amount must be negative for expense transactions.";
  if (type === "transfer" && amount <= 0)
    return "Amount must be positive for transfers.";
  if (Math.abs(amount) < AMOUNT_MIN_ABS)
    return `Amount must be at least ${AMOUNT_MIN_ABS}.`;
  return null;
}

export function validateTransactionDate(date: number): string | null {
  if (!Number.isFinite(date)) return "Date must be a valid timestamp.";
  if (date > Date.now()) return "Transaction date cannot be in the future.";
  return null;
}

export function validateBudgetAmount(amount: number): string | null {
  if (!Number.isFinite(amount)) return "Amount must be a valid number.";
  if (!Number.isSafeInteger(amount)) return "Amount must be a whole number.";
  if (amount < BUDGET_AMOUNT_MIN)
    return `Amount must be at least ${BUDGET_AMOUNT_MIN}.`;
  return null;
}

export function validateInviteCode(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  if (normalized.length !== INVITE_CODE_LENGTH)
    return `Invite code must be ${INVITE_CODE_LENGTH} characters.`;
  for (const ch of normalized) {
    if (!INVITE_CHARSET.includes(ch))
      return "Invite code contains invalid characters.";
  }
  return null;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add constants/validation.ts
git commit -m "feat: add shared validation module"
```

---

### Task 2: Write failing backend tests

**Files:**
- Create: `tests/transactions.list.test.ts`
- Create: `tests/budgets.list.test.ts`
- Create: `tests/invitations.listActive.test.ts`

**Interfaces:**
- Consumes: nothing yet (this task only asserts the target behaviors).
- Produces: three failing specs that Task 3 makes green.

- [ ] **Step 1: Write `tests/transactions.list.test.ts`**

```ts
/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|list-test";
const MEMBER_TOKEN = "member|list-test";

describe("transactions.list", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed(ctx: any) {
    const householdId = await ctx.db.insert("households", {
      name: "List HH",
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerId = await ctx.db.insert("users", {
      tokenIdentifier: OWNER_TOKEN,
      clerkUserId: "clerk-owner-list",
    });
    const memberId = await ctx.db.insert("users", {
      tokenIdentifier: MEMBER_TOKEN,
      clerkUserId: "clerk-member-list",
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
    const insertTx = async (categoryId: any, note: string, date: number) =>
      ctx.db.insert("transactions", {
        householdId,
        accountId,
        categoryId,
        amount: -100,
        type: "expense",
        note,
        date,
        createdBy: ownerId,
        updatedBy: ownerId,
        createdAt: date,
        updatedAt: date,
      });
    return { householdId, accountId, hiddenCatId, visibleCatId, insertTx };
  }

  it("returns null transactions for unauthenticated caller", async () => {
    const result = await t.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
    });
    expect(result.transactions).toBeNull();
  });

  it("owner receives all transactions in range", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { insertTx, hiddenCatId, visibleCatId } = await t.run(async (ctx) => seed(ctx));
    await t.run(async (ctx) => {
      await insertTx(hiddenCatId, "hidden-1", 100);
      await insertTx(visibleCatId, "visible-1", 200);
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
    });
    expect(result.transactions!.length).toBe(2);
    expect(result.transactions!.map((tx) => tx.note)).toEqual(
      expect.arrayContaining(["hidden-1", "visible-1"]),
    );
  });

  it("respects the limit cap", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { insertTx, visibleCatId } = await t.run(async (ctx) => seed(ctx));
    await t.run(async (ctx) => {
      for (let i = 0; i < 5; i++) await insertTx(visibleCatId, `tx-${i}`, 100 + i);
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
    });
    expect(result.transactions!.length).toBe(2);
  });

  it("member sees only transactions with visible categories", async () => {
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const { insertTx, hiddenCatId, visibleCatId } = await t.run(async (ctx) => seed(ctx));
    await t.run(async (ctx) => {
      await insertTx(hiddenCatId, "hidden-1", 100);
      await insertTx(visibleCatId, "visible-1", 200);
      await insertTx(visibleCatId, "visible-2", 300);
    });
    const result = await member.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
    });
    expect(result.transactions!.length).toBe(2);
    expect(result.transactions!.map((tx) => tx.note)).toEqual(
      expect.arrayContaining(["visible-1", "visible-2"]),
    );
  });
});
```

- [ ] **Step 2: Write `tests/budgets.list.test.ts`**

```ts
/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|budget-test";
const MEMBER_TOKEN = "member|budget-test";

describe("budgets.list", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed(ctx: any) {
    const householdId = await ctx.db.insert("households", {
      name: "Budget HH",
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerId = await ctx.db.insert("users", {
      tokenIdentifier: OWNER_TOKEN,
      clerkUserId: "clerk-owner-budget",
    });
    const memberId = await ctx.db.insert("users", {
      tokenIdentifier: MEMBER_TOKEN,
      clerkUserId: "clerk-member-budget",
    });
    await ctx.db.insert("householdMemberships", { householdId, userId: ownerId, role: "owner" });
    await ctx.db.insert("householdMemberships", { householdId, userId: memberId, role: "member" });
    const accountId = await ctx.db.insert("accounts", {
      householdId,
      name: "Cash",
      type: "cash",
      balance: 0,
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const hiddenCatId = await ctx.db.insert("categories", {
      householdId,
      name: "Hidden",
      type: "expense",
      hidden: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const visibleCatId = await ctx.db.insert("categories", {
      householdId,
      name: "Visible",
      type: "expense",
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const budgetId = await ctx.db.insert("budgets", {
      householdId,
      categoryId: hiddenCatId,
      periodStart: 1_000,
      amount: 1000,
      createdBy: ownerId,
      updatedBy: ownerId,
      createdAt: 1,
      updatedAt: 1,
    });
    const visibleBudgetId = await ctx.db.insert("budgets", {
      householdId,
      categoryId: visibleCatId,
      periodStart: 1_000,
      amount: 500,
      createdBy: ownerId,
      updatedBy: ownerId,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("transactions", {
      householdId,
      accountId,
      categoryId: hiddenCatId,
      amount: -300,
      type: "expense",
      date: 1_500,
      createdBy: ownerId,
      updatedBy: ownerId,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("transactions", {
      householdId,
      accountId,
      categoryId: visibleCatId,
      amount: -200,
      type: "expense",
      date: 1_500,
      createdBy: ownerId,
      updatedBy: ownerId,
      createdAt: 1,
      updatedAt: 1,
    });
    return { householdId, budgetId, visibleBudgetId };
  }

  it("member sees hidden-category budget with redacted breakdown and visible-category budget intact", async () => {
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const { budgetId, visibleBudgetId } = await t.run(async (ctx) => seed(ctx));

    const result = await member.query(api.budgets.list, {
      periodStart: 1_000,
      periodEnd: 1_000 + 31 * 86_400_000,
    });

    const hidden = result.budgets!.find((b) => b._id === budgetId)!;
    expect(hidden.category?.hidden).toBe(true);
    expect(hidden.spent).toBeUndefined();
    expect(hidden.progress).toBeUndefined();
    expect(hidden.amount).toBe(1000);

    const visible = result.budgets!.find((b) => b._id === visibleBudgetId)!;
    expect(visible.category?.hidden).toBe(false);
    expect(visible.spent).toBe(200);
    expect(visible.progress).toBe(200 / 500);
  });

  it("owner sees full breakdown for hidden-category budgets", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { budgetId } = await t.run(async (ctx) => seed(ctx));

    const result = await owner.query(api.budgets.list, {
      periodStart: 1_000,
      periodEnd: 1_000 + 31 * 86_400_000,
    });

    const hidden = result.budgets!.find((b) => b._id === budgetId)!;
    expect(hidden.spent).toBe(300);
    expect(hidden.progress).toBe(0.3);
  });
});
```

- [ ] **Step 3: Write `tests/invitations.listActive.test.ts`**

```ts
/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|invite-test";
const MEMBER_TOKEN = "member|invite-test";

describe("invitations.listActive", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed(ctx: any) {
    const householdId = await ctx.db.insert("households", {
      name: "Invite HH",
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerId = await ctx.db.insert("users", {
      tokenIdentifier: OWNER_TOKEN,
      clerkUserId: "clerk-owner-invite",
    });
    const memberId = await ctx.db.insert("users", {
      tokenIdentifier: MEMBER_TOKEN,
      clerkUserId: "clerk-member-invite",
    });
    await ctx.db.insert("householdMemberships", { householdId, userId: ownerId, role: "owner" });
    await ctx.db.insert("householdMemberships", { householdId, userId: memberId, role: "member" });
    const now = Date.now();
    const invitationId = await ctx.db.insert("invitations", {
      householdId,
      codeHash: "abc123",
      createdBy: ownerId,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000,
      maxUses: 1,
      useCount: 0,
      revoked: false,
      redemptionAttempts: 0,
      lastAttemptAt: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { householdId, invitationId };
  }

  it("owner sees active invitations", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { householdId } = await t.run(async (ctx) => seed(ctx));
    const result = await owner.query(api.invitations.listActive, { householdId });
    expect(result.length).toBe(1);
  });

  it("member in the same household gets no invitations", async () => {
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const { householdId } = await t.run(async (ctx) => seed(ctx));
    const result = await member.query(api.invitations.listActive, { householdId });
    expect(result).toEqual([]);
  });

  it("unauthenticated caller gets an empty array", async () => {
    const { householdId } = await t.run(async (ctx) => seed(ctx));
    const result = await t.query(api.invitations.listActive, { householdId });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 4: Run tests to verify the new behaviors fail**

Run: `npm test`
Expected: `transactions.list` "respects the limit cap" FAILS (extra `limit` arg rejected), `budgets.list` "member sees…redacted" FAILS (spent is a number), `invitations.listActive` "member…gets no invitations" FAILS (returns 1). Existing `transactions.recent` spec must still PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/transactions.list.test.ts tests/budgets.list.test.ts tests/invitations.listActive.test.ts
git commit -m "test: add failing specs for list cap, budget redaction, invite owner-gate"
```

---

### Task 3: Backend implementation

**Files:**
- Modify: `convex/transactions.ts`
- Modify: `convex/budgets.ts`
- Modify: `convex/invitations.ts`
- Modify: `convex/accounts.ts`
- Modify: `convex/categories.ts`
- Modify: `convex/households.ts`

**Interfaces:**
- Consumes: `constants/validation.ts` validators (Task 1).
- Produces: `transactions.list` accepts optional `limit` (default 1000, clamped 1–1000) and returns `{ transactions, isOwner }`; `budgets.list` returns `spent: number | undefined, progress: number | undefined`; `invitations.listActive` returns `[]` for non-owners.

- [ ] **Step 1: Add the hydration cache + limit cap to `transactions.list`**

In `convex/transactions.ts`:

1. Add near the top a cap constant:

```ts
const MAX_LIST_ROWS = 1000;
```

2. Replace the `hydrate` function with a cache-aware version:

```ts
async function hydrate(
  ctx: QueryCtx,
  row: Doc<"transactions">,
  cache?: Map<string, Doc<"accounts"> | Doc<"categories"> | undefined>,
) {
  const getEntity = async <T>(
    key: string,
    id: Id<"accounts"> | Id<"categories">,
  ): Promise<T | undefined> => {
    if (cache?.has(key)) return cache.get(key) as T | undefined;
    const doc = (await ctx.db.get(id)) as T | null;
    const value = doc ?? undefined;
    cache?.set(key, value as Doc<"accounts"> | Doc<"categories"> | undefined);
    return value;
  };

  const category =
    row.categoryId === undefined
      ? undefined
      : await getEntity<Doc<"categories">>(`category:${row.categoryId}`, row.categoryId);
  const account = await getEntity<Doc<"accounts">>(`account:${row.accountId}`, row.accountId);
  const toAccount =
    row.toAccountId === undefined
      ? undefined
      : await getEntity<Doc<"accounts">>(`account:${row.toAccountId}`, row.toAccountId);

  return { category, account, toAccount };
}
```

3. Update `list` args and handler:

```ts
export const list = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // ...existing auth/membership code unchanged...
    const isOwner = membership.role === "owner";
    const limit = Math.min(
      Math.max(Math.floor(args.limit ?? MAX_LIST_ROWS), 1),
      MAX_LIST_ROWS,
    );
    const entityCache = new Map<
      string,
      Doc<"accounts"> | Doc<"categories"> | undefined
    >();

    if (isOwner) {
      const rows = await ctx.db
        .query("transactions")
        .withIndex("by_household_date", (q) =>
          q
            .eq("householdId", membership.householdId)
            .gte("date", args.startDate)
            .lt("date", args.endDate),
        )
        .order("desc")
        .take(limit);

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

4. In the `recent` member path, update the call to pass the same cache map (it already passes `categoryCache`; rename it `entityCache` and keep passing it to `hydrate`). No other change needed — `hydrate` handles keys.

- [ ] **Step 2: Redact hidden-category breakdown in `budgets.list`**

In `convex/budgets.ts`, change the `result` mapping:

```ts
    const result = budgets.map((budget) => {
      const category = categoryMap.get(budget.categoryId);
      const spent = spendingByCategory.get(budget.categoryId) ?? 0;
      const progress = budget.amount > 0 ? spent / budget.amount : 0;
      const redacted = !isOwner && category?.hidden === true;
      return {
        ...budget,
        category: category
          ? { _id: category._id, name: category.name, hidden: category.hidden }
          : undefined,
        spent: redacted ? undefined : spent,
        progress: redacted ? undefined : progress,
      };
    });
```

- [ ] **Step 3: Owner-gate `invitations.listActive`**

In `convex/invitations.ts`, after the household membership check add:

```ts
    if (membership.role !== "owner") {
      return [];
    }
```

- [ ] **Step 4: Wire shared validators into remaining convex handlers**

In `convex/transactions.ts`:
- Delete the local `MAX_NOTE_LENGTH`, `validateAmount`, `validateNote`, `validateDate`.
- Add import: `import { validateNote, validateTransactionAmount, validateTransactionDate } from "../constants/validation";`
- In `create` handler, replace the three validation calls with:

```ts
    const err = validateTransactionAmount(args.amount, args.type);
    if (err) throw new ConvexError(err);
    const noteErr = validateNote(args.note);
    if (noteErr) throw new ConvexError(noteErr);
    const dateErr = validateTransactionDate(args.date);
    if (dateErr) throw new ConvexError(dateErr);
```

- In `update` handler replace `validateAmount(amount, type);` with the same `validateTransactionAmount`/`validateNote`/`validateDate` pattern (note: date validation stays inside `if (args.date !== undefined)`).

In `convex/accounts.ts`:
- Add import: `import { validateAccountName } from "../constants/validation";`
- Replace the inline name checks in `create` and `update` with:

```ts
    const err = validateAccountName(args.name);
    if (err) throw new ConvexError(err);
    const name = args.name.trim();
```
and in `update`, for the optional `args.name` branch use the same pattern before assigning `patch.name`.

In `convex/categories.ts`:
- Add import: `import { validateCategoryName } from "../constants/validation";`
- Replace the local `validateName` function with:

```ts
    const err = validateCategoryName(args.name);
    if (err) throw new ConvexError(err);
```
- Delete the old `validateName` helper; keep `RESERVED_CATEGORY_NAME`.

In `convex/households.ts`:
- Add import: `import { validateHouseholdName } from "../constants/validation";`
- Replace inline name checks in `create` and `update` with:

```ts
    const err = validateHouseholdName(args.name);
    if (err) throw new ConvexError(err);
    const trimmedName = args.name.trim();
```

In `convex/budgets.ts`:
- Add import: `import { validateBudgetAmount } from "../constants/validation";`
- Replace the two inline amount checks in `create` and `update` with:

```ts
    const err = validateBudgetAmount(args.amount);
    if (err) throw new ConvexError(err);
```

In `convex/invitations.ts`:
- Add import: `import { INVITE_CHARSET, INVITE_CODE_LENGTH } from "../constants/validation";`
- Delete the local `CHARSET` and `CODE_LENGTH` constants; update `generateCode` to use `INVITE_CODE_LENGTH`/`INVITE_CHARSET`.

- [ ] **Step 5: Regenerate + verify backend**

Run: `npx convex codegen && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 6: Run all tests — must pass**

Run: `npm test`
Expected: all specs pass (new list/budget/invite specs + existing recent spec).

- [ ] **Step 7: Commit**

```bash
git add convex/
git commit -m "feat: shared validators, transactions.list cache+cap, budget redaction, invite owner-gate"
```

---

### Task 4: Client forms use shared validators

**Files:**
- Modify: `app/transaction-form.tsx`
- Modify: `app/account-form.tsx`
- Modify: `app/category-form.tsx`
- Modify: `app/budget-form.tsx`
- Modify: `app/members.tsx`
- Modify: `app/onboarding.tsx` (read it first; if it has an invite-code format check, use `validateInviteCode`)

**Interfaces:**
- Consumes: validators + constants from Task 1.
- Produces: client-side validation identical to server-side rules; no `isInteger`/`isSafeInteger` drift.

- [ ] **Step 1: `app/transaction-form.tsx`**

Add import:

```ts
import {
  validateNote,
  validateTransactionAmount,
  validateTransactionDate,
  NOTE_MAX_LENGTH,
  AMOUNT_MIN_ABS,
} from "@/constants/validation";
```

- Replace the `Number.isInteger(amountValue)` check in `handleSubmit` (line ~248) with `validateTransactionAmount(signedAmount, type)`:

```ts
    const err = validateTransactionAmount(signedAmount, type);
    if (err) {
      setAmountError(err);
      return;
    }
```

- Replace the future-date submit check (lines ~267–270) with `validateTransactionDate(date.getTime())`:

```ts
    const dateErr = validateTransactionDate(date.getTime());
    if (dateErr) {
      setError(dateErr);
      return;
    }
```

- In `canSubmit`, use `amountValue >= AMOUNT_MIN_ABS` instead of `amountValue > 0` (keep `amountValue !== null && Number.isFinite(amountValue)`).
- Replace the note counter `0/200` text and `maxLength={200}` with `{note.length}/{NOTE_MAX_LENGTH}` and `maxLength={NOTE_MAX_LENGTH}`.

- [ ] **Step 2: `app/account-form.tsx`**

Add import:

```ts
import { validateAccountName, ACCOUNT_NAME_MAX } from "@/constants/validation";
```

- In `handleSubmit`, replace the two length checks (lines ~69–76) with:

```ts
    const err = validateAccountName(trimmedName);
    if (err) {
      setError(err);
      return;
    }
```

- In `canSubmit`, replace `trimmedName.length >= 2 && trimmedName.length <= 30` with `validateAccountName(trimmedName) === null`.
- Replace `maxLength={30}` on the name Input with `maxLength={ACCOUNT_NAME_MAX}`.

- [ ] **Step 3: `app/category-form.tsx`**

Add import:

```ts
import { validateCategoryName, CATEGORY_NAME_MAX } from "@/constants/validation";
```

- In `handleSubmit`, replace the two length checks (lines ~69–76) with:

```ts
    const err = validateCategoryName(trimmedName);
    if (err) {
      setError(err);
      return;
    }
```

- In `canSubmit`, replace `trimmedName.length >= 2 && trimmedName.length <= 30` with `validateCategoryName(trimmedName) === null`.
- Replace `maxLength={30}` with `maxLength={CATEGORY_NAME_MAX}`.

- [ ] **Step 4: `app/budget-form.tsx`**

Add import:

```ts
import { validateBudgetAmount, BUDGET_AMOUNT_MIN } from "@/constants/validation";
```

- Replace the three checks in `handleSubmit` (valid number / whole number / at least 1) with:

```ts
    const err = validateBudgetAmount(parsedAmount);
    if (err) {
      setError(err);
      return;
    }
```

- Update `amountValid` in `canSubmit` to `Number.isFinite(parsedAmount) && parsedAmount >= BUDGET_AMOUNT_MIN`.

- [ ] **Step 5: `app/members.tsx` (rename validation)**

Add import:

```ts
import { validateHouseholdName, HOUSEHOLD_NAME_MAX } from "@/constants/validation";
```

- In `handleSaveRename`, replace the two length checks (lines ~165–172) with:

```ts
    const err = validateHouseholdName(trimmed);
    if (err) {
      setRenameError(err);
      return;
    }
```

- Replace `maxLength={50}` on the rename Input with `maxLength={HOUSEHOLD_NAME_MAX}`.

- [ ] **Step 6: `app/onboarding.tsx`**

Read the file. If it has a client-side invite-code format check (length 8 / charset), replace it with:

```ts
import { validateInviteCode, INVITE_CODE_LENGTH } from "@/constants/validation";
```

and use `validateInviteCode` for the format check before calling `invitations.redeem`.

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/transaction-form.tsx app/account-form.tsx app/category-form.tsx app/budget-form.tsx app/members.tsx app/onboarding.tsx
git commit -m "refactor: client forms use shared validation module"
```

---

### Task 5: Budget UI handles optional `spent`

**Files:**
- Modify: `components/BudgetCard.tsx`
- Modify: `app/(tabs)/budgets.tsx`

**Interfaces:**
- Consumes: `budgets.list` now returns `spent?: number`, `progress?: number` (Task 3).

- [ ] **Step 1: `components/BudgetCard.tsx`**

Change the `spent` prop type to `number | undefined` and guard all usage:

```ts
type Props = {
  categoryName: string;
  categoryHidden: boolean;
  budgetAmount: number;
  spent?: number;
  onEdit: () => void;
  onDelete: () => void;
};
```

Inside the component body:

```ts
  const overBudget = spent !== undefined && spent > budgetAmount;
  const progress =
    spent === undefined ? 0 : budgetAmount > 0 ? Math.min(spent / budgetAmount, 1) : 0;
```

In the spent/budget text line:

```tsx
        <Text
          className={`text-sm ${overBudget ? "text-error dark:text-error-dark" : "text-text-secondary dark:text-text-secondary-dark"}`}
        >
          {spent === undefined ? "—" : spent.toLocaleString("en-US")} /{" "}
          {budgetAmount.toLocaleString("en-US")}
        </Text>
```

Keep the progress bar but render it at 0 width when `spent` is undefined (already handled by `progress === 0`).

- [ ] **Step 2: `app/(tabs)/budgets.tsx`**

In the `summary` computation, treat optional `spent` as 0:

```ts
    for (const b of budgets) {
      budgeted += b.amount;
      spent += b.spent ?? 0;
    }
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/BudgetCard.tsx "app/(tabs)/budgets.tsx"
git commit -m "feat: budget card handles redacted spending for hidden categories"
```

---

### Task 6: Fix discard guard in edit mode

**Files:**
- Modify: `app/transaction-form.tsx`

**Interfaces:**
- Consumes: existing form state.
- Produces: unsaved-change confirmation on back navigation in BOTH create and edit modes.

- [ ] **Step 1: Rewrite `hasInteracted`**

Replace the current `hasInteracted` memo (lines ~175–187) with:

```ts
  const hasInteracted = useMemo(() => {
    if (!isEdit) {
      return (
        amountText !== "" ||
        accountId !== null ||
        toAccountId !== null ||
        categoryId !== null ||
        note !== "" ||
        type !== "expense" ||
        date.toDateString() !== new Date().toDateString()
      );
    }
    if (!editingTx) return false;
    return (
      type !== editingTx.type ||
      amountValue !== Math.abs(editingTx.amount) ||
      accountId !== editingTx.accountId ||
      toAccountId !== (editingTx.toAccountId ?? null) ||
      categoryId !== (editingTx.categoryId ?? null) ||
      date.getTime() !== editingTx.date ||
      note !== (editingTx.note ?? "")
    );
  }, [
    isEdit,
    editingTx,
    type,
    amountValue,
    amountText,
    accountId,
    toAccountId,
    categoryId,
    date,
    note,
  ]);
```

- [ ] **Step 2: Remove the `|| isEdit` bypass**

In `handleBack` (line ~192):

```ts
    if (!hasInteracted) {
      router.back();
      return;
    }
```

In the `beforeRemove` listener (line ~219):

```ts
      if (!hasInteracted) return;
```

The `intentionalBack` flag (set on submit/delete) continues to suppress the prompt for intentional navigation.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/transaction-form.tsx
git commit -m "fix: discard guard now covers edit mode and all fields"
```

---

### Task 7: Remove render side effects

**Files:**
- Modify: `app/members.tsx`
- Modify: `app/(tabs)/settings.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: navigation to `/onboarding` triggered from a `useEffect`, never during render.

- [ ] **Step 1: `app/members.tsx`**

- Update the react import to include `useEffect`: `import { useCallback, useEffect, useState } from "react";`
- Add an effect after the queries:

```ts
  useEffect(() => {
    if (household === null) {
      router.replace("/onboarding");
    }
  }, [household, router]);
```

- Change the guard block so redirect is not called inline. Replace the `if (household === null) { router.replace(...); return <skeleton/> }` block (lines ~246–253) with:

```ts
  if (household === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <Skeleton style={{ width: 120, height: 120, borderRadius: 999 }} />
      </SafeAreaView>
    );
  }
```

- [ ] **Step 2: `app/(tabs)/settings.tsx`**

- Add `useEffect` to the react import: `import { useEffect } from "react";`
- Add the effect:

```ts
  useEffect(() => {
    if (household === null) {
      router.replace("/onboarding");
    }
  }, [household, router]);
```

- Replace the `if (household === null) { router.replace(...); ... }` block with a combined loading guard:

```ts
  if (household === undefined || household === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color={C.primary} />
      </SafeAreaView>
    );
  }
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/members.tsx "app/(tabs)/settings.tsx"
git commit -m "fix: move onboarding redirect out of render in members and settings"
```

---

### Task 8: Update PRD

**Files:**
- Modify: `docs/Product Requirement Document/PRD.md`

- [ ] **Step 1: Apply documentation updates**

1. §2.1 Functional Requirements, "Transactions" row: append "`list` returns at most 1 000 rows per call (server cap, optional `limit`)."
2. §2.4 Visibility Rules, "Hidden Category Budgets" bullet: append "(server-side: `spent`/`progress` are redacted for Members)."
3. §3.6 Transactions: add one line "The `list` query hydrates entities with a per-query cache and caps results at 1 000 rows."
4. §3.7 Budgets: add "For Members, the spending breakdown (spent/progress) of budgets on hidden categories is not shown."
5. §5.4 Error Handling Convention: add "Client and server share one validation module, `constants/validation.ts` (path alias `@/constants/validation`), eliminating drift (e.g. `isInteger` vs `isSafeInteger`)."
6. §6 Convex Functions table:
   - `transactions | list` note → "Date-range filtered; optional `limit` (default/max 1 000); cached hydration."
   - `invitations | listActive` note → "Active invites; owner only."
   - `budgets | list` note → "`{periodStart, periodEnd}`; spent + progress; redacted (undefined) for Members on hidden categories."
7. §8 Change Log — insert at the top a new row:
   `| 2026-08-15 | Hardening | Shared validation module (constants/validation.ts) used by client + server, fixing isInteger/isSafeInteger drift; transactions.list hydration cache + 1 000-row cap; discard guard fixed for edit mode (all fields tracked); invitations.listActive owner-gated; budgets.list redacts spent/progress for Members on hidden-category budgets; onboarding redirect moved out of render (members/settings); new convex-test specs for list cap, budget redaction, and invite owner-gate |`

- [ ] **Step 2: Commit**

```bash
git add "docs/Product Requirement Document/PRD.md"
git commit -m "docs: update PRD for technical hardening"
```

---

### Task 9: Final verification

**Files:**
- None (verification only).

- [ ] **Step 1: Regenerate Convex types**

Run: `npx convex codegen`
Expected: `convex/_generated/` updated (gitignored).

- [ ] **Step 2: Full verification suite**

Run: `npx tsc --noEmit && npm test && npm run lint`
Expected: all three pass.

- [ ] **Step 3: Review diff**

Run: `git status && git log --oneline -15`
Expected: 8 commits from Tasks 1–8, clean working tree.

---

## Self-Review

- **Spec coverage:** Spec points 1–5 map to Tasks 1/4 (validators), 2/3 (backend), 5 (budget UI), 6 (discard guard), 7 (render side effects), 8 (PRD), plus tests in Task 2. Spec §2 limit default/clamp matches Task 3. Spec §3 hasInteracted logic matches Task 6. Spec §4a/§4b match Task 3 steps 2–3. Spec §5 matches Task 7.
- **Placeholder scan:** All steps contain concrete code or exact run commands; no "TBD"/"implement later".
- **Type consistency:** `spent?: number` is used consistently across Task 3 (backend), Task 5 (BudgetCard `spent?: number`), and budgets.tsx (`b.spent ?? 0`). `validateTransactionAmount`, `validateBudgetAmount`, `validateAccountName`, `validateCategoryName`, `validateHouseholdName`, `validateNote`, `validateTransactionDate`, `validateInviteCode` names are consistent across all tasks. `INVITE_CODE_LENGTH`/`INVITE_CHARSET` used in Task 1 and Task 3 Step 4.
