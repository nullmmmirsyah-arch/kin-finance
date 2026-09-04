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

  it("owner can hard delete cascade — isolated to target household", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { householdId, householdId2 } = await t.run(async (ctx) => {
      const { householdId } = await seed(ctx);
      // second isolated household — should survive delete
      const householdId2 = await ctx.db.insert("households", {
        name: "HH2",
        createdAt: 1,
        updatedAt: 1,
      });
      const otherUser = await ctx.db.insert("users", {
        tokenIdentifier: "other|hh-iso",
        clerkUserId: "c-other-iso",
      });
      await ctx.db.insert("householdMemberships", {
        householdId: householdId2,
        userId: otherUser,
        role: "owner",
      });
      const acc2 = await ctx.db.insert("accounts", {
        householdId: householdId2,
        name: "Cash2",
        type: "cash",
        balance: 0,
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const cat2 = await ctx.db.insert("categories", {
        householdId: householdId2,
        name: "Food2",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("transactions", {
        householdId: householdId2,
        accountId: acc2,
        categoryId: cat2,
        amount: -50,
        type: "expense",
        date: 1,
        createdBy: otherUser,
        updatedBy: otherUser,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("budgets", {
        householdId: householdId2,
        categoryId: cat2,
        periodStart: 1,
        amount: 500,
        createdBy: otherUser,
        updatedBy: otherUser,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("periodBalances", {
        householdId: householdId2,
        periodType: "monthly",
        periodStart: 1,
        periodEnd: 2,
        income: 0,
        expense: 50,
        openingBalance: 0,
        closingBalance: -50,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("invitations", {
        householdId: householdId2,
        codeHash: "iso",
        createdBy: otherUser,
        expiresAt: Date.now() + 100000,
        maxUses: 1,
        useCount: 0,
        revoked: false,
        redemptionAttempts: 0,
        lastAttemptAt: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      return { householdId, householdId2 };
    });
    await owner.mutation(api.households.deleteHousehold, { householdId });
    const result = await t.run(async (ctx: any) => {
      const allHh = await ctx.db.query("households").collect();
      const allMem = await ctx.db.query("householdMemberships").collect();
      const allAcc = await ctx.db.query("accounts").collect();
      const allCat = await ctx.db.query("categories").collect();
      const allTx = await ctx.db.query("transactions").collect();
      const allBud = await ctx.db.query("budgets").collect();
      const allPer = await ctx.db.query("periodBalances").collect();
      const allInv = await ctx.db.query("invitations").collect();
      // verify target household records are gone
      const targetHh = await ctx.db.get(householdId);
      const targetAcc = allAcc.filter((a: any) => a.householdId === householdId);
      const isolatedHh = await ctx.db.get(householdId2);
      const isolatedAcc = allAcc.filter((a: any) => a.householdId === householdId2);
      return {
        counts: {
          hh: allHh.length,
          mem: allMem.length,
          acc: allAcc.length,
          cat: allCat.length,
          tx: allTx.length,
          bud: allBud.length,
          per: allPer.length,
          inv: allInv.length,
        },
        targetHh,
        targetAccLen: targetAcc.length,
        isolatedHhExists: isolatedHh !== null,
        isolatedAccLen: isolatedAcc.length,
      };
    });
    // global counts should be exactly the isolated household's 1-per-table
    expect(result.counts).toEqual({ hh: 1, mem: 1, acc: 1, cat: 1, tx: 1, bud: 1, per: 1, inv: 1 });
    expect(result.targetHh).toBeNull();
    expect(result.targetAccLen).toBe(0);
    expect(result.isolatedHhExists).toBe(true);
    expect(result.isolatedAccLen).toBe(1);
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
