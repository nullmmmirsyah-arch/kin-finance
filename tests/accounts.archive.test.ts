/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|archive-test";
const MEMBER_TOKEN = "member|archive-test";

describe("accounts archive/unarchive", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed() {
    return await t.run(async (ctx) => {
      const householdId = await ctx.db.insert("households", {
        name: "Archive HH",
        createdAt: 1,
        updatedAt: 1,
      });
      const ownerId = await ctx.db.insert("users", {
        tokenIdentifier: OWNER_TOKEN,
        clerkUserId: "clerk-owner-archive",
      });
      const memberId = await ctx.db.insert("users", {
        tokenIdentifier: MEMBER_TOKEN,
        clerkUserId: "clerk-member-archive",
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
      const cashId = await ctx.db.insert("accounts", {
        householdId,
        name: "Cash",
        type: "asset",
        subType: "cash",
        balance: 0,
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      return { householdId, ownerId, memberId, cashId };
    });
  }

  it("owner archives an account; list splits active/archived", async () => {
    const { cashId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.accounts.archive, { accountId: cashId as any });
    const result = await owner.query(api.accounts.list, {});
    expect(result.accounts!.map((a) => a._id)).not.toContain(cashId);
    expect(result.archived!.map((a) => a._id)).toContain(cashId);
  });

  it("member cannot archive", async () => {
    const { cashId } = await seed();
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    await expect(
      member.mutation(api.accounts.archive, { accountId: cashId as any }),
    ).rejects.toThrow("You are not the owner of this household.");
  });

  it("unarchive restores to active list", async () => {
    const { cashId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.accounts.archive, { accountId: cashId as any });
    await owner.mutation(api.accounts.unarchive, { accountId: cashId as any });
    const result = await owner.query(api.accounts.list, {});
    expect(result.accounts!.map((a) => a._id)).toContain(cashId);
    expect(result.archived).toHaveLength(0);
  });

  it("legacy doc without isArchived reads as active", async () => {
    await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const result = await owner.query(api.accounts.list, {});
    expect(result.accounts!.length).toBe(1);
    expect(result.archived).toHaveLength(0);
  });

  it("member does not see archived+hidden accounts", async () => {
    const { cashId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.accounts.update, {
      accountId: cashId as any,
      hidden: true,
    });
    await owner.mutation(api.accounts.archive, { accountId: cashId as any });
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const result = await member.query(api.accounts.list, {});
    expect(result.accounts).toHaveLength(0);
    expect(result.archived).toHaveLength(0);
  });

  it("remove stays blocked for archived account with transactions", async () => {
    const { householdId, cashId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const foodId = await t.run(async (ctx) =>
      ctx.db.insert("categories", {
        householdId,
        name: "Food",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    await owner.mutation(api.transactions.create, {
      accountId: cashId as any,
      categoryId: foodId as any,
      amount: -100,
      type: "expense",
      date: Date.now(),
    });
    await owner.mutation(api.accounts.archive, { accountId: cashId as any });
    await expect(
      owner.mutation(api.accounts.remove, { accountId: cashId as any }),
    ).rejects.toThrow("Cannot delete account");
  });

  it("archived account without transactions can be deleted", async () => {
    const { cashId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.accounts.archive, { accountId: cashId as any });
    await owner.mutation(api.accounts.remove, { accountId: cashId as any });
    const result = await owner.query(api.accounts.list, {});
    expect(result.accounts).toHaveLength(0);
    expect(result.archived).toHaveLength(0);
  });
});
