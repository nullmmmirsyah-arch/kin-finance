/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|balance-test";

describe("transaction balance auto-update", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed(ctx: any) {
    const householdId = await ctx.db.insert("households", {
      name: "Balance HH",
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerId = await ctx.db.insert("users", {
      tokenIdentifier: OWNER_TOKEN,
      clerkUserId: "clerk-owner-balance",
    });
    await ctx.db.insert("householdMemberships", {
      householdId,
      userId: ownerId,
      role: "owner",
    });
    const cashId = await ctx.db.insert("accounts", {
      householdId,
      name: "Cash",
      type: "cash",
      balance: 100,
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const bankId = await ctx.db.insert("accounts", {
      householdId,
      name: "Bank",
      type: "bank",
      balance: 500,
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const expenseCatId = await ctx.db.insert("categories", {
      householdId,
      name: "Food",
      type: "expense",
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const incomeCatId = await ctx.db.insert("categories", {
      householdId,
      name: "Salary",
      type: "income",
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    return { householdId, ownerId, cashId, bankId, expenseCatId, incomeCatId };
  }

  it("create expense decrements the account balance", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => seed(ctx));

    await owner.mutation(api.transactions.create, {
      accountId: ids.cashId,
      categoryId: ids.expenseCatId,
      amount: -30,
      type: "expense",
      date: 100,
    });

    const account = await t.run((ctx) => ctx.db.get(ids.cashId));
    expect(account!.balance).toBe(70);
  });

  it("create income increments the account balance", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => seed(ctx));

    await owner.mutation(api.transactions.create, {
      accountId: ids.cashId,
      categoryId: ids.incomeCatId,
      amount: 50,
      type: "income",
      date: 100,
    });

    const account = await t.run((ctx) => ctx.db.get(ids.cashId));
    expect(account!.balance).toBe(150);
  });

  it("create transfer moves magnitude from source to destination", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => seed(ctx));

    await owner.mutation(api.transactions.create, {
      accountId: ids.cashId,
      toAccountId: ids.bankId,
      amount: 40,
      type: "transfer",
      date: 100,
    });

    const from = await t.run((ctx) => ctx.db.get(ids.cashId));
    const to = await t.run((ctx) => ctx.db.get(ids.bankId));
    expect(from!.balance).toBe(60);
    expect(to!.balance).toBe(540);
  });

  it("update reverses old balance then applies new (amount change)", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => seed(ctx));

    const txId = await owner.mutation(api.transactions.create, {
      accountId: ids.cashId,
      categoryId: ids.expenseCatId,
      amount: -30,
      type: "expense",
      date: 100,
    });
    // cash: 100 - 30 = 70

    await owner.mutation(api.transactions.update, {
      transactionId: txId,
      amount: -45,
    });
    // reverse old: 70 + 30 = 100, apply new: 100 - 45 = 55

    const account = await t.run((ctx) => ctx.db.get(ids.cashId));
    expect(account!.balance).toBe(55);
  });

  it("update that changes account moves balances across accounts", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => seed(ctx));

    const txId = await owner.mutation(api.transactions.create, {
      accountId: ids.cashId,
      categoryId: ids.expenseCatId,
      amount: -30,
      type: "expense",
      date: 100,
    });
    // cash: 70, bank: 500

    await owner.mutation(api.transactions.update, {
      transactionId: txId,
      accountId: ids.bankId,
      amount: -30,
    });
    // reverse old on cash: 70 + 30 = 100
    // apply new on bank: 500 - 30 = 470

    const cash = await t.run((ctx) => ctx.db.get(ids.cashId));
    const bank = await t.run((ctx) => ctx.db.get(ids.bankId));
    expect(cash!.balance).toBe(100);
    expect(bank!.balance).toBe(470);
  });

  it("delete reverses the balance", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => seed(ctx));

    const txId = await owner.mutation(api.transactions.create, {
      accountId: ids.cashId,
      categoryId: ids.expenseCatId,
      amount: -30,
      type: "expense",
      date: 100,
    });
    // cash: 70

    await owner.mutation(api.transactions.remove, {
      transactionId: txId,
    });
    // reverse: 70 + 30 = 100

    const account = await t.run((ctx) => ctx.db.get(ids.cashId));
    expect(account!.balance).toBe(100);
  });
});
