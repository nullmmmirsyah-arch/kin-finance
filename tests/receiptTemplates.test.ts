/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import {
  validateTemplateKeywords,
  validateTemplateLabel,
} from "../constants/validation";

const TOKEN = "owner|receipt-template-test";

describe("validateTemplateLabel", () => {
  it("rejects empty, accepts normal label", () => {
    expect(validateTemplateLabel("")).not.toBeNull();
    expect(validateTemplateLabel("BCA Mobile")).toBeNull();
  });
});

describe("validateTemplateKeywords", () => {
  it("requires 1-8 keywords", () => {
    expect(validateTemplateKeywords([])).not.toBeNull();
    expect(validateTemplateKeywords(["BCA"])).toBeNull();
  });
});

describe("receiptTemplates.create duplicate label", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  it("rejects duplicate label within the same household", async () => {
    const owner = t.withIdentity({
      tokenIdentifier: TOKEN,
      subject: "owner",
    });
    await t.run(async (ctx) => {
      const householdId = await ctx.db.insert("households", {
        name: "Receipt HH",
        createdAt: 1,
        updatedAt: 1,
      });
      const userId = await ctx.db.insert("users", {
        tokenIdentifier: TOKEN,
        clerkUserId: "clerk-owner-receipt",
      });
      await ctx.db.insert("householdMemberships", {
        householdId,
        userId,
        role: "owner",
      });
    });

    await owner.mutation(api.receiptTemplates.create, {
      label: "BCA Mobile",
      keywords: ["BCA"],
      amountStrategy: "largest",
      noteStrategy: "firstLine",
      defaultType: "expense",
      keywordRules: [],
    });

    await expect(
      owner.mutation(api.receiptTemplates.create, {
        label: "BCA Mobile",
        keywords: ["BCA"],
        amountStrategy: "largest",
        noteStrategy: "firstLine",
        defaultType: "expense",
        keywordRules: [],
      }),
    ).rejects.toThrow("Template label already exists.");
  });

  it("rejects case-insensitive duplicate label", async () => {
    const owner = t.withIdentity({
      tokenIdentifier: TOKEN,
      subject: "owner",
    });
    await t.run(async (ctx) => {
      const householdId = await ctx.db.insert("households", {
        name: "Receipt HH",
        createdAt: 1,
        updatedAt: 1,
      });
      const userId = await ctx.db.insert("users", {
        tokenIdentifier: TOKEN,
        clerkUserId: "clerk-owner-receipt",
      });
      await ctx.db.insert("householdMemberships", {
        householdId,
        userId,
        role: "owner",
      });
    });

    await owner.mutation(api.receiptTemplates.create, {
      label: "BCA",
      keywords: ["BCA"],
      amountStrategy: "largest",
      noteStrategy: "firstLine",
      defaultType: "expense",
      keywordRules: [],
    });

    await expect(
      owner.mutation(api.receiptTemplates.create, {
        label: "bca",
        keywords: ["BCA"],
        amountStrategy: "largest",
        noteStrategy: "firstLine",
        defaultType: "expense",
        keywordRules: [],
      }),
    ).rejects.toThrow("Template label already exists.");
  });
});

