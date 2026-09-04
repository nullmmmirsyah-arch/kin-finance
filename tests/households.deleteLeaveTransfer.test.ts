/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|hh-del-test";
const MEMBER_TOKEN = "member|hh-del-test";

describe("households delete/leave/transfer", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed(ctx: any) {
    const householdId = await ctx.db.insert("households", {
      name: "HH",
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerId = await ctx.db.insert("users", {
      tokenIdentifier: OWNER_TOKEN,
      clerkUserId: "c-owner",
    });
    const memberId = await ctx.db.insert("users", {
      tokenIdentifier: MEMBER_TOKEN,
      clerkUserId: "c-member",
    });
    await ctx.db.insert("householdMemberships", {
      householdId,
      userId: ownerId,
      role: "owner",
    });
    await ctx.db.insert("householdMemberships", {
      householdId,
      userId: memberId,
      role: "member",
    });
    const acc = await ctx.db.insert("accounts", {
      householdId,
      name: "Cash",
      type: "cash",
      balance: 0,
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const cat = await ctx.db.insert("categories", {
      householdId,
      name: "Food",
      type: "expense",
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("transactions", {
      householdId,
      accountId: acc,
      categoryId: cat,
      amount: -100,
      type: "expense",
      date: 1,
      createdBy: ownerId,
      updatedBy: ownerId,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("budgets", {
      householdId,
      categoryId: cat,
      periodStart: 1,
      amount: 1000,
      createdBy: ownerId,
      updatedBy: ownerId,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("periodBalances", {
      householdId,
      periodType: "monthly",
      periodStart: 1,
      periodEnd: 2,
      income: 0,
      expense: 100,
      openingBalance: 0,
      closingBalance: -100,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("invitations", {
      householdId,
      codeHash: "abc",
      createdBy: ownerId,
      expiresAt: Date.now() + 100000,
      maxUses: 1,
      useCount: 0,
      revoked: false,
      redemptionAttempts: 0,
      lastAttemptAt: 0,
      createdAt: 1,
      updatedAt: 1,
    });
    return { householdId, ownerId, memberId };
  }

  it("owner can hard delete cascade", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { householdId } = await t.run(async (ctx) => seed(ctx));
    await owner.mutation(api.households.deleteHousehold, { householdId });
    const counts = await t.run(async (ctx) => {
      return {
        hh: (await ctx.db.query("households").collect()).length,
        mem: (await ctx.db.query("householdMemberships").collect()).length,
        acc: (await ctx.db.query("accounts").collect()).length,
        cat: (await ctx.db.query("categories").collect()).length,
        tx: (await ctx.db.query("transactions").collect()).length,
        bud: (await ctx.db.query("budgets").collect()).length,
        per: (await ctx.db.query("periodBalances").collect()).length,
        inv: (await ctx.db.query("invitations").collect()).length,
      };
    });
    expect(counts).toEqual({ hh: 0, mem: 0, acc: 0, cat: 0, tx: 0, bud: 0, per: 0, inv: 0 });
  });

  it("member cannot delete household", async () => {
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const { householdId } = await t.run(async (ctx) => seed(ctx));
    await expect(member.mutation(api.households.deleteHousehold, { householdId })).rejects.toThrow();
  });

  it("member can leave (only own membership deleted)", async () => {
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const { householdId } = await t.run(async (ctx) => seed(ctx));
    await member.mutation(api.households.leaveHousehold, { householdId });
    const after = await t.run(async (ctx) => ({
      mem: (await ctx.db.query("householdMemberships").collect()).length,
      hh: (await ctx.db.query("households").collect()).length,
      tx: (await ctx.db.query("transactions").collect()).length,
    }));
    expect(after).toEqual({ mem: 1, hh: 1, tx: 1 });
    // member should have no membership now
    const memberMembership = await t.run(async (ctx: any) => {
      const users = await ctx.db.query("users").withIndex("by_tokenIdentifier", (q: any) => q.eq("tokenIdentifier", MEMBER_TOKEN)).unique();
      if (!users) return null;
      return await ctx.db.query("householdMemberships").withIndex("by_userId", (q: any) => q.eq("userId", users._id)).first();
    });
    expect(memberMembership).toBeNull();
  });

  it("owner cannot leave", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { householdId } = await t.run(async (ctx) => seed(ctx));
    await expect(owner.mutation(api.households.leaveHousehold, { householdId })).rejects.toThrow("Owners cannot leave");
  });

  it("transferOwnership swaps roles", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { householdId, memberId } = await t.run(async (ctx) => seed(ctx));
    await owner.mutation(api.households.transferOwnership, { householdId, newOwnerUserId: memberId });
    const roles = await t.run(async (ctx) => (await ctx.db.query("householdMemberships").collect()).map((m: any) => m.role).sort());
    expect(roles).toEqual(["member", "owner"]);
    // verify member now owner can delete
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    // member is now owner, should be able to transfer back or delete - test leave still blocked for new owner
    await expect(member.mutation(api.households.leaveHousehold, { householdId })).rejects.toThrow("Owners cannot leave");
  });

  it("transfer target not member throws", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { householdId } = await t.run(async (ctx) => seed(ctx));
    const outsiderId = await t.run(async (ctx) => await ctx.db.insert("users", { tokenIdentifier: "outsider", clerkUserId: "c-out" }));
    await expect(owner.mutation(api.households.transferOwnership, { householdId, newOwnerUserId: outsiderId as any })).rejects.toThrow();
  });

  it("member cannot transfer ownership", async () => {
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const { householdId, ownerId } = await t.run(async (ctx) => seed(ctx));
    await expect(member.mutation(api.households.transferOwnership, { householdId, newOwnerUserId: ownerId })).rejects.toThrow();
  });

  it("old owner can leave after transfer", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { householdId, memberId } = await t.run(async (ctx) => seed(ctx));
    await owner.mutation(api.households.transferOwnership, { householdId, newOwnerUserId: memberId });
    // old owner now member, can leave
    await owner.mutation(api.households.leaveHousehold, { householdId });
    const memCount = await t.run(async (ctx) => (await ctx.db.query("householdMemberships").collect()).length);
    expect(memCount).toBe(1);
  });
});
