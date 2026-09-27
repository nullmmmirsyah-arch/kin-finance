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
});
