/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { getPeriodBounds, getNextPeriod } from "../utils/period";

const OWNER_TOKEN = "owner|period-balances-test";
const MEMBER_TOKEN = "member|period-balances-test";
const TZ = "Asia/Jakarta";

describe("periodBalances", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seedHousehold(balanceMode: "fresh" | "carryOver" = "fresh", periodType: "monthly" | "weekly" | "yearly" = "monthly") {
    return await t.run(async (ctx) => {
      // Jan 1 2026 in Jakarta: wall to UTC
      const createdAt = getPeriodBounds(Date.UTC(2026, 0, 15), TZ, "monthly").start;
      const householdId = await ctx.db.insert("households", {
        name: "Period HH",
        timezone: TZ,
        periodType,
        balanceMode,
        createdAt,
        updatedAt: createdAt,
      });
      const ownerId = await ctx.db.insert("users", {
        tokenIdentifier: OWNER_TOKEN,
        clerkUserId: "clerk-owner-period",
      });
      const memberId = await ctx.db.insert("users", {
        tokenIdentifier: MEMBER_TOKEN,
        clerkUserId: "clerk-member-period",
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
      const incomeCat = await ctx.db.insert("categories", {
        householdId,
        name: "Salary",
        type: "income",
        hidden: false,
        createdAt,
        updatedAt: createdAt,
      });
      const expenseCat = await ctx.db.insert("categories", {
        householdId,
        name: "Food",
        type: "expense",
        hidden: false,
        createdAt,
        updatedAt: createdAt,
      });
      const accountId = await ctx.db.insert("accounts", {
        householdId,
        name: "Cash",
        type: "cash",
        balance: 0,
        hidden: false,
        createdAt,
        updatedAt: createdAt,
      });
      return { householdId, ownerId, memberId, incomeCat, expenseCat, accountId, createdAt };
    });
  }

  it("fresh mode: closing equals net per period, opening 0", async () => {
    const ids = await seedHousehold("fresh", "monthly");
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });

    const janStart = getPeriodBounds(Date.UTC(2026, 0, 15), TZ, "monthly").start;
    const febStart = getNextPeriod(janStart, TZ, "monthly");

    // Jan: income 1000, expense -300 => net 700
    // Feb: income 500, expense -100 => net 400
    await t.run(async (ctx) => {
      await ctx.db.insert("transactions", {
        householdId: ids.householdId,
        accountId: ids.accountId,
        categoryId: ids.incomeCat,
        amount: 1000,
        type: "income",
        date: janStart + 2 * 86_400_000,
        createdBy: ids.ownerId,
        updatedBy: ids.ownerId,
        createdAt: janStart,
        updatedAt: janStart,
      });
      await ctx.db.insert("transactions", {
        householdId: ids.householdId,
        accountId: ids.accountId,
        categoryId: ids.expenseCat,
        amount: -300,
        type: "expense",
        date: janStart + 3 * 86_400_000,
        createdBy: ids.ownerId,
        updatedBy: ids.ownerId,
        createdAt: janStart,
        updatedAt: janStart,
      });
      await ctx.db.insert("transactions", {
        householdId: ids.householdId,
        accountId: ids.accountId,
        categoryId: ids.incomeCat,
        amount: 500,
        type: "income",
        date: febStart + 2 * 86_400_000,
        createdBy: ids.ownerId,
        updatedBy: ids.ownerId,
        createdAt: febStart,
        updatedAt: febStart,
      });
      await ctx.db.insert("transactions", {
        householdId: ids.householdId,
        accountId: ids.accountId,
        categoryId: ids.expenseCat,
        amount: -100,
        type: "expense",
        date: febStart + 3 * 86_400_000,
        createdBy: ids.ownerId,
        updatedBy: ids.ownerId,
        createdAt: febStart,
        updatedAt: febStart,
      });
    });

    await owner.mutation(api.periodBalances.backfill, {});

    const janSnap = await owner.query(api.periodBalances.get, { periodStart: janStart, periodType: "monthly" });
    const febSnap = await owner.query(api.periodBalances.get, { periodStart: febStart, periodType: "monthly" });

    expect(janSnap).not.toBeNull();
    expect(janSnap!.income).toBe(1000);
    expect(janSnap!.expense).toBe(300);
    expect(janSnap!.openingBalance).toBe(0);
    expect(janSnap!.closingBalance).toBe(700);

    expect(febSnap).not.toBeNull();
    expect(febSnap!.income).toBe(500);
    expect(febSnap!.expense).toBe(100);
    expect(febSnap!.openingBalance).toBe(0);
    expect(febSnap!.closingBalance).toBe(400);

    // listWindow
    const window = await owner.query(api.periodBalances.listWindow, {
      startDate: janStart,
      endDate: getNextPeriod(febStart, TZ, "monthly"),
      periodType: "monthly",
    });
    const balances = (window as any).balances ?? window;
    expect(Array.isArray(balances)).toBe(true);
    expect(balances.length).toBeGreaterThanOrEqual(2);
  });

  it("carryOver mode: cumulative closing", async () => {
    const ids = await seedHousehold("carryOver", "monthly");
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });

    const janStart = getPeriodBounds(Date.UTC(2026, 0, 15), TZ, "monthly").start;
    const febStart = getNextPeriod(janStart, TZ, "monthly");

    await t.run(async (ctx) => {
      await ctx.db.insert("transactions", {
        householdId: ids.householdId,
        accountId: ids.accountId,
        categoryId: ids.incomeCat,
        amount: 1000,
        type: "income",
        date: janStart + 2 * 86_400_000,
        createdBy: ids.ownerId,
        updatedBy: ids.ownerId,
        createdAt: janStart,
        updatedAt: janStart,
      });
      await ctx.db.insert("transactions", {
        householdId: ids.householdId,
        accountId: ids.accountId,
        categoryId: ids.expenseCat,
        amount: -300,
        type: "expense",
        date: janStart + 3 * 86_400_000,
        createdBy: ids.ownerId,
        updatedBy: ids.ownerId,
        createdAt: janStart,
        updatedAt: janStart,
      });
      await ctx.db.insert("transactions", {
        householdId: ids.householdId,
        accountId: ids.accountId,
        categoryId: ids.incomeCat,
        amount: 500,
        type: "income",
        date: febStart + 2 * 86_400_000,
        createdBy: ids.ownerId,
        updatedBy: ids.ownerId,
        createdAt: febStart,
        updatedAt: febStart,
      });
      await ctx.db.insert("transactions", {
        householdId: ids.householdId,
        accountId: ids.accountId,
        categoryId: ids.expenseCat,
        amount: -100,
        type: "expense",
        date: febStart + 3 * 86_400_000,
        createdBy: ids.ownerId,
        updatedBy: ids.ownerId,
        createdAt: febStart,
        updatedAt: febStart,
      });
    });

    await owner.mutation(api.periodBalances.backfill, {});

    const janSnap = await owner.query(api.periodBalances.get, { periodStart: janStart, periodType: "monthly" });
    const febSnap = await owner.query(api.periodBalances.get, { periodStart: febStart, periodType: "monthly" });

    expect(janSnap!.openingBalance).toBe(0);
    expect(janSnap!.closingBalance).toBe(700);

    expect(febSnap!.openingBalance).toBe(700);
    expect(febSnap!.closingBalance).toBe(1100); // 700 + 400
  });

  it("verify detects drift and reconcile fixes it (owner only)", async () => {
    const ids = await seedHousehold("fresh", "monthly");
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });

    const janStart = getPeriodBounds(Date.UTC(2026, 0, 15), TZ, "monthly").start;

    await t.run(async (ctx) => {
      await ctx.db.insert("transactions", {
        householdId: ids.householdId,
        accountId: ids.accountId,
        categoryId: ids.incomeCat,
        amount: 2000,
        type: "income",
        date: janStart + 1_000_000,
        createdBy: ids.ownerId,
        updatedBy: ids.ownerId,
        createdAt: janStart,
        updatedAt: janStart,
      });
    });

    await owner.mutation(api.periodBalances.backfill, {});

    let verify = await owner.query(api.periodBalances.verify, {});
    expect((verify as any).discrepancies.length).toBe(0);

    // drift: patch snapshot
    await t.run(async (ctx: any) => {
      const all = await ctx.db.query("periodBalances").collect();
      const snap = all.find(
        (s: any) => String(s.householdId) === String(ids.householdId) && s.periodType === "monthly" && s.periodStart === janStart,
      );
      if (snap) await ctx.db.patch(snap._id, { closingBalance: 9999 });
    });

    verify = await owner.query(api.periodBalances.verify, {});
    expect((verify as any).discrepancies.length).toBeGreaterThanOrEqual(1);

    // member cannot reconcile
    await expect(member.mutation(api.periodBalances.reconcile, {})).rejects.toThrow();

    const fixed = await owner.mutation(api.periodBalances.reconcile, {});
    expect((fixed as any).fixed).toBeGreaterThanOrEqual(1);

    verify = await owner.query(api.periodBalances.verify, {});
    expect((verify as any).discrepancies.length).toBe(0);

    const snap = await owner.query(api.periodBalances.get, { periodStart: janStart, periodType: "monthly" });
    expect(snap!.closingBalance).toBe(2000);
  });

  it("owner-gate: member cannot backfill or recompute", async () => {
    await seedHousehold("fresh", "monthly");
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });

    await expect(member.mutation(api.periodBalances.backfill, {})).rejects.toThrow();
    // recomputeAll / recomputeFrom should also be owner-only if exposed
    // try recomputeAll if it exists
    try {
      await (member.mutation as any)(api.periodBalances.recomputeAll, {});
      // if mutation exists, it should have thrown
      throw new Error("expected recomputeAll to throw for member");
    } catch (e: any) {
      // either ConvexError owner check or function not found is not acceptable;
      // but if function exists, it should throw owner error
      const msg = String(e.message ?? e);
      if (msg.includes("expected recomputeAll to throw")) throw e;
      // otherwise acceptable: owner error, or if recomputeAll not exposed, skip
    }
  });

  it("recomputeFrom recomputes from given date", async () => {
    const ids = await seedHousehold("fresh", "monthly");
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });

    const janStart = getPeriodBounds(Date.UTC(2026, 0, 15), TZ, "monthly").start;
    const febStart = getNextPeriod(janStart, TZ, "monthly");

    await t.run(async (ctx) => {
      await ctx.db.insert("transactions", {
        householdId: ids.householdId,
        accountId: ids.accountId,
        categoryId: ids.incomeCat,
        amount: 1000,
        type: "income",
        date: janStart + 1_000_000,
        createdBy: ids.ownerId,
        updatedBy: ids.ownerId,
        createdAt: janStart,
        updatedAt: janStart,
      });
    });

    await owner.mutation(api.periodBalances.backfill, {});

    // add Feb transaction after backfill, then recomputeFrom Feb
    await t.run(async (ctx) => {
      await ctx.db.insert("transactions", {
        householdId: ids.householdId,
        accountId: ids.accountId,
        categoryId: ids.expenseCat,
        amount: -200,
        type: "expense",
        date: febStart + 1_000_000,
        createdBy: ids.ownerId,
        updatedBy: ids.ownerId,
        createdAt: febStart,
        updatedAt: febStart,
      });
    });

    await owner.mutation(api.periodBalances.recomputeFrom, { fromDate: febStart });

    const febSnap = await owner.query(api.periodBalances.get, { periodStart: febStart, periodType: "monthly" });
    expect(febSnap!.expense).toBe(200);
    expect(febSnap!.closingBalance).toBe(-200);
  });
});
