# Transactions Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement income/expense/transfer transactions with account-balance auto-update, date-range listing, and create/edit/delete UI (list tab + form screen + FABs).

**Architecture:** Convex backend (`convex/transactions.ts` gains list/get/update/delete + transfer support; `schema.ts` extends the transactions table; `accounts.ts` deletion guard covers transfer destinations). Expo Router frontend: new `Transactions` tab, pushed `/transaction-form` screen, new `SelectField`/`DateField`/`TransactionCard` components, labeled FAB, Home-screen FAB. All styling via NativeWind + theme tokens.

**Tech Stack:** Expo SDK 54 / RN 0.81, Expo Router 6, Convex 1.43, NativeWind v4, `@react-native-community/datetimepicker` (new dep).

## Global Constraints

- **No test framework is configured.** Verification = `npx convex codegen` (after any `convex/*.ts` change), `npx tsc --noEmit`, `npm run lint`. Run all three in the final task; the first two after each backend task.
- NativeWind `className` only — no `StyleSheet.create`. Theme tokens from `constants/theme.ts` only, no hardcoded colors.
- **NativeWind v4 gotcha:** never use `style={({ pressed }) => [...]}` on `Pressable`. Use `useState` pressed state + static `style`.
- Amount inputs must use the shared `Input` component with the `amount` prop (thousand-separator on keystroke). Never format amount inputs ad hoc.
- Money display uses `formatNumber` from `utils/format.ts`. Gradient cards use `expo-linear-gradient` + `Gradients.card`.
- Income color = `Colors.success`, expense = `Colors.error`, transfer = `Colors.textPrimary`.
- TypeScript strict; `Id<...>` from `@/convex/_generated/dataModel`.
- Transaction `date` stored as epoch ms; boundaries local-time. `transactions.list` uses exclusive `endDate`.
- Convex functions follow existing `accounts.ts`/`categories.ts` conventions (shared `getUserAndMembership`, `ConvexError` messages, `{ data, isOwner }` shape).

---

### Task 1: Install date picker dependency

**Files:**
- Modify: `package.json` (via `npx expo install`)

**Interfaces:**
- Produces: `@react-native-community/datetimepicker` available for import in Tasks 9–12.

- [ ] **Step 1: Install the package**

