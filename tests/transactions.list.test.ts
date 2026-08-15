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
});
