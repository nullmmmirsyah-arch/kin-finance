/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|auto-revoke-test";

describe("P0-1 invitations.create auto-revokes previous active invites", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
    process.env.INVITE_SECRET = "test-secret-for-auto-revoke-p0-1";
  });

  async function seedOwner(ctx: any) {
    const householdId = await ctx.db.insert("households", {
      name: "AutoRevoke HH",
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerId = await ctx.db.insert("users", {
      tokenIdentifier: OWNER_TOKEN,
      clerkUserId: "clerk-owner-auto-revoke",
    });
    await ctx.db.insert("householdMemberships", {
      householdId,
      userId: ownerId,
      role: "owner",
    });
    const now = Date.now();
    // Seed one active invitation manually (simulates previous code)
    const seedInviteId = await ctx.db.insert("invitations", {
      householdId,
      codeHash: "seedhash-active-1",
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
    return { householdId, ownerId, seedInviteId };
  }

  it("creating a new invite auto-revokes the previous active invite", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { householdId, seedInviteId } = await t.run(async (ctx) => seedOwner(ctx));

    // Verify seed invite is active before
    const before = await t.run(async (ctx) => ctx.db.get(seedInviteId));
    expect(before!.revoked).toBe(false);

    // Create new invite via mutation — should auto-revoke previous
    const result = await owner.mutation(api.invitations.create, {});
    expect(result.code).toBeDefined();
    expect(result.code.length).toBe(8);

    // Previous invite must now be revoked
    const after = await t.run(async (ctx) => ctx.db.get(seedInviteId));
    expect(after!.revoked).toBe(true);

    // New invite is active — listActive should return exactly 1 (the new one)
    const active = await owner.query(api.invitations.listActive, { householdId });
    expect(active.length).toBe(1);
    expect(active[0]._id).not.toBe(seedInviteId);

    // Revoked invite's code must fail on redeem
    // We can't redeem the old hash without knowing plaintext, but we verify
    // via DB state: revoked isolates it from listActive
  });

  it("multiple previous active invites are all revoked on new create", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { householdId } = await t.run(async (ctx) => {
      const base = await seedOwner(ctx);
      // Insert a second active invite
      const secondId = await ctx.db.insert("invitations", {
        householdId: base.householdId,
        codeHash: "seedhash-active-2",
        createdBy: base.ownerId,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxUses: 1,
        useCount: 0,
        revoked: false,
        redemptionAttempts: 0,
        lastAttemptAt: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { ...base, secondId };
    });

    await owner.mutation(api.invitations.create, {});

    const all = await t.run(async (ctx) => {
      const invites: any[] = [];
      for await (const inv of ctx.db.query("invitations")) invites.push(inv);
      return invites.filter((i) => i.householdId === householdId);
    });

    // Only the newly created invite should remain active
    const active = all.filter((i) => !i.revoked && i.expiresAt > Date.now() && i.useCount < i.maxUses);
    expect(active.length).toBe(1);

    const revokedCount = all.filter((i) => i.revoked).length;
    expect(revokedCount).toBe(2);
  });

  it("expired or already-revoked invites are left untouched (idempotent)", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { expiredId, expiredUpdatedAt, revokedId, revokedUpdatedAt } = await t.run(async (ctx) => {
      const base = await seedOwner(ctx);
      const expiredCreatedAt = Date.now();
      // Expired invite
      const expiredId = await ctx.db.insert("invitations", {
        householdId: base.householdId,
        codeHash: "seedhash-expired",
        createdBy: base.ownerId,
        expiresAt: Date.now() - 1000,
        maxUses: 1,
        useCount: 0,
        revoked: false,
        redemptionAttempts: 0,
        lastAttemptAt: 0,
        createdAt: expiredCreatedAt,
        updatedAt: expiredCreatedAt,
      });
      const revokedCreatedAt = Date.now();
      // Already revoked
      const revokedId = await ctx.db.insert("invitations", {
        householdId: base.householdId,
        codeHash: "seedhash-revoked",
        createdBy: base.ownerId,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxUses: 1,
        useCount: 0,
        revoked: true,
        redemptionAttempts: 0,
        lastAttemptAt: 0,
        createdAt: revokedCreatedAt,
        updatedAt: revokedCreatedAt,
      });
      const expiredDoc = await ctx.db.get(expiredId);
      const revokedDoc = await ctx.db.get(revokedId);
      return {
        expiredId,
        expiredUpdatedAt: expiredDoc!.updatedAt,
        revokedId,
        revokedUpdatedAt: revokedDoc!.updatedAt,
      };
    });

    await owner.mutation(api.invitations.create, {});

    // Expired remains unrevoked and both retain original updatedAt
    const expiredAfter = await t.run(async (ctx) => ctx.db.get(expiredId));
    const revokedAfter = await t.run(async (ctx) => ctx.db.get(revokedId));
    expect(expiredAfter!.revoked).toBe(false);
    expect(expiredAfter!.updatedAt).toBe(expiredUpdatedAt);
    expect(revokedAfter!.revoked).toBe(true);
    expect(revokedAfter!.updatedAt).toBe(revokedUpdatedAt);

    // New invite created successfully — the expired/revoked ones remain as-is (no double-revoke error)
    const active = await t.run(async (ctx) => {
      const all: any[] = [];
      for await (const inv of ctx.db.query("invitations")) {
        all.push(inv);
      }
      return all;
    });
    expect(active.length).toBeGreaterThanOrEqual(3);
  });
});
