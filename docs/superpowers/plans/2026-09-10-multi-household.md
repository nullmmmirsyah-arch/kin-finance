# Multi-Household per User Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One user can belong to many households (Personal / Family / Business) with a server-side active household, switchable from Home and Settings.

**Architecture:** Add optional `users.activeHouseholdId`; helpers resolve the *active* membership internally (explicit `householdId` override where a mutation targets a non-active household). Existing queries keep their signatures — `getActive` needs no body change — so all current screens keep working untouched. New `listMine` + `switchActive`, opened guards in `create`/`redeem`, active-reassignment in `leave`/`delete`.

**Tech Stack:** Convex (schema, queries, mutations, convex-test), Expo SDK 54 + expo-router, NativeWind v4, `Modal` sheet pattern (like `MonthPicker`), vitest.

## Global Constraints

- After any change to `convex/*.ts`, run `npx convex codegen` first, then `npx tsc --noEmit`.
- Verify with `npm run lint` and `npm test` (vitest — required since this touches Convex functions).
- Never use `style` callback functions on `Pressable` (`style={({ pressed }) => ...}`); use `useState` pressed + static `style`/`className`.
- Use NativeWind `className`, theme via `useThemeColors()` (never hardcode colors, never `Colors` directly), `Shadow.card`, Feather icons.
- Every `convex/*.ts` handler requires sign-in via `ctx.auth.getUserIdentity()` and throws `ConvexError` (never silent nulls in mutations).
- Path alias `@/*` → repo root. Install deps only via `npx expo install` (no new deps needed in this plan).

---

## File Structure

| File | Responsibility |
|---|---|
| `convex/schema.ts` | + `activeHouseholdId?: v.id("households")` on `users` (only schema change) |
| `convex/helpers.ts` | Active-resolution core: `getUserAndMembership(ctx, householdId?)`, `findUserAndMembership(ctx, householdId?)` |
| `convex/households.ts` | `listMine`, `switchActive`, opened `create`, active-reassign in `leave`/`delete`, explicit id in `transfer`/`updateBalanceMode`/`updatePeriodType` |
| `convex/invitations.ts` | `redeem`: per-household duplicate guard, returns `{ householdId }`, sets active if first |
| `components/HouseholdSwitcher.tsx` (new) | `Modal` bottom sheet listing households, tap to switch (pattern: `MonthPicker`) |
| `app/(tabs)/home.tsx` | Household name in header becomes tappable → opens switcher |
| `app/(tabs)/settings.tsx` | New Households card: list + switch + Create/Join buttons |
| `app/onboarding.tsx` | `add=1` mode: hides sign-out, shows Pindah/Tetap dialog after success |
| `tests/households.multi.test.ts` (new) | Backend suites for resolution, switch, create-2nd, redeem-2nd, leave/delete-active, listMine |
| Existing tests asserting old guards | Updated expectations (create-2nd now succeeds, redeem-2nd now succeeds) |

**Key plan decision (refines spec §2):** helpers take an *optional* `householdId`. When omitted they resolve the active household internally. This keeps ~30 existing call sites (`accounts.list`, `categories.*`, `transactions.*`, `budgets.*`, `periodBalances.*`, …) byte-identical — no arg plumbing through the whole backend, no frontend query changes. Explicit id is passed only where a mutation targets a possibly-non-active household (`delete`/`leave`/`transfer`/`updateBalanceMode`/`updatePeriodType`).

---

### Task 1: Backend foundation — schema, helpers, listMine, switchActive

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/helpers.ts`
- Modify: `convex/households.ts` (add `listMine`, `switchActive`; `getActive` body UNCHANGED)
- Test: `tests/households.multi.test.ts` (new, suites 1–2)

**Interfaces:**
- Consumes: existing `householdMemberships` rows (`by_userId` index), `users` rows.
- Produces: `getUserAndMembership(ctx, householdId?) → { user, membership }` (throws), `findUserAndMembership(ctx, householdId?) → { user, membership } | null`, `api.households.listMine → [{ household, role, isActive }]`, `api.households.switchActive({ householdId }) → household | null`.

- [ ] **Step 1: Write failing tests (suites 1–2)**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/households.multi.test.ts`
Expected: FAIL — `switchActive` / `listMine` do not exist; `activeHouseholdId` unknown.

