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
      accountIds: [ids.accountId],
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
      categoryIds: [ids.visibleCatId],
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
      accountIds: [ids.bankId],
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
      accountIds: [ids.accountId],
      categoryIds: [ids.visibleCatId],
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
      categoryIds: [ids.hiddenCatId],
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
      accountIds: [ids.accountId],
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

  it("owner filters by multiple account ids", async () => {
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
      accountIds: [ids.accountId, ids.bankId],
    });
    expect(result.transactions!.length).toBe(2);
    expect(result.transactions!.map((t) => t.note).sort()).toEqual(["bank-tx", "cash-tx"]);
  });

  it("owner filters by multiple category ids", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const foodCatId = await ctx.db.insert("categories", {
        householdId: s.householdId,
        name: "Food",
        type: "expense",
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
        note: "vis-cat-tx",
        date: 100,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 100,
        updatedAt: 100,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: foodCatId,
        amount: -50,
        type: "expense",
        note: "food-tx",
        date: 200,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 200,
        updatedAt: 200,
      });
      return { ...s, foodCatId };
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      categoryIds: [ids.visibleCatId, ids.foodCatId],
    });
    expect(result.transactions!.length).toBe(2);
    expect(result.transactions!.map((t) => t.note).sort()).toEqual(["food-tx", "vis-cat-tx"]);
  });

  it("member filters by multiple account and category ids", async () => {
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
      const foodCatId = await ctx.db.insert("categories", {
        householdId: s.householdId,
        name: "Food",
        type: "expense",
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
        note: "match-1",
        date: 100,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 100,
        updatedAt: 100,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: bankId,
        categoryId: foodCatId,
        amount: -50,
        type: "expense",
        note: "match-2",
        date: 200,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 200,
        updatedAt: 200,
      });
      const gasCatId = await ctx.db.insert("categories", {
        householdId: s.householdId,
        name: "Gas",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: bankId,
        categoryId: gasCatId,
        amount: -30,
        type: "expense",
        note: "wrong-category",
        date: 300,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 300,
        updatedAt: 300,
      });
      return { ...s, bankId, foodCatId, gasCatId };
    });
    const result = await member.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      accountIds: [ids.accountId, ids.bankId],
      categoryIds: [ids.visibleCatId, ids.foodCatId],
    });
    expect(result.transactions!.length).toBe(2);
    expect(result.transactions!.map((t) => t.note).sort()).toEqual(["match-1", "match-2"]);
  });

  it("owner intersects type, multi-account, and multi-category filters", async () => {
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
      const creditId = await ctx.db.insert("accounts", {
        householdId: s.householdId,
        name: "Credit",
        type: "credit_card",
        balance: 0,
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const gasCatId = await ctx.db.insert("categories", {
        householdId: s.householdId,
        name: "Gas",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const txns = [
        {
          accountId: s.accountId,
          categoryId: s.visibleCatId,
          amount: -100,
          type: "expense",
          note: "match",
          date: 100,
        },
        {
          accountId: creditId,
          categoryId: s.visibleCatId,
          amount: -200,
          type: "expense",
          note: "wrong-account",
          date: 200,
        },
        {
          accountId: s.accountId,
          categoryId: gasCatId,
          amount: -50,
          type: "expense",
          note: "wrong-category",
          date: 300,
        },
        {
          accountId: s.accountId,
          categoryId: s.visibleCatId,
          amount: 60,
          type: "income",
          note: "wrong-type",
          date: 400,
        },
      ];
      for (const tx of txns) {
        await ctx.db.insert("transactions", {
          householdId: s.householdId,
          accountId: tx.accountId,
          categoryId: tx.categoryId,
          amount: tx.amount,
          type: tx.type,
          note: tx.note,
          date: tx.date,
          createdBy: s.ownerId,
          updatedBy: s.ownerId,
          createdAt: tx.date,
          updatedAt: tx.date,
        });
      }
      return { ...s, bankId, foodCatId, creditId, gasCatId };
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      type: "expense",
      accountIds: [ids.accountId, ids.bankId],
      categoryIds: [ids.visibleCatId, ids.foodCatId],
    });
    expect(result.transactions!.length).toBe(1);
    expect(result.transactions![0].note).toBe("match");
  });

  it("owner filters by category-pinned index with multi-account or filter", async () => {
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
          categoryId: foodCatId,
          amount: -100,
          type: "expense",
          note: "cash-food",
          date: 100,
        },
        {
          accountId: bankId,
          categoryId: foodCatId,
          amount: -200,
          type: "expense",
          note: "bank-food",
          date: 200,
        },
        {
          accountId: s.accountId,
          categoryId: s.visibleCatId,
          amount: -50,
          type: "expense",
          note: "cash-other",
          date: 300,
        },
      ];
      for (const tx of txns) {
        await ctx.db.insert("transactions", {
          householdId: s.householdId,
          accountId: tx.accountId,
          categoryId: tx.categoryId,
          amount: tx.amount,
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
      categoryIds: [ids.foodCatId],
      accountIds: [ids.accountId, ids.bankId],
    });
    expect(result.transactions!.length).toBe(2);
    expect(result.transactions!.map((t) => t.note)).toEqual(["bank-food", "cash-food"]);
  });

  it("owner excludes transfers under the category or-filter path", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const foodCatId = await ctx.db.insert("categories", {
        householdId: s.householdId,
        name: "Food",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
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
        categoryId: foodCatId,
        amount: -100,
        type: "expense",
        note: "food-tx",
        date: 100,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 100,
        updatedAt: 100,
      });
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        toAccountId: bankId,
        amount: 200,
        type: "transfer",
        note: "transfer-tx",
        date: 200,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 200,
        updatedAt: 200,
      });
      return { ...s, foodCatId, bankId };
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      categoryIds: [ids.visibleCatId, ids.foodCatId],
    });
    expect(result.transactions!.length).toBe(1);
    expect(result.transactions![0].note).toBe("food-tx");
  });

  it("treats empty accountIds/categoryIds arrays as no filter", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const ids = await t.run(async (ctx) => {
      const s = await seed(ctx);
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.visibleCatId,
        amount: -100,
        type: "expense",
        note: "first",
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
        note: "second",
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
      accountIds: [],
      categoryIds: [],
    });
    expect(result.transactions!.length).toBe(2);
    expect(result.transactions!.map((t) => t.note)).toEqual(["second", "first"]);
  });

  it("owner pages through all rows with cursor continuation", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("transactions", {
          householdId: s.householdId,
          accountId: s.accountId,
          categoryId: s.visibleCatId,
          amount: -100,
          type: "expense",
          note: `tx-${i}`,
          date: 100 + i,
          createdBy: s.ownerId,
          updatedBy: s.ownerId,
          createdAt: 100 + i,
          updatedAt: 100 + i,
        });
      }
    });
    const page1 = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
    });
    expect(page1.transactions!.map((tx) => tx.note)).toEqual(["tx-4", "tx-3"]);
    expect(page1.hasMore).toBe(true);
    expect(page1.cursor).toBeDefined();

    const page2 = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
      cursor: page1.cursor,
    });
    expect(page2.transactions!.map((tx) => tx.note)).toEqual(["tx-2", "tx-1"]);
    expect(page2.hasMore).toBe(true);
    expect(page2.cursor).toBeDefined();

    const page3 = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
      cursor: page2.cursor,
    });
    expect(page3.transactions!.map((tx) => tx.note)).toEqual(["tx-0"]);
    expect(page3.hasMore).toBe(false);
    expect(page3.cursor).toBeUndefined();
  });

  it("cursor continuation has no duplicates or gaps on tied dates", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      for (let i = 0; i < 4; i++) {
        await ctx.db.insert("transactions", {
          householdId: s.householdId,
          accountId: s.accountId,
          categoryId: s.visibleCatId,
          amount: -100,
          type: "expense",
          note: `tie-${i}`,
          date: 100,
          createdBy: s.ownerId,
          updatedBy: s.ownerId,
          createdAt: 100,
          updatedAt: 100,
        });
      }
    });
    const page1 = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
    });
    const page2 = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
      cursor: page1.cursor,
    });
    const all = [...page1.transactions!, ...page2.transactions!].map((tx) => tx.note);
    expect(new Set(all).size).toBe(4);
    expect(all.sort()).toEqual(["tie-0", "tie-1", "tie-2", "tie-3"]);
    expect(page2.hasMore).toBe(false);
  });

  it("reports hasMore=false when the range is exhausted below the limit", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      for (let i = 0; i < 2; i++) {
        await ctx.db.insert("transactions", {
          householdId: s.householdId,
          accountId: s.accountId,
          categoryId: s.visibleCatId,
          amount: -100,
          type: "expense",
          note: `few-${i}`,
          date: 100 + i,
          createdBy: s.ownerId,
          updatedBy: s.ownerId,
          createdAt: 100 + i,
          updatedAt: 100 + i,
        });
      }
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 5,
    });
    expect(result.transactions!.length).toBe(2);
    expect(result.hasMore).toBe(false);
    expect(result.cursor).toBeUndefined();
  });

  it("fills the page despite many non-matching rows (multi-account filter)", async () => {
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
      for (let i = 0; i < 6; i++) {
        await ctx.db.insert("transactions", {
          householdId: s.householdId,
          accountId: bankId,
          categoryId: s.visibleCatId,
          amount: -200,
          type: "expense",
          note: `bank-${i}`,
          date: 100 + i,
          createdBy: s.ownerId,
          updatedBy: s.ownerId,
          createdAt: 100 + i,
          updatedAt: 100 + i,
        });
      }
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("transactions", {
          householdId: s.householdId,
          accountId: s.accountId,
          categoryId: s.visibleCatId,
          amount: -100,
          type: "expense",
          note: `cash-${i}`,
          date: 300 + i,
          createdBy: s.ownerId,
          updatedBy: s.ownerId,
          createdAt: 300 + i,
          updatedAt: 300 + i,
        });
      }
      return { ...s, bankId };
    });
    const page1 = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
      accountIds: [ids.accountId],
    });
    expect(page1.transactions!.map((tx) => tx.note)).toEqual(["cash-2", "cash-1"]);
    expect(page1.hasMore).toBe(true);
    expect(page1.cursor).toBeDefined();

    const page2 = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
      accountIds: [ids.accountId],
      cursor: page1.cursor,
    });
    expect(page2.transactions!.map((tx) => tx.note)).toEqual(["cash-0"]);
    expect(page2.hasMore).toBe(false);
  });

  it("member pages past hidden-category rows without duplicates or gaps", async () => {
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      for (let i = 0; i < 6; i++) {
        await ctx.db.insert("transactions", {
          householdId: s.householdId,
          accountId: s.accountId,
          categoryId: i % 2 === 0 ? s.hiddenCatId : s.visibleCatId,
          amount: -100,
          type: "expense",
          note: `m-${i}`,
          date: 100 + i,
          createdBy: s.ownerId,
          updatedBy: s.ownerId,
          createdAt: 100 + i,
          updatedAt: 100 + i,
        });
      }
    });
    const page1 = await member.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
    });
    expect(page1.transactions!.map((tx) => tx.note)).toEqual(["m-5", "m-3"]);

    const page2 = await member.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
      limit: 2,
      cursor: page1.cursor,
    });
    expect(page2.transactions!.map((tx) => tx.note)).toEqual(["m-1"]);
    expect(page2.hasMore).toBe(false);
  });

  it("returns cursor and hasMore fields on the default (no-cursor) call", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      await ctx.db.insert("transactions", {
        householdId: s.householdId,
        accountId: s.accountId,
        categoryId: s.visibleCatId,
        amount: -100,
        type: "expense",
        note: "only",
        date: 100,
        createdBy: s.ownerId,
        updatedBy: s.ownerId,
        createdAt: 100,
        updatedAt: 100,
      });
    });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: 1_000_000_000_000,
    });
    expect(result.transactions!.length).toBe(1);
    expect(result.hasMore).toBe(false);
    expect(result.cursor).toBeUndefined();
  });

  it("pages through a single-date tie larger than the batch without losing rows", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => {
      const s = await seed(ctx);
      for (let i = 0; i < 10; i++) {
        await ctx.db.insert("transactions", {
          householdId: s.householdId,
          accountId: s.accountId,
          categoryId: s.visibleCatId,
          amount: -100,
          type: "expense",
          note: `tie-big-${i}`,
          date: 100,
          createdBy: s.ownerId,
          updatedBy: s.ownerId,
          createdAt: 100,
          updatedAt: 100,
        });
      }
    });
    const collected: string[] = [];
    let cursor: any = undefined;
    let hasMore = true;
    while (hasMore) {
      const page: any = await owner.query(api.transactions.list, {
        startDate: 0,
        endDate: 1_000_000_000_000,
        limit: 2,
        ...(cursor ? { cursor } : {}),
      });
      for (const tx of page.transactions!) collected.push(tx.note);
      hasMore = page.hasMore;
      cursor = page.cursor;
      if (collected.length > 20) break;
    }
    expect(new Set(collected).size).toBe(10);
    expect(collected.sort()).toEqual(
      Array.from({ length: 10 }, (_, i) => `tie-big-${i}`).sort(),
    );
  });
});
