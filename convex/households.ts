import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  validateBalanceMode,
  validateHouseholdName,
  validatePeriodType,
  validateTimezone,
} from "../constants/validation";
import { RESERVED_CATEGORY_NAME } from "../constants/categories";
import { findUserAndMembership, getUserAndMembership, requireOwner } from "./helpers";
import { getYearMonth, zonedMonthStart } from "../utils/date";
import { recomputeAllForHousehold } from "./periodBalances";

export const create = mutation({
  args: {
    name: v.string(),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError("You are not signed in.");
    }

    const err = validateHouseholdName(args.name);
    if (err) throw new ConvexError(err);
    const trimmedName = args.name.trim();

    const timezoneErr = validateTimezone(args.timezone);
    if (timezoneErr) throw new ConvexError(timezoneErr);

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      throw new ConvexError("User not found.");
    }

    const existingMembership = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (existingMembership) {
      throw new ConvexError("You already have a household.");
    }

    const now = Date.now();
    const householdId = await ctx.db.insert("households", {
      name: trimmedName,
      timezone: args.timezone,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("householdMemberships", {
      householdId,
      userId: user._id,
      role: "owner",
    });

    const reservedCategories = [
      { name: RESERVED_CATEGORY_NAME, type: "income" as const },
      { name: RESERVED_CATEGORY_NAME, type: "expense" as const },
    ];
    for (const category of reservedCategories) {
      await ctx.db.insert("categories", {
        householdId,
        name: category.name,
        type: category.type,
        hidden: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    return await ctx.db.get(householdId);
  },
});

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const result = await findUserAndMembership(ctx);
    if (result === null) {
      return null;
    }
    return await ctx.db.get(result.membership.householdId);
  },
});

export const update = mutation({
  args: { householdId: v.id("households"), name: v.string() },
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

    const memberships = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const membership = memberships.find(
      (m) => m.householdId === args.householdId,
    );

    if (membership === undefined || membership.role !== "owner") {
      throw new ConvexError("You are not the owner of this household.");
    }

    const household = await ctx.db.get(args.householdId);
    if (!household) {
      throw new ConvexError("Household not found.");
    }

    const err = validateHouseholdName(args.name);
    if (err) throw new ConvexError(err);
    const trimmedName = args.name.trim();

    await ctx.db.patch(args.householdId, {
      name: trimmedName,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.householdId);
  },
});

export const updateTimezone = mutation({
  args: { householdId: v.id("households"), timezone: v.optional(v.string()) },
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

    const memberships = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const membership = memberships.find(
      (m) => m.householdId === args.householdId,
    );

    if (membership === undefined || membership.role !== "owner") {
      throw new ConvexError("You are not the owner of this household.");
    }

    const household = await ctx.db.get(args.householdId);
    if (!household) {
      throw new ConvexError("Household not found.");
    }

    const timezoneErr = validateTimezone(args.timezone);
    if (timezoneErr) throw new ConvexError(timezoneErr);

    if (args.timezone === household.timezone) {
      return household;
    }

    // Only re-anchor budgets when we actually know the timezone they were
    // created in AND the new target is a concrete zone. A missing value means
    // "match device": budgets were created in device-local time (legacy) or
    // should keep their stored boundaries (the device locale matches), so we
    // leave them untouched.
    if (household.timezone !== undefined && args.timezone !== undefined) {
      const oldTimezone = household.timezone;

      const budgets = await ctx.db
        .query("budgets")
        .withIndex("by_householdId", (q) =>
          q.eq("householdId", args.householdId),
        )
        .collect();

      for (const budget of budgets) {
        const { year, month } = getYearMonth(budget.periodStart, oldTimezone);
        const newPeriodStart = zonedMonthStart(year, month, args.timezone);
        if (newPeriodStart !== budget.periodStart) {
          await ctx.db.patch(budget._id, {
            periodStart: newPeriodStart,
            updatedAt: Date.now(),
          });
        }
      }
    }

    await ctx.db.patch(args.householdId, {
      timezone: args.timezone,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.householdId);
  },
});

export const updateBalanceMode = mutation({
  args: {
    householdId: v.id("households"),
    balanceMode: v.union(v.literal("fresh"), v.literal("carryOver")),
  },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);
    requireOwner(membership);
    if (membership.householdId !== args.householdId) {
      throw new ConvexError("You are not the owner of this household.");
    }
    const err = validateBalanceMode(args.balanceMode);
    if (err) throw new ConvexError(err);
    const household = await ctx.db.get(args.householdId);
    if (household === null) {
      throw new ConvexError("Household not found.");
    }
    await ctx.db.patch(args.householdId, {
      balanceMode: args.balanceMode,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get(args.householdId);
    if (updated !== null) {
      await recomputeAllForHousehold(ctx, updated);
    }
    return updated;
  },
});

export const updatePeriodType = mutation({
  args: {
    householdId: v.id("households"),
    periodType: v.union(v.literal("monthly"), v.literal("weekly"), v.literal("yearly")),
  },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);
    requireOwner(membership);
    if (membership.householdId !== args.householdId) {
      throw new ConvexError("You are not the owner of this household.");
    }
    if (args.periodType !== "monthly") {
      throw new ConvexError("Weekly/yearly coming soon");
    }
    const err = validatePeriodType(args.periodType);
    if (err) throw new ConvexError(err);
    const household = await ctx.db.get(args.householdId);
    if (household === null) {
      throw new ConvexError("Household not found.");
    }
    await ctx.db.patch(args.householdId, {
      periodType: args.periodType,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get(args.householdId);
    if (updated !== null) {
      await recomputeAllForHousehold(ctx, updated);
    }
    return updated;
  },
});

export const listMembers = query({
  args: { householdId: v.id("households") },
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
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", args.householdId),
      )
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (membership === null) {
      return null;
    }

    const memberships = await ctx.db
      .query("householdMemberships")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", args.householdId),
      )
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const member = await ctx.db.get(m.userId);
        return {
          userId: m.userId,
          name: member?.name,
          email: member?.email,
          imageUrl: member?.imageUrl,
          role: m.role,
        };
      }),
    );

    return { householdId: args.householdId, members };
  },
});

export const removeMember = mutation({
  args: { householdId: v.id("households"), userId: v.id("users") },
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

    const callerMembership = await ctx.db
      .query("householdMemberships")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", args.householdId),
      )
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (callerMembership === null || callerMembership.role !== "owner") {
      throw new ConvexError("You are not the owner of this household.");
    }

    const targetMembership = await ctx.db
      .query("householdMemberships")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", args.householdId),
      )
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (targetMembership === null) {
      throw new ConvexError("Member not found.");
    }

    if (targetMembership.role === "owner") {
      throw new ConvexError("You cannot remove the owner of the household.");
    }

    await ctx.db.delete(targetMembership._id);
  },
});
