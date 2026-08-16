/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { RESERVED_CATEGORY_NAME } from "../constants/categories";

const OWNER_TOKEN = "owner|acct-create-test";
const MEMBER_TOKEN = "member|acct-create-test";

describe("accounts.create", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed(
    ctx: any,
    reserved: { income?: boolean; expense?: boolean } = {
      income: true,
      expense: true,
    },
  ) {
    const householdId = await ctx.db.insert("households", {
      name: "Acct HH",
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerId = await ctx.db.insert("users", {
      tokenIdentifier: OWNER_TOKEN,
      clerkUserId: "clerk-owner-acct",
    });
    const memberId = await ctx.db.insert("users", {
      tokenIdentifier: MEMBER_TOKEN,
      clerkUserId: "clerk-member-acct",
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
    if (reserved.income !== false) {
      await ctx.db.insert("categories", {
        householdId,
        name: RESERVED_CATEGORY_NAME,
        type: "income",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
    }
    if (reserved.expense !== false) {
      await ctx.db.insert("categories", {
        householdId,
        name: RESERVED_CATEGORY_NAME,
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
    }
    return { householdId, ownerId };
  }

  it("creates account with zero opening balance", async () => {
    const owner = t.withIdentity({
      tokenIdentifier: OWNER_TOKEN,
      subject: "owner",
    });
    await t.run(async (ctx) => seed(ctx));

    const result = await owner.mutation(api.accounts.create, {
      name: "Cash",
      type: "cash",
    });

    expect(result!.balance).toBe(0);
    expect(result!.name).toBe("Cash");
  });

  it("creates account with positive opening balance (income transaction)", async () => {
    const owner = t.withIdentity({
      tokenIdentifier: OWNER_TOKEN,
      subject: "owner",
    });
    await t.run(async (ctx) => seed(ctx));

    const result = await owner.mutation(api.accounts.create, {
      name: "Savings",
      type: "bank",
      openingBalance: 500,
    });

    expect(result!.balance).toBe(500);

    const txns = await t.run(async (ctx) => {
      const all: any[] = [];
      for await (const tx of ctx.db.query("transactions")) all.push(tx);
      return all;
    });
    expect(txns.length).toBe(1);
    expect(txns[0].type).toBe("income");
    expect(txns[0].amount).toBe(500);
  });

  it("creates account with negative opening balance (expense transaction)", async () => {
    const owner = t.withIdentity({
      tokenIdentifier: OWNER_TOKEN,
      subject: "owner",
    });
    await t.run(async (ctx) => seed(ctx));

    const result = await owner.mutation(api.accounts.create, {
      name: "Credit Card",
      type: "credit_card",
      openingBalance: -200,
    });

    expect(result!.balance).toBe(-200);

    const txns = await t.run(async (ctx) => {
      const all: any[] = [];
      for await (const tx of ctx.db.query("transactions")) all.push(tx);
      return all;
    });
    expect(txns.length).toBe(1);
    expect(txns[0].type).toBe("expense");
    expect(txns[0].amount).toBe(-200);
  });

  it("rejects nonzero opening balance when the matching reserved category is missing", async () => {
    const owner = t.withIdentity({
      tokenIdentifier: OWNER_TOKEN,
      subject: "owner",
    });
    await t.run(async (ctx) => seed(ctx, { expense: false }));

    await expect(
      owner.mutation(api.accounts.create, {
        name: "Credit Card",
        type: "credit_card",
        openingBalance: -200,
      }),
    ).rejects.toThrow();

    const accounts = await t.run(async (ctx) => {
      const all: any[] = [];
      for await (const account of ctx.db.query("accounts")) all.push(account);
      return all;
    });
    expect(accounts.length).toBe(0);
  });

  it("member cannot create account", async () => {
    const member = t.withIdentity({
      tokenIdentifier: MEMBER_TOKEN,
      subject: "member",
    });
    await t.run(async (ctx) => seed(ctx));

    await expect(
      member.mutation(api.accounts.create, { name: "Cash", type: "cash" }),
    ).rejects.toThrow();
  });

  it("rejects duplicate account name within household", async () => {
    const owner = t.withIdentity({
      tokenIdentifier: OWNER_TOKEN,
      subject: "owner",
    });
    await t.run(async (ctx) => seed(ctx));

    await owner.mutation(api.accounts.create, {
      name: "Cash",
      type: "cash",
    });

    await expect(
      owner.mutation(api.accounts.create, { name: "Cash", type: "bank" }),
    ).rejects.toThrow();
  });
});