Run: `npx expo install @react-native-community/datetimepicker`
Expected: dependency added to `package.json` at the SDK-54-compatible version (^8.x).

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @react-native-community/datetimepicker"
```

---

### Task 2: Extend transactions schema

**Files:**
- Modify: `convex/schema.ts:51-66`
- Regenerate: `convex/_generated/*` (via codegen)

**Interfaces:**
- Produces: `transactions` docs now carry `categoryId?: Id<"categories">`, `toAccountId?: Id<"accounts">`, `type: "income" | "expense" | "transfer"`, plus indexes `by_household_date` and `by_toAccountId`.

- [ ] **Step 1: Update the transactions table**

Replace the current `transactions` table definition in `convex/schema.ts` with:

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
    .index("by_accountId", ["accountId"])
    .index("by_toAccountId", ["toAccountId"])
    .index("by_categoryId", ["categoryId"]),
```

- [ ] **Step 2: Regenerate bindings**

Run: `npx convex codegen`
Expected: `convex/_generated/dataModel.d.ts` reflects the new optional fields and union type.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (existing `convex/transactions.ts` still compiles — it writes `categoryId`/`type` which remain valid).

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/_generated
git commit -m "feat: extend transactions schema with transfer support"
```

---

### Task 3: transactions backend — helpers + create

**Files:**
- Modify: `convex/transactions.ts` (rewrite)

**Interfaces:**
- Consumes: `getUserAndMembership` pattern from `convex/accounts.ts:12-39`.
- Produces:
  - `validateAmount(amount: number, type: "income" | "expense" | "transfer"): void`
  - `validateNote(note: string | undefined): void`
  - `validateDate(date: number): void`
  - `create` mutation args `{ accountId, categoryId?, toAccountId?, amount, type, note?, date }` → returns `Id<"transactions">`. Income/expense: signed amount, category type match, balance `account.balance + amount`. Transfer: `toAccountId !== accountId`, no category, `from.balance - amount`, `to.balance + amount`. Member: hidden account/category rejected. Must remain callable by `convex/accounts.ts:165` (opening balance) with the old income/expense shape.

- [ ] **Step 1: Replace the file**

Rewrite `convex/transactions.ts` entirely:

```ts
import { ConvexError, v } from "convex/values";
import { mutation, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const transactionType = v.union(
  v.literal("income"),
  v.literal("expense"),
  v.literal("transfer"),
);

const MAX_NOTE_LENGTH = 200;

async function getUserAndMembership(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new ConvexError("You are not signed in.");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

  if (user === null) {
    throw new ConvexError("User not found.");
  }

  const membership = await ctx.db
    .query("householdMemberships")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .first();

  if (membership === null) {
    throw new ConvexError("You are not a member of a household.");
  }

  return { user, membership };
}

function validateAmount(amount: number, type: "income" | "expense" | "transfer") {
  if (!Number.isFinite(amount)) {
    throw new ConvexError("Amount must be a finite number.");
  }
  if (amount === 0) {
    throw new ConvexError("Amount must be a non-zero number.");
  }
  if (type === "income" && amount <= 0) {
    throw new ConvexError("Amount must be positive for income transactions.");
  }
  if (type === "expense" && amount >= 0) {
    throw new ConvexError("Amount must be negative for expense transactions.");
  }
  if (type === "transfer" && amount <= 0) {
    throw new ConvexError("Amount must be positive for transfers.");
  }
  if (Math.abs(amount) < 1) {
    throw new ConvexError("Amount must be at least 1.");
  }
}

function validateNote(note: string | undefined) {
  if (note !== undefined && note.length > MAX_NOTE_LENGTH) {
    throw new ConvexError("Note must be at most 200 characters.");
  }
}

function validateDate(date: number) {
  if (!Number.isFinite(date)) {
    throw new ConvexError("Date must be a valid timestamp.");
  }
  if (date > Date.now()) {
    throw new ConvexError("Transaction date cannot be in the future.");
  }
}

export const create = mutation({
  args: {
    accountId: v.id("accounts"),
    categoryId: v.optional(v.id("categories")),
    toAccountId: v.optional(v.id("accounts")),
    amount: v.number(),
    type: transactionType,
    note: v.optional(v.string()),
    date: v.number(),
  },
  handler: async (ctx, args) => {
    const { user, membership } = await getUserAndMembership(ctx);

    validateAmount(args.amount, args.type);
    validateNote(args.note);
    validateDate(args.date);

    const account = await ctx.db.get(args.accountId);
    if (account === null || account.householdId !== membership.householdId) {
      throw new ConvexError("Account not found.");
    }

    let category:
      | {
          _id: Id<"categories">;
          householdId: Id<"households">;
          name: string;
          type: "income" | "expense";
          hidden: boolean;
          createdAt: number;
          updatedAt: number;
        }
      | undefined;
    let toAccount:
      | {
          _id: Id<"accounts">;
          householdId: Id<"households">;
          name: string;
          type: "cash" | "bank" | "ewallet" | "credit_card";
          balance: number;
          hidden: boolean;
          createdAt: number;
          updatedAt: number;
        }
      | undefined;

    if (args.type === "transfer") {
      if (args.categoryId !== undefined) {
        throw new ConvexError("Transfers cannot have a category.");
      }
      if (args.toAccountId === undefined) {
        throw new ConvexError("To account is required for transfers.");
      }
      if (args.toAccountId === args.accountId) {
        throw new ConvexError("From and To accounts must be different.");
      }
      const to = await ctx.db.get(args.toAccountId);
      if (to === null || to.householdId !== membership.householdId) {
        throw new ConvexError("To account not found.");
      }
      toAccount = to;
    } else {
      if (args.categoryId === undefined) {
        throw new ConvexError(
          "Category is required for income and expense transactions.",
        );
      }
      const cat = await ctx.db.get(args.categoryId);
      if (cat === null || cat.householdId !== membership.householdId) {
        throw new ConvexError("Category not found.");
      }
      if (cat.type !== args.type) {
        throw new ConvexError("Category type must match transaction type.");
      }
      category = cat;
    }

    if (membership.role !== "owner") {
      if (account.hidden) {
        throw new ConvexError(
          "You cannot create transactions on a hidden account.",
        );
      }
      if (toAccount !== undefined && toAccount.hidden) {
        throw new ConvexError("You cannot create transfers to a hidden account.");
      }
      if (category !== undefined && category.hidden) {
        throw new ConvexError(
          "You cannot create transactions on a hidden category.",
        );
      }
    }

    const now = Date.now();
    const transactionId = await ctx.db.insert("transactions", {
      householdId: membership.householdId,
      accountId: args.accountId,
      categoryId: category?._id,
      toAccountId: args.toAccountId,
      amount: args.amount,
      type: args.type,
      note: args.note,
      date: args.date,
      createdBy: user._id,
      updatedBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    if (args.type === "transfer") {
      await ctx.db.patch(args.accountId, {
        balance: account.balance - args.amount,
        updatedAt: now,
      });
      await ctx.db.patch(args.toAccountId as Id<"accounts">, {
        balance: toAccount!.balance + args.amount,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(args.accountId, {
        balance: account.balance + args.amount,
        updatedAt: now,
      });
    }

    return transactionId;
  },
});
```

- [ ] **Step 2: Regenerate bindings and typecheck**

Run: `npx convex codegen` then `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add convex/transactions.ts convex/_generated
git commit -m "feat: transactions create with income/expense/transfer and balance updates"
```

---

### Task 4: transactions backend — list + get queries

**Files:**
- Modify: `convex/transactions.ts`

**Interfaces:**
- Consumes: `getUserAndMembership` from Task 3.
- Produces:
  - `list(query)` args `{ startDate: number, endDate: number }` → `{ transactions: EnrichedTransaction[] | null, isOwner: boolean }`. Enriched = `{ ...transaction, category?: CategoryDoc, account: AccountDoc, toAccount?: AccountDoc }`. Member excludes txs with `category.hidden === true`. Sorted by `date` desc.
  - `get(query)` args `{ transactionId: Id<"transactions"> }` → `{ transaction: EnrichedTransaction, isOwner: boolean } | null`.

- [ ] **Step 1: Append the list query**

Update the existing import line at the top of `convex/transactions.ts` to add `query`:

```ts
import { mutation, query, MutationCtx } from "./_generated/server";
```

Then add to `convex/transactions.ts`:

```ts
export const list = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
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
    const rows = await ctx.db
      .query("transactions")
      .withIndex("by_household_date", (q) =>
        q.and(
          q.eq("householdId", membership.householdId),
          q.gte("date", args.startDate),
          q.lt("date", args.endDate),
        ),
      )
      .collect();

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

    transactions.sort((a, b) => b.date - a.date);
    return { transactions, isOwner };
  },
});
```

- [ ] **Step 2: Append the get query**

Add to `convex/transactions.ts`:

```ts
export const get = query({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      return null;
    }

    const membership = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (membership === null) {
      return null;
    }

    const tx = await ctx.db.get(args.transactionId);
    if (tx === null || tx.householdId !== membership.householdId) {
      return null;
    }

    if (membership.role !== "owner" && tx.categoryId !== undefined) {
      const category = await ctx.db.get(tx.categoryId);
      if (category !== null && category.hidden) {
        return null;
      }
    }

    const category =
      tx.categoryId === undefined
        ? undefined
        : ((await ctx.db.get(tx.categoryId)) ?? undefined);
    const account = (await ctx.db.get(tx.accountId)) ?? undefined;
    const toAccount =
      tx.toAccountId === undefined
        ? undefined
        : ((await ctx.db.get(tx.toAccountId)) ?? undefined);

    return {
      transaction: { ...tx, category, account, toAccount },
      isOwner: membership.role === "owner",
    };
  },
});
```

- [ ] **Step 3: Regenerate bindings and typecheck**

Run: `npx convex codegen` then `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add convex/transactions.ts convex/_generated
git commit -m "feat: transactions list and get queries with enrichment"
```

---

### Task 5: transactions backend — update mutation

**Files:**
- Modify: `convex/transactions.ts`

**Interfaces:**
- Consumes: `getUserAndMembership`, `validateAmount`, `validateNote`, `validateDate` from Task 3.
- Produces: `update` mutation args `{ transactionId, accountId?, categoryId?, toAccountId?, amount?, type?, note?, date? }` → returns the updated enriched transaction. Balance adjusts via **net delta per account** (handles type changes and overlapping accounts). Member cannot reassign to hidden accounts/categories; keeping an existing hidden reference unchanged is allowed.

- [ ] **Step 1: Append the update mutation**

Add to `convex/transactions.ts`:

```ts
export const update = mutation({
  args: {
    transactionId: v.id("transactions"),
    accountId: v.optional(v.id("accounts")),
    categoryId: v.optional(v.id("categories")),
    toAccountId: v.optional(v.id("accounts")),
    amount: v.optional(v.number()),
    type: v.optional(transactionType),
    note: v.optional(v.string()),
    date: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, membership } = await getUserAndMembership(ctx);

    const tx = await ctx.db.get(args.transactionId);
    if (tx === null || tx.householdId !== membership.householdId) {
      throw new ConvexError("Transaction not found.");
    }

    const type = args.type ?? tx.type;
    const amount = args.amount ?? tx.amount;
    const accountId = args.accountId ?? tx.accountId;

    let categoryId: Id<"categories"> | undefined;
    let toAccountId: Id<"accounts"> | undefined;
    if (type === "transfer") {
      if (args.categoryId !== undefined) {
        throw new ConvexError("Transfers cannot have a category.");
      }
      toAccountId = args.toAccountId ?? tx.toAccountId;
      if (toAccountId === undefined) {
        throw new ConvexError("To account is required for transfers.");
      }
      if (toAccountId === accountId) {
        throw new ConvexError("From and To accounts must be different.");
      }
    } else {
      if (args.toAccountId !== undefined) {
        throw new ConvexError(
          "Income and expense transactions cannot have a to account.",
        );
      }
      categoryId = args.categoryId ?? tx.categoryId;
      if (categoryId === undefined) {
        throw new ConvexError(
          "Category is required for income and expense transactions.",
        );
      }
    }

    validateAmount(amount, type);
    if (args.note !== undefined) {
      validateNote(args.note);
    }
    if (args.date !== undefined) {
      validateDate(args.date);
    }

    const account = await ctx.db.get(accountId);
    if (account === null || account.householdId !== membership.householdId) {
      throw new ConvexError("Account not found.");
    }

    let category:
      | {
          _id: Id<"categories">;
          householdId: Id<"households">;
          name: string;
          type: "income" | "expense";
          hidden: boolean;
          createdAt: number;
          updatedAt: number;
        }
      | undefined;
    if (categoryId !== undefined) {
      const cat = await ctx.db.get(categoryId);
      if (cat === null || cat.householdId !== membership.householdId) {
        throw new ConvexError("Category not found.");
      }
      if (cat.type !== type) {
        throw new ConvexError("Category type must match transaction type.");
      }
      category = cat;
    }

    let toAccount:
      | {
          _id: Id<"accounts">;
          householdId: Id<"households">;
          name: string;
          type: "cash" | "bank" | "ewallet" | "credit_card";
          balance: number;
          hidden: boolean;
          createdAt: number;
          updatedAt: number;
        }
      | undefined;
    if (toAccountId !== undefined) {
      const to = await ctx.db.get(toAccountId);
      if (to === null || to.householdId !== membership.householdId) {
        throw new ConvexError("To account not found.");
      }
      toAccount = to;
    }

    if (membership.role !== "owner") {
      if (accountId !== tx.accountId && account.hidden) {
        throw new ConvexError("You cannot reassign to a hidden account.");
      }
      if (
        toAccount !== undefined &&
        toAccountId !== tx.toAccountId &&
        toAccount.hidden
      ) {
        throw new ConvexError("You cannot reassign to a hidden account.");
      }
      if (
        category !== undefined &&
        categoryId !== tx.categoryId &&
        category.hidden
      ) {
        throw new ConvexError("You cannot reassign to a hidden category.");
      }
    }

    const now = Date.now();

    const deltas = new Map<string, number>();
    const applyDelta = (id: string, delta: number) => {
      deltas.set(id, (deltas.get(id) ?? 0) + delta);
    };

    if (tx.type === "transfer" && tx.toAccountId !== undefined) {
      applyDelta(tx.accountId, tx.amount);
      applyDelta(tx.toAccountId, -tx.amount);
    } else {
      applyDelta(tx.accountId, -tx.amount);
    }

    if (type === "transfer" && toAccountId !== undefined) {
      applyDelta(accountId, -amount);
      applyDelta(toAccountId, amount);
    } else {
      applyDelta(accountId, amount);
    }

    for (const [id, delta] of deltas) {
      if (delta === 0) continue;
      const doc = await ctx.db.get(id as Id<"accounts">);
      if (doc !== null) {
        await ctx.db.patch(doc._id, {
          balance: doc.balance + delta,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(args.transactionId, {
      accountId,
      categoryId: category?._id,
      toAccountId,
      amount,
      type,
      note: args.note !== undefined ? args.note : tx.note,
      date: args.date ?? tx.date,
      updatedBy: user._id,
      updatedAt: now,
    });

    return await ctx.db.get(args.transactionId);
  },
});
```

- [ ] **Step 2: Regenerate bindings and typecheck**

Run: `npx convex codegen` then `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add convex/transactions.ts convex/_generated
git commit -m "feat: transactions update with generalized balance adjustment"
```

---

### Task 6: transactions backend — delete mutation

**Files:**
- Modify: `convex/transactions.ts`

**Interfaces:**
- Consumes: `getUserAndMembership` from Task 3.
- Produces: `remove` mutation args `{ transactionId }` → void. Reverses balance: income/expense `account.balance - amount`; transfer `from.balance + amount`, `to.balance - amount`. Member rejects deleting a tx on a hidden category.

- [ ] **Step 1: Append the remove mutation**

Add to `convex/transactions.ts`:

```ts
export const remove = mutation({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);

    const tx = await ctx.db.get(args.transactionId);
    if (tx === null || tx.householdId !== membership.householdId) {
      throw new ConvexError("Transaction not found.");
    }

    if (membership.role !== "owner" && tx.categoryId !== undefined) {
      const category = await ctx.db.get(tx.categoryId);
      if (category !== null && category.hidden) {
        throw new ConvexError(
          "You cannot delete transactions on a hidden category.",
        );
      }
    }

    const now = Date.now();
    if (tx.type === "transfer" && tx.toAccountId !== undefined) {
      const from = await ctx.db.get(tx.accountId);
      const to = await ctx.db.get(tx.toAccountId);
      if (from !== null) {
        await ctx.db.patch(from._id, {
          balance: from.balance + tx.amount,
          updatedAt: now,
        });
      }
      if (to !== null) {
        await ctx.db.patch(to._id, {
          balance: to.balance - tx.amount,
          updatedAt: now,
        });
      }
    } else {
      const account = await ctx.db.get(tx.accountId);
      if (account !== null) {
        await ctx.db.patch(account._id, {
          balance: account.balance - tx.amount,
          updatedAt: now,
        });
      }
    }

    await ctx.db.delete(args.transactionId);
  },
});
```

- [ ] **Step 2: Regenerate bindings and typecheck**

Run: `npx convex codegen` then `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add convex/transactions.ts convex/_generated
git commit -m "feat: transactions delete with balance reversal"
```

---

### Task 7: accounts deletion guard for transfer destinations

**Files:**
- Modify: `convex/accounts.ts:262-272`

**Interfaces:**
- Consumes: `by_toAccountId` index from Task 2.
- Produces: `accounts.remove` rejects when the account is referenced as a transfer destination, with the existing PRD error message.

- [ ] **Step 1: Extend the guard**

Replace the reference check block in `convex/accounts.ts`:

```ts
    const referencingTx = await ctx.db
      .query("transactions")
      .withIndex("by_accountId", (q) => q.eq("accountId", args.accountId))
      .first();

    const referencingToTx = await ctx.db
      .query("transactions")
      .withIndex("by_toAccountId", (q) =>
        q.eq("toAccountId", args.accountId),
      )
      .first();

    if (referencingTx !== null || referencingToTx !== null) {
      throw new ConvexError(
        "Cannot delete account — existing transactions reference this account. Delete or reassign those transactions first.",
      );
    }
```

- [ ] **Step 2: Regenerate bindings and typecheck**

Run: `npx convex codegen` then `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add convex/accounts.ts convex/_generated
git commit -m "feat: reject account deletion when used as transfer destination"
```

---

### Task 8: Frontend — date utils, transaction constants, Button danger, Fab label

**Files:**
- Create: `utils/date.ts`
- Create: `constants/transactions.ts`
- Modify: `components/Button.tsx` (add `danger` variant)
- Modify: `components/Fab.tsx` (add optional `label`)

**Interfaces:**
- Produces:
  - `utils/date.ts`: `startOfDay(d: Date): Date`, `startOfMonth(d: Date): Date`, `addMonths(d: Date, n: number): Date`, `formatDateHeader(ts: number): string`, `formatTime(ts: number): string`, `formatDateShort(ts: number): string`.
  - `constants/transactions.ts`: `type TransactionType = "income" | "expense" | "transfer"` and `TRANSACTION_TYPES: { id: TransactionType; label: string }[]`.
  - `Button` supports `variant="danger"` (transparent bg, error border/text).
  - `Fab` supports `label?: string` → rounded pill with `plus` icon + label text; unchanged circular icon-only look when omitted.

- [ ] **Step 1: Create `utils/date.ts`**

```ts
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = startOfMonth(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function formatDateHeader(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function formatDateShort(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}
```

- [ ] **Step 2: Create `constants/transactions.ts`**

```ts
export type TransactionType = "income" | "expense" | "transfer";

export const TRANSACTION_TYPES: { id: TransactionType; label: string }[] = [
  { id: "income", label: "Income" },
  { id: "expense", label: "Expense" },
  { id: "transfer", label: "Transfer" },
];
```

- [ ] **Step 3: Add danger variant to `components/Button.tsx`**

Replace the `Variant` type, `variantStyles`, and `labelStyles`:

```ts
type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantStyles: Record<Variant, string> = {
  primary: "bg-primary",
  secondary: "bg-background border border-border",
  ghost: "bg-transparent",
  danger: "bg-transparent border border-error",
};

const labelStyles: Record<Variant, string> = {
  primary: "text-background",
  secondary: "text-text-primary",
  ghost: "text-primary",
  danger: "text-error",
};
```

- [ ] **Step 4: Add optional label to `components/Fab.tsx`**

Replace the whole file:

```tsx
import Feather from "@expo/vector-icons/Feather";
import { Colors, Shadow } from "@/constants/theme";
import { useState } from "react";
import { Pressable, Text } from "react-native";

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  label?: string;
};

export function Fab({ onPress, accessibilityLabel, label }: Props) {
  const [pressed, setPressed] = useState(false);

  if (label !== undefined) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        className="absolute bottom-6 right-6 flex-row items-center gap-2 rounded-full bg-primary px-5"
        style={[
          Shadow.elevated,
          { height: 56 },
          pressed ? { opacity: 0.92 } : undefined,
        ]}
      >
        <Feather name="plus" size={24} color={Colors.background} />
        <Text className="text-base font-semibold text-background">{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="absolute bottom-6 right-6 h-[56px] w-[56px] items-center justify-center rounded-full bg-primary"
      style={[Shadow.elevated, pressed ? { opacity: 0.92 } : undefined]}
    >
      <Feather name="plus" size={26} color={Colors.background} />
    </Pressable>
  );
}
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add utils/date.ts constants/transactions.ts components/Button.tsx components/Fab.tsx
git commit -m "feat: add date utils, transaction constants, Button danger variant, labeled Fab"
```

---

### Task 9: Frontend — SelectField + DateField components

**Files:**
- Create: `components/SelectField.tsx`
- Create: `components/DateField.tsx`

**Interfaces:**
- Consumes: `@react-native-community/datetimepicker` (Task 1), `utils/date.ts` `formatDateShort` (Task 8).
- Produces:
  - `SelectField` props `{ label?: string; placeholder: string; value: string | null; options: { id: string; label: string }[]; onSelect: (id: string) => void; error?: string | null }`. Pressable opens a bottom modal list; tap selects and closes.
  - `DateField` props `{ label?: string; value: Date; onChange: (date: Date) => void; maximumDate?: Date; error?: string | null }`. Pressable shows `formatDateShort(value.getTime())`, opens the native date picker (iOS modal spinner, Android default dialog).

- [ ] **Step 1: Create `components/SelectField.tsx`**

```tsx
import Feather from "@expo/vector-icons/Feather";
import { Colors, Radius, Shadow } from "@/constants/theme";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

export type SelectOption = { id: string; label: string };

type Props = {
  label?: string;
  placeholder: string;
  value: string | null;
  options: SelectOption[];
  onSelect: (id: string) => void;
  error?: string | null;
};

export function SelectField({
  label,
  placeholder,
  value,
  options,
  onSelect,
  error,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <View className="w-full gap-1.5">
      {label ? (
        <Text className="text-sm font-medium text-text-primary">{label}</Text>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        style={[
          {
            borderRadius: Radius.sm,
            borderWidth: 1,
            borderColor: error ? Colors.error : Colors.border,
            backgroundColor: Colors.background,
            height: 48,
            paddingHorizontal: 16,
          },
          pressed ? { opacity: 0.9 } : undefined,
        ]}
        className="flex-row items-center justify-between"
      >
        <Text
          className={`text-base ${value ? "text-text-primary" : "text-text-secondary"}`}
        >
          {value ?? placeholder}
        </Text>
        <Feather name="chevron-down" size={20} color={Colors.textSecondary} />
      </Pressable>
      {error ? <Text className="text-sm text-error">{error}</Text> : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          className="flex-1 justify-end px-5 pb-8"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={[
              Shadow.card,
              { borderRadius: Radius.md, backgroundColor: Colors.background },
            ]}
            className="max-h-[60%] overflow-hidden"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="px-4 pb-2 pt-4 text-sm font-medium text-text-secondary">
              Select {label ?? "option"}
            </Text>
            <ScrollView>
              {options.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    onSelect(option.id);
                    setOpen(false);
                  }}
                  className="flex-row items-center justify-between px-4 py-3"
                >
                  <Text className="text-base text-text-primary">
                    {option.label}
                  </Text>
                  {option.label === value ? (
                    <Feather name="check" size={18} color={Colors.primary} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
```

- [ ] **Step 2: Create `components/DateField.tsx`**

```tsx
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import Feather from "@expo/vector-icons/Feather";
import { Colors, Radius, Shadow } from "@/constants/theme";
import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { formatDateShort } from "@/utils/date";
import { Button } from "./Button";

type Props = {
  label?: string;
  value: Date;
  onChange: (date: Date) => void;
  maximumDate?: Date;
  error?: string | null;
};

export function DateField({
  label,
  value,
  onChange,
  maximumDate,
  error,
}: Props) {
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState<Date | null>(null);
  const [pressed, setPressed] = useState(false);

  return (
    <View className="w-full gap-1.5">
      {label ? (
        <Text className="text-sm font-medium text-text-primary">{label}</Text>
      ) : null}
      <Pressable
        onPress={() => {
          setDraft(value);
          setShow(true);
        }}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        style={[
          {
            borderRadius: Radius.sm,
            borderWidth: 1,
            borderColor: error ? Colors.error : Colors.border,
            backgroundColor: Colors.background,
            height: 48,
            paddingHorizontal: 16,
          },
          pressed ? { opacity: 0.9 } : undefined,
        ]}
        className="flex-row items-center justify-between"
      >
        <Text className="text-base text-text-primary">
          {formatDateShort(value.getTime())}
        </Text>
        <Feather name="calendar" size={18} color={Colors.textSecondary} />
      </Pressable>
      {error ? <Text className="text-sm text-error">{error}</Text> : null}

      {show ? (
        Platform.OS === "ios" ? (
          <Modal
            transparent
            animationType="fade"
            onRequestClose={() => setShow(false)}
          >
            <Pressable
              className="flex-1 items-center justify-center px-6"
              style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
              onPress={() => setShow(false)}
            >
              <Pressable
                style={[
                  Shadow.card,
                  { borderRadius: Radius.md, backgroundColor: Colors.background, padding: 16 },
                ]}
                onPress={(e) => e.stopPropagation()}
              >
                <DateTimePicker
                  value={draft ?? value}
                  mode="date"
                  display="spinner"
                  maximumDate={maximumDate}
                  onChange={(event: DateTimePickerEvent, date?: Date) => {
                    if (event.type === "set" && date) setDraft(date);
                  }}
                />
                <Button
                  title="Done"
                  variant="secondary"
                  onPress={() => {
                    if (draft) onChange(draft);
                    setShow(false);
                  }}
                />
              </Pressable>
            </Pressable>
          </Modal>
        ) : (
          <DateTimePicker
            value={value}
            mode="date"
            display="default"
            maximumDate={maximumDate}
            onChange={(event: DateTimePickerEvent, date?: Date) => {
              if (event.type === "set" && date) onChange(date);
              setShow(false);
            }}
          />
        )
      ) : null}
    </View>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/SelectField.tsx components/DateField.tsx
git commit -m "feat: add SelectField and DateField components"
```

---

### Task 10: Frontend — TransactionCard component

**Files:**
- Create: `components/TransactionCard.tsx`

**Interfaces:**
- Consumes: `utils/format.ts` `formatNumber`, `utils/date.ts` `formatTime` (Tasks 8).
- Produces: `TransactionCard` props `{ categoryName: string | null; isTransfer: boolean; toAccountName?: string; note: string | null; amount: number; type: "income" | "expense" | "transfer"; date: number; onPress: () => void }`.

- [ ] **Step 1: Create the component**

```tsx
import Feather from "@expo/vector-icons/Feather";
import { Colors, Radius } from "@/constants/theme";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { formatNumber } from "@/utils/format";
import { formatTime } from "@/utils/date";

type Props = {
  categoryName: string | null;
  isTransfer: boolean;
  toAccountName?: string;
  note: string | null;
  amount: number;
  type: "income" | "expense" | "transfer";
  date: number;
  onPress: () => void;
};

export function TransactionCard({
  categoryName,
  isTransfer,
  toAccountName,
  note,
  amount,
  type,
  date,
  onPress,
}: Props) {
  const [pressed, setPressed] = useState(false);

  const displayNote =
    note && note.length > 0
      ? note
      : isTransfer
        ? toAccountName
          ? `Transfer to ${toAccountName}`
          : "Transfer"
        : (categoryName ?? "");

  const amountLabel =
    type === "expense"
      ? `-${formatNumber(Math.abs(amount))}`
      : type === "income"
        ? `+${formatNumber(amount)}`
        : formatNumber(amount);

  const amountColor =
    type === "income"
      ? Colors.success
      : type === "expense"
        ? Colors.error
        : Colors.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-[16px] px-4 py-3"
      style={pressed ? { backgroundColor: Colors.surface } : undefined}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: Radius.sm,
          backgroundColor: Colors.surface,
        }}
        className="items-center justify-center"
      >
        <Feather
          name={isTransfer ? "arrow-right" : "tag"}
          size={18}
          color={Colors.primary}
        />
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-base text-text-primary">
          {displayNote}
        </Text>
        <Text className="text-xs text-text-secondary">{formatTime(date)}</Text>
      </View>
      <Text
        className="text-base font-semibold"
        style={{ color: amountColor }}
      >
        {amountLabel}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/TransactionCard.tsx
git commit -m "feat: add TransactionCard component"
```

---

### Task 11: Frontend — Transactions list tab screen

**Files:**
- Create: `app/(tabs)/transactions.tsx`

**Interfaces:**
- Consumes: `api.transactions.list`, `Chip`, `Fab`, `TransactionCard`, `EmptyState`, `DateField`, `GradientCard`, `utils/date.ts`, `utils/format.ts` (all prior tasks).
- Produces: The `Transactions` tab root screen. Default filter This Month; chips This Month | Last Month | Custom Range; summary card; SectionList grouped by date header; row tap → `/transaction-form?id=`; FAB `label="Add Transaction"` → `/transaction-form`.

- [ ] **Step 1: Create the screen**

```tsx
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  SectionList,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Colors, Shadow } from "@/constants/theme";
import { Chip } from "@/components/Chip";
import { Fab } from "@/components/Fab";
import { TransactionCard } from "@/components/TransactionCard";
import { EmptyState } from "@/components/EmptyState";
import { DateField } from "@/components/DateField";
import { GradientCard } from "@/components/GradientCard";
import { formatNumber } from "@/utils/format";
import {
  addMonths,
  formatDateHeader,
  startOfDay,
  startOfMonth,
} from "@/utils/date";

type DateFilter = "thisMonth" | "lastMonth" | "custom";

const FILTERS: { id: DateFilter; label: string }[] = [
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "custom", label: "Custom Range" },
];

export default function Transactions() {
  const router = useRouter();
  const [filter, setFilter] = useState<DateFilter>("thisMonth");
  const [customFrom, setCustomFrom] = useState(() => startOfDay(new Date()));
  const [customTo, setCustomTo] = useState(() => startOfDay(new Date()));

  const range = useMemo(() => {
    const now = new Date();
    if (filter === "thisMonth") {
      return {
        startDate: startOfMonth(now).getTime(),
        endDate: addMonths(now, 1).getTime(),
      };
    }
    if (filter === "lastMonth") {
      return {
        startDate: addMonths(now, -1).getTime(),
        endDate: startOfMonth(now).getTime(),
      };
    }
    return {
      startDate: startOfDay(customFrom).getTime(),
      endDate: startOfDay(customTo).getTime() + 24 * 60 * 60 * 1000,
    };
  }, [filter, customFrom, customTo]);

  const result = useQuery(api.transactions.list, range);

  const sections = useMemo(() => {
    const transactions = result?.transactions ?? null;
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
    }));
  }, [result]);

  const summary = useMemo(() => {
    const transactions = result?.transactions ?? [];
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      if (tx.type === "income") income += tx.amount;
      else if (tx.type === "expense") expense += Math.abs(tx.amount);
    }
    return { income, expense, net: income - expense };
  }, [result]);

  if (result === undefined) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (result.transactions === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-sm text-text-secondary">
          You are not a member of a household.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-5 pt-4">
        <Text className="text-[28px] font-bold text-text-primary">
          Transactions
        </Text>
      </View>

      <View className="mt-4 flex-row flex-wrap gap-2 px-5">
        {FILTERS.map((f) => (
          <Chip
            key={f.id}
            label={f.label}
            active={filter === f.id}
            onPress={() => setFilter(f.id)}
          />
        ))}
      </View>

      {filter === "custom" ? (
        <View className="mt-4 flex-row gap-3 px-5">
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
              onChange={setCustomTo}
            />
          </View>
        </View>
      ) : null}

      <View className="mt-4 px-5">
        <GradientCard>
          <View className="flex-row items-center justify-between px-2 py-1">
            <View>
              <Text className="text-xs text-text-secondary">Income</Text>
              <Text className="text-base font-semibold text-success">
                +{formatNumber(summary.income)}
              </Text>
            </View>
            <View>
              <Text className="text-xs text-text-secondary">Expense</Text>
              <Text className="text-base font-semibold text-error">
                -{formatNumber(summary.expense)}
              </Text>
            </View>
            <View>
              <Text className="text-xs text-text-secondary">Net</Text>
              <Text className="text-base font-semibold text-text-primary">
                {formatNumber(summary.net)}
              </Text>
            </View>
          </View>
        </GradientCard>
      </View>

      {sections !== null && sections.length === 0 ? (
        <View className="mt-6 flex-1 px-5">
          <View style={Shadow.card} className="rounded-[16px] bg-background">
            <EmptyState
              icon="book-open"
              title="No transactions yet"
              description="Start by recording your first transaction."
              actionLabel="Add Transaction"
              onAction={() => router.push("/transaction-form")}
            />
          </View>
        </View>
      ) : (
        <SectionList
          className="mt-4 flex-1"
          contentContainerClassName="pb-28"
          sections={sections ?? []}
          keyExtractor={(item) => item._id}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View className="bg-background px-5 pb-1 pt-4">
              <Text className="text-sm font-semibold text-text-primary">
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View className="px-2">
              <TransactionCard
                categoryName={item.category?.name ?? null}
                isTransfer={item.type === "transfer"}
                toAccountName={item.toAccount?.name}
                note={item.note ?? null}
                amount={item.amount}
                type={item.type}
                date={item.date}
                onPress={() =>
                  router.push({
                    pathname: "/transaction-form",
                    params: { id: item._id },
                  })
                }
              />
            </View>
          )}
        />
      )}

      <Fab
        label="Add Transaction"
        onPress={() => router.push("/transaction-form")}
        accessibilityLabel="Add transaction"
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/transactions.tsx"
git commit -m "feat: add transactions list tab screen"
```

---

### Task 12: Frontend — transaction create/edit form screen

**Files:**
- Create: `app/transaction-form.tsx`

**Interfaces:**
- Consumes: `api.transactions.get` (edit pre-fill), `api.accounts.list`, `api.categories.list`, `api.transactions.create`, `api.transactions.update`, `api.transactions.remove`, `Chip`, `Input` (`amount`), `SelectField`, `DateField`, `Button` (incl. `danger`), `utils/format.ts` `formatNumber`.
- Produces: The `/transaction-form` screen. Create mode ("New Transaction" / "Save Transaction"), edit mode ("Edit Transaction" / "Save Changes" + "Delete Transaction"). Type trio; transfer shows From/To accounts, income/expense show Account + Category; amount (signed client-side); date (max today); note ≤ 200.

- [ ] **Step 1: Create the screen**

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Colors } from "@/constants/theme";
import { TRANSACTION_TYPES, TransactionType } from "@/constants/transactions";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Chip } from "@/components/Chip";
import { SelectField } from "@/components/SelectField";
import { DateField } from "@/components/DateField";
import { formatNumber } from "@/utils/format";

export default function TransactionForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const transactionId = params.id;
  const isEdit = transactionId !== undefined;

  const getResult = useQuery(
    api.transactions.get,
    isEdit
      ? { transactionId: transactionId as Id<"transactions"> }
      : "skip",
  );
  const accountResult = useQuery(api.accounts.list);
  const categoryResult = useQuery(api.categories.list);
  const createTransaction = useMutation(api.transactions.create);
  const updateTransaction = useMutation(api.transactions.update);
  const removeTransaction = useMutation(api.transactions.remove);

  const [type, setType] = useState<TransactionType>("expense");
  const [amountText, setAmountText] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const editingTx = useMemo(
    () => (isEdit ? getResult?.transaction : undefined),
    [isEdit, getResult],
  );

  const seeded = useRef(false);
  useEffect(() => {
    if (editingTx && !seeded.current) {
      seeded.current = true;
      setType(editingTx.type);
      setAmountText(formatNumber(Math.abs(editingTx.amount)));
      setAccountId(editingTx.accountId);
      setToAccountId(editingTx.toAccountId ?? null);
      setCategoryId(editingTx.categoryId ?? null);
      setDate(new Date(editingTx.date));
      setNote(editingTx.note ?? "");
    }
  }, [editingTx]);

  const accountOptions = useMemo(() => {
    const accounts = accountResult?.accounts ?? [];
    const options = accounts.map((a) => ({ id: a._id, label: a.name }));
    const addIfMissing = (id: string | undefined, name: string | undefined) => {
      if (id && name && !options.some((o) => o.id === id)) {
        options.push({ id, label: name });
      }
    };
    if (isEdit && editingTx) {
      addIfMissing(editingTx.accountId, editingTx.account?.name);
      addIfMissing(editingTx.toAccountId, editingTx.toAccount?.name);
    }
    return options;
  }, [accountResult, isEdit, editingTx]);

  const categoryOptions = useMemo(() => {
    const categories = categoryResult?.categories ?? [];
    return categories
      .filter((c) => c.type === type)
      .map((c) => ({ id: c._id, label: c.name }));
  }, [categoryResult, type]);

  useEffect(() => {
    if (
      type !== "transfer" &&
      categoryId !== null &&
      !categoryOptions.some((o) => o.id === categoryId)
    ) {
      setCategoryId(null);
    }
  }, [type, categoryId, categoryOptions]);

  const handleTypeChange = (t: TransactionType) => {
    setType(t);
    if (t === "transfer") {
      setCategoryId(null);
    } else {
      setToAccountId(null);
    }
  };

  const parsedAmount = amountText.replace(/,/g, "");
  const amountValue =
    parsedAmount === "" || parsedAmount === "-"
      ? null
      : Number(parsedAmount);
  const signedAmount =
    type === "expense" ? -1 * (amountValue ?? 0) : (amountValue ?? 0);

  const canSubmit =
    amountValue !== null &&
    amountValue > 0 &&
    !isLoading &&
    (type === "transfer"
      ? accountId !== null &&
        toAccountId !== null &&
        accountId !== toAccountId
      : accountId !== null && categoryId !== null);

  const handleSubmit = async () => {
    setError(null);
    if (amountValue === null || amountValue <= 0) {
      setError("Amount is required and must be greater than zero.");
      return;
    }
    if (type === "transfer") {
      if (accountId === null || toAccountId === null) {
        setError("From and To accounts are required.");
        return;
      }
      if (accountId === toAccountId) {
        setError("From and To accounts must be different.");
        return;
      }
    } else {
      if (accountId === null || categoryId === null) {
        setError("Account and category are required.");
        return;
      }
    }
    if (date.getTime() > Date.now()) {
      setError("Transaction date cannot be in the future.");
      return;
    }

    setIsLoading(true);
    try {
      const base = {
        amount: signedAmount,
        type,
        note: note.trim() === "" ? undefined : note.trim(),
        date: date.getTime(),
        accountId: accountId as Id<"accounts">,
        categoryId:
          type === "transfer"
            ? undefined
            : (categoryId as Id<"categories">),
        toAccountId:
          type === "transfer" ? (toAccountId as Id<"accounts">) : undefined,
      };
      if (isEdit && transactionId !== undefined) {
        await updateTransaction({
          transactionId: transactionId as Id<"transactions">,
          ...base,
        });
      } else {
        await createTransaction(base);
      }
      router.back();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : isEdit
            ? "Failed to update transaction."
            : "Failed to create transaction.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    setError(null);
    if (transactionId === undefined) return;
    Alert.alert(
      "Delete Transaction",
      "Delete this transaction? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            removeTransaction({
              transactionId: transactionId as Id<"transactions">,
            })
              .then(() => router.back())
              .catch((e: unknown) =>
                setError(
                  e instanceof Error
                    ? e.message
                    : "Failed to delete transaction.",
                ),
              );
          },
        },
      ],
    );
  };

  if (accountResult === undefined || (isEdit && getResult === undefined)) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-sm text-text-secondary">Loading…</Text>
      </SafeAreaView>
    );
  }

  if (accountResult.accounts === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-sm text-text-secondary">
          You are not a member of a household.
        </Text>
      </SafeAreaView>
    );
  }

  if (isEdit && getResult === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-sm text-text-secondary">
          Transaction not found.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-row items-center gap-2 px-5 pt-4">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 40, height: 40 }}
            className="items-center justify-center"
          >
            <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text className="text-[28px] font-bold text-text-primary">
            {isEdit ? "Edit Transaction" : "New Transaction"}
          </Text>
        </View>

        <ScrollView
          contentContainerClassName="gap-4 px-5 py-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-text-primary">
              Type
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {TRANSACTION_TYPES.map((t) => (
                <Chip
                  key={t.id}
                  label={t.label}
                  active={type === t.id}
                  onPress={() => handleTypeChange(t.id)}
                />
              ))}
            </View>
          </View>

          <Input
            label="Amount"
            placeholder="0"
            value={amountText}
            onChangeText={setAmountText}
            keyboardType={
              Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"
            }
            amount
            error={error}
          />

          {type === "transfer" ? (
            <>
              <SelectField
                label="From account"
                placeholder="Select account"
                value={
                  accountOptions.find((o) => o.id === accountId)?.label ?? null
                }
                options={accountOptions}
                onSelect={setAccountId}
              />
              <SelectField
                label="To account"
                placeholder="Select account"
                value={
                  accountOptions.find((o) => o.id === toAccountId)?.label ??
                  null
                }
                options={accountOptions.filter((o) => o.id !== accountId)}
                onSelect={setToAccountId}
              />
            </>
          ) : (
            <>
              <SelectField
                label="Account"
                placeholder="Select account"
                value={
                  accountOptions.find((o) => o.id === accountId)?.label ?? null
                }
                options={accountOptions}
                onSelect={setAccountId}
              />
              <SelectField
                label="Category"
                placeholder="Select category"
                value={
                  categoryOptions.find((o) => o.id === categoryId)?.label ??
                  null
                }
                options={categoryOptions}
                onSelect={setCategoryId}
              />
            </>
          )}

          <DateField
            label="Date"
            value={date}
            maximumDate={new Date()}
            onChange={setDate}
          />

          <Input
            label="Note (optional)"
            placeholder="e.g. Lunch with colleagues"
            value={note}
            onChangeText={setNote}
            maxLength={200}
          />

          <Button
            title={isEdit ? "Save Changes" : "Save Transaction"}
            onPress={handleSubmit}
            loading={isLoading}
            disabled={!canSubmit}
          />

          {isEdit ? (
            <Button
              title="Delete Transaction"
              variant="danger"
              onPress={handleDelete}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/transaction-form.tsx
git commit -m "feat: add transaction create/edit form screen"
```

---

### Task 13: Navigation + Home FAB

**Files:**
- Modify: `app/(tabs)/_layout.tsx`
- Modify: `app/_layout.tsx:35-42`
- Modify: `app/(tabs)/home.tsx` (add FAB)

**Interfaces:**
- Consumes: `Fab` label support (Task 8).
- Produces: `Transactions` tab (icon `list`) between Accounts and Settings; `/transaction-form` registered in the signed-in Stack; Home shows labeled "Add Transaction" FAB → `/transaction-form`.

- [ ] **Step 1: Add the Transactions tab**

In `app/(tabs)/_layout.tsx`, insert between the `accounts` and `settings` `Tabs.Screen` entries:

```tsx
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color }) => (
            <Feather name="list" size={22} color={color} />
          ),
        }}
      />
```

- [ ] **Step 2: Register the form screen**

In `app/_layout.tsx`, inside `Stack.Protected`, add after the `category-form` line:

```tsx
        <Stack.Screen name="transaction-form" />
```

- [ ] **Step 3: Add the Home FAB**

In `app/(tabs)/home.tsx`, add `Fab` to the imports:

```tsx
import { Fab } from "@/components/Fab";
```

Then add the FAB as the last child of the root `SafeAreaView` (after the closing `ScrollView`):

```tsx
      <Fab
        label="Add Transaction"
        onPress={() => router.push("/transaction-form")}
        accessibilityLabel="Add transaction"
      />
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/_layout.tsx" app/_layout.tsx "app/(tabs)/home.tsx"
git commit -m "feat: add transactions tab, form route, and home add-transaction FAB"
```

---

### Task 14: Final verification

**Files:**
- None (verification only).

- [ ] **Step 1: Regenerate bindings and typecheck**

Run: `npx convex codegen` then `npx tsc --noEmit`
Expected: both clean.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Start the app (`npx expo start`) and verify, as Owner:
1. Transactions tab shows summary + empty state; FAB labeled "Add Transaction".
2. Create an expense: amount types with thousand separators; category list filters by type; saving updates the account balance and shows the row with `-` red amount.
3. Create a transfer (From/To required, `from !== to` enforced); both account balances change (from −, to +); row shows neutral amount.
4. Edit a transaction (tap row): fields pre-filled; balance reverses/applies correctly; Delete Transaction removes it and reverses balances.
5. This Month / Last Month / Custom Range filters return expected rows.
6. Home screen also shows the labeled FAB and can create a transaction.

Then repeat the create flows as a Member with one hidden account and one hidden category: hidden account absent from selectors; hidden category transactions invisible; existing transaction on a hidden account still editable (account kept, cannot switch to another hidden one).

- [ ] **Step 4: Commit any leftover changes**

Run: `git status --short`
If clean, done. If not, commit the remaining changes with an appropriate message.

```bash
git add -A
git commit -m "chore: final verification fixes"
```
