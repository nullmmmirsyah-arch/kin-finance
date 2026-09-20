/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|restore-test";
const MEMBER_TOKEN = "member|restore-test";

describe("transactions restore (undo flow)", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed() {
    return await t.run(async (ctx) => {
      const householdId = await ctx.db.insert("households", {
        name: "Restore HH",
        createdAt: 1,
        updatedAt: 1,
      });
      const ownerId = await ctx.db.insert("users", {
        tokenIdentifier: OWNER_TOKEN,
        clerkUserId: "clerk-owner-restore",
      });
      const memberId = await ctx.db.insert("users", {
        tokenIdentifier: MEMBER_TOKEN,
        clerkUserId: "clerk-member-restore",
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
      const otherHouseholdId = await ctx.db.insert("households", {
        name: "Other HH",
        createdAt: 1,
        updatedAt: 1,
      });
      const foreignFoodId = await ctx.db.insert("categories", {
        householdId: otherHouseholdId,
        name: "Food",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      return { householdId, ownerId, memberId, foodId, cashId, foreignFoodId };
    });
  }

  it("owner restores a deleted transaction on an archived category", async () => {
    const { cashId, foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const txId = await owner.mutation(api.transactions.create, {
      accountId: cashId as any,
      categoryId: foodId as any,
      amount: -500,
      type: "expense",
      date: Date.now(),
    });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    await owner.mutation(api.transactions.remove, { transactionId: txId as any });
    const restoredId = await owner.mutation(api.transactions.restore, {
      accountId: cashId as any,
      categoryId: foodId as any,
      amount: -500,
      type: "expense",
      date: Date.now(),
    });
    expect(restoredId).toBeDefined();
    const list = await owner.query(api.accounts.list, {});
    const cash = [...list.accounts!, ...list.archived!].find((a) => a.name === "Cash")!;
    expect(cash.balance).toBe(-500);
  });

  it("owner restores a deleted transaction on an archived account", async () => {
    const { cashId, foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const txId = await owner.mutation(api.transactions.create, {
      accountId: cashId as any,
      categoryId: foodId as any,
      amount: -500,
      type: "expense",
      date: Date.now(),
    });
    await owner.mutation(api.accounts.archive, { accountId: cashId as any });
    await owner.mutation(api.transactions.remove, { transactionId: txId as any });
    const restoredId = await owner.mutation(api.transactions.restore, {
      accountId: cashId as any,
      categoryId: foodId as any,
      amount: -500,
      type: "expense",
      date: Date.now(),
    });
    expect(restoredId).toBeDefined();
  });

  it("restore rejects a cross-household category", async () => {
    const { cashId, foreignFoodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await expect(
      owner.mutation(api.transactions.restore, {
        accountId: cashId as any,
        categoryId: foreignFoodId as any,
        amount: -500,
        type: "expense",
        date: Date.now(),
      }),
    ).rejects.toThrow("Category not found.");
  });

  it("restore rejects a type-mismatched category", async () => {
    const { cashId, foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await expect(
      owner.mutation(api.transactions.restore, {
        accountId: cashId as any,
        categoryId: foodId as any,
        amount: 500,
        type: "income",
        date: Date.now(),
      }),
    ).rejects.toThrow("Category type must match transaction type.");
  });

  it("member restore on a hidden category is rejected", async () => {
    const { cashId, foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.categories.update, {
      categoryId: foodId as any,
      hidden: true,
    });
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    await expect(
      member.mutation(api.transactions.restore, {
        accountId: cashId as any,
        categoryId: foodId as any,
        amount: -500,
        type: "expense",
        date: Date.now(),
      }),
    ).rejects.toThrow("You cannot create transactions on a hidden category.");
  });
});
