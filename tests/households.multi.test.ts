/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const A_TOKEN = "a|hh-multi";
const B_TOKEN = "b|hh-multi";

describe("multi-household foundation", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seedTwo(ctx: any) {
    const older = await ctx.db.insert("households", { name: "Older", createdAt: 1, updatedAt: 1 });
    const newer = await ctx.db.insert("households", { name: "Newer", createdAt: 2, updatedAt: 2 });
    const aId = await ctx.db.insert("users", { tokenIdentifier: A_TOKEN, clerkUserId: "c-a" });
    await ctx.db.insert("householdMemberships", { householdId: older, userId: aId, role: "owner" });
    await ctx.db.insert("householdMemberships", { householdId: newer, userId: aId, role: "member" });
    return { older, newer, aId };
  }

  it("getActive falls back to oldest household when no active set", async () => {
    const a = t.withIdentity({ tokenIdentifier: A_TOKEN, subject: "a" });
    const { older } = await t.run(async (ctx) => await seedTwo(ctx));
    const active = await a.query(api.households.getActive, {});
    expect(active?._id).toEqual(older);
  });

  it("getActive respects explicit activeHouseholdId", async () => {
    const a = t.withIdentity({ tokenIdentifier: A_TOKEN, subject: "a" });
    const { newer } = await t.run(async (ctx) => await seedTwo(ctx));
    await a.mutation(api.households.switchActive, { householdId: newer });
    const active = await a.query(api.households.getActive, {});
    expect(active?._id).toEqual(newer);
  });

  it("switchActive throws for a household the caller does not belong to", async () => {
    const b = t.withIdentity({ tokenIdentifier: B_TOKEN, subject: "b" });
    await t.run(async (ctx) => {
      await ctx.db.insert("users", { tokenIdentifier: B_TOKEN, clerkUserId: "c-b" });
      await seedTwo(ctx);
    });
    const { older } = await t.run(async (ctx) => {
      const h = await ctx.db.query("households").collect();
      return { older: h[0]._id };
    });
    await expect(b.mutation(api.households.switchActive, { householdId: older })).rejects.toThrow(
      "You are not a member of this household.",
    );
  });

  it("listMine returns oldest-first with role and effective isActive", async () => {
    const a = t.withIdentity({ tokenIdentifier: A_TOKEN, subject: "a" });
    await t.run(async (ctx) => await seedTwo(ctx));
    const mine = await a.query(api.households.listMine, {});
    expect(mine.map((m) => m.household.name)).toEqual(["Older", "Newer"]);
    expect(mine.map((m) => m.role)).toEqual(["owner", "member"]);
    expect(mine.map((m) => m.isActive)).toEqual([true, false]);
  });
});
