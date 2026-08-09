import { ConvexError, v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";

const categoryType = v.union(v.literal("income"), v.literal("expense"));

const RESERVED_CATEGORY_NAME = "Initial Balance";

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

function validateName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ConvexError("Category name is required.");
  }
  if (trimmed.length < 2) {
    throw new ConvexError("Category name must be at least 2 characters.");
  }
  if (trimmed.length > 30) {
    throw new ConvexError("Category name must be at most 30 characters.");
  }
  return trimmed;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return { categories: null, isOwner: false };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      return { categories: null, isOwner: false };
    }

    const membership = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (membership === null) {
      return { categories: null, isOwner: false };
    }

    const isOwner = membership.role === "owner";
    const all = await ctx.db
      .query("categories")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", membership.householdId),
      )
      .collect();

    const manageable = all.filter(
      (category) => category.name !== RESERVED_CATEGORY_NAME,
    );
    const categories = isOwner
      ? manageable
      : manageable.filter((category) => !category.hidden);
    return { categories, isOwner };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    type: categoryType,
    hidden: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);

    if (membership.role !== "owner") {
      throw new ConvexError("You are not the owner of this household.");
    }

    const name = validateName(args.name);

    if (name === RESERVED_CATEGORY_NAME) {
      throw new ConvexError("This category name is reserved.");
    }

    const existing = await ctx.db
      .query("categories")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", membership.householdId),
      )
      .filter((q) =>
        q.and(q.eq(q.field("name"), name), q.eq(q.field("type"), args.type)),
      )
      .first();
    if (existing !== null) {
      throw new ConvexError("Category name already exists.");
    }

    const now = Date.now();
    const categoryId = await ctx.db.insert("categories", {
      householdId: membership.householdId,
      name,
      type: args.type,
      hidden: args.hidden ?? false,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(categoryId);
  },
});

export const update = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.optional(v.string()),
    type: v.optional(categoryType),
    hidden: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);

    if (membership.role !== "owner") {
      throw new ConvexError("You are not the owner of this household.");
    }

    const category = await ctx.db.get(args.categoryId);
    if (category === null || category.householdId !== membership.householdId) {
      throw new ConvexError("Category not found.");
    }

    if (category.name === RESERVED_CATEGORY_NAME) {
      throw new ConvexError("This category cannot be modified.");
    }

    const patch: {
      name?: string;
      type?: "income" | "expense";
      hidden?: boolean;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.name !== undefined) {
      const name = validateName(args.name);
      if (name === RESERVED_CATEGORY_NAME) {
        throw new ConvexError("This category name is reserved.");
      }

      const existing = await ctx.db
        .query("categories")
        .withIndex("by_householdId", (q) =>
          q.eq("householdId", membership.householdId),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), name),
            q.neq(q.field("_id"), args.categoryId),
          ),
        )
        .first();
      if (existing !== null) {
        throw new ConvexError("Category name already exists.");
      }

      patch.name = name;
    }

    if (args.type !== undefined && args.type !== category.type) {
      const referencingTx = await ctx.db
        .query("transactions")
        .withIndex("by_categoryId", (q) => q.eq("categoryId", args.categoryId))
        .first();
      if (referencingTx !== null) {
        throw new ConvexError(
          "Cannot change category type — existing transactions or budgets use this category.",
        );
      }
      patch.type = args.type;
    }

    if (args.hidden !== undefined) {
      patch.hidden = args.hidden;
    }

    await ctx.db.patch(args.categoryId, patch);
    return await ctx.db.get(args.categoryId);
  },
});

export const remove = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);

    if (membership.role !== "owner") {
      throw new ConvexError("You are not the owner of this household.");
    }

    const category = await ctx.db.get(args.categoryId);
    if (category === null || category.householdId !== membership.householdId) {
      throw new ConvexError("Category not found.");
    }

    if (category.name === RESERVED_CATEGORY_NAME) {
      throw new ConvexError("This category cannot be deleted.");
    }

    const referencingTx = await ctx.db
      .query("transactions")
      .withIndex("by_categoryId", (q) => q.eq("categoryId", args.categoryId))
      .first();

    if (referencingTx !== null) {
      throw new ConvexError(
        "Cannot delete category — existing transactions or budgets reference this category. Delete or reassign those first.",
      );
    }

    await ctx.db.delete(args.categoryId);
  },
});
