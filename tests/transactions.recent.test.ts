/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|test-user";
const MEMBER_TOKEN = "member|test-user";

describe("transactions.recent", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  it("non-owner collects limit visible transactions past hidden-category pages", async () => {
    const owner = t.withIdentity({
      tokenIdentifier: OWNER_TOKEN,
      subject: "owner",
    });
    const member = t.withIdentity({
      tokenIdentifier: MEMBER_TOKEN,
      subject: "member",
    });

    const { accountId, hiddenCategoryId, visibleCategoryId, ownerId } =
      await t.run(async (ctx) => {
        const householdId = await ctx.db.insert("households", {
          name: "Test Household",
          createdAt: 1,
          updatedAt: 1,
        });
        const ownerId = await ctx.db.insert("users", {
          tokenIdentifier: OWNER_TOKEN,
          clerkUserId: "clerk-owner",
        });
        await ctx.db.insert("users", {
          tokenIdentifier: MEMBER_TOKEN,
          clerkUserId: "clerk-member",
        });
        await ctx.db.insert("householdMemberships", {
          householdId,
          userId: ownerId,
          role: "owner",
        });
        const allUsers = await ctx.db.query("users").collect();
        const memberUser = allUsers.find(
          (u) => u.tokenIdentifier === MEMBER_TOKEN,
        );
        if (memberUser === undefined) throw new Error("member user not found");
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
        const hiddenCategoryId = await ctx.db.insert("categories", {
          householdId,
          name: "Hidden Category",
          type: "expense",
          hidden: true,
          createdAt: 1,
          updatedAt: 1,
        });
        const visibleCategoryId = await ctx.db.insert("categories", {
          householdId,
          name: "Visible Category",
          type: "expense",
          hidden: false,
          createdAt: 1,
          updatedAt: 1,
        });

        const now = 1_000_000_000_000;

        for (let i = 0; i < 21; i++) {
          await ctx.db.insert("transactions", {
            householdId,
            accountId,
            categoryId: hiddenCategoryId,
            amount: -100,
            type: "expense",
            note: `hidden-${i}`,
            date: now + i * 1000,
            createdBy: ownerId,
            updatedBy: ownerId,
            createdAt: now + i * 1000,
            updatedAt: now + i * 1000,
          });
        }

        for (let j = 0; j < 5; j++) {
          await ctx.db.insert("transactions", {
            householdId,
            accountId,
            categoryId: visibleCategoryId,
            amount: -50,
            type: "expense",
            note: `visible-${j}`,
            date: now - 10_000_000 - j * 1000,
            createdBy: ownerId,
            updatedBy: ownerId,
            createdAt: now - 10_000_000 - j * 1000,
            updatedAt: now - 10_000_000 - j * 1000,
          });
        }

        return { accountId, hiddenCategoryId, visibleCategoryId, ownerId };
      });

    const result = await member.query(api.transactions.recent, { limit: 5 });
    expect(result.transactions).not.toBeNull();
    expect(result.transactions!.length).toBe(5);

    for (const tx of result.transactions!) {
      expect(tx.category?.name).toBe("Visible Category");
      expect(tx.note).toMatch(/^visible-/);
    }

    expect(result.transactions!.map((tx) => tx.note)).toEqual([
      "visible-0",
      "visible-1",
      "visible-2",
      "visible-3",
      "visible-4",
    ]);

    const ownerResult = await owner.query(api.transactions.recent, {
      limit: 5,
    });
    expect(ownerResult.transactions).not.toBeNull();
    expect(ownerResult.transactions!.length).toBe(5);

    expect(ownerResult.transactions!.map((tx) => tx.note)).toEqual([
      "hidden-20",
      "hidden-19",
      "hidden-18",
      "hidden-17",
      "hidden-16",
    ]);

    for (const tx of ownerResult.transactions!) {
      expect(tx.category?.name).toBe("Hidden Category");
    }
  });

  it("returns null transactions for unauthenticated caller", async () => {
    const result = await t.query(api.transactions.recent, { limit: 5 });
    expect(result.transactions).toBeNull();
  });

  it("exhausts scan budget and returns cursor for continuation", async () => {
    const member = t.withIdentity({
      tokenIdentifier: MEMBER_TOKEN,
      subject: "member",
    });

    await t.run(async (ctx) => {
      const householdId = await ctx.db.insert("households", {
        name: "Budget Test Household",
        createdAt: 1,
        updatedAt: 1,
      });
      const ownerId = await ctx.db.insert("users", {
        tokenIdentifier: OWNER_TOKEN,
        clerkUserId: "clerk-owner-budget",
      });
      await ctx.db.insert("users", {
        tokenIdentifier: MEMBER_TOKEN,
        clerkUserId: "clerk-member-budget",
      });
      await ctx.db.insert("householdMemberships", {
        householdId,
        userId: ownerId,
        role: "owner",
      });
      const allUsers = await ctx.db.query("users").collect();
      const memberUser = allUsers.find(
        (u) => u.tokenIdentifier === MEMBER_TOKEN,
      );
      if (memberUser === undefined) throw new Error("member user not found");
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
      const hiddenCategoryId = await ctx.db.insert("categories", {
        householdId,
        name: "Hidden",
        type: "expense",
        hidden: true,
        createdAt: 1,
        updatedAt: 1,
      });
      const visibleCategoryId = await ctx.db.insert("categories", {
        householdId,
        name: "Visible",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });

      for (let i = 0; i < 60; i++) {
        await ctx.db.insert("transactions", {
          householdId,
          accountId,
          categoryId: hiddenCategoryId,
          amount: -100,
          type: "expense",
          note: `hidden-${i}`,
          date: 1000 + i,
          createdBy: ownerId,
          updatedBy: ownerId,
          createdAt: 1000 + i,
          updatedAt: 1000 + i,
        });
      }
      for (let j = 0; j < 5; j++) {
        await ctx.db.insert("transactions", {
          householdId,
          accountId,
          categoryId: visibleCategoryId,
          amount: -50,
          type: "expense",
          note: `visible-${j}`,
          date: 100 + j,
          createdBy: ownerId,
          updatedBy: ownerId,
          createdAt: 100 + j,
          updatedAt: 100 + j,
        });
      }
    });

    const first = await member.query(api.transactions.recent, { limit: 5 });
    expect(first.transactions!.length).toBe(0);
    expect(first.cursor).toBeDefined();
    expect(first.cursor!.date).toBe(1012);
    expect(first.cursor!.id).toBeDefined();

    const second = await member.query(api.transactions.recent, {
      limit: 5,
      cursor: first.cursor!,
    });
    expect(second.transactions!.length).toBe(5);
    expect(second.cursor).toBeUndefined();
    expect(second.transactions!.map((tx) => tx.note)).toEqual([
      "visible-4",
      "visible-3",
      "visible-2",
      "visible-1",
      "visible-0",
    ]);
  });

  it("paginates past >limit*4 same-date hidden rows without losing visible transactions", async () => {
    const member = t.withIdentity({
      tokenIdentifier: MEMBER_TOKEN,
      subject: "member",
    });

    await t.run(async (ctx) => {
      const householdId = await ctx.db.insert("households", {
        name: "Same-Date Household",
        createdAt: 1,
        updatedAt: 1,
      });
      const ownerId = await ctx.db.insert("users", {
        tokenIdentifier: OWNER_TOKEN,
        clerkUserId: "clerk-owner-samedate",
      });
      await ctx.db.insert("users", {
        tokenIdentifier: MEMBER_TOKEN,
        clerkUserId: "clerk-member-samedate",
      });
      await ctx.db.insert("householdMemberships", {
        householdId,
        userId: ownerId,
        role: "owner",
      });
      const allUsers = await ctx.db.query("users").collect();
      const memberUser = allUsers.find(
        (u) => u.tokenIdentifier === MEMBER_TOKEN,
      );
      if (memberUser === undefined) throw new Error("member user not found");
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
      const hiddenCategoryId = await ctx.db.insert("categories", {
        householdId,
        name: "Hidden",
        type: "expense",
        hidden: true,
        createdAt: 1,
        updatedAt: 1,
      });
      const visibleCategoryId = await ctx.db.insert("categories", {
        householdId,
        name: "Visible",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });

      for (let i = 0; i < 50; i++) {
        await ctx.db.insert("transactions", {
          householdId,
          accountId,
          categoryId: hiddenCategoryId,
          amount: -100,
          type: "expense",
          note: `same-date-hidden-${i}`,
          date: 1000,
          createdBy: ownerId,
          updatedBy: ownerId,
          createdAt: 1000,
          updatedAt: 1000,
        });
      }
      for (let i = 0; i < 30; i++) {
        await ctx.db.insert("transactions", {
          householdId,
          accountId,
          categoryId: hiddenCategoryId,
          amount: -100,
          type: "expense",
          note: `mid-hidden-${i}`,
          date: 900,
          createdBy: ownerId,
          updatedBy: ownerId,
          createdAt: 900,
          updatedAt: 900,
        });
      }
      for (let j = 0; j < 5; j++) {
        await ctx.db.insert("transactions", {
          householdId,
          accountId,
          categoryId: visibleCategoryId,
          amount: -50,
          type: "expense",
          note: `visible-${j}`,
          date: 100 + j,
          createdBy: ownerId,
          updatedBy: ownerId,
          createdAt: 100 + j,
          updatedAt: 100 + j,
        });
      }
    });

    const first = await member.query(api.transactions.recent, { limit: 5 });

    const second = await member.query(api.transactions.recent, {
      limit: 5,
      cursor: first.cursor!,
    });

    expect(first.transactions!.length).toBe(0);
    expect(first.cursor).toBeDefined();

    expect(second.transactions!.length).toBe(5);
    expect(second.cursor).toBeUndefined();
    expect(second.transactions!.map((tx) => tx.note)).toEqual([
      "visible-4",
      "visible-3",
      "visible-2",
      "visible-1",
      "visible-0",
    ]);
  });
});
