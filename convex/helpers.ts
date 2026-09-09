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

async function findUserRow(ctx: AnyCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
}

async function membershipsOf(ctx: AnyCtx, userId: Id<"users">) {
  return await ctx.db
    .query("householdMemberships")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
}

async function resolveActive(
  ctx: AnyCtx,
  user: Doc<"users">,
  memberships: Doc<"householdMemberships">[],
): Promise<Doc<"householdMemberships"> | null> {
  if (memberships.length === 0) return null;
  const activeId = (user as { activeHouseholdId?: Id<"households"> }).activeHouseholdId;
  if (activeId !== undefined) {
    const hit = memberships.find((m) => m.householdId === activeId);
    if (hit !== undefined) return hit;
  }
  const withDates = await Promise.all(
    memberships.map(async (m) => ({
      m,
      createdAt: (await ctx.db.get(m.householdId))?.createdAt ?? Number.MAX_SAFE_INTEGER,
    })),
  );
  withDates.sort((a, b) => a.createdAt - b.createdAt);
  return withDates[0].m;
}

export async function findUserAndMembership(ctx: AnyCtx, householdId?: Id<"households">) {
  const user = await findUserRow(ctx);
  if (user === null) return null;
  const memberships = await membershipsOf(ctx, user._id);
  if (householdId !== undefined) {
    const membership = memberships.find((m) => m.householdId === householdId) ?? null;
    if (membership === null) return null;
    return { user, membership };
  }
  const membership = await resolveActive(ctx, user, memberships);
  if (membership === null) return null;
  return { user, membership };
}

export async function getUserAndMembership(ctx: MutationCtx, householdId?: Id<"households">) {
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
  const memberships = await membershipsOf(ctx, user._id);
  if (householdId !== undefined) {
    const membership = memberships.find((m) => m.householdId === householdId);
    if (membership === undefined) {
      throw new ConvexError("You are not a member of this household.");
    }
    return { user, membership };
  }
  const membership = await resolveActive(ctx, user, memberships);
  if (membership === null) {
    throw new ConvexError("You are not a member of a household.");
  }
  return { user, membership };
}
