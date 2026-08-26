/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|summary-test";
const MEMBER_TOKEN = "member|summary-test";

describe("transactions.summary", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed(ctx: any) {
    const householdId = await ctx.db.insert("households", {
      name: "Summary HH",
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerId = await ctx.db.insert("users", {
      tokenIdentifier: OWNER_TOKEN,
      clerkUserId: "clerk-owner-summary",
    });
    const memberId = await ctx.db.insert("users", {
      tokenIdentifier: MEMBER_TOKEN,
      clerkUserId: "clerk-member-summary",
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
    const accountId = await ctx.db.insert("accounts", {
      householdId,
      name: "Cash",
      type: "cash",
      balance: 0,
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const bankId = await ctx.db.insert("accounts", {
      householdId,
      name: "Bank",
      type: "bank",
      balance: 0,
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const hiddenCatId = await ctx.db.insert("categories", {
      householdId,
      name: "Hidden Cat",
      type: "expense",
      hidden: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const visibleCatId = await ctx.db.insert("categories", {
      householdId,
      name: "Visible Cat",
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
    return {
      householdId,
      accountId,
      bankId,
      hiddenCatId,
      visibleCatId,
      incomeCatId,
      ownerId,
    };
  }

  async function insertTx(ctx: any, s: any, overrides: Record<string, unknown>) {
    await ctx.db.insert("transactions", {
      householdId: s.householdId,
      accountId: s.accountId,
      categoryId: s.visibleCatId,
      amount: -100,
      type: "expense",
      note: undefined,
      date: 100,
      createdBy: s.ownerId,
      updatedBy: s.ownerId,
      createdAt: 100,
      updatedAt: 100,
      ...overrides,
    });
  }

  it("returns null for an unauthenticated caller", async () => {
    const result = await t.query(api.transactions.summary, {
      startDate: 0,
      endDate: 1_000_000_000_000,
    });
    expect(result).toBeNull();
  });

  it("sums income, expense, and net over the full range; excludes transfers", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      await insertTx(ctx, s, { amount: 500, type: "income", categoryId: s.incomeCatId, date: 100 });
      await insertTx(ctx, s, { amount: -200, type: "expense", date: 200 });
      await insertTx(ctx, s, { amount: -50, type: "expense", date: 300 });
      await insertTx(ctx, s, {
        amount: 75,
        type: "transfer",
        toAccountId: s.bankId,
        categoryId: undefined,
        date: 400,
      });
    });
    const result = await owner.query(api.transactions.summary, {
      startDate: 0,
      endDate: 1_000_000_000_000,
    });
    expect(result).toEqual({ income: 500, expense: 250, net: 250 });
  });

  it("covers the entire range beyond any row cap", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      for (let i = 0; i < 30; i++) {
        await insertTx(ctx, s, { amount: -10, type: "expense", date: 100 + i });
      }
    });
    const result = await owner.query(api.transactions.summary, {
      startDate: 0,
      endDate: 1_000_000_000_000,
    });
    expect(result).toEqual({ income: 0, expense: 300, net: -300 });
  });

  it("member excludes hidden-category transactions", async () => {
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      await insertTx(ctx, s, { amount: -80, type: "expense", categoryId: s.hiddenCatId, date: 100 });
      await insertTx(ctx, s, { amount: -20, type: "expense", categoryId: s.visibleCatId, date: 200 });
      await insertTx(ctx, s, { amount: 90, type: "income", categoryId: s.incomeCatId, date: 300 });
    });
    const result = await member.query(api.transactions.summary, {
      startDate: 0,
      endDate: 1_000_000_000_000,
    });
    expect(result).toEqual({ income: 90, expense: 20, net: 70 });
  });

  it("applies type, account, and category filters like list", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      await insertTx(ctx, s, { amount: 100, type: "income", categoryId: s.incomeCatId, date: 100 });
      await insertTx(ctx, s, { amount: -40, type: "expense", date: 200, accountId: s.bankId });
      await insertTx(ctx, s, { amount: -60, type: "expense", date: 300 });
      return s;
    });
    const byType = await owner.query(api.transactions.summary, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      type: "expense",
    });
    expect(byType).toEqual({ income: 0, expense: 100, net: -100 });

    const byAccount = await owner.query(api.transactions.summary, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      accountIds: [ids.bankId],
    });
    expect(byAccount).toEqual({ income: 0, expense: 40, net: -40 });

    const byEmptyArrays = await owner.query(api.transactions.summary, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      accountIds: [],
      categoryIds: [],
    });
    expect(byEmptyArrays).toEqual({ income: 100, expense: 100, net: 0 });
  });

  it("returns zeros for an empty range", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      await insertTx(ctx, s, { amount: -100, type: "expense", date: 500 });
    });
    const result = await owner.query(api.transactions.summary, {
      startDate: 0,
      endDate: 400,
    });
    expect(result).toEqual({ income: 0, expense: 0, net: 0 });
  });
});
