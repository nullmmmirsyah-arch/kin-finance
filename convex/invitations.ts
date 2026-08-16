import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserAndMembership, findUserAndMembership, requireOwner, getScopedDoc } from "./helpers";
import { INVITE_CHARSET, INVITE_CODE_LENGTH } from "../constants/validation";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function generateCode(): string {
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => INVITE_CHARSET[b % INVITE_CHARSET.length]).join("");
}

async function hmacHash(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const { user, membership } = await getUserAndMembership(ctx);
    requireOwner(membership);

    const secret = process.env.INVITE_SECRET;
    if (!secret) {
      throw new ConvexError("Server configuration error.");
    }

    const now = Date.now();
    const expiresAt = now + SEVEN_DAYS_MS;

    let code: string;
    let codeHash: string;
    let attempts = 0;
    const MAX_RETRIES = 5;

    do {
      code = generateCode();
      codeHash = await hmacHash(code.toLowerCase(), secret);
      attempts++;

      const existing = await ctx.db
        .query("invitations")
        .withIndex("by_codeHash", (q) => q.eq("codeHash", codeHash!))
        .first();

      if (existing === null) {
        break;
      }

      if (attempts >= MAX_RETRIES) {
        throw new ConvexError("Failed to generate unique code. Please try again.");
      }
    } while (true);

    await ctx.db.insert("invitations", {
      householdId: membership.householdId,
      codeHash: codeHash!,
      createdBy: user._id,
      expiresAt,
      maxUses: 1,
      useCount: 0,
      revoked: false,
      redemptionAttempts: 0,
      lastAttemptAt: 0,
      createdAt: now,
      updatedAt: now,
    });

    return { code: code! };
  },
});

export const revoke = mutation({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);
    requireOwner(membership);

    const invitation = await getScopedDoc(ctx, args.invitationId, membership.householdId, "Invitation");

    await ctx.db.patch(args.invitationId, {
      revoked: true,
      updatedAt: Date.now(),
    });
  },
});

export const redeem = mutation({
  args: { code: v.string() },
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

    const existingMembership = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (existingMembership !== null) {
      throw new ConvexError("You are already a member of a household.");
    }

    const secret = process.env.INVITE_SECRET;
    if (!secret) {
      throw new ConvexError("Server configuration error.");
    }

    const normalizedCode = args.code.trim().toUpperCase();
    const codeHash = await hmacHash(normalizedCode.toLowerCase(), secret);

    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_codeHash", (q) => q.eq("codeHash", codeHash))
      .collect();

    if (invitations.length === 0) {
      throw new ConvexError("Invalid invite code.");
    }

    if (invitations.length > 1) {
      throw new ConvexError("Invalid invite code.");
    }

    const invitation = invitations[0];
    const now = Date.now();
    const ATTEMPT_WINDOW_MS = 60 * 1000;
    const MAX_ATTEMPTS = 5;

    if (
      invitation.lastAttemptAt > now - ATTEMPT_WINDOW_MS &&
      invitation.redemptionAttempts >= MAX_ATTEMPTS
    ) {
      await ctx.db.patch(invitation._id, {
        redemptionAttempts: invitation.redemptionAttempts + 1,
        lastAttemptAt: now,
        updatedAt: now,
      });
      throw new ConvexError(
        "Too many attempts. Please try again later.",
      );
    }

    const resetCounter =
      invitation.lastAttemptAt <= now - ATTEMPT_WINDOW_MS;
    await ctx.db.patch(invitation._id, {
      redemptionAttempts: resetCounter
        ? 1
        : invitation.redemptionAttempts + 1,
      lastAttemptAt: now,
      updatedAt: now,
    });

    if (invitation.expiresAt < now) {
      throw new ConvexError("This invite code has expired.");
    }

    if (invitation.revoked) {
      throw new ConvexError("This invite code has been revoked.");
    }

    if (invitation.useCount >= invitation.maxUses) {
      throw new ConvexError("This invite code has already been used.");
    }

    await ctx.db.insert("householdMemberships", {
      householdId: invitation.householdId,
      userId: user._id,
      role: "member",
    });

    await ctx.db.patch(invitation._id, {
      useCount: invitation.useCount + 1,
      updatedAt: now,
    });
  },
});

export const listActive = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const result = await findUserAndMembership(ctx);
    if (
      result === null ||
      result.membership.householdId !== args.householdId
    ) {
      return [];
    }
    if (result.membership.role !== "owner") {
      return [];
    }

    const now = Date.now();
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", args.householdId),
      )
      .collect();

    return invitations.filter(
      (inv) =>
        !inv.revoked &&
        inv.expiresAt > now &&
        inv.useCount < inv.maxUses,
    );
  },
});
