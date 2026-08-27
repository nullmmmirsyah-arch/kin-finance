/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|search-test";
const MEMBER_TOKEN = "member|search-test";

describe("transactions.search", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function setupHousehold() {
    return await t.run(async (ctx) => {
      const householdId = await ctx.db.insert("households", {
        name: "Search Household",
        createdAt: 1,
        updatedAt: 1,
      });
      const ownerId = await ctx.db.insert("users", {
        tokenIdentifier: OWNER_TOKEN,
        clerkUserId: "clerk-owner-search",
      });
      await ctx.db.insert("users", {
        tokenIdentifier: MEMBER_TOKEN,
        clerkUserId: "clerk-member-search",
      });
      await ctx.db.insert("householdMemberships", {
        householdId,
        userId: ownerId,
        role: "owner",
      });
      const allUsers = await ctx.db.query("users").collect();
      const memberUser = allUsers.find((u) => u.tokenIdentifier === MEMBER_TOKEN)!;
      await ctx.db.insert("householdMemberships", {
        householdId,
        userId: memberUser._id,
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
      const visibleCategoryId = await ctx.db.insert("categories", {
        householdId,
        name: "Food",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const hiddenCategoryId = await ctx.db.insert("categories", {
        householdId,
        name: "Hidden Food",
        type: "expense",
        hidden: true,
        createdAt: 1,
        updatedAt: 1,
      });
      const now = 1_000_000_000_000;
      await ctx.db.insert("transactions", {
        householdId,
        accountId,
        categoryId: visibleCategoryId,
        amount: -5000,
        type: "expense",
        note: "Lunch with team",
        date: now,
        createdBy: ownerId,
        updatedBy: ownerId,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("transactions", {
        householdId,
        accountId,
        categoryId: visibleCategoryId,
        amount: -2000,
        type: "expense",
        note: "Grocery shopping",
        date: now - 1000,
        createdBy: ownerId,
        updatedBy: ownerId,
        createdAt: now - 1000,
        updatedAt: now - 1000,
      });
      await ctx.db.insert("transactions", {
        householdId,
        accountId,
        categoryId: hiddenCategoryId,
        amount: -3000,
        type: "expense",
        note: "Lunch hidden",
        date: now - 2000,
        createdBy: ownerId,
        updatedBy: ownerId,
        createdAt: now - 2000,
        updatedAt: now - 2000,
      });
      return { now };
    });
  }

  it("filters by note substring case-insensitive", async () => {
    const { now } = await setupHousehold();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: now + 10000,
      search: "lunc",
    });
    expect(result.transactions!.length).toBe(2); // Lunch with team + Lunch hidden (owner sees hidden)
    for (const tx of result.transactions!) {
      expect(tx.note!.toLowerCase()).toContain("lunc");
    }
  });

  it("min 2 chars — 1 char treated as no filter", async () => {
    const { now } = await setupHousehold();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const result = await owner.query(api.transactions.list, {
      startDate: 0,
      endDate: now + 10000,
      search: "L",
    });
    expect(result.transactions!.length).toBe(3);
  });

  it("member excludes hidden notes from search", async () => {
    const { now } = await setupHousehold();
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const result = await member.query(api.transactions.list, {
      startDate: 0,
      endDate: now + 10000,
      search: "lunc",
    });
    expect(result.transactions!.length).toBe(1);
    expect(result.transactions![0].note).toBe("Lunch with team");
  });

  it("summary respects search filter", async () => {
    const { now } = await setupHousehold();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const summary = await owner.query(api.transactions.summary, {
      startDate: 0,
      endDate: now + 10000,
      search: "grocery",
    });
    expect(summary!.expense).toBe(2000);
    expect(summary!.income).toBe(0);
  });

  it("summary with no match returns zeros", async () => {
    const { now } = await setupHousehold();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const summary = await owner.query(api.transactions.summary, {
      startDate: 0,
      endDate: now + 10000,
      search: "nonexistent",
    });
    expect(summary!.expense).toBe(0);
    expect(summary!.net).toBe(0);
  });
});