- [ ] **Step 3: Implement schema + helpers + listMine + switchActive**

`convex/schema.ts` — add one field to `users`:

```ts
users: defineTable({
  tokenIdentifier: v.string(),
  clerkUserId: v.string(),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  activeHouseholdId: v.optional(v.id("households")),
}).index("by_tokenIdentifier", ["tokenIdentifier"]),
```

`convex/helpers.ts` — replace `findUserAndMembership` and `getUserAndMembership` with:

```ts
import { ConvexError } from "convex/values";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

type AnyCtx = QueryCtx | MutationCtx;

async function findUserRow(ctx: AnyCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
}

async function membershipsOf(ctx: AnyCtx, userId: Id<"users">) {
  return await ctx.db
    .query("householdMemberships")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
}

async function resolveActive(
  ctx: AnyCtx,
  user: Doc<"users">,
  memberships: Doc<"householdMemberships">[],
): Promise<Doc<"householdMemberships"> | null> {
  if (memberships.length === 0) return null;
  const activeId = (user as { activeHouseholdId?: Id<"households"> }).activeHouseholdId;
  if (activeId !== undefined) {
    const hit = memberships.find((m) => m.householdId === activeId);
    if (hit !== undefined) return hit;
  }
  const withDates = await Promise.all(
    memberships.map(async (m) => ({
      m,
      createdAt: (await ctx.db.get(m.householdId))?.createdAt ?? Number.MAX_SAFE_INTEGER,
    })),
  );
  withDates.sort((a, b) => a.createdAt - b.createdAt);
  return withDates[0].m;
}

export async function findUserAndMembership(ctx: AnyCtx, householdId?: Id<"households">) {
  const user = await findUserRow(ctx);
  if (user === null) return null;
  const memberships = await membershipsOf(ctx, user._id);
  if (householdId !== undefined) {
    const membership = memberships.find((m) => m.householdId === householdId) ?? null;
    if (membership === null) return null;
    return { user, membership };
  }
  const membership = await resolveActive(ctx, user, memberships);
  if (membership === null) return null;
  return { user, membership };
}

export async function getUserAndMembership(ctx: MutationCtx, householdId?: Id<"households">) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new ConvexError("You are not signed in.");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (user === null) {
    throw new ConvexError("User not found.");
  }
  const memberships = await membershipsOf(ctx, user._id);
  if (householdId !== undefined) {
    const membership = memberships.find((m) => m.householdId === householdId);
    if (membership === undefined) {
      throw new ConvexError("You are not a member of this household.");
    }
    return { user, membership };
  }
  const membership = await resolveActive(ctx, user, memberships);
  if (membership === null) {
    throw new ConvexError("You are not a member of a household.");
  }
  return { user, membership };
}
```

Keep `requireOwner`, `getScopedDoc`, `findUser` exactly as-is. Delete the old `.first()` / `.unique()` membership lookups.

`convex/households.ts` — append (keep `getActive` body unchanged; it now resolves active via the helper):

```ts
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const result = await findUserAndMembership(ctx);
    if (result === null) return [];
    const { user } = result;
    const memberships = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const out: { household: Doc<"households">; role: "owner" | "member"; isActive: boolean }[] = [];
    for (const m of memberships) {
      const h = await ctx.db.get(m.householdId);
      if (h === null) continue;
      out.push({ household: h, role: m.role, isActive: false });
    }
    out.sort((a, b) => a.household.createdAt - b.household.createdAt);
    const activeId = (user as { activeHouseholdId?: typeof out[0]["household"]["_id"] }).activeHouseholdId;
    const effective = activeId !== undefined && out.some((o) => o.household._id === activeId)
      ? activeId
      : out[0]?.household._id;
    for (const o of out) o.isActive = o.household._id === effective;
    return out;
  },
});

export const switchActive = mutation({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const { user } = await getUserAndMembership(ctx, args.householdId);
    const household = await ctx.db.get(args.householdId);
    if (household === null) {
      throw new ConvexError("Household not found.");
    }
    await ctx.db.patch(user._id, { activeHouseholdId: args.householdId });
    return household;
  },
});
```

