# Revoke Invite UI + Home Recent Transactions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up invite revocation in the Members UI and replace the static "Recent Transactions" placeholder on the Home tab with real data.

**Architecture:** Two small features, each a backend + frontend pairing. Backend: `invitations.create` gains auto-revoke of previous active invites; a new `transactions.recent` query returns the newest N transactions. Frontend: `app/members.tsx` renders a "Pending Invites" section (owner-only) with per-row Revoke; `app/(tabs)/home.tsx` renders up to 5 real `TransactionCard`s plus a "See All" link.

**Tech Stack:** Expo SDK 54, expo-router, React Native, NativeWind v4, Convex (queries/mutations), Clerk auth.

**Spec:** `docs/superpowers/specs/2026-08-11-home-recent-invite-revoke-design.md`

## Global Constraints

- No test framework exists. Verify with `npx tsc --noEmit` (typecheck) and `npm run lint` (expo lint).
- After any change to `convex/*.ts`, run `npx convex codegen` FIRST to regenerate `convex/_generated/`, then typecheck.
- Backend invariants (per `docs/ARCHITECTURE.md`): every handler requires sign-in via `ctx.auth.getUserIdentity()` and throws `ConvexError` with plain-string messages; amounts are signed (+income, −expense, +transfer magnitude); owner vs member permission matrix.
- User-facing errors: use `getConvexErrorMessage(e, fallback)` from `@/lib/errors` + `setError` or snackbar — never raw backend errors.
- Styling: NativeWind `className` only (no `StyleSheet.create`); import theme from `constants/theme.ts`; `dark:` variants; icons from `@expo/vector-icons/Feather`.
- **NativeWind v4 gotcha:** Never use `style` callback functions on `Pressable` (breaks all style rendering). Use `useState` for pressed state + static `style`/`className`.
- Invite codes are hashed server-side; plaintext is shown once at generation. The Pending Invites UI must NOT attempt to display the code.

---

### Task 1: Backend — `invitations.create` auto-revokes previous active invites

**Files:**
- Modify: `convex/invitations.ts:58-115` (`create` handler)

**Interfaces:**
- Consumes: existing `getUserAndMembership` helper, `crypto`, `hmacHash`.
- Produces: unchanged `create` signature (args `{}`, returns `{ code: string }`) — but now guarantees at most one active invite per household.

- [ ] **Step 1: Insert the auto-revoke block**

In the `create` handler, immediately after `const expiresAt = now + SEVEN_DAYS_MS;` (line 73) and before the `let code: string;` declaration, insert:

```ts
    const existingInvites = await ctx.db
      .query("invitations")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", membership.householdId),
      )
      .collect();

    for (const inv of existingInvites) {
      if (!inv.revoked && inv.expiresAt > now && inv.useCount < inv.maxUses) {
        await ctx.db.patch(inv._id, {
          revoked: true,
          updatedAt: now,
        });
      }
    }
```

The existing `const now = Date.now();` line stays as-is. The loop uses the existing `now` variable.

- [ ] **Step 2: Regenerate Convex types**

Run: `npx convex codegen`
Expected: succeeds and regenerates `convex/_generated/`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors (or only pre-existing warnings).

- [ ] **Step 5: Commit**

```bash
git add convex/invitations.ts
git commit -m "feat: auto-revoke previous active invite on new code generation"
```

---

### Task 2: Backend — new `transactions.recent` query

**Files:**
- Modify: `convex/transactions.ts:212-274` (add after `list`)

**Interfaces:**
- Consumes: `query`, `v`, `ctx.auth.getUserIdentity`, index `by_household_date`.
- Produces: `recent` with args `{ limit?: number }` returning `{ transactions: (TransactionDoc & { category?: Category; account?: Account; toAccount?: Account })[] | null, isOwner: boolean }`. Newest-first. Non-owners skip transactions whose category exists and `category.hidden` — identical to `list`.

- [ ] **Step 1: Add the `recent` query**

Immediately after the closing of the `list` query (after line 274), add:

