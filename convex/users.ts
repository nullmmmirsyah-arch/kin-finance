import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError("Unauthenticated");
    }
    console.log("STORE_IDENTITY", JSON.stringify({
      tokenIdentifier: identity.tokenIdentifier,
      issuer: identity.issuer,
      subject: identity.subject,
      name: identity.name,
      email: identity.email,
      pictureUrl: identity.pictureUrl,
      sid: (identity as Record<string, unknown>).sid,
      allKeys: Object.keys(identity),
    }));
    const data = {
      tokenIdentifier: identity.tokenIdentifier,
      clerkUserId: identity.subject,
      name: identity.name,
      email: identity.email,
      imageUrl: identity.pictureUrl,
    };
    const existing = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (existing === null) {
      await ctx.db.insert("users", data);
    } else {
      await ctx.db.patch(existing._id, data);
    }
  },
});

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }
    return await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
  },
});
