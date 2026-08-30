import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { getUserAndMembership, findUserAndMembership, requireOwner, getScopedDoc } from "./helpers";
import { validateAccountName } from "../constants/validation";
import { RESERVED_CATEGORY_NAME } from "../constants/categories";

const accountType = v.union(
  v.literal("cash"),
  v.literal("bank"),
  v.literal("ewallet"),
  v.literal("credit_card"),
);

export const list = query({
  args: {},
  handler: async (ctx) => {
    const result = await findUserAndMembership(ctx);
    if (result === null) {
      return { accounts: null, isOwner: false };
    }
    const { membership } = result;
    const isOwner = membership.role === "owner";
    const all = await ctx.db
      .query("accounts")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", membership.householdId),
      )
      .collect();

    const accounts = isOwner ? all : all.filter((account) => !account.hidden);
    return { accounts, isOwner };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    type: accountType,
    openingBalance: v.optional(v.number()),
    hidden: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { user, membership } = await getUserAndMembership(ctx);
    requireOwner(membership);

    const err = validateAccountName(args.name);
    if (err) throw new ConvexError(err);
    const name = args.name.trim();

    const existing = await ctx.db
      .query("accounts")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", membership.householdId),
      )
      .filter((q) => q.eq(q.field("name"), name))
      .first();
    if (existing !== null) {
      throw new ConvexError("Account name already exists.");
    }

    const openingBalance = args.openingBalance ?? 0;
    if (!Number.isFinite(openingBalance)) {
      throw new ConvexError("Opening balance must be a valid number.");
    }
    if (!Number.isSafeInteger(openingBalance)) {
      throw new ConvexError("Opening balance must be a whole number.");
    }

    // P0-2: validate reserved category BEFORE inserting account to avoid orphan
    let openingCategory: Doc<"categories"> | null = null;
    let txType: "income" | "expense" | null = null;
    if (openingBalance !== 0) {
      txType = openingBalance > 0 ? "income" : "expense";
      const category = await ctx.db
        .query("categories")
        .withIndex("by_householdId", (q) =>
          q.eq("householdId", membership.householdId),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), RESERVED_CATEGORY_NAME),
            q.eq(q.field("type"), txType!),
          ),
        )
        .first();

      if (category === null) {
        throw new ConvexError("Initial Balance category not found.");
      }
      openingCategory = category;
    }

    const now = Date.now();
    // P0-2: atomic — balance set to openingBalance directly, single timestamp
    const accountId = await ctx.db.insert("accounts", {
      householdId: membership.householdId,
      name,
      type: args.type,
      balance: openingBalance,
      hidden: args.hidden ?? false,
      createdAt: now,
      updatedAt: now,
    });

    if (openingBalance !== 0 && openingCategory !== null && txType !== null) {
      await ctx.db.insert("transactions", {
        householdId: membership.householdId,
        accountId,
        categoryId: openingCategory._id,
        amount: openingBalance,
        type: txType,
        note: "Initial balance",
        date: now,
        createdBy: user._id,
        updatedBy: user._id,
        createdAt: now,
        updatedAt: now,
      });
    }

    return await ctx.db.get(accountId);
  },
});

export const update = mutation({
  args: {
    accountId: v.id("accounts"),
    name: v.optional(v.string()),
    type: v.optional(accountType),
    hidden: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);
    requireOwner(membership);

    const account = await getScopedDoc(ctx, args.accountId, membership.householdId, "Account");

    const patch: {
      name?: string;
      type?: "cash" | "bank" | "ewallet" | "credit_card";
      hidden?: boolean;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.name !== undefined) {
      const err = validateAccountName(args.name);
      if (err) throw new ConvexError(err);
      const name = args.name.trim();

      const existing = await ctx.db
        .query("accounts")
        .withIndex("by_householdId", (q) =>
          q.eq("householdId", membership.householdId),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), name),
            q.neq(q.field("_id"), args.accountId),
          ),
        )
        .first();
      if (existing !== null) {
        throw new ConvexError("Account name already exists.");
      }

      patch.name = name;
    }

    if (args.type !== undefined) {
      patch.type = args.type;
    }
    if (args.hidden !== undefined) {
      patch.hidden = args.hidden;
    }

    await ctx.db.patch(args.accountId, patch);
    return await ctx.db.get(args.accountId);
  },
});

