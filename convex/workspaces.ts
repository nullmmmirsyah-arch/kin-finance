import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError("Unauthenticated");
    }

    const trimmedName = args.name.trim();

    if (trimmedName.length === 0) {
      throw new ConvexError("Nama workspace wajib diisi");
    }
    if (trimmedName.length < 3) {
      throw new ConvexError("Nama workspace minimal 3 karakter");
    }
    if (trimmedName.length > 50) {
      throw new ConvexError("Nama workspace maksimal 50 karakter");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      throw new ConvexError("User tidak ditemukan");
    }

    const now = Date.now();
    const workspaceId = await ctx.db.insert("workspaces", {
      name: trimmedName,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("workspaceMemberships", {
      workspaceId,
      userId: user._id,
      role: "owner",
    });

    return workspaceId;
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
      .query("workspaceMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (membership === null) {
      return null;
    }

    const workspace = await ctx.db.get(membership.workspaceId);
    return workspace;
  },
});

export const update = mutation({
  args: { workspaceId: v.id("workspaces"), name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError("Unauthenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      throw new ConvexError("User tidak ditemukan");
    }

    const memberships = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const membership = memberships.find(
      (m) => m.workspaceId === args.workspaceId,
    );

    if (membership === undefined || membership.role !== "owner") {
      throw new ConvexError("Anda bukan owner workspace ini");
    }

    const trimmedName = args.name.trim();

    if (trimmedName.length === 0) {
      throw new ConvexError("Nama workspace wajib diisi");
    }
    if (trimmedName.length < 3) {
      throw new ConvexError("Nama workspace minimal 3 karakter");
    }
    if (trimmedName.length > 50) {
      throw new ConvexError("Nama workspace maksimal 50 karakter");
    }

    await ctx.db.patch(args.workspaceId, {
      name: trimmedName,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.workspaceId);
  },
});