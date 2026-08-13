# Multi-Member + Rename Household Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full Multi-Member feature (invite code backend, join flow, Members screen) and rename Household UI.

**Architecture:** Add `invitations` table + `convex/invations.ts` (create/revoke/redeem/listActive). Update onboarding to toggle Create/Join mode. Add Members screen in Settings with generate code + member list + remove. Add rename household inline in Settings.

**Tech Stack:** Convex (schema, mutations, queries), Expo Router (screens), NativeWind (styling), expo-clipboard, expo-sharing, Clerk auth.

## Global Constraints

- Amount formatting: use `Input` component with `amount` prop for thousand-separator. Never format ad hoc.
- NativeWind v4: never use `style` callback functions on `Pressable`. Use `useState` for pressed state.
- Dark mode: use `useThemeColors()` hooks, `dark:` class variants. Import theme from `constants/theme.ts`.
- Icons: `@expo/vector-icons/Feather`.
- All convex error messages must be user-friendly (ConvexError, no technical details).
- After any `convex/*.ts` change: run `npx convex codegen` then `npx tsc --noEmit`.
- Install dependencies with `npx expo install <pkg>`.
- Env var: `INVITE_SECRET` set in Convex dashboard (not in `.env.local` — Convex env vars are managed separately).

---

### Task 1: Add `invitations` table to schema

**Files:**
- Modify: `convex/schema.ts`
- Regenerate: `convex/_generated/`

**Interfaces:**
- Produces: `invitations` table with indexes `by_codeHash`, `by_householdId`

- [ ] **Step 1: Add invitations table to schema.ts**

Append to `convex/schema.ts` after the `budgets` table definition:

```typescript
  invitations: defineTable({
    householdId: v.id("households"),
    codeHash: v.string(),
    createdBy: v.id("users"),
    expiresAt: v.number(),
    maxUses: v.number(),
    useCount: v.number(),
    revoked: v.boolean(),
    redemptionAttempts: v.number(),
    lastAttemptAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_codeHash", ["codeHash"])
    .index("by_householdId", ["householdId"]),
```

- [ ] **Step 2: Regenerate codegen**

Run: `npx convex codegen`

Expected: `convex/_generated/` regenerated with new `invitations` types.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts convex/_generated/
git commit -m "feat(schema): add invitations table for invite codes"
```

---

### Task 2: Create `convex/invitations.ts` — generateCode helper + create mutation

**Files:**
- Create: `convex/invitations.ts`
- Regenerate: `convex/_generated/`

**Interfaces:**
- Produces: `invitations.create` mutation returning `{ code: string }`

- [ ] **Step 1: Create invitations.ts with generateCode + create**

Create `convex/invitations.ts`:

```typescript
import { ConvexError, v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 8;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CHARSET[b % CHARSET.length]).join("");
}