export const remove = mutation({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);
    requireOwner(membership);

    await getScopedDoc(ctx, args.accountId, membership.householdId, "Account");

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

    await ctx.db.delete(args.accountId);
  },
});

function computeExpectedBalances(
  accounts: Doc<"accounts">[],
  transactions: Doc<"transactions">[],
): Map<string, number> {
  const expected = new Map<string, number>();
  for (const acc of accounts) expected.set(acc._id, 0);
  for (const tx of transactions) {
    if (tx.type === "transfer" && tx.toAccountId !== undefined) {
      // transfer: from -amount, to +amount (amount is positive magnitude)
      expected.set(tx.accountId, (expected.get(tx.accountId) ?? 0) - tx.amount);
      expected.set(tx.toAccountId as string, (expected.get(tx.toAccountId as string) ?? 0) + tx.amount);
    } else {
      // income/expense: signed amount already
      expected.set(tx.accountId, (expected.get(tx.accountId) ?? 0) + tx.amount);
    }
  }
  return expected;
}

export const verify = query({
  args: {},
  handler: async (ctx) => {
    const result = await findUserAndMembership(ctx);
    if (result === null) return null;
    const { membership } = result;
    const isOwner = membership.role === "owner";

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_householdId", (q) => q.eq("householdId", membership.householdId))
      .collect();

    const visibleAccounts = isOwner ? accounts : accounts.filter((a) => !a.hidden);

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_householdId", (q) => q.eq("householdId", membership.householdId))
      .take(10001);
    if (transactions.length > 10000) {
      throw new ConvexError("Too many transactions to verify. Please contact support.");
    }

    const expected = computeExpectedBalances(accounts, transactions as Doc<"transactions">[]);

    const discrepancies: Array<{
      accountId: string;
      name: string;
      stored: number;
      expected: number;
      delta: number;
    }> = [];

    let totalStored = 0;
    let totalExpected = 0;
    for (const acc of visibleAccounts) {
      const exp = expected.get(acc._id) ?? 0;
      totalStored += acc.balance;
      totalExpected += exp;
      if (acc.balance !== exp) {
        discrepancies.push({
          accountId: acc._id,
          name: acc.name,
          stored: acc.balance,
          expected: exp,
          delta: exp - acc.balance,
        });
      }
    }

    return { discrepancies, isOwner, totalStored, totalExpected };
  },
});

export const reconcile = mutation({
  args: {},
  handler: async (ctx) => {
    const { membership } = await getUserAndMembership(ctx);
    requireOwner(membership);

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_householdId", (q) => q.eq("householdId", membership.householdId))
      .collect();

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_householdId", (q) => q.eq("householdId", membership.householdId))
      .take(10001);
    if (transactions.length > 10000) {
      throw new ConvexError("Too many transactions to reconcile. Please contact support.");
    }

    const expected = computeExpectedBalances(accounts, transactions as Doc<"transactions">[]);
    let fixed = 0;
    const now = Date.now();
    const discrepancies: Array<{ accountId: string; name: string; stored: number; expected: number }> = [];

    for (const acc of accounts) {
      const exp = expected.get(acc._id) ?? 0;
      if (acc.balance !== exp) {
        await ctx.db.patch(acc._id, { balance: exp, updatedAt: now });
        fixed++;
        discrepancies.push({ accountId: acc._id, name: acc.name, stored: acc.balance, expected: exp });
      }
    }

    return { fixed, discrepancies };
  },
});
