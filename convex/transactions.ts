import { ConvexError, v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { getUserAndMembership, getScopedDoc } from "./helpers";
import {
  validateNote,
  validateTransactionAmount,
  validateTransactionDate,
} from "../constants/validation";
import { recomputeAllForHousehold } from "./periodBalances";
import {
  handleList,
  handleSummary,
  handleRecent,
  handleGet,
} from "./transactionQueries";
import {
  handleCashflow,
  handleSpendingByCategory,
} from "./transactionAnalytics";

/**
 * Facade: convex/transactions.ts — keeps api.transactions.* stable.
 *
 * Deep modules: transactionHelpers (shared seam), transactionQueries (list/summary/recent/get),
 * transactionAnalytics (cashflow/spending). This facade is the narrow interface that hides them.
 * Client unchanged: api.transactions.list etc still resolve here.
 * No folder convex/transactions/ to avoid api path changes — flat files leverage existing codegen.
 */

const transactionType = v.union(v.literal("income"), v.literal("expense"), v.literal("transfer"));

// ── ledger mutations — remain here (balance seam, recompute) ──
async function applyBalanceDelta(
  ctx: MutationCtx,
  accountId: Id<"accounts">,
  delta: number,
  now: number,
) {
  if (delta === 0) return;
  const account = await ctx.db.get(accountId);
  if (account === null) return;
  await ctx.db.patch(account._id, {
    balance: account.balance + delta,
    updatedAt: now,
  });
}

async function reverseBalances(ctx: MutationCtx, tx: Doc<"transactions">, now: number) {
  if (tx.type === "transfer" && tx.toAccountId !== undefined) {
    await applyBalanceDelta(ctx, tx.accountId, tx.amount, now);
    await applyBalanceDelta(ctx, tx.toAccountId, -tx.amount, now);
  } else {
    await applyBalanceDelta(ctx, tx.accountId, -tx.amount, now);
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

    const err = validateTransactionAmount(args.amount, args.type);
    if (err) throw new ConvexError(err);
    const noteErr = validateNote(args.note);
    if (noteErr) throw new ConvexError(noteErr);
    const dateErr = validateTransactionDate(args.date);
    if (dateErr) throw new ConvexError(dateErr);

    const account = await getScopedDoc(ctx, args.accountId, membership.householdId, "Account");

    let category: Doc<"categories"> | undefined;
    let toAccount: Doc<"accounts"> | undefined;

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
      const to = await getScopedDoc(ctx, args.toAccountId, membership.householdId, "To account");
      toAccount = to;
    } else {
      if (args.toAccountId !== undefined) {
        throw new ConvexError("Income and expense transactions cannot have a to account.");
      }
      if (args.categoryId === undefined) {
        throw new ConvexError("Category is required for income and expense transactions.");
      }
      const cat = await getScopedDoc(ctx, args.categoryId, membership.householdId, "Category");
      if (cat.type !== args.type) {
        throw new ConvexError("Category type must match transaction type.");
      }
      category = cat;
    }

    if (membership.role !== "owner") {
      if (account.hidden) {
        throw new ConvexError("You cannot create transactions on a hidden account.");
      }
      if (toAccount !== undefined && toAccount.hidden) {
        throw new ConvexError("You cannot create transfers to a hidden account.");
      }
      if (category !== undefined && category.hidden) {
        throw new ConvexError("You cannot create transactions on a hidden category.");
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
      await applyBalanceDelta(ctx, args.accountId, -args.amount, now);
      await applyBalanceDelta(ctx, args.toAccountId as Id<"accounts">, args.amount, now);
    } else {
      await applyBalanceDelta(ctx, args.accountId, args.amount, now);
    }

    const householdForRecompute = await ctx.db.get(membership.householdId);
    if (householdForRecompute) {
      await recomputeAllForHousehold(ctx, householdForRecompute);
    }

    return transactionId;
  },
});

