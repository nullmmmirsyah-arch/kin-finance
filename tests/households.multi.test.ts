/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const A_TOKEN = "a|hh-multi";
const B_TOKEN = "b|hh-multi";

process.env.INVITE_SECRET = "test-secret";

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

describe("multi-household create/join/leave", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  it("create second household succeeds and keeps first active", async () => {
    const a = t.withIdentity({ tokenIdentifier: A_TOKEN, subject: "a" });
    await t.run(async (ctx) => {
      await ctx.db.insert("users", { tokenIdentifier: A_TOKEN, clerkUserId: "c-a" });
    });
    const first = await a.mutation(api.households.create, { name: "Family", timezone: "UTC" });
    const second = await a.mutation(api.households.create, { name: "Business", timezone: "UTC" });
    expect(second?.name).toEqual("Business");
    const active = await a.query(api.households.getActive, {});
    expect(active?._id).toEqual(first?._id);
    const mine = await a.query(api.households.listMine, {});
    expect(mine).toHaveLength(2);
  });

  it("leave active household moves active to the remaining one", async () => {
    const a = t.withIdentity({ tokenIdentifier: A_TOKEN, subject: "a" });
    const ids = await t.run(async (ctx) => {
      const h1 = await ctx.db.insert("households", { name: "H1", createdAt: 1, updatedAt: 1 });
      const h2 = await ctx.db.insert("households", { name: "H2", createdAt: 2, updatedAt: 2 });
      const aId = await ctx.db.insert("users", { tokenIdentifier: A_TOKEN, clerkUserId: "c-a" });
      const bId = await ctx.db.insert("users", { tokenIdentifier: B_TOKEN, clerkUserId: "c-b" });
      await ctx.db.insert("householdMemberships", { householdId: h1, userId: bId, role: "owner" });
      await ctx.db.insert("householdMemberships", { householdId: h1, userId: aId, role: "member" });
      await ctx.db.insert("householdMemberships", { householdId: h2, userId: aId, role: "owner" });
      await ctx.db.patch(aId, { activeHouseholdId: h1 });
      return { h1, h2, aId };
    });
    await a.mutation(api.households.leaveHousehold, { householdId: ids.h1 });
    const active = await a.query(api.households.getActive, {});
    expect(active?._id).toEqual(ids.h2);
  });

  it("owner deleting active household moves active to the remaining one", async () => {
    const a = t.withIdentity({ tokenIdentifier: A_TOKEN, subject: "a" });
    const ids = await t.run(async (ctx) => {
      const h1 = await ctx.db.insert("households", { name: "H1", createdAt: 1, updatedAt: 1 });
      const h2 = await ctx.db.insert("households", { name: "H2", createdAt: 2, updatedAt: 2 });
      const aId = await ctx.db.insert("users", { tokenIdentifier: A_TOKEN, clerkUserId: "c-a" });
      await ctx.db.insert("householdMemberships", { householdId: h1, userId: aId, role: "owner" });
      await ctx.db.insert("householdMemberships", { householdId: h2, userId: aId, role: "owner" });
      await ctx.db.patch(aId, { activeHouseholdId: h1 });
      return { h1, h2, aId };
    });
    await a.mutation(api.households.deleteHousehold, { householdId: ids.h1 });
    const active = await a.query(api.households.getActive, {});
    expect(active?._id).toEqual(ids.h2);
  });

  it("leaving last household clears active", async () => {
    const a = t.withIdentity({ tokenIdentifier: A_TOKEN, subject: "a" });
    const ids = await t.run(async (ctx) => {
      const h1 = await ctx.db.insert("households", { name: "H1", createdAt: 1, updatedAt: 1 });
      const aId = await ctx.db.insert("users", { tokenIdentifier: A_TOKEN, clerkUserId: "c-a" });
      const bId = await ctx.db.insert("users", { tokenIdentifier: B_TOKEN, clerkUserId: "c-b" });
      await ctx.db.insert("householdMemberships", { householdId: h1, userId: bId, role: "owner" });
      await ctx.db.insert("householdMemberships", { householdId: h1, userId: aId, role: "member" });
      await ctx.db.patch(aId, { activeHouseholdId: h1 });
      return { h1 };
    });
    await a.mutation(api.households.leaveHousehold, { householdId: ids.h1 });
    const active = await a.query(api.households.getActive, {});
    expect(active).toBeNull();
    const mine = await a.query(api.households.listMine, {});
    expect(mine).toHaveLength(0);
  });

  it("redeem succeeds for member of another household and returns householdId", async () => {
    const a = t.withIdentity({ tokenIdentifier: A_TOKEN, subject: "a" });
    const b = t.withIdentity({ tokenIdentifier: B_TOKEN, subject: "b" });
    await t.run(async (ctx) => {
      await ctx.db.insert("users", { tokenIdentifier: A_TOKEN, clerkUserId: "c-a" });
      await ctx.db.insert("users", { tokenIdentifier: B_TOKEN, clerkUserId: "c-b" });
    });
    await b.mutation(api.households.create, { name: "B Home", timezone: "UTC" });
    const home = await a.mutation(api.households.create, { name: "Family", timezone: "UTC" });
    const { code } = await a.mutation(api.invitations.create, {});
    const result = await b.mutation(api.invitations.redeem, { code });
    expect(result.householdId).toEqual(home?._id);
    const { code: code2 } = await a.mutation(api.invitations.create, {});
    await expect(b.mutation(api.invitations.redeem, { code: code2 })).rejects.toThrow(
      "You are already a member of this household.",
    );
  });

  it("leaving a non-active household keeps active unchanged", async () => {
    const a = t.withIdentity({ tokenIdentifier: A_TOKEN, subject: "a" });
    const ids = await t.run(async (ctx) => {
      const h1 = await ctx.db.insert("households", { name: "H1", createdAt: 1, updatedAt: 1 });
      const h2 = await ctx.db.insert("households", { name: "H2", createdAt: 2, updatedAt: 2 });
      const h3 = await ctx.db.insert("households", { name: "H3", createdAt: 3, updatedAt: 3 });
      const aId = await ctx.db.insert("users", { tokenIdentifier: A_TOKEN, clerkUserId: "c-a" });
      const bId = await ctx.db.insert("users", { tokenIdentifier: B_TOKEN, clerkUserId: "c-b" });
      await ctx.db.insert("householdMemberships", { householdId: h1, userId: bId, role: "owner" });
      await ctx.db.insert("householdMemberships", { householdId: h1, userId: aId, role: "member" });
      await ctx.db.insert("householdMemberships", { householdId: h2, userId: bId, role: "owner" });
      await ctx.db.insert("householdMemberships", { householdId: h2, userId: aId, role: "member" });
      await ctx.db.insert("householdMemberships", { householdId: h3, userId: aId, role: "owner" });
      await ctx.db.patch(aId, { activeHouseholdId: h3 });
      return { h1, h2, h3 };
    });
    await a.mutation(api.households.leaveHousehold, { householdId: ids.h2 });
    const active = await a.query(api.households.getActive, {});
    expect(active?._id).toEqual(ids.h3);
  });

  it("deleting a non-active household keeps active unchanged", async () => {
    const a = t.withIdentity({ tokenIdentifier: A_TOKEN, subject: "a" });
    const ids = await t.run(async (ctx) => {
      const h1 = await ctx.db.insert("households", { name: "H1", createdAt: 1, updatedAt: 1 });
      const h2 = await ctx.db.insert("households", { name: "H2", createdAt: 2, updatedAt: 2 });
      const h3 = await ctx.db.insert("households", { name: "H3", createdAt: 3, updatedAt: 3 });
      const aId = await ctx.db.insert("users", { tokenIdentifier: A_TOKEN, clerkUserId: "c-a" });
      await ctx.db.insert("householdMemberships", { householdId: h1, userId: aId, role: "owner" });
      await ctx.db.insert("householdMemberships", { householdId: h2, userId: aId, role: "owner" });
      await ctx.db.insert("householdMemberships", { householdId: h3, userId: aId, role: "owner" });
      await ctx.db.patch(aId, { activeHouseholdId: h3 });
      return { h1, h2, h3 };
    });
    await a.mutation(api.households.deleteHousehold, { householdId: ids.h2 });
    const active = await a.query(api.households.getActive, {});
    expect(active?._id).toEqual(ids.h3);
  });
});
