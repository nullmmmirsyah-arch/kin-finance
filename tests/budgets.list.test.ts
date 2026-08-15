/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|budget-test";
const MEMBER_TOKEN = "member|budget-test";

describe("budgets.list", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed(ctx: any) {
    const householdId = await ctx.db.insert("households", {
      name: "Budget HH",
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerId = await ctx.db.insert("users", {
      tokenIdentifier: OWNER_TOKEN,
      clerkUserId: "clerk-owner-budget",
    });
    const memberId = await ctx.db.insert("users", {
      tokenIdentifier: MEMBER_TOKEN,
      clerkUserId: "clerk-member-budget",
    });
    await ctx.db.insert("householdMemberships", { householdId, userId: ownerId, role: "owner" });
    await ctx.db.insert("householdMemberships", { householdId, userId: memberId, role: "member" });
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
      name: "Hidden",
      type: "expense",
      hidden: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const visibleCatId = await ctx.db.insert("categories", {
      householdId,
      name: "Visible",
      type: "expense",
      hidden: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const budgetId = await ctx.db.insert("budgets", {
      householdId,
      categoryId: hiddenCatId,
      periodStart: 1_000,
      amount: 1000,
      createdBy: ownerId,
      updatedBy: ownerId,
      createdAt: 1,
      updatedAt: 1,
    });
    const visibleBudgetId = await ctx.db.insert("budgets", {
      householdId,
      categoryId: visibleCatId,
      periodStart: 1_000,
      amount: 500,
      createdBy: ownerId,
      updatedBy: ownerId,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("transactions", {
      householdId,
      accountId,
      categoryId: hiddenCatId,
      amount: -300,
      type: "expense",
      date: 1_500,
      createdBy: ownerId,
      updatedBy: ownerId,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("transactions", {
      householdId,
      accountId,
      categoryId: visibleCatId,
      amount: -200,
      type: "expense",
      date: 1_500,
      createdBy: ownerId,
      updatedBy: ownerId,
      createdAt: 1,
      updatedAt: 1,
    });
    return { householdId, budgetId, visibleBudgetId };
  }

  it("member sees hidden-category budget with redacted breakdown and visible-category budget intact", async () => {
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const { budgetId, visibleBudgetId } = await t.run(async (ctx) => seed(ctx));

    const result = await member.query(api.budgets.list, {
      periodStart: 1_000,
      periodEnd: 1_000 + 31 * 86_400_000,
    });

    const hidden = result.budgets!.find((b) => b._id === budgetId)!;
    expect(hidden.category?.hidden).toBe(true);
    expect(hidden.spent).toBeUndefined();
    expect(hidden.progress).toBeUndefined();
    expect(hidden.amount).toBe(1000);

    const visible = result.budgets!.find((b) => b._id === visibleBudgetId)!;
    expect(visible.category?.hidden).toBe(false);
    expect(visible.spent).toBe(200);
    expect(visible.progress).toBe(200 / 500);
  });

  it("owner sees full breakdown for hidden-category budgets", async () => {
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const { budgetId } = await t.run(async (ctx) => seed(ctx));

    const result = await owner.query(api.budgets.list, {
      periodStart: 1_000,
      periodEnd: 1_000 + 31 * 86_400_000,
    });

    const hidden = result.budgets!.find((b) => b._id === budgetId)!;
    expect(hidden.spent).toBe(300);
    expect(hidden.progress).toBe(0.3);
  });
});