```ts
export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return { transactions: null, isOwner: false };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      return { transactions: null, isOwner: false };
    }

    const membership = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (membership === null) {
      return { transactions: null, isOwner: false };
    }

    const isOwner = membership.role === "owner";
    const limit = Math.min(Math.max(args.limit ?? 5, 1), 10);

    const rows = await ctx.db
      .query("transactions")
      .withIndex("by_household_date", (q) =>
        q.eq("householdId", membership.householdId),
      )
      .order("desc")
      .take(limit);

    const transactions = [];
    for (const row of rows) {
      const category =
        row.categoryId === undefined
          ? undefined
          : ((await ctx.db.get(row.categoryId)) ?? undefined);
      if (!isOwner && category !== undefined && category.hidden) {
        continue;
      }
      const account = (await ctx.db.get(row.accountId)) ?? undefined;
      const toAccount =
        row.toAccountId === undefined
          ? undefined
          : ((await ctx.db.get(row.toAccountId)) ?? undefined);
      transactions.push({ ...row, category, account, toAccount });
    }

    return { transactions, isOwner };
  },
});
```

- [ ] **Step 2: Regenerate Convex types**

Run: `npx convex codegen`
Expected: succeeds; `convex/_generated/api.d.ts` now includes `recent`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add convex/transactions.ts
git commit -m "feat: add transactions.recent query for home screen"
```

---

### Task 3: Frontend — Pending Invites section in `app/members.tsx`

**Files:**
- Modify: `app/members.tsx` (imports, hooks, handler, render function, two render sites)

**Interfaces:**
- Consumes: `api.invitations.listActive` (args `{ householdId }` → `Invitation[]`), `api.invitations.revoke` (args `{ invitationId }` → `void`), `formatDateShort(timestamp: number): string`, `Button` (supports `variant="danger"`, `className`), `Shadow.card`, `Radius.md`, theme colors, `getConvexErrorMessage`.
- Produces: `handleRevoke(invitationId: Id<"invitations">)` callback; `renderPendingInvites()` function returning JSX (or `null`).

- [ ] **Step 1: Add imports**

Add `import { formatDateShort } from "@/utils/date";` after the `useSnackbar` import (line 24). Existing imports already include `Alert`, `useCallback`, `useQuery`, `useMutation`, `Button`, `Shadow`, `Radius`, `Id`, `getConvexErrorMessage`.

- [ ] **Step 2: Add hooks and handler**

After `const updateHousehold = useMutation(api.households.update);` (line 42), add:

```ts
  const invites = useQuery(
    api.invitations.listActive,
    household?._id ? { householdId: household._id } : "skip",
  );
  const revokeInvite = useMutation(api.invitations.revoke);
```

After the `handleRemoveMember` callback (after line 101), add:

```ts
  const handleRevoke = useCallback(
    (invitationId: Id<"invitations">) => {
      Alert.alert(
        "Revoke Invite",
        "Revoke this invite code? It can no longer be used to join your household.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Revoke",
            style: "destructive",
            onPress: async () => {
              try {
                await revokeInvite({ invitationId });
                show("Invite revoked");
              } catch (e: any) {
                setError(getConvexErrorMessage(e, "Failed to revoke invite."));
              }
            },
          },
        ],
      );
    },
    [revokeInvite, show],
  );
```

- [ ] **Step 3: Add `renderPendingInvites`**

After `handleSaveRename` (after line 137), before the `if (screen === "invite" && inviteCode)` block, add:

```tsx
  const renderPendingInvites = () => {
    if (!isOwner || !Array.isArray(invites) || invites.length === 0) {
      return null;
    }
    return (
      <View className="mb-6">
        <Text className="mb-2 text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
          Pending Invites
        </Text>
        <View
          style={[
            Shadow.card,
            {
              borderRadius: Radius.md,
              backgroundColor: C.background,
              borderWidth: 1,
              borderColor: C.border,
            },
          ]}
          className="gap-3 px-4 py-4"
        >
          {invites.map((inv) => (
            <View
              key={inv._id}
              className="flex-row items-center justify-between gap-3"
            >
              <View className="flex-1">
                <Text className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                  Invite code
                </Text>
                <Text className="mt-0.5 text-xs text-text-secondary dark:text-text-secondary-dark">
                  Created {formatDateShort(inv.createdAt)} · Expires{" "}
                  {formatDateShort(inv.expiresAt)}
                </Text>
              </View>
              <Button
                title="Revoke"
                variant="danger"
                className="h-10 w-auto px-4"
                onPress={() => handleRevoke(inv._id)}
              />
            </View>
          ))}
        </View>
      </View>
    );
  };
