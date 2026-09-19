/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { getMonthBounds, formatMonthLabel } from "../utils/periodTime";

const OWNER_TOKEN = "owner|suggestion-test";
const TZ = "Asia/Jakarta";

describe("budgets.suggestion", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed(ctx: any) {
    const householdId = await ctx.db.insert("households", {
      name: "Sugg HH",
      timezone: TZ,
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerId = await ctx.db.insert("users", {
      tokenIdentifier: OWNER_TOKEN,
      clerkUserId: "clerk-owner-sugg",
    });
    await ctx.db.insert("householdMemberships", { householdId, userId: ownerId, role: "owner" });
    const accountId = await ctx.db.insert("accounts", {
      householdId, name: "Cash", type: "asset", subType: "cash",
      balance: 0, hidden: false, createdAt: 1, updatedAt: 1,
    });
    const catId = await ctx.db.insert("categories", {
      householdId, name: "Food", type: "expense", hidden: false, createdAt: 1, updatedAt: 1,
    });
    return { householdId, ownerId, accountId, catId };
  }

  async function insertTx(ctx: any, s: any, date: number, amount: number) {
    await ctx.db.insert("transactions", {
      householdId: s.householdId, accountId: s.accountId, categoryId: s.catId,
      amount, type: "expense", date,
      createdBy: s.ownerId, updatedBy: s.ownerId, createdAt: 1, updatedAt: 1,
    });
  }

  it("returns prevBudget, prevSpent and 3-month average", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { s, periodStart } = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const now = Date.UTC(2026, 8, 15);
      const cur = getMonthBounds(now, TZ);
      const m1 = getMonthBounds(cur.start - 1, TZ);
      const m2 = getMonthBounds(m1.start - 1, TZ);
      const m3 = getMonthBounds(m2.start - 1, TZ);
      await ctx.db.insert("budgets", {
        householdId: s.householdId, categoryId: s.catId, periodStart: m1.start,
        amount: 900, createdBy: s.ownerId, updatedBy: s.ownerId, createdAt: 1, updatedAt: 1,
      });
      return { s, periodStart: cur.start, m1, m2, m3 };
    });
    const { m1, m2, m3 } = await t.run(async (ctx) => {
      const now = Date.UTC(2026, 8, 15);
      const cur = getMonthBounds(now, TZ);
      const m1 = getMonthBounds(cur.start - 1, TZ);
      const m2 = getMonthBounds(m1.start - 1, TZ);
      const m3 = getMonthBounds(m2.start - 1, TZ);
      return { m1, m2, m3 };
    });
    await t.run(async (ctx) => {
      await insertTx(ctx, s, m1.start + 1_000, -300);
      await insertTx(ctx, s, m2.start + 1_000, -600);
    });
    const res = await owner.query(api.budgets.suggestion, {
      categoryId: s.catId, periodStart, timezone: TZ,
    });
    expect(res!.prevBudget).toBe(900);
    expect(res!.prevSpent).toBe(300);
    expect(res!.avgSpent).toBe(Math.round((300 + 600 + 0) / 3));
    expect(res!.prevLabel).toBe(formatMonthLabel(m1.start, TZ));
    expect(res!.hasHistory).toBe(true);
  });

  it("returns null prevBudget and hasHistory false when no history", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { catId, periodStart } = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const cur = getMonthBounds(Date.UTC(2026, 8, 15), TZ);
      return { catId: s.catId, periodStart: cur.start };
    });
    const res = await owner.query(api.budgets.suggestion, {
      categoryId: catId, periodStart, timezone: TZ,
    });
    expect(res!.prevBudget).toBeNull();
    expect(res!.prevSpent).toBe(0);
    expect(res!.avgSpent).toBe(0);
    expect(res!.hasHistory).toBe(false);
  });

  it("returns null when unauthenticated", async () => {
    const anon = t.withIdentity({ tokenIdentifier: "anon|x", subject: "anon" });
    const { catId, periodStart } = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const cur = getMonthBounds(Date.UTC(2026, 8, 15), TZ);
      return { catId: s.catId, periodStart: cur.start };
    });
    const res = await anon.query(api.budgets.suggestion, {
      categoryId: catId, periodStart, timezone: TZ,
    });
    expect(res).toBeNull();
  });
});
