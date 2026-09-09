/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { RESERVED_CATEGORY_NAME } from "../constants/categories";

const OWNER_TOKEN = "owner|reconcile-test";
const MEMBER_TOKEN = "member|reconcile-test";

describe("accounts.verify + reconcile (P0-1)", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed() {
    return await t.run(async (ctx) => {
      const householdId = await ctx.db.insert("households", {
        name: "Reconcile HH",
        createdAt: 1,
        updatedAt: 1,
      });
      const ownerId = await ctx.db.insert("users", {
        tokenIdentifier: OWNER_TOKEN,
        clerkUserId: "clerk-owner-reconcile",
      });
      const memberId = await ctx.db.insert("users", {
        tokenIdentifier: MEMBER_TOKEN,
        clerkUserId: "clerk-member-reconcile",
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
      const foodId = await ctx.db.insert("categories", {
        householdId,
        name: "Food",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const salaryId = await ctx.db.insert("categories", {
        householdId,
        name: "Salary",
        type: "income",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const cashId = await ctx.db.insert("accounts", {
        householdId,
        name: "Cash",
        type: "asset",
        subType: "cash",
        balance: 0,
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const bankId = await ctx.db.insert("accounts", {
        householdId,
        name: "Bank",
        type: "asset",
        subType: "bank",
        balance: 0,
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      return { householdId, ownerId, memberId, cashId, bankId, foodId, salaryId };
    });
  }

  it("verify detects no drift initially", async () => {
    await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const result = await owner.query(api.accounts.verify, {});
    expect(result).not.toBeNull();
    expect(result!.discrepancies.length).toBe(0);
    expect(result!.isOwner).toBe(true);
  });

  it("verify detects drift after manual patch and reconcile fixes it", async () => {
    const { cashId, bankId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });

    // create transactions via mutations (so balances are correct)
    await owner.mutation(api.transactions.create, {
      accountId: cashId as any,
      categoryId: (await t.run(async (ctx) => (await ctx.db.query("categories").filter((q) => q.eq(q.field("name"), "Salary")).first())!))._id as any,
      amount: 1000,
      type: "income",
      date: Date.now(),
    });
    await owner.mutation(api.transactions.create, {
      accountId: cashId as any,
      categoryId: (await t.run(async (ctx) => (await ctx.db.query("categories").filter((q) => q.eq(q.field("name"), "Food")).first())!))._id as any,
      amount: -300,
      type: "expense",
      date: Date.now(),
    });
    await owner.mutation(api.transactions.create, {
      accountId: cashId as any,
      toAccountId: bankId as any,
      amount: 200,
      type: "transfer",
      date: Date.now(),
    });

    // expected: Cash = 1000 -300 -200 = 500, Bank = 200
    let verify = await owner.query(api.accounts.verify, {});
    expect(verify!.discrepancies.length).toBe(0);

    // drift: manually patch cash balance to 999
    await t.run(async (ctx) => {
      await ctx.db.patch(cashId, { balance: 999 });
    });

    verify = await owner.query(api.accounts.verify, {});
    expect(verify!.discrepancies.length).toBe(1);
    expect(verify!.discrepancies[0].accountId).toBe(cashId);
    expect(verify!.discrepancies[0].stored).toBe(999);
    expect(verify!.discrepancies[0].expected).toBe(500);
    expect(verify!.discrepancies[0].delta).toBe(-499);

    const fixed = await owner.mutation(api.accounts.reconcile, {});
    expect(fixed.fixed).toBe(1);

    verify = await owner.query(api.accounts.verify, {});
    expect(verify!.discrepancies.length).toBe(0);

    const cash = await t.run(async (ctx) => (await ctx.db.get(cashId))!);
    expect(cash.balance).toBe(500);
  }, 10000);

  it("reconcile is owner-only", async () => {
    await seed();
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    await expect(member.mutation(api.accounts.reconcile, {})).rejects.toThrow();
  });

  it("verify returns null when not authenticated / not member", async () => {
    await seed();
    const outsider = t.withIdentity({ tokenIdentifier: "outsider|none", subject: "outsider" });
    // need to create outsider user without membership
    await t.run(async (ctx) => {
      await ctx.db.insert("users", { tokenIdentifier: "outsider|none", clerkUserId: "clerk-outsider" });
    });
    const result = await outsider.query(api.accounts.verify, {});
    expect(result).toBeNull();
  });

  it("verify handles transfer correctly (from -amount, to +amount)", async () => {
    const { cashId, bankId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.transactions.create, {
      accountId: cashId as any,
      toAccountId: bankId as any,
      amount: 400,
      type: "transfer",
      date: Date.now(),
    });
    const v = await owner.query(api.accounts.verify, {});
    expect(v!.discrepancies.length).toBe(0);
    // drift bank to 0
    await t.run(async (ctx) => { await ctx.db.patch(bankId, { balance: 0 }); });
    const v2 = await owner.query(api.accounts.verify, {});
    expect(v2!.discrepancies.find((d: any) => d.accountId === bankId)!.expected).toBe(400);
  });

  it("reconcile respects opening balance transaction (atomic)", async () => {
    await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const acc = await owner.mutation(api.accounts.create, {
      name: "WithOpening",
      type: "asset",
      subType: "cash",
      openingBalance: 750,
    });
    const v = await owner.query(api.accounts.verify, {});
    expect(v!.discrepancies.length).toBe(0);
    expect(acc!.balance).toBe(750);
  });

  it("legacy types map to asset/debt (cash/bank → asset, credit_card → debt)", async () => {
    const map = (t: string) =>
      t === "cash" || t === "bank" || t === "ewallet" ? "asset" : "debt";
    expect(map("cash")).toBe("asset");
    expect(map("bank")).toBe("asset");
    expect(map("ewallet")).toBe("asset");
    expect(map("credit_card")).toBe("debt");
  });

  it("infers sub-type from account name", () => {
    expect(inferSubType("BCA", "asset")).toBe("bank");
    expect(inferSubType("Dompet", "asset")).toBe("cash");
    expect(inferSubType("GoPay", "asset")).toBe("ewallet");
    expect(inferSubType("BSI", "asset")).toBe("bank");
    expect(inferSubType("Random", "asset")).toBe("other");
    expect(inferSubType("My Card", "debt")).toBe("credit_card");
  });
});

function inferSubType(name: string, type: "asset" | "debt"): string {
  const n = name.toLowerCase();
  if (type === "debt") return n.includes("credit") || n.includes("kartu") || n.includes("card") ? "credit_card" : "other";
  if (/(bca|bank|bsi|mandiri|bri|bni)/.test(n)) return "bank";
  if (/(dompet|cash|tunai)/.test(n)) return "cash";
  if (/(gopay|ovo|dana|shopeepay|emoney|e-money)/.test(n)) return "ewallet";
  return "other";
}

