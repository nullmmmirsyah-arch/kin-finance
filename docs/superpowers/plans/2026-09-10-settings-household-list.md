# Settings Household List + Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Settings shows one Households list (tap → per-household detail with set-active inline and in detail); invite create/revoke work for non-active households.

**Architecture:** `app/members.tsx` becomes a param-driven detail screen (`?householdId=`, fallback active) — all its mutations already take explicit ids. Only `invitations.create` (add optional `householdId`) and `revoke` (derive household from the invitation doc) need backend changes. Balance-mode toggle moves from the deleted Settings card into the detail screen. Settings keeps zero per-household logic besides `listMine`.

**Tech Stack:** Convex (convex-test, vitest), Expo SDK 54 + expo-router, NativeWind v4, existing `Button`/`Skeleton`/`SelectField`.

## Global Constraints

- After any change to `convex/*.ts`, run `npx convex codegen` first, then `npx tsc --noEmit`.
- Verify with `npm run lint` and `npm test` (vitest — required, touches Convex).
- Never use `style` callback functions on `Pressable`; use `useState` pressed + static `style`/`className`.
- NativeWind `className`; colors only via `useThemeColors()`; `Shadow.card`; Feather icons; English UI copy only.
- Every `convex/*.ts` handler requires sign-in via `ctx.auth.getUserIdentity()` and throws `ConvexError` in mutations.
- Path alias `@/*`. No new dependencies.
- Work on a new `feat/*` branch cut from `review` (the old `.worktrees/feat-multi-household` is stale — do NOT reuse it).

---

## File Structure

| File | Responsibility |
|---|---|
| `convex/invitations.ts` | `create({ householdId? })`, `revoke` derives household from doc |
| `tests/invitations.household.test.ts` (new) | Backend suites for the above |
| `app/members.tsx` | Param-driven detail: target resolution, Set-as-Active button, relocated balance-mode section, invite passes target id |
| `app/(tabs)/settings.tsx` | Single Households card: navigate rows + inline set-active; delete old card, Danger Zone, balance-mode code, switcher sheet |
| PRD | §2.1/§3.x updates + Change Log |

---

### Task 1: Backend — invitations.create householdId + revoke scoping

**Files:**
- Modify: `convex/invitations.ts:29-52` (`create`), `convex/invitations.ts:96-109` (`revoke`)
- Test: `tests/invitations.household.test.ts` (new)

**Interfaces:**
- Consumes: `getUserAndMembership(ctx, householdId?)` (Task-1 multi-household helper).
- Produces: `create({ householdId? }) → { code }` (unchanged return); `revoke({ invitationId })` unchanged signature, new scoping.

- [ ] **Step 1: Write the failing test** (`tests/invitations.household.test.ts`)

```ts
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
    const rows = await t.run(async (ctx) =>
      ctx.db.query("invitations").withIndex("by_householdId", (q: any) => q.eq("householdId", h2)).collect(),
    );
    expect(rows).toHaveLength(1);
  });

  it("create with householdId rejects non-members", async () => {
    const b = t.withIdentity({ tokenIdentifier: B_TOKEN, subject: "b" });
    const { h2 } = await t.run(async (ctx) => await seed(ctx));
    await expect(a.mutation(api.invitations.create, { householdId: h2 })).rejects.toThrow();
  });

  it("revoke works for an invite of the non-active household", async () => {
    const a = t.withIdentity({ tokenIdentifier: A_TOKEN, subject: "a" });
    const { h2 } = await t.run(async (ctx) => await seed(ctx));
    const { code } = await a.mutation(api.invitations.create, { householdId: h2 });
    expect(typeof code).toEqual("string");
    const inv = await t.run(async (ctx) =>
      ctx.db.query("invitations").withIndex("by_householdId", (q: any) => q.eq("householdId", h2)).first(),
    );
    await a.mutation(api.invitations.revoke, { invitationId: inv._id });
    const after = await t.run(async (ctx) => ctx.db.get(inv._id));
    expect(after.revoked).toEqual(true);
  });
});
```

