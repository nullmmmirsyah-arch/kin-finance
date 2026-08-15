import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserAndMembership, findUserAndMembership } from "./helpers";
import { validateCategoryName } from "../constants/validation";

const categoryType = v.union(v.literal("income"), v.literal("expense"));

const RESERVED_CATEGORY_NAME = "Initial Balance";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const result = await findUserAndMembership(ctx);
    if (result === null) {
      return { categories: null, isOwner: false };
    }
    const { membership } = result;
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

    const err = validateCategoryName(args.name);
    if (err) throw new ConvexError(err);
    const name = args.name.trim();

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
      const err = validateCategoryName(args.name);
      if (err) throw new ConvexError(err);
      const name = args.name.trim();
      if (name === RESERVED_CATEGORY_NAME) {
        throw new ConvexError("This category name is reserved.");
      }
      patch.name = name;
    }

    if (args.type !== undefined && args.type !== category.type) {
      const referencingBudget = await ctx.db
        .query("budgets")
        .withIndex("by_categoryId", (q) => q.eq("categoryId", args.categoryId))
        .first();
      if (referencingBudget !== null) {
        throw new ConvexError(
          "Cannot change category type — existing budgets use this category.",
        );
      }

      const referencingTx = await ctx.db
        .query("transactions")
        .withIndex("by_categoryId", (q) => q.eq("categoryId", args.categoryId))
        .first();
      if (referencingTx !== null) {
        throw new ConvexError(
          "Cannot change category type — existing transactions use this category.",
        );
      }
      patch.type = args.type;
    }

    if (
      args.name !== undefined ||
      (args.type !== undefined && args.type !== category.type)
    ) {
      const effectiveName = patch.name ?? category.name;
      const effectiveType = patch.type ?? category.type;
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_householdId", (q) =>
          q.eq("householdId", membership.householdId),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), effectiveName),
            q.eq(q.field("type"), effectiveType),
            q.neq(q.field("_id"), args.categoryId),
          ),
        )
        .first();
      if (existing !== null) {
        throw new ConvexError("Category name already exists.");
      }
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

    const referencingBudget = await ctx.db
      .query("budgets")
      .withIndex("by_categoryId", (q) => q.eq("categoryId", args.categoryId))
      .first();

    if (referencingBudget !== null) {
      throw new ConvexError(
        "Cannot delete category — existing budgets reference this category. Delete those budgets first.",
      );
    }

    const referencingTx = await ctx.db
      .query("transactions")
      .withIndex("by_categoryId", (q) => q.eq("categoryId", args.categoryId))
      .first();

    if (referencingTx !== null) {
      throw new ConvexError(
        "Cannot delete category — existing transactions reference this category. Delete or reassign those first.",
      );
    }

    await ctx.db.delete(args.categoryId);
  },
});
