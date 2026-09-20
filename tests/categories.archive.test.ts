/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|category-archive-test";
const MEMBER_TOKEN = "member|category-archive-test";

describe("categories archive/unarchive", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed() {
    return await t.run(async (ctx) => {
      const householdId = await ctx.db.insert("households", {
        name: "Category Archive HH",
        createdAt: 1,
        updatedAt: 1,
      });
      const ownerId = await ctx.db.insert("users", {
        tokenIdentifier: OWNER_TOKEN,
        clerkUserId: "clerk-owner-catarchive",
      });
      const memberId = await ctx.db.insert("users", {
        tokenIdentifier: MEMBER_TOKEN,
        clerkUserId: "clerk-member-catarchive",
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
      const foodId = await ctx.db.insert("categories", {
        householdId,
        name: "Food",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      return { householdId, ownerId, memberId, foodId };
    });
  }

  it("owner archives a category; list splits active/archived", async () => {
    const { foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    const result = await owner.query(api.categories.list, {});
    expect(result.categories!.map((c) => c._id)).not.toContain(foodId);
    expect(result.archived!.map((c) => c._id)).toContain(foodId);
  });

  it("member cannot archive", async () => {
    const { foodId } = await seed();
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    await expect(
      member.mutation(api.categories.archive, { categoryId: foodId as any }),
    ).rejects.toThrow("You are not the owner of this household.");
  });

  it("unarchive restores to active list", async () => {
    const { foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    await owner.mutation(api.categories.unarchive, { categoryId: foodId as any });
    const result = await owner.query(api.categories.list, {});
    expect(result.categories!.map((c) => c._id)).toContain(foodId);
    expect(result.archived).toHaveLength(0);
  });

  it("legacy doc without isArchived reads as active", async () => {
    await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const result = await owner.query(api.categories.list, {});
    expect(result.categories!.length).toBe(1);
    expect(result.archived).toHaveLength(0);
  });

  it("member does not see archived+hidden categories", async () => {
    const { foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.categories.update, {
      categoryId: foodId as any,
      hidden: true,
    });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const result = await member.query(api.categories.list, {});
    expect(result.categories).toHaveLength(0);
    expect(result.archived).toHaveLength(0);
  });

  it("member sees archived+visible categories in archived", async () => {
    const { foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const result = await member.query(api.categories.list, {});
    expect(result.categories).toHaveLength(0);
    expect(result.archived!.map((c) => c._id)).toContain(foodId);
  });

  it("remove stays blocked for archived category with transactions", async () => {
    const { householdId, foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const cashId = await t.run(async (ctx) =>
      ctx.db.insert("accounts", {
        householdId,
        name: "Cash",
        type: "asset",
        subType: "cash",
        balance: 0,
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
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    await expect(
      owner.mutation(api.categories.remove, { categoryId: foodId as any }),
    ).rejects.toThrow("Cannot delete category");
  });

  it("archived category without references can be deleted", async () => {
    const { foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    await owner.mutation(api.categories.remove, { categoryId: foodId as any });
    const result = await owner.query(api.categories.list, {});
    expect(result.categories).toHaveLength(0);
    expect(result.archived).toHaveLength(0);
  });
});