```

- [ ] **Step 4: Render in the solo-member branch**

In the `members.members.length === 1` branch (line 289), insert `{renderPendingInvites()}` as the first child inside `<View className="mt-6 flex-1 px-5">`, before the EmptyState card:

```tsx
      {members.members.length === 1 ? (
        <View className="mt-6 flex-1 px-5">
          {renderPendingInvites()}
          <View
            style={{ backgroundColor: C.background }}
            className="rounded-[16px]"
          >
            <EmptyState ... />
          </View>
        </View>
      ) : (
```

- [ ] **Step 5: Render as FlatList header**

In the else branch, add `ListHeaderComponent` to the `FlatList` (keep `contentContainerClassName="gap-3 px-5 pb-28"`):

```tsx
        <FlatList
          className="mt-4 flex-1"
          contentContainerClassName="gap-3 px-5 pb-28"
          data={members.members}
          keyExtractor={(item) => item.userId}
          ListHeaderComponent={
            <View className="mb-3">{renderPendingInvites()}</View>
          }
          renderItem={({ item }) => (
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors. (Run `npx convex codegen` first if Task 2 codegen is not already done — it is.)

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/members.tsx
git commit -m "feat: add pending invite revocation to members screen"
```

---

### Task 4: Frontend — Real Recent Transactions on `app/(tabs)/home.tsx`

**Files:**
- Modify: `app/(tabs)/home.tsx:199-213` (Recent Transactions block) + imports

**Interfaces:**
- Consumes: `api.transactions.recent` (args `{ limit?: number }`), `TransactionCard` (props: `categoryName: string | null`, `isTransfer: boolean`, `toAccountName?: string`, `note: string | null`, `amount: number`, `type: "income" | "expense" | "transfer"`, `date: number`, `onPress: () => void`).
- Produces: Home "Recent Transactions" section rendering up to 5 real transactions + "See All" link to `/transactions`.

- [ ] **Step 1: Add import**

Add `import { TransactionCard } from "@/components/TransactionCard";` with the other component imports (after the `Button` import, line 12). Existing imports already include `ActivityIndicator`, `Pressable`, `ScrollView`, `Text`, `View`, `EmptyState`, `useQuery`.

- [ ] **Step 2: Add the query hook**

After `const accountData = useQuery(api.accounts.list);` (line 27), add:

```ts
  const recentTx = useQuery(api.transactions.recent, { limit: 5 });
```

- [ ] **Step 3: Replace the Recent Transactions block**

Replace lines 199-213 (the static `<EmptyState icon="book-open" .../>` inside the Recent Transactions card) with:

```tsx
        <View className="mt-8">
          <View className="flex-row items-center justify-between">
            <Text className="mb-1 text-xl font-semibold text-text-primary dark:text-text-primary-dark">
              Recent Transactions
            </Text>
            <Pressable
              onPress={() => router.push("/transactions")}
              accessibilityRole="button"
              className="min-h-12 items-center justify-center"
            >
              <Text className="text-sm font-medium text-primary dark:text-primary-dark">
                See All
              </Text>
            </Pressable>
          </View>
          <View
            style={{ backgroundColor: C.background }}
            className="mt-2 rounded-[16px]"
          >
            {recentTx === undefined ? (
              <View className="items-center px-4 py-4">
                <ActivityIndicator size="small" color={C.primary} />
              </View>
            ) : recentTx.transactions === null ? (
              <Text className="px-4 py-4 text-center text-sm text-text-secondary dark:text-text-secondary-dark">
                You are not a member of a household.
              </Text>
            ) : recentTx.transactions.length === 0 ? (
              <EmptyState
                icon="book-open"
                title="No transactions yet"
                description="Start by recording your first transaction"
              />
            ) : (
              <View className="gap-1 px-2 py-2">
                {recentTx.transactions.slice(0, 5).map((item) => (
                  <TransactionCard
                    key={item._id}
                    categoryName={item.category?.name ?? null}
                    isTransfer={item.type === "transfer"}
                    toAccountName={item.toAccount?.name}
                    note={item.note ?? null}
                    amount={item.amount}
                    type={item.type}
                    date={item.date}
                    onPress={() =>
                      router.push({
                        pathname: "/transaction-form",
                        params: { id: item._id },
                      })
                    }
                  />
                ))}
              </View>
            )}
          </View>
        </View>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/home.tsx"
git commit -m "feat: show recent transactions on home screen"
```

---

## Self-Review Notes

- **Spec coverage:** Part A (auto-revoke backend + Pending Invites UI with revoke) → Tasks 1, 3. Part B (`transactions.recent` + Home render + See All) → Tasks 2, 4. No spec requirement is left without a task.
- **No placeholders:** every step contains concrete code or exact edit targets.
- **Type consistency:** `recent` returns the same shape as `list`; TransactionCard props match the Transactions tab usage; `invites` is the `Invitation[]` from `listActive`; `handleRevoke` takes `Id<"invitations">` matching `revoke`'s `v.id("invitations")`.
