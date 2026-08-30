/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { RESERVED_CATEGORY_NAME } from "../constants/categories";
import fs from "fs";
import path from "path";

const OWNER_TOKEN = "owner|atomic-test";

describe("P0-2 accounts.create atomic opening balance", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed(ctx: any) {
    const householdId = await ctx.db.insert("households", {
      name: "Atomic HH",
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerId = await ctx.db.insert("users", {
      tokenIdentifier: OWNER_TOKEN,
      clerkUserId: "clerk-owner-atomic",
    });
    await ctx.db.insert("householdMemberships", {
      householdId,
      userId: ownerId,
      role: "owner",
    });
    for (const type of ["income", "expense"] as const) {
      await ctx.db.insert("categories", {
        householdId,
        name: RESERVED_CATEGORY_NAME,
        type,
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
    }
    return { householdId };
  }

  it("code invariant: accounts.create must NOT use ctx.runMutation (must be atomic)", async () => {
    // This test fails before P0-2 fix (file contains runMutation) and passes after
    const file = fs.readFileSync(path.join(process.cwd(), "convex", "accounts.ts"), "utf8");
    expect(file).not.toContain("runMutation");
    expect(file).not.toContain("api.transactions.create");
    // Must handle opening balance atomically within the same mutation
    expect(file).toContain("balance: openingBalance");
  });

  it("creates account with openingBalance atomically — balance equals openingBalance and single transaction", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => seed(ctx));

    const account = await owner.mutation(api.accounts.create, {
      name: "Savings",
      type: "bank",
      openingBalance: 750,
    });

    expect(account!.balance).toBe(750);
    expect(account!.name).toBe("Savings");

    const txns = await t.run(async (ctx) => {
      const all: any[] = [];
      for await (const tx of ctx.db.query("transactions")) all.push(tx);
      return all;
    });
    expect(txns.length).toBe(1);
    expect(txns[0].amount).toBe(750);
    expect(txns[0].type).toBe("income");
    expect(txns[0].note).toBe("Initial balance");
    expect(txns[0].accountId).toBe(account!._id);

    // Atomic: account and transaction share same createdAt/updatedAt (single Date.now())
    expect(txns[0].createdAt).toBe(account!.createdAt);
    expect(txns[0].createdAt).toBe(account!.updatedAt);
  });

  it("creates account with negative openingBalance atomically", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => seed(ctx));

    const account = await owner.mutation(api.accounts.create, {
      name: "Debt",
      type: "credit_card",
      openingBalance: -300,
    });

    expect(account!.balance).toBe(-300);

    const txns = await t.run(async (ctx) => {
      const all: any[] = [];
      for await (const tx of ctx.db.query("transactions")) all.push(tx);
      return all;
    });
    expect(txns.length).toBe(1);
    expect(txns[0].amount).toBe(-300);
    expect(txns[0].type).toBe("expense");
  });

  it("no orphan account when reserved category missing — throws and leaves 0 accounts", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => {
      const householdId = await ctx.db.insert("households", {
        name: "NoCat HH",
        createdAt: 1,
        updatedAt: 1,
      });
      const ownerId = await ctx.db.insert("users", {
        tokenIdentifier: OWNER_TOKEN,
        clerkUserId: "clerk-owner-atomic2",
      });
      await ctx.db.insert("householdMemberships", { householdId, userId: ownerId, role: "owner" });
      // Only income category, no expense
      await ctx.db.insert("categories", {
        householdId,
        name: RESERVED_CATEGORY_NAME,
        type: "income",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
    });

    await expect(
      owner.mutation(api.accounts.create, {
        name: "ShouldFail",
        type: "cash",
        openingBalance: -100,
      }),
    ).rejects.toThrow("Initial Balance category not found");

    const accounts = await t.run(async (ctx) => {
      const all: any[] = [];
      for await (const a of ctx.db.query("accounts")) all.push(a);
      return all;
    });
    expect(accounts.length).toBe(0);

    const txns = await t.run(async (ctx) => {
      const all: any[] = [];
      for await (const tx of ctx.db.query("transactions")) all.push(tx);
      return all;
    });
    expect(txns.length).toBe(0);
  });

  it("zero openingBalance creates no transaction and balance 0", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await t.run(async (ctx) => seed(ctx));

    const account = await owner.mutation(api.accounts.create, {
      name: "Zero",
      type: "cash",
      openingBalance: 0,
    });

    expect(account!.balance).toBe(0);
    const txns = await t.run(async (ctx) => {
      const all: any[] = [];
      for await (const tx of ctx.db.query("transactions")) all.push(tx);
      return all;
    });
    expect(txns.length).toBe(0);
  });
});
