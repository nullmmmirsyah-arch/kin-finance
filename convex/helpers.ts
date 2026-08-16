import { ConvexError } from "convex/values";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

type AnyCtx = QueryCtx | MutationCtx;

export function requireOwner(membership: Doc<"householdMemberships">): void {
  if (membership.role !== "owner") {
    throw new ConvexError("You are not the owner of this household.");
  }
}

type HouseholdScopedTable =
  | "accounts"
  | "categories"
  | "transactions"
  | "budgets"
  | "invitations";

export async function getScopedDoc<T extends HouseholdScopedTable>(
  ctx: MutationCtx,
  id: Id<T>,
  householdId: Id<"households">,
  errorLabel: string,
): Promise<Doc<T>> {
  const doc = await ctx.db.get(id);
  if (
    doc === null ||
    (doc as unknown as { householdId: Id<"households"> }).householdId !==
      householdId
  ) {
    throw new ConvexError(`${errorLabel} not found.`);
  }
  return doc as Doc<T>;
}

export async function findUser(ctx: AnyCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
}

export async function findUserAndMembership(ctx: AnyCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (user === null) return null;
  const membership = await ctx.db
    .query("householdMemberships")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .first();
  if (membership === null) return null;
  return { user, membership };
}

export async function getUserAndMembership(ctx: MutationCtx) {
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
    .unique();
  if (membership === null) {
    throw new ConvexError("You are not a member of a household.");
  }
  return { user, membership };
}
