import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError("You are not signed in.");
    }

    const trimmedName = args.name.trim();

    if (trimmedName.length === 0) {
      throw new ConvexError("Household name is required.");
    }
    if (trimmedName.length < 3) {
      throw new ConvexError("Household name must be at least 3 characters.");
    }
    if (trimmedName.length > 50) {
      throw new ConvexError("Household name must be at most 50 characters.");
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
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("householdMemberships", {
      householdId,
      userId: user._id,
      role: "owner",
    });

    return await ctx.db.get(householdId);
  },
});

export const getActive = query({
  args: {},
  handler: async (ctx) => {
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

    const household = await ctx.db.get(membership.householdId);
    return household;
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

    const trimmedName = args.name.trim();

    if (trimmedName.length === 0) {
      throw new ConvexError("Household name is required.");
    }
    if (trimmedName.length < 3) {
      throw new ConvexError("Household name must be at least 3 characters.");
    }
    if (trimmedName.length > 50) {
      throw new ConvexError("Household name must be at most 50 characters.");
    }

    await ctx.db.patch(args.householdId, {
      name: trimmedName,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.householdId);
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