async function hmacHash(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getUserAndMembership(ctx: MutationCtx) {
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

  const membership = await ctx.db
    .query("householdMemberships")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .first();

  if (membership === null) {
    throw new ConvexError("You are not a member of a household.");
  }

  return { user, membership };
}

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const { user, membership } = await getUserAndMembership(ctx);

    if (membership.role !== "owner") {
      throw new ConvexError("You are not the owner of this household.");
    }

    const secret = process.env.INVITE_SECRET;
    if (!secret) {
      throw new ConvexError("Server configuration error.");
    }

    const now = Date.now();
    const expiresAt = now + SEVEN_DAYS_MS;

    let code: string;
    let codeHash: string;
    let attempts = 0;
    const MAX_RETRIES = 5;

    do {
      code = generateCode();
      codeHash = await hmacHash(code.toLowerCase(), secret);
      attempts++;

      const existing = await ctx.db
        .query("invitations")
        .withIndex("by_codeHash", (q) => q.eq("codeHash", codeHash!))
        .first();

      if (existing === null) {
        break;
      }

      if (attempts >= MAX_RETRIES) {
        throw new ConvexError("Failed to generate unique code. Please try again.");
      }
    } while (true);

    await ctx.db.insert("invitations", {
      householdId: membership.householdId,
      codeHash: codeHash!,
      createdBy: user._id,
      expiresAt,
      maxUses: 1,
      useCount: 0,
      revoked: false,
      redemptionAttempts: 0,
      lastAttemptAt: 0,
      createdAt: now,
      updatedAt: now,
    });

    return { code: code! };
  },
});
```

- [ ] **Step 2: Regenerate codegen**

Run: `npx convex codegen`

Expected: `convex/_generated/api.d.ts` now includes `invitations` module.

- [ ] **Step 3: Commit**

```bash
git add convex/invitations.ts convex/_generated/
git commit -m "feat(invitations): add create mutation with HMAC code generation"
```

---

### Task 3: Add `invitations.revoke` mutation

**Files:**
- Modify: `convex/invitations.ts`

**Interfaces:**
- Consumes: `getUserAndMembership` helper (Task 2)
- Produces: `invitations.revoke` mutation

- [ ] **Step 1: Add revoke mutation to invitations.ts**

Append to `convex/invitations.ts`:

```typescript
export const revoke = mutation({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);

    if (membership.role !== "owner") {
      throw new ConvexError("You are not the owner of this household.");
    }

    const invitation = await ctx.db.get(args.invitationId);
    if (
      invitation === null ||
      invitation.householdId !== membership.householdId
    ) {
      throw new ConvexError("Invitation not found.");
    }

    await ctx.db.patch(args.invitationId, {
      revoked: true,
      updatedAt: Date.now(),
    });
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/invitations.ts
git commit -m "feat(invitations): add revoke mutation"
```

---

### Task 4: Add `invitations.redeem` mutation (with rate limiting + HMAC)

**Files:**
- Modify: `convex/invitations.ts`

**Interfaces:**
- Consumes: `getUserAndMembership` helper, `hmacHash` helper
- Produces: `invitations.redeem` mutation

- [ ] **Step 1: Add redeem mutation to invitations.ts**

Append to `convex/invitations.ts`:

```typescript
export const redeem = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
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

    const existingMembership = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (existingMembership !== null) {
      throw new ConvexError("You are already a member of a household.");
    }

    const secret = process.env.INVITE_SECRET;
    if (!secret) {
      throw new ConvexError("Server configuration error.");
    }

    const normalizedCode = args.code.trim().toUpperCase();
    const codeHash = await hmacHash(normalizedCode.toLowerCase(), secret);

    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_codeHash", (q) => q.eq("codeHash", codeHash))
      .collect();

    if (invitations.length === 0) {
      throw new ConvexError("Invalid invite code.");
    }

    if (invitations.length > 1) {
      throw new ConvexError("Invalid invite code.");
    }

    const invitation = invitations[0];
    const now = Date.now();
    const ATTEMPT_WINDOW_MS = 60 * 1000;
    const MAX_ATTEMPTS = 5;

    if (
      invitation.lastAttemptAt > now - ATTEMPT_WINDOW_MS &&
      invitation.redemptionAttempts >= MAX_ATTEMPTS
    ) {
      await ctx.db.patch(invitation._id, {
        redemptionAttempts: invitation.redemptionAttempts + 1,
        lastAttemptAt: now,
        updatedAt: now,
      });
      throw new ConvexError(
        "Too many attempts. Please try again later.",
      );
    }

    const resetCounter =
      invitation.lastAttemptAt <= now - ATTEMPT_WINDOW_MS;
    await ctx.db.patch(invitation._id, {
      redemptionAttempts: resetCounter
        ? 1
        : invitation.redemptionAttempts + 1,
      lastAttemptAt: now,
      updatedAt: now,
    });

    if (invitation.expiresAt < now) {
      throw new ConvexError("This invite code has expired.");
    }

    if (invitation.revoked) {
      throw new ConvexError("This invite code has been revoked.");
    }

    if (invitation.useCount >= invitation.maxUses) {
      throw new ConvexError("This invite code has already been used.");
    }

    await ctx.db.insert("householdMemberships", {
      householdId: invitation.householdId,
      userId: user._id,
      role: "member",
    });

    await ctx.db.patch(invitation._id, {
      useCount: invitation.useCount + 1,
      updatedAt: now,
    });
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/invitations.ts
git commit -m "feat(invitations): add redeem mutation with rate limiting"
```

---

### Task 5: Add `invitations.listActive` query

**Files:**
- Modify: `convex/invitations.ts`

**Interfaces:**
- Consumes: `getUserAndMembership` helper
- Produces: `invitations.listActive` query

- [ ] **Step 1: Add listActive query to invitations.ts**

Append to `convex/invitations.ts`:

```typescript
export const listActive = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      return [];
    }

    const membership = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (
      membership === null ||
      membership.householdId !== args.householdId
    ) {
      return [];
    }

    const now = Date.now();
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", args.householdId),
      )
      .collect();

    return invitations.filter(
      (inv) =>
        !inv.revoked &&
        inv.expiresAt > now &&
        inv.useCount < inv.maxUses,
    );
  },
});
```

- [ ] **Step 2: Regenerate codegen**

Run: `npx convex codegen`

- [ ] **Step 3: Commit**

```bash
git add convex/invitations.ts convex/_generated/
git commit -m "feat(invitations): add listActive query"
```

---

### Task 6: Create `components/MemberCard.tsx`

**Files:**
- Create: `components/MemberCard.tsx`

**Interfaces:**
- Props: `{ name: string; email: string; role: "owner" | "member"; onRemove?: () => void }`
- Produces: Reusable member list item component

- [ ] **Step 1: Create MemberCard component**

Create `components/MemberCard.tsx`:

```tsx
import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";

