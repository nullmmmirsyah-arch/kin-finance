/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

process.env.INVITE_SECRET = "test-secret";

const A_TOKEN = "a|hh-inv-target";
const B_TOKEN = "b|hh-inv-target";

describe("invitations targeted household", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed(ctx: any) {
    const h1 = await ctx.db.insert("households", { name: "H1", createdAt: 1, updatedAt: 1 });
    const h2 = await ctx.db.insert("households", { name: "H2", createdAt: 2, updatedAt: 2 });
    const aId = await ctx.db.insert("users", { tokenIdentifier: A_TOKEN, clerkUserId: "c-a" });
    const bId = await ctx.db.insert("users", { tokenIdentifier: B_TOKEN, clerkUserId: "c-b" });
    await ctx.db.insert("householdMemberships", { householdId: h1, userId: aId, role: "owner" });
    await ctx.db.insert("householdMemberships", { householdId: h2, userId: aId, role: "owner" });
    await ctx.db.insert("householdMemberships", { householdId: h1, userId: bId, role: "member" });
    await ctx.db.patch(aId, { activeHouseholdId: h1 });
    return { h1, h2, aId, bId };
  }

  it("create with householdId targets the non-active household", async () => {
    const a = t.withIdentity({ tokenIdentifier: A_TOKEN, subject: "a" });
    const { h2 } = await t.run(async (ctx) => await seed(ctx));
    await a.mutation(api.invitations.create, { householdId: h2 });
    const rows = await t.run(async (ctx: any) =>
      ctx.db.query("invitations").withIndex("by_householdId", (q: any) => q.eq("householdId", h2)).collect(),
    );
    expect(rows).toHaveLength(1);
  });

  it("create with householdId rejects non-members", async () => {
    const a = t.withIdentity({ tokenIdentifier: A_TOKEN, subject: "a" });
    const b = t.withIdentity({ tokenIdentifier: B_TOKEN, subject: "b" });
    const { h2 } = await t.run(async (ctx) => await seed(ctx));
    void a;
    await expect(b.mutation(api.invitations.create, { householdId: h2 })).rejects.toThrow(
      "You are not a member of this household.",
    );
  });

  it("revoke works for an invite of the non-active household", async () => {
    const a = t.withIdentity({ tokenIdentifier: A_TOKEN, subject: "a" });
    const { h2 } = await t.run(async (ctx) => await seed(ctx));
    const { code } = await a.mutation(api.invitations.create, { householdId: h2 });
    expect(typeof code).toEqual("string");
    const inv = await t.run(async (ctx: any) =>
      ctx.db.query("invitations").withIndex("by_householdId", (q: any) => q.eq("householdId", h2)).first(),
    );
    await a.mutation(api.invitations.revoke, { invitationId: inv._id });
    const after = await t.run(async (ctx) => ctx.db.get(inv._id));
    expect(after.revoked).toEqual(true);
  });
});