// ── query facade — delegates to deep modules ──
export const list = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    limit: v.optional(v.number()),
    accountIds: v.optional(v.array(v.id("accounts"))),
    categoryIds: v.optional(v.array(v.id("categories"))),
    type: v.optional(transactionType),
    search: v.optional(v.string()),
    cursor: v.optional(v.object({ date: v.number(), id: v.id("transactions") })),
  },
  handler: async (ctx, args) => handleList(ctx, args),
});

export const summary = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    accountIds: v.optional(v.array(v.id("accounts"))),
    categoryIds: v.optional(v.array(v.id("categories"))),
    type: v.optional(transactionType),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => handleSummary(ctx, args),
});

export const cashflow = query({
  args: { startDate: v.number(), endDate: v.number(), timezone: v.optional(v.string()) },
  handler: async (ctx, args) => handleCashflow(ctx, args),
});

export const spendingByCategory = query({
  args: { startDate: v.number(), endDate: v.number() },
  handler: async (ctx, args) => handleSpendingByCategory(ctx, args),
});

export const recent = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.object({ date: v.number(), id: v.id("transactions") })),
  },
  handler: async (ctx, args) => handleRecent(ctx, args),
});

export const get = query({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => handleGet(ctx, args),
});

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

    const tx = await getScopedDoc(ctx, args.transactionId, membership.householdId, "Transaction");

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
        throw new ConvexError("Income and expense transactions cannot have a to account.");
      }
      categoryId = args.categoryId ?? tx.categoryId;
      if (categoryId === undefined) {
        throw new ConvexError("Category is required for income and expense transactions.");
      }
    }

    const err = validateTransactionAmount(amount, type);
    if (err) throw new ConvexError(err);
    const noteErr = validateNote(args.note);
    if (noteErr) throw new ConvexError(noteErr);
    if (args.date !== undefined) {
      const dateErr = validateTransactionDate(args.date);
      if (dateErr) throw new ConvexError(dateErr);
    }

    const account = await getScopedDoc(ctx, accountId, membership.householdId, "Account");

    let category: Doc<"categories"> | undefined;
    if (categoryId !== undefined) {
      const cat = await getScopedDoc(ctx, categoryId, membership.householdId, "Category");
      if (cat.type !== type) {
        throw new ConvexError("Category type must match transaction type.");
      }
      category = cat;
    }

    let toAccount: Doc<"accounts"> | undefined;
    if (toAccountId !== undefined) {
      const to = await getScopedDoc(ctx, toAccountId, membership.householdId, "To account");
      toAccount = to;
    }

    if (membership.role !== "owner" && tx.categoryId !== undefined) {
      const existingCategory = await ctx.db.get(tx.categoryId);
      if (existingCategory !== null && existingCategory.hidden) {
        throw new ConvexError("You cannot edit transactions on a hidden category.");
      }
    }

    if (membership.role !== "owner") {
      if (accountId !== tx.accountId && account.hidden) {
        throw new ConvexError("You cannot reassign to a hidden account.");
      }
      if (toAccount !== undefined && toAccountId !== tx.toAccountId && toAccount.hidden) {
        throw new ConvexError("You cannot reassign to a hidden account.");
      }
      if (category !== undefined && categoryId !== tx.categoryId && category.hidden) {
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
      await applyBalanceDelta(ctx, id as Id<"accounts">, delta, now);
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

    const householdForRecompute = await ctx.db.get(membership.householdId);
    if (householdForRecompute) {
      await recomputeAllForHousehold(ctx, householdForRecompute);
    }

    return await ctx.db.get(args.transactionId);
  },
});

export const remove = mutation({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);

    const tx = await getScopedDoc(ctx, args.transactionId, membership.householdId, "Transaction");

    if (membership.role !== "owner" && tx.categoryId !== undefined) {
      const category = await ctx.db.get(tx.categoryId);
      if (category !== null && category.hidden) {
        throw new ConvexError("You cannot delete transactions on a hidden category.");
      }
    }

    const now = Date.now();
    await reverseBalances(ctx, tx, now);
    await ctx.db.delete(args.transactionId);

    const householdForRecompute = await ctx.db.get(membership.householdId);
    if (householdForRecompute) {
      await recomputeAllForHousehold(ctx, householdForRecompute);
    }
  },
});
