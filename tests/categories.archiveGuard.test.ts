/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|catguard-test";

describe("category archived guards", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed() {
    return await t.run(async (ctx) => {
      const householdId = await ctx.db.insert("households", {
        name: "Guard HH",
        createdAt: 1,
        updatedAt: 1,
      });
      const ownerId = await ctx.db.insert("users", {
        tokenIdentifier: OWNER_TOKEN,
        clerkUserId: "clerk-owner-catguard",
      });
      await ctx.db.insert("householdMemberships", {
        householdId,
        userId: ownerId,
        role: "owner",
      });
      const foodId = await ctx.db.insert("categories", {
        householdId,
        name: "Food",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const salaryId = await ctx.db.insert("categories", {
        householdId,
        name: "Salary",
        type: "income",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const snacksId = await ctx.db.insert("categories", {
        householdId,
        name: "Snacks",
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
      return { householdId, ownerId, foodId, salaryId, snacksId, cashId };
    });
  }

  it("create expense on archived category is rejected", async () => {
    const { cashId, foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    await expect(
      owner.mutation(api.transactions.create, {
        accountId: cashId as any,
        categoryId: foodId as any,
        amount: -500,
        type: "expense",
        date: Date.now(),
      }),
    ).rejects.toThrow("This category is archived.");
  });

  it("update keeping the archived category is allowed", async () => {
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
    const updated = await owner.mutation(api.transactions.update, {
      transactionId: txId as any,
      note: "fixed note",
    });
    expect(updated!.note).toBe("fixed note");
  });

  it("update reassigning to an archived category is rejected", async () => {
    const { cashId, foodId, snacksId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const txId = await owner.mutation(api.transactions.create, {
      accountId: cashId as any,
      categoryId: foodId as any,
      amount: -500,
      type: "expense",
      date: Date.now(),
    });
    await owner.mutation(api.categories.archive, { categoryId: snacksId as any });
    await expect(
      owner.mutation(api.transactions.update, {
        transactionId: txId as any,
        categoryId: snacksId as any,
      }),
    ).rejects.toThrow("This category is archived.");
  });

  it("update reassigning archived -> active is allowed", async () => {
    const { cashId, foodId, snacksId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const txId = await owner.mutation(api.transactions.create, {
      accountId: cashId as any,
      categoryId: foodId as any,
      amount: -500,
      type: "expense",
      date: Date.now(),
    });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    const updated = await owner.mutation(api.transactions.update, {
      transactionId: txId as any,
      categoryId: snacksId as any,
    });
    expect(updated!.categoryId).toBe(snacksId);
  });

  it("budgets.categoryOptions excludes archived categories", async () => {
    const { foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    const options = await owner.query(api.budgets.categoryOptions, {});
    expect(options.map((o) => o._id)).not.toContain(foodId);
  });

  it("budgets.create on archived category is rejected", async () => {
    const { foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    await expect(
      owner.mutation(api.budgets.create, {
        categoryId: foodId as any,
        amount: 100000,
        periodStart: 1,
      }),
    ).rejects.toThrow("This category is archived.");
  });

  it("existing budget on newly-archived category still lists with progress", async () => {
    const { foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const periodStart = new Date("2026-09-01T00:00:00Z").getTime();
    await owner.mutation(api.budgets.create, {
      categoryId: foodId as any,
      amount: 100000,
      periodStart,
    });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    const result = await owner.query(api.budgets.list, {
      periodStart,
      periodEnd: periodStart + 30 * 86_400_000,
    });
    expect(result.budgets!.length).toBe(1);
    expect(result.budgets![0].category?.name).toBe("Food");
  });
});