describe("receiptTemplates household isolation + rule type check", () => {
  let t: ReturnType<typeof convexTest>;
  const TOKEN_B = "owner|receipt-template-test-b";

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function setupTwoHouseholds() {
    return await t.run(async (ctx) => {
      const householdA = await ctx.db.insert("households", {
        name: "HH A",
        createdAt: 1,
        updatedAt: 1,
      });
      const householdB = await ctx.db.insert("households", {
        name: "HH B",
        createdAt: 1,
        updatedAt: 1,
      });
      const userA = await ctx.db.insert("users", {
        tokenIdentifier: TOKEN,
        clerkUserId: "clerk-owner-a",
      });
      const userB = await ctx.db.insert("users", {
        tokenIdentifier: TOKEN_B,
        clerkUserId: "clerk-owner-b",
      });
      await ctx.db.insert("householdMemberships", {
        householdId: householdA,
        userId: userA,
        role: "owner",
      });
      await ctx.db.insert("householdMemberships", {
        householdId: householdB,
        userId: userB,
        role: "owner",
      });
      const expenseCat = await ctx.db.insert("categories", {
        householdId: householdA,
        name: "Food",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const incomeCat = await ctx.db.insert("categories", {
        householdId: householdA,
        name: "Salary",
        type: "income",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const otherCat = await ctx.db.insert("categories", {
        householdId: householdB,
        name: "Other",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const templateA = await ctx.db.insert("receiptTemplates", {
        householdId: householdA,
        label: "BCA A",
        keywords: ["BCA"],
        amountStrategy: "largest",
        noteStrategy: "firstLine",
        defaultType: "expense",
        keywordRules: [],
        createdBy: userA,
        createdAt: 1,
        updatedAt: 1,
      });
      return { expenseCat, incomeCat, otherCat, templateA };
    });
  }

  it("rejects cross-household update/remove with Template not found.", async () => {
    const { templateA } = await setupTwoHouseholds();
    const ownerB = t.withIdentity({
      tokenIdentifier: TOKEN_B,
      subject: "owner-b",
    });
    await expect(
      ownerB.mutation(api.receiptTemplates.update, {
        templateId: templateA,
        label: "Hijacked",
      }),
    ).rejects.toThrow("Template not found.");
    await expect(
      ownerB.mutation(api.receiptTemplates.remove, {
        templateId: templateA,
      }),
    ).rejects.toThrow("Template not found.");
  });

  it("rejects rule with mismatched category type", async () => {
    const { incomeCat } = await setupTwoHouseholds();
    const ownerA = t.withIdentity({
      tokenIdentifier: TOKEN,
      subject: "owner",
    });
    await expect(
      ownerA.mutation(api.receiptTemplates.create, {
        label: "BCA rule",
        keywords: ["BCA"],
        amountStrategy: "largest",
        noteStrategy: "firstLine",
        defaultType: "expense",
        keywordRules: [{ keyword: "gaji", categoryId: incomeCat }],
      }),
    ).rejects.toThrow("Category type must match transaction type.");
  });
});

describe("receiptTemplates transfer rules", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function setupTemplateWithRule() {
    return await t.run(async (ctx) => {
      const householdId = await ctx.db.insert("households", {
        name: "Rule HH",
        createdAt: 1,
        updatedAt: 1,
      });
      const userId = await ctx.db.insert("users", {
        tokenIdentifier: TOKEN,
        clerkUserId: "clerk-owner-rule",
      });
      await ctx.db.insert("householdMemberships", {
        householdId,
        userId,
        role: "owner",
      });
      const expenseCat = await ctx.db.insert("categories", {
        householdId,
        name: "Food",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const templateId = await ctx.db.insert("receiptTemplates", {
        householdId,
        label: "Kopi",
        keywords: ["kopi"],
        amountStrategy: "largest",
        noteStrategy: "firstLine",
        defaultType: "expense",
        keywordRules: [{ keyword: "kopi", categoryId: expenseCat }],
        createdBy: userId,
        createdAt: 1,
        updatedAt: 1,
      });
      return { templateId, expenseCat };
    });
  }

  function ownerA() {
    return t.withIdentity({ tokenIdentifier: TOKEN, subject: "owner" });
  }

  it("rejects create transfer with non-empty rules", async () => {
    const { expenseCat } = await setupTemplateWithRule();
    await expect(
      ownerA().mutation(api.receiptTemplates.create, {
        label: "Transfer tpl",
        keywords: ["bank"],
        amountStrategy: "largest",
        noteStrategy: "firstLine",
        defaultType: "transfer",
        keywordRules: [{ keyword: "bank", categoryId: expenseCat }],
      }),
    ).rejects.toThrow("Transfer templates cannot have category rules.");
  });

  it("rejects type change to transfer while rules remain", async () => {
    const { templateId } = await setupTemplateWithRule();
    await expect(
      ownerA().mutation(api.receiptTemplates.update, {
        templateId,
        defaultType: "transfer",
      }),
    ).rejects.toThrow("Transfer templates cannot have category rules.");
  });

  it("rejects type change that orphans existing rule types", async () => {
    const { templateId } = await setupTemplateWithRule();
    await expect(
      ownerA().mutation(api.receiptTemplates.update, {
        templateId,
        defaultType: "income",
      }),
    ).rejects.toThrow("Category type must match transaction type.");
  });

  it("allows type change to transfer when rules cleared together", async () => {
    const { templateId } = await setupTemplateWithRule();
    const updated = await ownerA().mutation(api.receiptTemplates.update, {
      templateId,
      defaultType: "transfer",
      keywordRules: [],
    });
    expect(updated?.defaultType).toBe("transfer");
    expect(updated?.keywordRules).toEqual([]);
  });
});
