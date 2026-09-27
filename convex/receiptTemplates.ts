import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  findUserAndMembership,
  getScopedDoc,
  getUserAndMembership,
} from "./helpers";
import {
  validateTemplateKeywords,
  validateTemplateLabel,
} from "../constants/validation";

const amountStrategy = v.union(
  v.literal("largest"),
  v.literal("afterKeyword"),
);
const noteStrategy = v.union(
  v.literal("firstLine"),
  v.literal("afterKeyword"),
  v.literal("merchantLine"),
);
const defaultType = v.union(
  v.literal("expense"),
  v.literal("income"),
  v.literal("transfer"),
);
const keywordRule = v.object({
  keyword: v.string(),
  categoryId: v.id("categories"),
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const result = await findUserAndMembership(ctx);
    if (result === null) {
      return { templates: null };
    }
    const templates = await ctx.db
      .query("receiptTemplates")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", result.membership.householdId),
      )
      .collect();
    return { templates };
  },
});

export const create = mutation({
  args: {
    label: v.string(),
    icon: v.optional(v.string()),
    keywords: v.array(v.string()),
    amountStrategy,
    amountKeyword: v.optional(v.string()),
    noteStrategy,
    noteKeyword: v.optional(v.string()),
    defaultAccountId: v.optional(v.id("accounts")),
    defaultType,
    defaultCategoryId: v.optional(v.id("categories")),
    keywordRules: v.array(keywordRule),
  },
  handler: async (ctx, args) => {
    const { membership, user } = await getUserAndMembership(ctx);

    const labelErr = validateTemplateLabel(args.label);
    if (labelErr) throw new ConvexError(labelErr);
    const kwErr = validateTemplateKeywords(args.keywords);
    if (kwErr) throw new ConvexError(kwErr);
    const label = args.label.trim();
    const keywords = args.keywords.map((k) => k.trim()).filter(Boolean);

    const dupes = await ctx.db
      .query("receiptTemplates")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", membership.householdId),
      )
      .collect();
    const dup = dupes.find(
      (t) => t.label.toLowerCase() === label.toLowerCase(),
    );
    if (dup !== undefined) {
      throw new ConvexError("Template label already exists.");
    }

    if (args.defaultAccountId !== undefined) {
      await getScopedDoc(
        ctx,
        args.defaultAccountId,
        membership.householdId,
        "Account",
      );
    }

    if (args.defaultCategoryId !== undefined) {
      const cat = await getScopedDoc(
        ctx,
        args.defaultCategoryId,
        membership.householdId,
        "Category",
      );
      if (cat.type !== args.defaultType && args.defaultType !== "transfer") {
        throw new ConvexError("Category type must match transaction type.");
      }
    }

    for (const rule of args.keywordRules) {
      if (rule.keyword.trim().length === 0) {
        throw new ConvexError("Keyword rule keyword is required.");
      }
      const ruleCat = await getScopedDoc(
        ctx,
        rule.categoryId,
        membership.householdId,
        "Category",
      );
      if (ruleCat.type !== args.defaultType && args.defaultType !== "transfer") {
        throw new ConvexError("Category type must match transaction type.");
      }
    }

    const now = Date.now();
    const id = await ctx.db.insert("receiptTemplates", {
      householdId: membership.householdId,
      label,
      icon: args.icon,
      keywords,
      amountStrategy: args.amountStrategy,
      amountKeyword: args.amountKeyword,
      noteStrategy: args.noteStrategy,
      noteKeyword: args.noteKeyword,
      defaultAccountId: args.defaultAccountId,
      defaultType: args.defaultType,
      defaultCategoryId: args.defaultCategoryId,
      keywordRules: args.keywordRules,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: {
    templateId: v.id("receiptTemplates"),
    label: v.optional(v.string()),
    icon: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
    amountStrategy: v.optional(amountStrategy),
    amountKeyword: v.optional(v.string()),
    noteStrategy: v.optional(noteStrategy),
    noteKeyword: v.optional(v.string()),
    defaultAccountId: v.optional(v.id("accounts")),
    defaultType: v.optional(defaultType),
    defaultCategoryId: v.optional(v.id("categories")),
    keywordRules: v.optional(v.array(keywordRule)),
  },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);

    const template = await ctx.db.get(args.templateId);
    if (
      template === null ||
      template.householdId !== membership.householdId
    ) {
      throw new ConvexError("Template not found.");
    }

    const patch: {
      label?: string;
      icon?: string;
      keywords?: string[];
      amountStrategy?: "largest" | "afterKeyword";
      amountKeyword?: string;
      noteStrategy?: "firstLine" | "afterKeyword" | "merchantLine";
      noteKeyword?: string;
      defaultAccountId?: typeof template.defaultAccountId;
      defaultType?: "expense" | "income" | "transfer";
      defaultCategoryId?: typeof template.defaultCategoryId;
      keywordRules?: { keyword: string; categoryId: typeof template.keywordRules[number]["categoryId"] }[];
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.label !== undefined) {
      const labelErr = validateTemplateLabel(args.label);
      if (labelErr) throw new ConvexError(labelErr);
      const label = args.label.trim();
      const dupes = await ctx.db
        .query("receiptTemplates")
        .withIndex("by_householdId", (q) =>
          q.eq("householdId", membership.householdId),
        )
        .collect();
      const dup = dupes.find(
        (t) =>
          t.label.toLowerCase() === label.toLowerCase() &&
          t._id !== args.templateId,
      );
      if (dup !== undefined) {
        throw new ConvexError("Template label already exists.");
      }
      patch.label = label;
    }

    if (args.keywords !== undefined) {
      const kwErr = validateTemplateKeywords(args.keywords);
      if (kwErr) throw new ConvexError(kwErr);
      patch.keywords = args.keywords.map((k) => k.trim()).filter(Boolean);
    }

    if (args.amountStrategy !== undefined) {
      patch.amountStrategy = args.amountStrategy;
    }
    if (args.amountKeyword !== undefined) {
      patch.amountKeyword = args.amountKeyword;
    }
    if (args.noteStrategy !== undefined) {
      patch.noteStrategy = args.noteStrategy;
    }
    if (args.noteKeyword !== undefined) {
      patch.noteKeyword = args.noteKeyword;
    }
    if (args.icon !== undefined) {
      patch.icon = args.icon;
    }

    if (args.defaultAccountId !== undefined) {
      await getScopedDoc(
        ctx,
        args.defaultAccountId,
        membership.householdId,
        "Account",
      );
      patch.defaultAccountId = args.defaultAccountId;
    }

    const effectiveType = args.defaultType ?? template.defaultType;
    if (args.defaultType !== undefined) {
      patch.defaultType = args.defaultType;
    }

    if (args.defaultCategoryId !== undefined) {
      const cat = await getScopedDoc(
        ctx,
        args.defaultCategoryId,
        membership.householdId,
        "Category",
      );
      if (cat.type !== effectiveType && effectiveType !== "transfer") {
        throw new ConvexError("Category type must match transaction type.");
      }
      patch.defaultCategoryId = args.defaultCategoryId;
    } else if (
      args.defaultType !== undefined &&
      template.defaultCategoryId !== undefined
    ) {
      const cat = await getScopedDoc(
        ctx,
        template.defaultCategoryId,
        membership.householdId,
        "Category",
      );
      if (cat.type !== effectiveType && effectiveType !== "transfer") {
        throw new ConvexError("Category type must match transaction type.");
      }
    }

    if (args.keywordRules !== undefined) {
      for (const rule of args.keywordRules) {
        if (rule.keyword.trim().length === 0) {
          throw new ConvexError("Keyword rule keyword is required.");
        }
        const ruleCat = await getScopedDoc(
          ctx,
          rule.categoryId,
          membership.householdId,
          "Category",
        );
        if (ruleCat.type !== effectiveType && effectiveType !== "transfer") {
          throw new ConvexError("Category type must match transaction type.");
        }
      }
      patch.keywordRules = args.keywordRules;
    }

    await ctx.db.patch(args.templateId, patch);
    return await ctx.db.get(args.templateId);
  },
});

export const remove = mutation({
  args: { templateId: v.id("receiptTemplates") },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);

    const template = await ctx.db.get(args.templateId);
    if (
      template === null ||
      template.householdId !== membership.householdId
    ) {
      throw new ConvexError("Template not found.");
    }

    await ctx.db.delete(args.templateId);
  },
});