type Props = {
  name: string;
  email: string;
  role: "owner" | "member";
  onRemove?: () => void;
};

export function MemberCard({ name, email, role, onRemove }: Props) {
  const C = useThemeColors();
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      style={[
        Shadow.card,
        {
          borderRadius: Radius.md,
          backgroundColor: pressed ? C.surface : C.background,
          borderWidth: 1,
          borderColor: C.border,
        },
      ]}
      className="flex-row items-center justify-between px-4 py-4"
    >
      <View className="flex-1 flex-row items-center gap-3">
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: Radius.sm,
            backgroundColor: C.surface,
          }}
          className="items-center justify-center"
        >
          <Feather
            name={role === "owner" ? "shield" : "user"}
            size={20}
            color={C.primary}
          />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
            {name}
          </Text>
          <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
            {email}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        <View
          style={{
            borderRadius: 999,
            backgroundColor:
              role === "owner" ? C.primaryLight : C.surface,
          }}
          className="px-2.5 py-1"
        >
          <Text
            className={`text-xs font-medium ${
              role === "owner"
                ? "text-primary dark:text-primary-dark"
                : "text-text-secondary dark:text-text-secondary-dark"
            }`}
          >
            {role === "owner" ? "Owner" : "Member"}
          </Text>
        </View>

        {onRemove && role !== "owner" ? (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel="Remove member"
            style={{ width: 40, height: 40 }}
            className="items-center justify-center"
          >
            <Feather name="x-circle" size={20} color={C.error} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/MemberCard.tsx
git commit -m "feat(ui): add MemberCard component"
```

---

### Task 7: Create `components/InviteCodeDisplay.tsx`

**Files:**
- Create: `components/InviteCodeDisplay.tsx`
- Dependencies: `npx expo install expo-clipboard expo-sharing`

**Interfaces:**
- Props: `{ code: string; onDone: () => void }`
- Produces: Reusable invite code display with copy/share

- [ ] **Step 1: Install dependencies**

Run: `npx expo install expo-clipboard expo-sharing`

- [ ] **Step 2: Create InviteCodeDisplay component**

Create `components/InviteCodeDisplay.tsx`:

```tsx
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@expo/vector-icons/Feather";
import { Radius, Shadow, useThemeColors, useThemeGradients } from "@/constants/theme";
import { Button } from "@/components/Button";
import { useSnackbar } from "@/components/Snackbar";

type Props = {
  code: string;
  onDone: () => void;
};

export function InviteCodeDisplay({ code, onDone }: Props) {
  const C = useThemeColors();
  const gradients = useThemeGradients();
  const { show } = useSnackbar();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    show("Copied!");
  };

  const handleShare = async () => {
    await Sharing.shareAsync(`Join my household on Kin Finance! Use invite code: ${code}`);
  };

  return (
    <View className="items-center gap-6">
      <LinearGradient
        colors={gradients.card}
        style={[
          Shadow.card,
          {
            borderRadius: Radius.lg,
            borderWidth: 1,
            borderColor: C.primaryLight,
            paddingVertical: 32,
            paddingHorizontal: 24,
            width: "100%",
          },
        ]}
        className="items-center gap-4"
      >
        <Feather name="key" size={32} color={C.primary} />
        <Text className="text-center text-sm text-text-secondary dark:text-text-secondary-dark">
          Your invite code
        </Text>
        <Text
          className="text-[28px] font-bold tracking-wider text-text-primary dark:text-text-primary-dark"
          style={{ fontFamily: "monospace" }}
        >
          {code}
        </Text>
        <Text className="text-center text-xs text-text-secondary dark:text-text-secondary-dark">
          Expires in 7 days. Single-use. Copy it now.
        </Text>
      </LinearGradient>

      <View className="w-full gap-3">
        <Button
          title={copied ? "Copied!" : "Copy to Clipboard"}
          onPress={handleCopy}
        />
        <Button
          title="Share"
          variant="secondary"
          onPress={handleShare}
        />
        <Button
          title="Done"
          variant="secondary"
          onPress={onDone}
        />
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/InviteCodeDisplay.tsx package.json package-lock.json
git commit -m "feat(ui): add InviteCodeDisplay component with copy/share"
```

---

### Task 8: Update `app/_layout.tsx` — add members route

**Files:**
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: none
- Produces: `members` route accessible via navigation

- [ ] **Step 1: Add Stack.Screen for members**

In `app/_layout.tsx`, inside the `<Stack.Protected guard={!!isSignedIn}>` block, add `<Stack.Screen name="members" />` after the existing `budget-form` entry (line 44):

```tsx
        <Stack.Screen name="budget-form" />
        <Stack.Screen name="members" />
```

- [ ] **Step 2: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(nav): add members route to root stack"
```

---

### Task 9: Update `app/onboarding.tsx` — add toggle mode (Create / Join)

**Files:**
- Modify: `app/onboarding.tsx`
- Dependencies: `convex/invitations.ts` (Task 4)

**Interfaces:**
- Consumes: `invitations.redeem` mutation
- Produces: Onboarding screen with Create/Join toggle

- [ ] **Step 1: Rewrite onboarding.tsx with toggle mode**

Replace the full content of `app/onboarding.tsx`:

```tsx
import { api } from "@/convex/_generated/api";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useThemeColors, useThemeGradients, Shadow } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@clerk/expo";

type Mode = "create" | "join";

const MODES: { id: Mode; label: string }[] = [
  { id: "create", label: "Create Household" },
  { id: "join", label: "Join with Code" },
];

export default function Onboarding() {
  const router = useRouter();
  const { signOut } = useAuth();
  const createHousehold = useMutation(api.households.create);
  const redeemInvite = useMutation(api.invitations.redeem);
  const [mode, setMode] = useState<Mode>("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const C = useThemeColors();
  const gradients = useThemeGradients();

  const trimmedName = name.trim();
  const trimmedCode = code.trim().toUpperCase();
  const canSubmit =
    !isLoading &&
    (mode === "create"
      ? trimmedName.length >= 3
      : trimmedCode.length === 8);

  const handleCreate = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await createHousehold({ name: trimmedName });
      router.replace("/home");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to create household. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await redeemInvite({ code: trimmedCode });
      router.replace("/home");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to join household. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setError(null);
    setName("");
    setCode("");
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center gap-6">
            <LinearGradient
              colors={gradients.card}
              style={[
                Shadow.card,
                {
                  width: 200,
                  height: 200,
                  borderRadius: 100,
                  borderWidth: 1,
                  borderColor: C.primaryLight,
                },
              ]}
              className="items-center justify-center"
            >
              <Feather name="users" size={72} color={C.primary} />
            </LinearGradient>

            <View className="items-center gap-2">
              <Text className="text-center text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
                Welcome to Kin Finance
              </Text>
              <Text className="text-center text-base text-text-secondary dark:text-text-secondary-dark">
                {mode === "create"
                  ? "Create your Household to start managing your family's finances."
                  : "Join an existing Household using an invite code."}
              </Text>
            </View>

            <View className="w-full flex-row rounded-[12px] border border-border dark:border-border-dark overflow-hidden">
              {MODES.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => handleModeChange(m.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === m.id }}
                  className="flex-1 items-center py-3"
                  style={{
                    backgroundColor:
                      mode === m.id ? C.primary : "transparent",
                  }}
                >
                  <Text
                    className={`text-sm font-medium ${
                      mode === m.id
                        ? "text-white"
                        : "text-text-secondary dark:text-text-secondary-dark"
                    }`}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="w-full gap-4">
              {mode === "create" ? (
                <>
                  <View className="w-full gap-2 rounded-[16px] border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark">
                    <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                      What's a Household?
                    </Text>
                    <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
                      A Household is your shared space for money. You're the Owner
                      — you can add family members later and control what they see
                      and do.
                    </Text>
                  </View>
                  <Input
                    value={name}
                    placeholder="Household name"
                    onChangeText={setName}
                    maxLength={50}
                    error={error}
                  />
                  <Button
                    title="Create Household"
                    onPress={handleCreate}
                    loading={isLoading}
                    disabled={!canSubmit}
                  />
                </>
              ) : (
                <>
                  <Input
                    value={code}
                    placeholder="Enter 8-character invite code"
                    onChangeText={(text) =>
                      setCode(text.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                    }
                    maxLength={8}
                    autoCapitalize="characters"
                    error={error}
                  />
                  <Button
                    title="Join Household"
                    onPress={handleJoin}
                    loading={isLoading}
                    disabled={!canSubmit}
                  />
                </>
              )}
            </View>

            <Pressable
              onPress={() => void signOut()}
              accessibilityRole="button"
              className="min-h-12 items-center justify-center py-2"
            >
              <Text className="text-sm font-medium text-primary dark:text-primary-dark">
                Back to login
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/onboarding.tsx
git commit -m "feat(onboarding): add Create/Join toggle mode with invite code"
```

---

### Task 10: Update `app/(tabs)/settings.tsx` — Household section + Members entry

**Files:**
- Modify: `app/(tabs)/settings.tsx`
- Dependencies: `convex/households.ts` (existing)

**Interfaces:**
- Consumes: `households.getActive` query, `households.update` mutation, `households.listMembers` query
- Produces: Settings screen with Household rename + Members entry

- [ ] **Step 1: Rewrite settings.tsx**

Replace the full content of `app/(tabs)/settings.tsx`:

```tsx
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/convex/_generated/api";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useSnackbar } from "@/components/Snackbar";

export default function Settings() {
  const router = useRouter();
  const C = useThemeColors();
  const { show } = useSnackbar();

  const household = useQuery(api.households.getActive);
  const members = useQuery(
    api.households.listMembers,
    household?._id ? { householdId: household._id } : "skip",
  );
  const updateHousehold = useMutation(api.households.update);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const me = useQuery(api.users.getMe);
  const isOwner =
    members?.members.some(
      (m) => m.userId === me?._id && m.role === "owner",
    ) ?? false;

  const memberCount = members?.members.length ?? 1;

  const handleStartRename = () => {
    setRenameValue(household?.name ?? "");
    setRenameError(null);
    setIsRenaming(true);
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
    setRenameError(null);
  };

  const handleSaveRename = async () => {
    setRenameError(null);
    const trimmed = renameValue.trim();
    if (trimmed.length < 3) {
      setRenameError("Household name must be at least 3 characters.");
      return;
    }
    if (trimmed.length > 50) {
      setRenameError("Household name must be at most 50 characters.");
      return;
    }
    if (!household?._id) return;

    setIsSaving(true);
    try {
      await updateHousehold({ householdId: household._id, name: trimmed });
      setIsRenaming(false);
      show("Household renamed");
    } catch (e) {
      setRenameError(
        e instanceof Error
          ? e.message
          : "Failed to rename household.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (household === undefined) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color={C.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
          Settings
        </Text>
      </View>

      <View className="mt-6 px-5">
        <Text className="mb-2 text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
          Household
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
          {isRenaming ? (
            <>
              <Input
                value={renameValue}
                onChangeText={setRenameValue}
                placeholder="Household name"
                maxLength={50}
                error={renameError}
              />
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button
                    title="Save"
                    onPress={handleSaveRename}
                    loading={isSaving}
                  />
                </View>
                <View className="flex-1">
                  <Button
                    title="Cancel"
                    variant="secondary"
                    onPress={handleCancelRename}
                    disabled={isSaving}
                  />
                </View>
              </View>
            </>
          ) : (
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
                  {household?.name ?? "Household"}
                </Text>
              </View>
              {isOwner ? (
                <Pressable
                  onPress={handleStartRename}
                  accessibilityRole="button"
                  accessibilityLabel="Rename household"
                  style={{ width: 48, height: 48 }}
                  className="items-center justify-center"
                >
                  <Feather name="edit-2" size={18} color={C.primary} />
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </View>

      <View className="mt-6 px-5">
        <Text className="mb-2 text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
          Household Members
        </Text>

        <Pressable
          onPress={() => router.push("/members")}
          accessibilityRole="button"
          accessibilityLabel="Members"
          style={[
            Shadow.card,
            {
              borderRadius: Radius.md,
              backgroundColor: C.background,
              borderWidth: 1,
              borderColor: C.border,
            },
          ]}
          className="flex-row items-center justify-between px-4 py-4"
        >
          <View className="flex-row items-center gap-3">
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: Radius.sm,
                backgroundColor: C.surface,
              }}
              className="items-center justify-center"
            >
              <Feather name="users" size={20} color={C.primary} />
            </View>
            <View>
              <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
                Members
              </Text>
              <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
                {memberCount === 1
                  ? "1 member"
                  : `${memberCount} members`}
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={C.textSecondary} />
        </Pressable>
      </View>

      <View className="mt-6 px-5">
        <Text className="mb-2 text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
          Household
        </Text>

        <Pressable
          onPress={() => router.push("/categories")}
          accessibilityRole="button"
          accessibilityLabel="Categories"
          style={[
            Shadow.card,
            {
              borderRadius: Radius.md,
              backgroundColor: C.background,
              borderWidth: 1,
              borderColor: C.border,
            },
          ]}
          className="flex-row items-center justify-between px-4 py-4"
        >
          <View className="flex-row items-center gap-3">
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: Radius.sm,
                backgroundColor: C.surface,
              }}
              className="items-center justify-center"
            >
              <Feather name="tag" size={20} color={C.primary} />
            </View>
            <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
              Categories
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={C.textSecondary} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(tabs\)/settings.tsx
git commit -m "feat(settings): add Household section with rename + Members entry"
```

---

### Task 11: Create `app/members.tsx` — full Members screen

**Files:**
- Create: `app/members.tsx`
- Dependencies: `components/MemberCard.tsx` (Task 6), `components/InviteCodeDisplay.tsx` (Task 7), `convex/invitations.ts` (Tasks 2-5)

**Interfaces:**
- Consumes: `households.getActive`, `households.listMembers`, `households.removeMember`, `invitations.create`, `invitations.listActive`
- Produces: Full Members screen with invite code generation, member list, remove member

- [ ] **Step 1: Create members.tsx**

Create `app/members.tsx`:

```tsx
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import Feather from "@expo/vector-icons/Feather";
import { api } from "@/convex/_generated/api";
import { useThemeColors } from "@/constants/theme";
import { Button } from "@/components/Button";
import { Fab } from "@/components/Fab";
import { MemberCard } from "@/components/MemberCard";
import { InviteCodeDisplay } from "@/components/InviteCodeDisplay";
import { EmptyState } from "@/components/EmptyState";
import { useSnackbar } from "@/components/Snackbar";

type Screen = "list" | "invite";

export default function Members() {
  const router = useRouter();
  const C = useThemeColors();
  const { show } = useSnackbar();
  const [screen, setScreen] = useState<Screen>("list");

  const household = useQuery(api.households.getActive);
  const me = useQuery(api.users.getMe);
  const members = useQuery(
    api.households.listMembers,
    household?._id ? { householdId: household._id } : "skip",
  );
  const removeMember = useMutation(api.households.removeMember);
  const createInvite = useMutation(api.invitations.create);

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner =
    members?.members.some(
      (m) => m.userId === me?._id && m.role === "owner",
    ) ?? false;

  const handleGenerateCode = useCallback(async () => {
    setError(null);
    setIsGenerating(true);
    try {
      const result = await createInvite();
      setInviteCode(result.code);
      setScreen("invite");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to generate invite code.",
      );
    } finally {
      setIsGenerating(false);
    }
  }, [createInvite]);

  const handleRemoveMember = useCallback(
    (member: { userId: string; name?: string }) => {
      if (!household?._id) return;
      Alert.alert(
        "Remove Member",
        `Remove ${member.name ?? "this member"} from household? They will lose access to all household data.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await removeMember({
                  householdId: household._id,
                  userId: member.userId as any,
                });
                show(`${member.name ?? "Member"} removed`);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Failed to remove member.",
                );
              }
            },
          },
        ],
      );
    },
    [household, removeMember, show],
  );

  if (screen === "invite" && inviteCode) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        <View className="flex-row items-center gap-2 px-5 pt-4">
          <Pressable
            onPress={() => {
              setScreen("list");
              setInviteCode(null);
            }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 48, height: 48 }}
            className="items-center justify-center"
          >
            <Feather name="arrow-left" size={22} color={C.textPrimary} />
          </Pressable>
          <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
            Invite Code
          </Text>
        </View>

        <View className="flex-1 justify-center px-6">
          <InviteCodeDisplay
            code={inviteCode}
            onDone={() => {
              setScreen("list");
              setInviteCode(null);
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (members === undefined || household === undefined) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color={C.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 48, height: 48 }}
            className="items-center justify-center"
          >
            <Feather name="arrow-left" size={22} color={C.textPrimary} />
          </Pressable>
          <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
            Household Members
          </Text>
        </View>
        {error ? (
          <Text className="mt-2 text-sm text-error dark:text-error-dark">
            {error}
          </Text>
        ) : null}
      </View>

      {isOwner && (
        <View className="mt-4 px-5">
          <Button
            title={isGenerating ? "Generating..." : "Generate Invite Code"}
            onPress={handleGenerateCode}
            loading={isGenerating}
            disabled={isGenerating}
          />
        </View>
      )}

      {members.members.length === 1 ? (
        <View className="mt-6 flex-1 px-5">
          <View
            style={{ backgroundColor: C.background }}
            className="rounded-[16px]"
          >
            <EmptyState
              icon="users"
              title="You're the only member"
              description="Invite family members to manage finances together."
              actionLabel={isOwner ? "Invite Member" : undefined}
              onAction={isOwner ? handleGenerateCode : undefined}
            />
          </View>
        </View>
      ) : (
        <FlatList
          className="mt-4 flex-1"
          contentContainerClassName="gap-3 px-5 pb-28"
          data={members.members}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => (
            <MemberCard
              name={item.name ?? "User"}
              email={item.email ?? "No email"}
              role={item.role}
              onRemove={
                isOwner && item.role !== "owner"
                  ? () =>
                      handleRemoveMember({
                        userId: item.userId,
                        name: item.name,
                      })
                  : undefined
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/members.tsx
git commit -m "feat(members): add Household Members screen with invite/remove"
```

---

### Task 12: Final verification

**Files:**
- All modified/created files

- [ ] **Step 1: Run codegen**

Run: `npx convex codegen`

Expected: No errors. `convex/_generated/` includes `invitations` module.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: No lint errors.

- [ ] **Step 4: Fix any issues found**

Address any errors from steps 1-3.

- [ ] **Step 5: Commit fixes if any**

```bash
git add -A && git commit -m "fix: address codegen/typecheck/lint issues"
```