Add `findUserAndMembership` to the existing import from `./helpers` in `households.ts` if missing (it already imports it). Also add `import type { Doc } from "./_generated/dataModel";` for the `listMine` row type.

- [ ] **Step 4: Regen + run tests**

```bash
npx convex codegen && npx vitest run tests/households.multi.test.ts
```

Expected: PASS (4/4). Then `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/helpers.ts convex/households.ts tests/households.multi.test.ts
git commit -m "feat(households): server-side active household, listMine, switchActive"
```

---

### Task 2: Open create/redeem, reassign active on leave/delete, explicit ids

**Files:**
- Modify: `convex/households.ts` (`create`, `leaveHousehold`, `deleteHousehold`, `transferOwnership`, `updateBalanceMode`, `updatePeriodType`)
- Modify: `convex/invitations.ts` (`redeem`)
- Test: extend `tests/households.multi.test.ts` (suites 3–5); update old-guard expectations in existing tests

**Interfaces:**
- Consumes: Task 1 helpers + `switchActive` semantics.
- Produces: `create` (unchanged return: household doc) sets active only for first-ever household; `redeem` returns `{ householdId }`; leave/delete move caller active to oldest remaining or clear it.

- [ ] **Step 1: Write failing tests (suites 3–5)** — append to `tests/households.multi.test.ts`:

```ts
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
    const b = t.withIdentity({ tokenIdentifier: B_TOKEN, subject: "b" });
    const ids = await t.run(async (ctx) => {
      const h1 = await ctx.db.insert("households", { name: "H1", createdAt: 1, updatedAt: 1 });
      const h2 = await ctx.db.insert("households", { name: "H2", createdAt: 2, updatedAt: 2 });
      const aId = await ctx.db.insert("users", { tokenIdentifier: A_TOKEN, clerkUserId: "c-a" });
      const bId = await ctx.db.insert("users", { tokenIdentifier: B_TOKEN, clerkUserId: "c-b" });
      await ctx.db.insert("householdMemberships", { householdId: h1, userId: aId, role: "owner" });
      await ctx.db.insert("householdMemberships", { householdId: h1, userId: bId, role: "member" });
      await ctx.db.insert("householdMemberships", { householdId: h2, userId: aId, role: "owner" });
      await ctx.db.patch(aId, { activeHouseholdId: h1 });
      return { h1, h2, aId };
    });
    await b.mutation(api.households.leaveHousehold, { householdId: ids.h1 });
    const active = await a.query(api.households.getActive, {});
    expect(active?._id).toEqual(ids.h2);
  });
});
```

(Redeem-2nd test needs `INVITE_SECRET`; set `process.env.INVITE_SECRET = "test-secret"` at top of file and note `invitations.create` requires owner + active context. Keep the redeem suite minimal: owner creates code for active household, second user redeems while already member elsewhere → succeeds and returns `{ householdId }`; redeeming again for the same household → throws "You are already a member of this household.")

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/households.multi.test.ts`
Expected: FAIL — `create` throws "You already have a household.", `leaveHousehold` uses `.unique()`-era helper.

- [ ] **Step 3: Minimal implementation**

In `convex/households.ts` `create`: replace the block

```ts
const existingMembership = await ctx.db
  .query("householdMemberships")
  .withIndex("by_userId", (q) => q.eq("userId", user._id))
  .first();

if (existingMembership) {
  throw new ConvexError("You already have a household.");
}
```

with:

```ts
const priorMemberships = await ctx.db
  .query("householdMemberships")
  .withIndex("by_userId", (q) => q.eq("userId", user._id))
  .collect();
const isFirstHousehold = priorMemberships.length === 0;
```

and after inserting the owner membership, add:

```ts
if (isFirstHousehold) {
  await ctx.db.patch(user._id, { activeHouseholdId: householdId });
}
```

In `leaveHousehold` and `deleteHousehold`: change `getUserAndMembership(ctx)` → `getUserAndMembership(ctx, args.householdId)`, and after deleting the membership (leave) / cascade (delete), reassign caller active:

```ts
const remaining = await ctx.db
  .query("householdMemberships")
  .withIndex("by_userId", (q) => q.eq("user._id" as never, user._id))
  .collect();
