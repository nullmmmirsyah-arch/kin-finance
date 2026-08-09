import { ConvexError, v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { api } from "./_generated/api";

const accountType = v.union(
  v.literal("cash"),
  v.literal("bank"),
  v.literal("ewallet"),
  v.literal("credit_card"),
);

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
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return { accounts: null, isOwner: false };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      return { accounts: null, isOwner: false };
    }

    const membership = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (membership === null) {
      return { accounts: null, isOwner: false };
    }

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
    const { membership } = await getUserAndMembership(ctx);

    if (membership.role !== "owner") {
      throw new ConvexError("You are not the owner of this household.");
    }

    const name = args.name.trim();
    if (name.length === 0) {
      throw new ConvexError("Account name is required.");
    }
    if (name.length < 2) {
      throw new ConvexError("Account name must be at least 2 characters.");
    }
    if (name.length > 30) {
      throw new ConvexError("Account name must be at most 30 characters.");
    }

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

    const now = Date.now();
    const accountId = await ctx.db.insert("accounts", {
      householdId: membership.householdId,
      name,
      type: args.type,
      balance: 0,
      hidden: args.hidden ?? false,
      createdAt: now,
      updatedAt: now,
    });

    if (openingBalance !== 0) {
      const txType = openingBalance > 0 ? "income" : "expense";
      let category = await ctx.db
        .query("categories")
        .withIndex("by_householdId", (q) =>
          q.eq("householdId", membership.householdId),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), "Initial Balance"),
            q.eq(q.field("type"), txType),
          ),
        )
        .first();

      if (category === null) {
        const categoryId = await ctx.db.insert("categories", {
          householdId: membership.householdId,
          name: "Initial Balance",
          type: txType,
          hidden: false,
          createdAt: now,
          updatedAt: now,
        });
        category = await ctx.db.get(categoryId);
      }

      if (category === null) {
        throw new ConvexError("Initial Balance category not found.");
      }

      await ctx.runMutation(api.transactions.create, {
        accountId,
        categoryId: category._id,
        amount: openingBalance,
        type: txType,
        note: "Initial balance",
        date: now,
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

    if (membership.role !== "owner") {
      throw new ConvexError("You are not the owner of this household.");
    }

    const account = await ctx.db.get(args.accountId);
    if (account === null || account.householdId !== membership.householdId) {
      throw new ConvexError("Account not found.");
    }

    const patch: {
      name?: string;
      type?: "cash" | "bank" | "ewallet" | "credit_card";
      hidden?: boolean;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length === 0) {
        throw new ConvexError("Account name is required.");
      }
      if (name.length < 2) {
        throw new ConvexError("Account name must be at least 2 characters.");
      }
      if (name.length > 30) {
        throw new ConvexError("Account name must be at most 30 characters.");
      }

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

    if (membership.role !== "owner") {
      throw new ConvexError("You are not the owner of this household.");
    }

    const account = await ctx.db.get(args.accountId);
    if (account === null || account.householdId !== membership.householdId) {
      throw new ConvexError("Account not found.");
    }

    const referencingTx = await ctx.db
      .query("transactions")
      .withIndex("by_accountId", (q) => q.eq("accountId", args.accountId))
      .first();

    if (referencingTx !== null) {
      throw new ConvexError(
        "Cannot delete account — existing transactions reference this account. Delete or reassign those transactions first.",
      );
    }

    await ctx.db.delete(args.accountId);
  },
});
