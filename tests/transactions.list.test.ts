/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|list-test";
const MEMBER_TOKEN = "member|list-test";

describe("transactions.list", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed(ctx: any) {
    const householdId = await ctx.db.insert("households", {
      name: "List HH",
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerId = await ctx.db.insert("users", {
      tokenIdentifier: OWNER_TOKEN,
      clerkUserId: "clerk-owner-list",
    });
    const memberId = await ctx.db.insert("users", {
      tokenIdentifier: MEMBER_TOKEN,
      clerkUserId: "clerk-member-list",
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
    return { householdId, accountId, hiddenCatId, visibleCatId, ownerId };
  }

  it("returns null transactions for unauthenticated caller", async () => {
    const result = await t.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
    });
    expect(result.transactions).toBeNull();
  });

  it("owner receives all transactions in range", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => {
      const ids = await seed(ctx);
      const txns = [
        { categoryId: ids.hiddenCatId, note: "hidden-1", date: 100 },
        { categoryId: ids.visibleCatId, note: "visible-1", date: 200 },
      ];
      for (const tx of txns) {
        await ctx.db.insert("transactions", {
          householdId: ids.householdId,
          accountId: ids.accountId,
          categoryId: tx.categoryId,
          amount: -100,
          type: "expense",
          note: tx.note,
          date: tx.date,
          createdBy: ids.ownerId,
          updatedBy: ids.ownerId,
          createdAt: tx.date,
          updatedAt: tx.date,
        });
      }
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
    });
    expect(result.transactions!.length).toBe(2);
    expect(result.transactions!.map((tx) => tx.note)).toEqual(
      expect.arrayContaining(["hidden-1", "visible-1"]),
    );
  });

  it("respects the limit cap", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => {
      const ids = await seed(ctx);
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("transactions", {
          householdId: ids.householdId,
          accountId: ids.accountId,
          categoryId: ids.visibleCatId,
          amount: -100,
          type: "expense",
          note: `tx-${i}`,
          date: 100 + i,
          createdBy: ids.ownerId,
          updatedBy: ids.ownerId,
          createdAt: 100 + i,
          updatedAt: 100 + i,
        });
      }
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
    });
    expect(result.transactions!.length).toBe(2);
  });

  it("member sees only transactions with visible categories", async () => {
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    await t.run(async (ctx) => {
      const ids = await seed(ctx);
      const txns = [
        { categoryId: ids.hiddenCatId, note: "hidden-1", date: 100 },
        { categoryId: ids.visibleCatId, note: "visible-1", date: 200 },
        { categoryId: ids.visibleCatId, note: "visible-2", date: 300 },
      ];
      for (const tx of txns) {
        await ctx.db.insert("transactions", {
          householdId: ids.householdId,
          accountId: ids.accountId,
          categoryId: tx.categoryId,
          amount: -100,
          type: "expense",
          note: tx.note,
          date: tx.date,
          createdBy: ids.ownerId,
          updatedBy: ids.ownerId,
          createdAt: tx.date,
          updatedAt: tx.date,
        });
      }
    });
    const result = await member.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
    });
    expect(result.transactions!.length).toBe(2);
    expect(result.transactions!.map((tx) => tx.note)).toEqual(
      expect.arrayContaining(["visible-1", "visible-2"]),
    );
  });

  it("owner filters by account", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const bankId = await ctx.db.insert("accounts", {
        householdId: s.householdId,
        name: "Bank",
        type: "bank",
        balance: 0,
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.visibleCatId,
        amount: -100,
        type: "expense",
        note: "cash-tx",
        date: 100,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 100,
        updatedAt: 100,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: bankId,
        categoryId: s.visibleCatId,
        amount: -200,
        type: "expense",
        note: "bank-tx",
        date: 200,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 200,
        updatedAt: 200,
      });
      return { ...s, bankId };
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      accountId: ids.accountId,
    });
    expect(result.transactions!.length).toBe(1);
    expect(result.transactions![0].note).toBe("cash-tx");
  });

  it("owner filters by category and excludes transfers", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const toAccountId = await ctx.db.insert("accounts", {
        householdId: s.householdId,
        name: "Bank",
        type: "bank",
        balance: 0,
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.visibleCatId,
        amount: -100,
        type: "expense",
        note: "cat-expense",
        date: 100,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 100,
        updatedAt: 100,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.hiddenCatId,
        amount: -50,
        type: "expense",
        note: "hidden-expense",
        date: 150,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 150,
        updatedAt: 150,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        toAccountId,
        amount: 300,
        type: "transfer",
        note: "transfer-tx",
        date: 200,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 200,
        updatedAt: 200,
      });
      return { ...s, toAccountId };
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      categoryId: ids.visibleCatId,
    });
    expect(result.transactions!.length).toBe(1);
    expect(result.transactions![0].note).toBe("cat-expense");
  });

  it("owner filters by type", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.visibleCatId,
        amount: -100,
        type: "expense",
        note: "expense-tx",
        date: 100,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 100,
        updatedAt: 100,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.visibleCatId,
        amount: 50,
        type: "income",
        note: "income-tx",
        date: 200,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 200,
        updatedAt: 200,
      });
      return s;
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      type: "income",
    });
    expect(result.transactions!.length).toBe(1);
    expect(result.transactions![0].note).toBe("income-tx");
  });

  it("owner combines type and account filters", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const bankId = await ctx.db.insert("accounts", {
        householdId: s.householdId,
        name: "Bank",
        type: "bank",
        balance: 0,
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.visibleCatId,
        amount: -100,
        type: "expense",
        note: "cash-expense",
        date: 100,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 100,
        updatedAt: 100,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: bankId,
        categoryId: s.visibleCatId,
        amount: -200,
        type: "expense",
        note: "bank-expense",
        date: 200,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 200,
        updatedAt: 200,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: bankId,
        categoryId: s.visibleCatId,
        amount: 50,
        type: "income",
        note: "bank-income",
        date: 300,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 300,
        updatedAt: 300,
      });
      return { ...s, bankId };
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      type: "expense",
      accountId: ids.bankId,
    });
    expect(result.transactions!.length).toBe(1);
    expect(result.transactions![0].note).toBe("bank-expense");
  });

  it("owner intersects type, account, and category filters", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const bankId = await ctx.db.insert("accounts", {
        householdId: s.householdId,
        name: "Bank",
        type: "bank",
        balance: 0,
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const foodCatId = await ctx.db.insert("categories", {
        householdId: s.householdId,
        name: "Food",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const txns = [
        {
          accountId: s.accountId,
          categoryId: s.visibleCatId,
          type: "expense",
          note: "match",
          date: 100,
        },
        {
          accountId: s.accountId,
          categoryId: foodCatId,
          type: "expense",
          note: "wrong-category",
          date: 150,
        },
        {
          accountId: bankId,
          categoryId: s.visibleCatId,
          type: "expense",
          note: "wrong-account",
          date: 200,
        },
        {
          accountId: s.accountId,
          categoryId: s.visibleCatId,
          type: "income",
          note: "wrong-type",
          date: 250,
        },
      ];
      for (const tx of txns) {
        await ctx.db.insert("transactions", {
          householdId: s.householdId,
          accountId: tx.accountId,
          categoryId: tx.categoryId,
          amount: tx.type === "income" ? 50 : -100,
          type: tx.type,
          note: tx.note,
          date: tx.date,
          createdBy: s.ownerId,
          updatedBy: s.ownerId,
          createdAt: tx.date,
          updatedAt: tx.date,
        });
      }
      return { ...s, bankId, foodCatId };
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      type: "expense",
      accountId: ids.accountId,
      categoryId: ids.visibleCatId,
    });
    expect(result.transactions!.length).toBe(1);
    expect(result.transactions![0].note).toBe("match");
  });

  it("member filtering a hidden category returns empty", async () => {
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.hiddenCatId,
        amount: -100,
        type: "expense",
        note: "hidden-tx",
        date: 100,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 100,
        updatedAt: 100,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.visibleCatId,
        amount: -50,
        type: "expense",
        note: "visible-tx",
        date: 200,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 200,
        updatedAt: 200,
      });
      return s;
    });
    const result = await member.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      categoryId: ids.hiddenCatId,
    });
    expect(result.transactions!.length).toBe(0);
  });

  it("member filters by type", async () => {
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const incomeCatId = await ctx.db.insert("categories", {
        householdId: s.householdId,
        name: "Salary",
        type: "income",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.visibleCatId,
        amount: -100,
        type: "expense",
        note: "member-expense",
        date: 100,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 100,
        updatedAt: 100,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: incomeCatId,
        amount: 50,
        type: "income",
        note: "member-income",
        date: 200,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 200,
        updatedAt: 200,
      });
      return s;
    });
    const result = await member.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      type: "income",
    });
    expect(result.transactions!.length).toBe(1);
    expect(result.transactions![0].note).toBe("member-income");
  });

  it("member filters by account", async () => {
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const bankId = await ctx.db.insert("accounts", {
        householdId: s.householdId,
        name: "Bank",
        type: "bank",
        balance: 0,
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.visibleCatId,
        amount: -100,
        type: "expense",
        note: "member-cash-tx",
        date: 100,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 100,
        updatedAt: 100,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: bankId,
        categoryId: s.visibleCatId,
        amount: -200,
        type: "expense",
        note: "member-bank-tx",
        date: 200,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 200,
        updatedAt: 200,
      });
      return { ...s, bankId };
    });
    const result = await member.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      accountId: ids.accountId,
    });
    expect(result.transactions!.length).toBe(1);
    expect(result.transactions![0].note).toBe("member-cash-tx");
  });

  it("respects the limit cap after filtering", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("transactions", {
          householdId: s.householdId,
          accountId: s.accountId,
          categoryId: s.visibleCatId,
          amount: -100,
          type: "expense",
          note: `match-${i}`,
          date: 100 + i,
          createdBy: s.ownerId,
          updatedBy: s.ownerId,
          createdAt: 100 + i,
          updatedAt: 100 + i,
        });
      }
      return s;
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      type: "expense",
      limit: 2,
    });
    expect(result.transactions!.length).toBe(2);
  });
});