Note: the second test uses variable `a` — define BOTH `a` and `b` identities at its top (the snippet above defines only `b`; add `const a = ...` too — the fixed version is in Step 3's instruction: define both). Write the file with both identities defined in every test that needs them.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/invitations.household.test.ts`
Expected: FAIL — `create` takes no args (`householdId` rejected by validator); `revoke` throws Invitation not found for non-active invite.

- [ ] **Step 3: Minimal implementation** (`convex/invitations.ts`)

Change `create` args + lookup (keep everything else identical):

```ts
export const create = mutation({
  args: { householdId: v.optional(v.id("households")) },
  handler: async (ctx, args) => {
    const { user, membership } = await getUserAndMembership(ctx, args.householdId);
    requireOwner(membership);
    // ... rest unchanged (uses membership.householdId throughout)
```

Rewrite `revoke` handler body (signature unchanged):

```ts
handler: async (ctx, args) => {
  const invitation = await ctx.db.get(args.invitationId);
  if (invitation === null) {
    throw new ConvexError("Invitation not found.");
  }
  const { membership } = await getUserAndMembership(ctx, invitation.householdId);
  requireOwner(membership);

  await ctx.db.patch(args.invitationId, {
    revoked: true,
    updatedAt: Date.now(),
  });
},
```

If `getScopedDoc` becomes unused in `invitations.ts`, remove it from the import (keep `getUserAndMembership, findUserAndMembership, requireOwner`).

- [ ] **Step 4: Run tests + typecheck**

```bash
npx convex codegen && npx vitest run tests/invitations.household.test.ts
```

Expected: PASS (3/3). Then full `npx vitest run` (existing `invitations.autoRevoke`, `invitations.listActive`, `households.multi` stay green) + `npx tsc --noEmit`.

- [ ] **Step 5: Commit** (on the new `feat/*` branch)

```bash
git add convex/invitations.ts tests/invitations.household.test.ts
git commit -m "feat(invites): targeted householdId on create, doc-scoped revoke"
```

---

### Task 2: Members detail — param target, set-active, balance mode, invite wiring

**Files:**
- Modify: `app/members.tsx`

**Interfaces:**
- Consumes: Task 1 (`create({ householdId })`), `api.households.listMine`, `api.households.switchActive`, existing explicit-id mutations.
- Produces: `/members?householdId=` detail usable for any owned/joined household.

- [ ] **Step 1: Param + target resolution.** Replace the `getActive` query (line 39) and add param reading. Change the expo-router import line to include `useLocalSearchParams`:

```tsx
import { useRouter, useLocalSearchParams } from "expo-router";
```

Replace:

```tsx
const household = useQuery(api.households.getActive);
```

with:

```tsx
const { householdId: householdIdParam } = useLocalSearchParams<{ householdId?: string }>();
const mine = useQuery(api.households.listMine);
const activeEntry = mine?.find((m) => m.isActive);
const targetEntry =
  (typeof householdIdParam === "string"
    ? mine?.find((m) => m.household._id === householdIdParam)
    : undefined) ?? activeEntry;
const household = mine === undefined ? undefined : (targetEntry?.household ?? null);
```

Everything downstream (`household?._id` guards, `members`/`invites` queries, rename, timezone, removeMember, transfer, delete/leave) works unchanged against the target. Keep the null→onboarding effect (lines 77-81) and both loading guards (lines 383-414) exactly as-is.

- [ ] **Step 2: Set-as-Active button.** Add mutation + state near the other `useMutation`/`useState` lines:

```tsx
const switchActive = useMutation(api.households.switchActive);
const [isSwitching, setIsSwitching] = useState(false);
```

Add the handler (place next to `handleTimezoneSelect`):

```tsx
const handleSetActive = useCallback(async () => {
  if (!household?._id || targetEntry?.isActive || isSwitching) return;
  setIsSwitching(true);
  try {
    await switchActive({ householdId: household._id });
    void hapticSuccess();
    show(`Switched to ${household.name}`);
  } catch (e: unknown) {
    void hapticError();
    show(getConvexErrorMessage(e, "Failed to switch household."));
  } finally {
    setIsSwitching(false);
  }
}, [household, targetEntry?.isActive, isSwitching, switchActive, show]);
```

Render inside the Household info card, directly below the name row `</View>` that closes at line 500 (before the card's closing `</View>` at line 502), insert:

```tsx
{targetEntry && !targetEntry.isActive ? (
  <Button
    title="Set as Active"
    variant="secondary"
    onPress={handleSetActive}
    loading={isSwitching}
    disabled={isSwitching}
    icon={<Feather name="check" size={18} color={C.primary} />}
  />
) : null}
```

(`Button` accepts `icon` — verified in settings usage `icon={<Feather .../>}`; `C` and `Feather` already in scope.)

- [ ] **Step 3: Relocate balance-mode section.** Add to the `members.tsx` Household info card, after the timezone block (after line 541 `</View>`, before the Danger Zone `<View className="mt-4">` at line 543), the owner toggle copied from settings semantics, bound to the TARGET household:

```tsx
const updateBalanceMode = useMutation(api.households.updateBalanceMode);
const [isUpdatingBalanceMode, setIsUpdatingBalanceMode] = useState(false);
const balanceMode = ((household as unknown as { balanceMode?: "fresh" | "carryOver" })?.balanceMode ?? "fresh") as "fresh" | "carryOver";
const BALANCE_MODE_OPTIONS: { id: "fresh" | "carryOver"; label: string }[] = [
  { id: "fresh", label: "Fresh" },
  { id: "carryOver", label: "Carry Over" },
];
const handleBalanceModeChange = useCallback(
  async (mode: "fresh" | "carryOver") => {
    if (!household?._id || mode === balanceMode || isUpdatingBalanceMode) return;
    setIsUpdatingBalanceMode(true);
    try {
      await updateBalanceMode({ householdId: household._id, balanceMode: mode });
      void hapticSuccess();
      show(`Balance mode: ${mode === "fresh" ? "Fresh" : "Carry Over"}`);
    } catch (e: unknown) {
      show(getConvexErrorMessage(e, "Failed to update balance mode."));
    } finally {
      setIsUpdatingBalanceMode(false);
    }
  },
  [household?._id, balanceMode, isUpdatingBalanceMode, updateBalanceMode, show],
);
```

UI (owner-only toggle; members see the read-only row — same copy as settings):

```tsx
<View className="mt-3">
  <View className="flex-row items-center gap-1.5">
    <Text className="text-[11px] font-semibold tracking-[0.08em] leading-none text-text-secondary dark:text-text-secondary-dark">
      BALANCE MODE
    </Text>
    {isOwner === false ? (
      <View className="flex-row items-center gap-1">
        <Feather name="info" size={12} color={C.textSecondary} />
        <Text className="text-[11px] font-semibold tracking-[0.08em] leading-none text-text-secondary dark:text-text-secondary-dark">OWNER ONLY</Text>
      </View>
    ) : null}
  </View>
  {isOwner ? (
    <View className="mt-2 flex-row overflow-hidden rounded-[12px] border border-border dark:border-border-dark">
      {BALANCE_MODE_OPTIONS.map((option) => {
        const selected = balanceMode === option.id;
        return (
          <Pressable
            key={option.id}
            onPress={() => void handleBalanceModeChange(option.id)}
            disabled={isUpdatingBalanceMode}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`Balance mode ${option.label}`}
            style={{
              backgroundColor: selected ? C.primary : C.background,
              opacity: isUpdatingBalanceMode && !selected ? 0.6 : 1,
            }}
            className="flex-1 items-center justify-center py-3"
          >
            <Text
              className={`text-[14px] font-semibold tracking-[0.02em] leading-5 ${
                selected
                  ? "text-background dark:text-background-dark"
                  : "text-text-secondary dark:text-text-secondary-dark"
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  ) : (
    <View
      style={{ borderRadius: Radius.md, backgroundColor: C.background, borderWidth: 1, borderColor: C.border }}
      className="mt-2 flex-row items-center justify-between px-4 py-3"
    >
      <Text className="text-[14px] font-semibold tracking-[0.02em] leading-5 text-text-primary dark:text-text-primary-dark">
        {balanceMode === "fresh" ? "Fresh" : "Carry Over"}
      </Text>
      <View style={{ backgroundColor: C.surface, borderRadius: 999 }} className="px-2.5 py-1">
        <Text className="text-[11px] font-semibold tracking-[0.08em] leading-none" style={{ color: C.textSecondary }}>
          READ ONLY
        </Text>
      </View>
    </View>
  )}
  <View className="mt-1.5 flex-row items-center gap-1">
    <Feather name="info" size={12} color={C.textSecondary} />
    <Text className="flex-1 text-[13px] leading-4 tracking-wide text-text-secondary dark:text-text-secondary-dark">
      {balanceMode === "fresh" ? "Each period starts fresh" : "Closing balance carries to next period"}
    </Text>
  </View>
</View>
```

- [ ] **Step 4: Invite passes target id.** In `handleGenerateCode` change `createInvite()` → `createInvite({ householdId: household._id })` with an early `if (!household?._id) return;` guard at the top, and add `household` to its dep array. (`revoke` needs no client change — Task 1 derives household server-side.)

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit && npm run lint
```

Expected: clean (fix unused imports if lint flags `api.households.getActive` removal leftovers — the query line itself is deleted in Step 1). Manual: open `/members?householdId=<non-active>` → rename/timezone/members/invite/danger-zone all operate on target; Set as Active switches + badge; stale id falls back to active.

- [ ] **Step 6: Commit**

```bash
git add app/members.tsx
git commit -m "feat(members): param-driven detail with set-active and balance mode"
```

---

### Task 3: Settings — single Households card, inline set-active, remove old sections

**Files:**
- Modify: `app/(tabs)/settings.tsx`

**Interfaces:**
- Consumes: Task 2 detail route, `listMine`, `switchActive`.
- Produces: Settings with one Households card; no per-household logic left.

- [ ] **Step 1: Delete the old single-Household card.** Remove the entire block from the `<View className="mt-6 px-5">` containing the `Household` label + active-household row (pushes `/members`) + BALANCE MODE toggle + its info text — i.e. everything up to (but excluding) the `Appearance` section. Keep `Appearance`, `Categories` sections untouched.

- [ ] **Step 2: Delete the Danger Zone section** (per-household delete/leave now lives in detail). Remove the whole `Danger Zone` `<View className="mt-6 px-5">` block.

- [ ] **Step 3: Rework the Households card rows.** The card already lists `mine` with skeleton + New/Join buttons. Change each row: whole row `onPress` → `router.push(`/members?householdId=${h._id}`)` (replace `setSwitcherOpen(true)`), add `chevron-right` icon, and add the inline control — replace the Active-badge-only trailing with:

```tsx
{isActive ? (
  <View style={{ backgroundColor: `${C.primary}14`, borderRadius: 999 }} className="px-2.5 py-1">
    <Text className="text-[11px] font-semibold tracking-[0.08em] leading-none" style={{ color: C.primary }}>
      Active
    </Text>
  </View>
) : (
  <Pressable
    onPress={() => void handleInlineSwitch(h._id)}
    disabled={switchingId !== null}
    accessibilityRole="button"
    accessibilityLabel={`Set ${h.name} as active household`}
    style={{ opacity: switchingId !== null ? 0.5 : 1 }}
    className="flex-row items-center gap-1 rounded-full border border-border px-3 py-2 dark:border-border-dark"
  >
    {switchingId === h._id ? (
      <ActivityIndicator size="small" color={C.primary} />
    ) : (
      <Feather name="check" size={14} color={C.primary} />
    )}
    <Text className="text-[12px] font-semibold tracking-[0.02em] text-primary dark:text-primary-dark">
      Set active
    </Text>
  </Pressable>
)}
```

Add once near other state/handlers:

```tsx
const switchActive = useMutation(api.households.switchActive);
const [switchingId, setSwitchingId] = useState<Id<"households"> | null>(null);

const handleInlineSwitch = useCallback(
  async (id: Id<"households">) => {
    if (switchingId !== null) return;
    setSwitchingId(id);
    try {
      await switchActive({ householdId: id });
      void hapticSuccess();
      show("Household switched");
    } catch (e: unknown) {
      void hapticError();
      show(getConvexErrorMessage(e, "Failed to switch household."));
    } finally {
      setSwitchingId(null);
    }
  },
  [switchingId, switchActive, show],
);
```

Imports to add: `Id` type from `@/convex/_generated/dataModel`, `ActivityIndicator` (already imported for other spinners — verify, else add). `hapticSuccess/hapticError` already imported.

- [ ] **Step 4: Remove now-dead code.** Delete: `members`/`me` queries, `memberCount`, `isOwner`, `balanceMode` consts + `BALANCE_MODE_OPTIONS`, `handleBalanceModeChange`, `handleDeleteOrLeave`, `updateBalanceMode`/`deleteHousehold`/`leaveHousehold` mutations, `switcherOpen` state + `<HouseholdSwitcher>` usage + its import, `Alert` import if unused afterwards. KEEP: `household = useQuery(api.households.getActive)` + its null→onboarding effect/loading gate (unchanged), `mine`, sign-out, theme, snackbar, New/Join buttons, ScrollView wrapper.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit && npm run lint
```

Expected: clean — no unused imports/vars (lint enforces). Manual: single-household → one row + Active, no buttons; multi → rows navigate to detail, inline Set active switches with spinner; New/Join still open onboarding add-mode; balance mode reachable in detail.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/settings.tsx"
git commit -m "feat(settings): single households list with inline set-active"
```

---

### Task 4: PRD + full verification

**Files:**
- Modify: `docs/Product Requirement Document/PRD.md`

- [ ] **Step 1: PRD updates** — §2.1 Household row: Settings single list → detail param flow + inline/detail set-active (replaces switcher-sheet-in-Settings; Home header switcher stays). Invitations row: `create({ householdId? })` + doc-scoped `revoke`. §3.x user flow: Settings → Household List → detail (rename/timezone/balance-mode/members/invite/danger). Balance-mode location: detail screen (moved from Settings). Append dated Change Log entry `| 2026-09-10 | Feature | **Settings household list + detail** — ... |` in the style of prior entries. Update header "Last updated" line.

- [ ] **Step 2: Full verification**

```bash
npx convex codegen && npx tsc --noEmit && npm run lint && npm test
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add "docs/Product Requirement Document/PRD.md"
git commit -m "docs: settings household list PRD update"
```

---

## Self-Review

**1. Spec coverage:** §1 single list → Task 3. §2 param detail + `invitations.create` param → Tasks 2 + 1. §3 inline set-active + detail button, no inline delete → Tasks 3 + 2 (switcher sheet removed from Settings; Home sheet stays). §4 data flow/fallback → Task 2 resolution + kept null guards. §5 errors (switch fail snackbar, non-member ConvexError, target-scoped invite, single-household no buttons) → Tasks 1–3 code. §6 tests (new invite suite + regression + manual) → Tasks 1, 4. §7 PRD → Task 4. Spec gap found and fixed in plan: balance-mode toggle relocation (was stranded in the deleted Settings card) → Task 2 Step 3.

**2. Placeholder scan:** No TBD/TODO; every code step has exact code; donor code (balance mode) written out fully rather than referenced.

**3. Type consistency:** `create({ householdId? })` / `revoke({ invitationId })` / `switchActive({ householdId })` / `listMine → [{ household, role, isActive }]` used identically across tasks. `Id<"households">` imported in both frontend files. `router.push("/members?householdId=${h._id}")` matches expo-router query params read via `useLocalSearchParams<{ householdId?: string }>`; id comparison `m.household._id === householdIdParam` is string equality on the same serialized id type used elsewhere (`member.userId as Id<"users">` pattern).
