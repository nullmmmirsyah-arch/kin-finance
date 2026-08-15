/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|invite-test";
const MEMBER_TOKEN = "member|invite-test";

describe("invitations.listActive", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed(ctx: any) {
    const householdId = await ctx.db.insert("households", {
      name: "Invite HH",
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerId = await ctx.db.insert("users", {
      tokenIdentifier: OWNER_TOKEN,
      clerkUserId: "clerk-owner-invite",
    });
    const memberId = await ctx.db.insert("users", {
      tokenIdentifier: MEMBER_TOKEN,
      clerkUserId: "clerk-member-invite",
    });
    await ctx.db.insert("householdMemberships", { householdId, userId: ownerId, role: "owner" });
    await ctx.db.insert("householdMemberships", { householdId, userId: memberId, role: "member" });
    const now = Date.now();
    const invitationId = await ctx.db.insert("invitations", {
      householdId,
      codeHash: "abc123",
      createdBy: ownerId,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000,
      maxUses: 1,
      useCount: 0,
      revoked: false,
      redemptionAttempts: 0,
      lastAttemptAt: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { householdId, invitationId };
  }

  it("owner sees active invitations", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { householdId } = await t.run(async (ctx) => seed(ctx));
    const result = await owner.query(api.invitations.listActive, { householdId });
    expect(result.length).toBe(1);
  });

  it("member in the same household gets no invitations", async () => {
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const { householdId } = await t.run(async (ctx) => seed(ctx));
    const result = await member.query(api.invitations.listActive, { householdId });
    expect(result).toEqual([]);
  });

  it("unauthenticated caller gets an empty array", async () => {
    const { householdId } = await t.run(async (ctx) => seed(ctx));
    const result = await t.query(api.invitations.listActive, { householdId });
    expect(result).toEqual([]);
  });
});