```

Correction — use the real field (no cast needed):

```ts
const { user } = await getUserAndMembership(ctx, args.householdId);
// ... existing delete logic ...
const remaining = await ctx.db
  .query("householdMemberships")
  .withIndex("by_userId", (q) => q.eq("userId", user._id))
  .collect();
if (remaining.length === 0) {
  await ctx.db.patch(user._id, { activeHouseholdId: undefined });
} else {
  const withDates = await Promise.all(
    remaining.map(async (m) => ({
      id: m.householdId,
      createdAt: (await ctx.db.get(m.householdId))?.createdAt ?? Number.MAX_SAFE_INTEGER,
    })),
  );
  withDates.sort((a, b) => a.createdAt - b.createdAt);
  await ctx.db.patch(user._id, { activeHouseholdId: withDates[0].id });
}
```

Note: `deleteHousehold` currently destructures only `{ membership }`; change to `{ user, membership }`. Same for `leaveHousehold`. For `deleteHousehold`, compute reassignment AFTER `cascadeDelete` (memberships already gone).

In `transferOwnership`, `updateBalanceMode`, `updatePeriodType`: change `getUserAndMembership(ctx)` → `getUserAndMembership(ctx, args.householdId)`. Their existing `membership.householdId !== args.householdId` checks become redundant but harmless — leave them.

In `convex/invitations.ts` `redeem`: replace

```ts
const existingMembership = await ctx.db
  .query("householdMemberships")
  .withIndex("by_userId", (q) => q.eq("userId", user._id))
  .first();

if (existingMembership !== null) {
  throw new ConvexError("You are already a member of a household.");
}
```

with:

```ts
const myMemberships = await ctx.db
  .query("householdMemberships")
  .withIndex("by_userId", (q) => q.eq("userId", user._id))
  .collect();
```

Move invitation lookup BEFORE the duplicate check is impossible (need `invitation.householdId`); keep hash lookup where it is, then after validity checks and before insert add:

```ts
if (myMemberships.some((m) => m.householdId === invitation.householdId)) {
  throw new ConvexError("You are already a member of this household.");
}
```

After insert + `useCount` patch, add:

```ts
if (myMemberships.length === 0) {
  await ctx.db.patch(user._id, { activeHouseholdId: invitation.householdId });
}
return { householdId: invitation.householdId };
```

- [ ] **Step 4: Update old-guard expectations** — search tests for `"You already have a household."` and `"You are already a member of a household."` (old meaning). The redeem old-guard message string is reused with a NEW meaning (same household) — update any test that redeems while member elsewhere to expect success. Run full suite:

```bash
npx convex codegen && npx vitest run tests/households.multi.test.ts
```

Expected: PASS. Then `npx vitest run` (whole suite) — fix fallout, then `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add convex/households.ts convex/invitations.ts tests/
git commit -m "feat(households): multi create/join, active reassignment on leave/delete"
```

---

### Task 3: HouseholdSwitcher component + Home header

**Files:**
- Create: `components/HouseholdSwitcher.tsx`
- Modify: `app/(tabs)/home.tsx` (header tap → sheet; add `listMine` query)
- Test: typecheck + lint + manual (no RN testing lib in repo)

**Interfaces:**
- Consumes: `api.households.listMine`, `api.households.switchActive`.
- Produces: `<HouseholdSwitcher visible onClose activeId />` — self-contained sheet; parent only toggles visibility.

- [ ] **Step 1: Write the component** (`components/HouseholdSwitcher.tsx`), following the `MonthPicker` Modal pattern (transparent overlay, bottom card, `Shadow.card`, `useThemeColors`, Feather `check`/`chevron-down`):

```tsx
import { api } from "@/convex/_generated/api";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { getConvexErrorMessage } from "@/lib/errors";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { useSnackbar } from "@/components/Snackbar";
import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";

