/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|archguard-test";

describe("transactions archived-account guard", () => {
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
        clerkUserId: "clerk-owner-guard",
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
      const bankId = await ctx.db.insert("accounts", {
        householdId,
        name: "Bank",
        type: "asset",
        subType: "bank",
        balance: 0,
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      return { householdId, ownerId, foodId, cashId, bankId };
    });
  }

  it("create expense on archived account is rejected", async () => {
    const { cashId, foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.accounts.archive, { accountId: cashId as any });
    await expect(
      owner.mutation(api.transactions.create, {
        accountId: cashId as any,
        categoryId: foodId as any,
        amount: -500,
        type: "expense",
        date: Date.now(),
      }),
    ).rejects.toThrow("This account is archived.");
  });

  it("create transfer to archived account is rejected", async () => {
    const { cashId, bankId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.accounts.archive, { accountId: bankId as any });
    await expect(
      owner.mutation(api.transactions.create, {
        accountId: cashId as any,
        toAccountId: bankId as any,
        amount: 100,
        type: "transfer",
        date: Date.now(),
      }),
    ).rejects.toThrow("This account is archived.");
  });

  it("update keeping the archived account is allowed", async () => {
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
    const updated = await owner.mutation(api.transactions.update, {
      transactionId: txId as any,
      note: "fixed note",
    });
    expect(updated!.note).toBe("fixed note");
  });

  it("update reassigning to an archived account is rejected", async () => {
    const { cashId, bankId, foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const txId = await owner.mutation(api.transactions.create, {
      accountId: cashId as any,
      categoryId: foodId as any,
      amount: -500,
      type: "expense",
      date: Date.now(),
    });
    await owner.mutation(api.accounts.archive, { accountId: bankId as any });
    await expect(
      owner.mutation(api.transactions.update, {
        transactionId: txId as any,
        accountId: bankId as any,
      }),
    ).rejects.toThrow("This account is archived.");
  });

  it("update reassigning archived -> active is allowed and fixes balances", async () => {
    const { cashId, bankId, foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const txId = await owner.mutation(api.transactions.create, {
      accountId: cashId as any,
      categoryId: foodId as any,
      amount: -500,
      type: "expense",
      date: Date.now(),
    });
    await owner.mutation(api.accounts.archive, { accountId: cashId as any });
    await owner.mutation(api.transactions.update, {
      transactionId: txId as any,
      accountId: bankId as any,
    });
    const list = await owner.query(api.accounts.list, {});
    // Cash archived → ada di `archived` (bukan `accounts`); Bank active.
    const cash = list.archived!.find((a) => a.name === "Cash")!;
    const bank = list.accounts!.find((a) => a.name === "Bank")!;
    expect(bank.balance).toBe(-500);
    expect(cash.balance).toBe(0);
  });
});
