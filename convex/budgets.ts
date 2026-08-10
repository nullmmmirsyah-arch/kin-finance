import { ConvexError, v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";

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