export function HouseholdSwitcher({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const C = useThemeColors();
  const { show } = useSnackbar();
  const mine = useQuery(api.households.listMine);
  const switchActive = useMutation(api.households.switchActive);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const handleSelect = async (householdId: string, isActive: boolean) => {
    if (isActive || switchingId !== null) {
      if (isActive) onClose();
      return;
    }
    setSwitchingId(householdId);
    try {
      await switchActive({ householdId: householdId as never });
      void hapticSuccess();
      onClose();
    } catch (e: unknown) {
      void hapticError();
      show(getConvexErrorMessage(e, "Failed to switch household."));
    } finally {
      setSwitchingId(null);
    }
  };
  // ... Modal with overlay Pressable (onClose) + card listing mine ?? skeleton rows ...
}
```

Correction for the mutation arg typing — use the generated id type instead of `as never`:

```tsx
import { Id } from "@/convex/_generated/dataModel";
const handleSelect = async (householdId: Id<"households">, isActive: boolean) => { ... await switchActive({ householdId }); ... };
```

Rows: household name (semibold) + role label (`Owner`/`Member`, secondary color) + right side `check` icon in `C.primary` when active else nothing; switching row shows `ActivityIndicator`. Tapping active row just closes. `mine === undefined` → 2 skeleton rows (pulsing Views); `mine.length <= 1` → sheet still opens but single row (tap closes) — Home only shows affordance when `> 1` (below).

- [ ] **Step 2: Wire Home header** (`app/(tabs)/home.tsx:637-648`): add `const mine = useQuery(api.households.listMine);` and `[switcherOpen, setSwitcherOpen] = useState(false)`. Replace the centered household-name View with:

```tsx
{mine !== undefined && mine.length > 1 ? (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Switch household, current ${household.name}`}
    onPress={() => setSwitcherOpen(true)}
    className="mb-3 flex-row items-center justify-center gap-1"
  >
    <Text className="text-[18px] font-bold tracking-[-0.02em] leading-6 text-text-primary dark:text-text-primary-dark">
      {household.name} Household
    </Text>
    <Feather name="chevron-down" size={18} color={C.secondary} />
  </Pressable>
) : (
  <View className="mb-3 items-center gap-1">
    <Text className="text-[18px] font-bold tracking-[-0.02em] leading-6 text-text-primary dark:text-text-primary-dark">
      {household.name} Household
    </Text>
  </View>
)}
```

(`C.secondary` must exist in theme — verify against `constants/theme.ts`; if the token is named differently use the correct secondary-text token.) Render `<HouseholdSwitcher visible={switcherOpen} onClose={() => setSwitcherOpen(false)} />` near the root. No `style` callback on Pressable (NativeWind gotcha).

Note: after a switch, Home's `selectedPeriodStart` re-anchors via the existing effect (`home.tsx:266-276`) — no reset code needed.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npm run lint
```

Expected: clean. Manual: `expo start`, two households, tap header → switch → all tabs show new context.

- [ ] **Step 4: Commit**

```bash
git add components/HouseholdSwitcher.tsx "app/(tabs)/home.tsx"
git commit -m "feat(home): household switcher in header"
```

---

### Task 4: Settings Households section + onboarding add-mode + Pindah/Tetap

**Files:**
- Modify: `app/(tabs)/settings.tsx` (Households card)
- Modify: `app/onboarding.tsx` (`add=1` mode + dialog)
- Test: typecheck + lint + manual

**Interfaces:**
- Consumes: `api.households.listMine`, `api.households.switchActive`, `api.households.create` (returns doc), `api.invitations.redeem` (returns `{ householdId }`), `HouseholdSwitcher`.
- Produces: Settings card + onboarding add flow ending in Pindah/Tetap `Alert`.

- [ ] **Step 1: Settings Households card** — above the Danger Zone: a `Shadow.card` section titled "Households" listing `listMine` (name + role + `Aktif` badge in `C.primary`), tap row → opens the same `HouseholdSwitcher` (local `visible` state). Two buttons: "New Household" → `router.push("/onboarding?mode=create&add=1")`, "Join with Code" → `router.push("/onboarding?mode=join&add=1")`. Use `Button` with `variant="secondary"` (exists — see `InviteCodeDisplay.tsx:84`) + Feather `plus`/`user-plus`. Loading state: `Skeleton` rows (`components/Skeleton.tsx`) while `mine === undefined`.

- [ ] **Step 2: Onboarding add-mode** (`app/onboarding.tsx`): read `useLocalSearchParams<{ mode?: Mode; add?: string }>()` from expo-router; initial `mode` from param when valid; `const isAdd = add === "1"`. When `isAdd`: hide the "Back to login" Pressable, change subtitle to "Add another household…". After success:

```tsx
const switchActive = useMutation(api.households.switchActive);
// create:
const created = await createHousehold({ name: trimmedName, timezone: ... });
// join:
const joined = await redeemInvite({ code: trimmedCode });
const newId = created?._id ?? joined.householdId;
if (!isAdd) {
  router.replace("/home");
  return;
}
Alert.alert("Household added", `Switch to ${trimmedName || "the new household"} now?`, [
  { text: "Stay here", style: "cancel", onPress: () => router.replace("/home") },
  {
    text: "Switch",
    onPress: async () => {
      try {
        await switchActive({ householdId: newId });
        void hapticSuccess();
      } catch (e: unknown) {
        void hapticError();
        setError(getConvexErrorMessage(e, "Added, but failed to switch."));
        return;
      }
      router.replace("/home");
    },
  },
]);
```

For the join branch the display name is unknown — use generic `"Switch to the new household now?"`. Add missing imports (`Alert`, `useLocalSearchParams`, `useMutation` already there, `hapticSuccess/hapticError` from `@/lib/haptics`).

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npm run lint
```

Expected: clean. Manual: Settings → New Household → create → dialog → Switch lands in empty household; Stay keeps old context with new row in switcher. Same for Join.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/settings.tsx" app/onboarding.tsx
git commit -m "feat(settings): households section, onboarding add-mode with switch dialog"
```

---

### Task 5: Docs + full verification

**Files:**
- Modify: `docs/Product Requirement Document/PRD.md`, `CONTEXT.md` (1 line if it restates one-household)

**Interfaces:**
- Consumes: implemented behavior from Tasks 1–4.

- [ ] **Step 1: PRD updates** — §1 Platform & Environment: replace "All financial data is scoped to exactly one Household per user (MVP)." with "A user can belong to many Households (Personal / Family / Business); one is active at a time (server-side, follows across devices)." Constraints: replace "One Household per user in MVP; no household switching" with role-per-household + switcher note. §2.1 Household row: `listMine`/`switchActive`, create/join-N, leave/delete active-reassignment, Pindah/Tetap dialog. Invitations row: redeem-while-member-elsewhere allowed, same-household duplicate rejected. §2.3 matrix header: roles are per-household. §6 schema: `users.activeHouseholdId` + new functions table rows. Append dated Change Log entry (2026-09-10 Feature, mirroring style of the 2026-09-04 entry).

- [ ] **Step 2: Full verification**

```bash
npx convex codegen && npx tsc --noEmit && npm run lint && npm test
```

Expected: all green (vitest full suite, incl. `tests/households.multi.test.ts`).

- [ ] **Step 3: Commit**

```bash
git add "docs/Product Requirement Document/PRD.md" CONTEXT.md
git commit -m "docs: multi-household PRD update"
```

---

## Self-Review

**1. Spec coverage:** §2 schema → Task 1. Resolution/fallback → Task 1. `listMine`/`switchActive` → Task 1. `create` guard removal + first-active → Task 2. `redeem` per-household guard + return → Task 2. Leave/delete reassignment → Task 2. Explicit ids on household-targeted mutations → Task 2. Hook/switcher Home → Task 3 (hook folded into component — no separate file; justified: single consumer pair, YAGNI). Settings list + create/join + dialog → Task 4. Error handling (non-member switch, orphan active, offline skeleton, same-household redeem) → Tasks 1–4 code + tests. Testing section → Tasks 1–2 suites + Task 5 full run. PRD impact → Task 5.

**2. Placeholder scan:** No TBD/TODO; every step has exact code/commands. One deliberate correction embedded in Task 2 Step 3 (bad `.collect()` snippet immediately replaced with the correct field version). Task 3 Step 1 embeds the `as never` → `Id<"households">` correction inline.

**3. Type consistency:** `getUserAndMembership(ctx, householdId?)` / `findUserAndMembership(ctx, householdId?)` signatures identical across Tasks 1–2. `switchActive({ householdId })` / `listMine({})` / `redeem → { householdId }` / `create → Doc<"households"> | null` used consistently in Tasks 3–4. `isActive`/`role` fields from `listMine` match switcher rows. `router.replace("/home")` and `router.push("/onboarding?mode=…&add=1")` match existing route strings.
