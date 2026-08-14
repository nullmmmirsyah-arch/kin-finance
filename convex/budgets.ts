import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserAndMembership } from "./helpers";

export const list = query({
  args: {
    periodStart: v.number(),
    periodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return { budgets: null, isOwner: false };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      return { budgets: null, isOwner: false };
    }

    const membership = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (membership === null) {
      return { budgets: null, isOwner: false };
    }

    const isOwner = membership.role === "owner";

    if (args.periodEnd <= args.periodStart) {
      throw new ConvexError("periodEnd must be after periodStart.");
    }
    if (args.periodEnd - args.periodStart > 32 * 86_400_000) {
      throw new ConvexError("Period cannot exceed 32 days.");
    }

    const budgets = await ctx.db
      .query("budgets")
      .withIndex("by_household_period", (q) =>
        q.eq("householdId", membership.householdId).eq(
          "periodStart",
          args.periodStart,
        ),
      )
      .collect();

    if (budgets.length === 0) {
      return { budgets: [], isOwner };
    }

    const categoryIds = [...new Set(budgets.map((b) => b.categoryId))];
    const categoryMap = new Map(
      (
        await Promise.all(
          categoryIds.map((id) => ctx.db.get(id)),
        )
      )
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => [c._id, c]),
    );

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_household_date", (q) =>
        q
          .eq("householdId", membership.householdId)
          .gte("date", args.periodStart)
          .lt("date", args.periodEnd),
      )
      .collect();

    const spendingByCategory = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type !== "expense" || tx.categoryId === undefined) continue;
      const current = spendingByCategory.get(tx.categoryId) ?? 0;
      spendingByCategory.set(tx.categoryId, current + Math.abs(tx.amount));
    }

    const result = budgets.map((budget) => {
      const category = categoryMap.get(budget.categoryId);
      const spent = spendingByCategory.get(budget.categoryId) ?? 0;
      const progress = budget.amount > 0 ? spent / budget.amount : 0;
      return {
        ...budget,
        category: category
          ? { _id: category._id, name: category.name, hidden: category.hidden }
          : undefined,
        spent,
        progress,
      };
    });

    return { budgets: result, isOwner };
  },
});

export const get = query({
  args: { budgetId: v.id("budgets") },
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

    const budget = await ctx.db.get(args.budgetId);
    if (budget === null || budget.householdId !== membership.householdId) {
      return null;
    }

    const category = budget.categoryId
      ? ((await ctx.db.get(budget.categoryId)) ?? undefined)
      : undefined;

    return {
      budget: { ...budget, category },
      isOwner: membership.role === "owner",
    };
  },
});

export const categoryOptions = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      return [];
    }

    const membership = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (membership === null) {
      return [];
    }

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", membership.householdId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "expense"),
          q.neq(q.field("name"), "Initial Balance"),
        ),
      )
      .collect();

    return categories.map((c) => ({ _id: c._id, name: c.name, hidden: c.hidden }));
  },
});

export const create = mutation({
  args: {
    categoryId: v.id("categories"),
    amount: v.number(),
    periodStart: v.number(),
  },
  handler: async (ctx, args) => {
    const { user, membership } = await getUserAndMembership(ctx);

    if (!Number.isFinite(args.amount) || !Number.isSafeInteger(args.amount) || args.amount < 1) {
      throw new ConvexError("Amount must be a whole number of at least 1.");
    }

    const category = await ctx.db.get(args.categoryId);
    if (
      category === null ||
      category.householdId !== membership.householdId
    ) {
      throw new ConvexError("Category not found.");
    }

    if (category.type !== "expense") {
      throw new ConvexError("Cannot create budget for an income category.");
    }

    const existing = await ctx.db
      .query("budgets")
      .withIndex("by_category_period", (q) =>
        q.eq("categoryId", args.categoryId).eq("periodStart", args.periodStart),
      )
      .first();

    if (existing !== null) {
      throw new ConvexError(
        "A budget already exists for this category in this month.",
      );
    }

    const now = Date.now();
    const budgetId = await ctx.db.insert("budgets", {
      householdId: membership.householdId,
      categoryId: args.categoryId,
      periodStart: args.periodStart,
      amount: args.amount,
      createdBy: user._id,
      updatedBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(budgetId);
  },
});

export const update = mutation({
  args: {
    budgetId: v.id("budgets"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const { user, membership } = await getUserAndMembership(ctx);

    const budget = await ctx.db.get(args.budgetId);
    if (budget === null || budget.householdId !== membership.householdId) {
      throw new ConvexError("Budget not found.");
    }

    if (!Number.isFinite(args.amount) || !Number.isSafeInteger(args.amount) || args.amount < 1) {
      throw new ConvexError("Amount must be a whole number of at least 1.");
    }

    const now = Date.now();
    await ctx.db.patch(args.budgetId, {
      amount: args.amount,
      updatedBy: user._id,
      updatedAt: now,
    });

    return await ctx.db.get(args.budgetId);
  },
});

export const remove = mutation({
  args: { budgetId: v.id("budgets") },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);

    const budget = await ctx.db.get(args.budgetId);
    if (budget === null || budget.householdId !== membership.householdId) {
      throw new ConvexError("Budget not found.");
    }

    await ctx.db.delete(args.budgetId);
  },
});
