/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|hh-tz-test";
const MEMBER_TOKEN = "member|hh-tz-test";

describe("households timezone", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed(ctx: any) {
    const householdId = await ctx.db.insert("households", {
      name: "TZ HH",
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerId = await ctx.db.insert("users", {
      tokenIdentifier: OWNER_TOKEN,
      clerkUserId: "clerk-owner-hh-tz",
    });
    const memberId = await ctx.db.insert("users", {
      tokenIdentifier: MEMBER_TOKEN,
      clerkUserId: "clerk-member-hh-tz",
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
    return { householdId, ownerId };
  }

  async function seedUser(ctx: any, token: string, clerkUserId: string) {
    return await ctx.db.insert("users", { tokenIdentifier: token, clerkUserId });
  }

  it("create accepts a valid IANA timezone", async () => {
    const owner = t.withIdentity({
      tokenIdentifier: OWNER_TOKEN,
      subject: "owner",
    });
    await t.run(async (ctx) => seedUser(ctx, OWNER_TOKEN, "clerk-owner-hh-tz"));

    const result = await owner.mutation(api.households.create, {
      name: "New HH",
      timezone: "Asia/Jakarta",
    });

    expect(result!.timezone).toBe("Asia/Jakarta");
  });

  it("create accepts an absent timezone (match device)", async () => {
    const owner = t.withIdentity({
      tokenIdentifier: OWNER_TOKEN,
      subject: "owner",
    });
    await t.run(async (ctx) => seedUser(ctx, OWNER_TOKEN, "clerk-owner-hh-tz"));

    const result = await owner.mutation(api.households.create, {
      name: "New HH",
    });

    expect(result!.timezone).toBe(undefined);
  });

  it("create rejects an invalid IANA timezone", async () => {
    const owner = t.withIdentity({
      tokenIdentifier: OWNER_TOKEN,
      subject: "owner",
    });
    await t.run(async (ctx) => seedUser(ctx, OWNER_TOKEN, "clerk-owner-hh-tz"));

    await expect(
      owner.mutation(api.households.create, {
        name: "New HH",
        timezone: "Not/AZone",
      }),
    ).rejects.toThrow();

    const households = await t.run(async (ctx) => {
      const all: any[] = [];
      for await (const hh of ctx.db.query("households")) all.push(hh);
      return all;
    });
    expect(households.length).toBe(0);
  });

  it("updateTimezone accepts a valid IANA timezone", async () => {
    const owner = t.withIdentity({
      tokenIdentifier: OWNER_TOKEN,
      subject: "owner",
    });
    const { householdId } = await t.run(async (ctx) => seed(ctx));

    const result = await owner.mutation(api.households.updateTimezone, {
      householdId,
      timezone: "Asia/Jakarta",
    });

    expect(result!.timezone).toBe("Asia/Jakarta");
  });

  it("updateTimezone rejects an invalid IANA timezone", async () => {
    const owner = t.withIdentity({
      tokenIdentifier: OWNER_TOKEN,
      subject: "owner",
    });
    const { householdId } = await t.run(async (ctx) => seed(ctx));

    await expect(
      owner.mutation(api.households.updateTimezone, {
        householdId,
        timezone: "Not/AZone",
      }),
    ).rejects.toThrow();

    const household = await t.run(async (ctx) =>
      ctx.db.get(householdId as any),
    );
    expect(household!.timezone).toBe(undefined);
  });

  it("member cannot updateTimezone", async () => {
    const member = t.withIdentity({
      tokenIdentifier: MEMBER_TOKEN,
      subject: "member",
    });
    const { householdId } = await t.run(async (ctx) => seed(ctx));

    await expect(
      member.mutation(api.households.updateTimezone, {
        householdId,
        timezone: "Asia/Jakarta",
      }),
    ).rejects.toThrow();
  });
});
