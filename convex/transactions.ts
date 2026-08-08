import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";

export const create = mutation({
  args: {
    accountId: v.id("accounts"),
    categoryId: v.id("categories"),
    amount: v.number(),
    type: v.union(v.literal("income"), v.literal("expense")),
    note: v.optional(v.string()),
    date: v.number(),
  },
  handler: async (ctx, args) => {
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

    const account = await ctx.db.get(args.accountId);
    if (account === null || account.householdId !== membership.householdId) {
      throw new ConvexError("Account does not belong to your household.");
    }

    const category = await ctx.db.get(args.categoryId);
    if (category === null || category.householdId !== membership.householdId) {
      throw new ConvexError("Category does not belong to your household.");
    }

    if (membership.role !== "owner") {
      if (account.hidden) {
        throw new ConvexError("You cannot create transactions on a hidden account.");
      }
      if (category.hidden) {
        throw new ConvexError("You cannot create transactions on a hidden category.");
      }
    }

    if (args.type === "income" && args.amount <= 0) {
      throw new ConvexError("Amount must be positive for income transactions.");
    }
    if (args.type === "expense" && args.amount >= 0) {
      throw new ConvexError("Amount must be negative for expense transactions.");
    }
    if (category.type !== args.type) {
      throw new ConvexError("Category type must match transaction type.");
    }

    const now = Date.now();
    const transactionId = await ctx.db.insert("transactions", {
      householdId: membership.householdId,
      accountId: args.accountId,
      categoryId: args.categoryId,
      amount: args.amount,
      type: args.type,
      note: args.note,
      date: args.date,
      createdBy: user._id,
      updatedBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.accountId, {
      balance: account.balance + args.amount,
      updatedAt: now,
    });

    return transactionId;
  },
});
