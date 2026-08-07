# Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Workspace as root entity for all financial data — create, get active, and rename workspace with onboarding flow.

**Architecture:** Add `workspaces` and `workspaceMemberships` tables to Convex, create `workspaces.ts` backend module with create/getActive/update functions, add onboarding screen for first-time users, and modify home screen to check workspace existence.

**Tech Stack:** Expo SDK 54, React Native, Convex, Clerk auth, expo-router

## Global Constraints

- Expo SDK 54 (`~54.0.35`) — read exact docs at https://docs.expo.dev/versions/v54.0.0/ before writing code
- Workspace name: required, 3-50 chars, trim whitespace
- All error messages in Indonesian
- No comments in code unless asked
- Follow existing code patterns (Convex mutations/queries, StyleSheet.create, React Native primitives)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `convex/schema.ts` | Modify | Add `workspaces` and `workspaceMemberships` tables |
| `convex/workspaces.ts` | Create | `create`, `getActive`, `update` mutations/queries |
| `app/onboarding.tsx` | Create | Onboarding screen with workspace creation form |
| `app/home.tsx` | Modify | Add workspace check, redirect to onboarding if none |
| `app/_layout.tsx` | Modify | Add `onboarding` screen to SignedInRoutes |

---

### Task 1: Update Convex Schema

**Files:**
- Modify: `convex/schema.ts`

**Interfaces:**
- Consumes: existing `users` table definition
- Produces: `workspaces` table, `workspaceMemberships` table with indexes

- [ ] **Step 1: Add workspaces and workspaceMemberships tables**

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    clerkUserId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),

  workspaces: defineTable({
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  workspaceMemberships: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("member")),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_userId", ["userId"]),
});
```

- [ ] **Step 2: Run `npx convex dev` to regenerate types**

Run: `npx convex dev`
Expected: Schema compiles, `_generated` files update with new tables

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add workspaces and workspaceMemberships tables"
```

---

### Task 2: Create Workspaces Backend Module

**Files:**
- Create: `convex/workspaces.ts`

**Interfaces:**
- Consumes: `users` table (via auth identity), `workspaces` table, `workspaceMemberships` table
- Produces: `api.workspaces.create`, `api.workspaces.getActive`, `api.workspaces.update`

- [ ] **Step 1: Create workspaces.ts with create mutation**

```typescript
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError("Unauthenticated");
    }

    const trimmedName = args.name.trim();

    if (trimmedName.length === 0) {
      throw new ConvexError("Nama workspace wajib diisi");
    }
    if (trimmedName.length < 3) {
      throw new ConvexError("Nama workspace minimal 3 karakter");
    }
    if (trimmedName.length > 50) {
      throw new ConvexError("Nama workspace maksimal 50 karakter");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      throw new ConvexError("User tidak ditemukan");
    }

    const now = Date.now();
    const workspaceId = await ctx.db.insert("workspaces", {
      name: trimmedName,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("workspaceMemberships", {
      workspaceId,
      userId: user._id,
      role: "owner",
    });

    return workspaceId;
  },
});
```

- [ ] **Step 2: Add getActive query**

Append to `convex/workspaces.ts`:

```typescript
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      return null;
    }

    const membership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (membership === null) {
      return null;
    }

    const workspace = await ctx.db.get(membership.workspaceId);
    return workspace;
  },
});
```

- [ ] **Step 3: Add update mutation**

Append to `convex/workspaces.ts`:

```typescript
export const update = mutation({
  args: { workspaceId: v.id("workspaces"), name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError("Unauthenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      throw new ConvexError("User tidak ditemukan");
    }

    const membership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspaceId", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .filter((q) => q.eq("userId", user._id))
      .unique();

    if (membership === null || membership.role !== "owner") {
      throw new ConvexError("Anda bukan owner workspace ini");
    }

    const trimmedName = args.name.trim();

    if (trimmedName.length === 0) {
      throw new ConvexError("Nama workspace wajib diisi");
    }
    if (trimmedName.length < 3) {
      throw new ConvexError("Nama workspace minimal 3 karakter");
    }
    if (trimmedName.length > 50) {
      throw new ConvexError("Nama workspace maksimal 50 karakter");
    }

    await ctx.db.patch(args.workspaceId, {
      name: trimmedName,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.workspaceId);
  },
});
```

- [ ] **Step 4: Run `npx convex dev` to verify functions deploy**

Run: `npx convex dev`
Expected: Functions deploy without errors

- [ ] **Step 5: Commit**

```bash
git add convex/workspaces.ts
git commit -m "feat: add workspaces create, getActive, update functions"
```

---

### Task 3: Create Onboarding Screen

**Files:**
- Create: `app/onboarding.tsx`

**Interfaces:**
- Consumes: `api.workspaces.create` mutation
- Produces: onboarding UI with workspace name input, validation, error display

- [ ] **Step 1: Create onboarding.tsx**

```typescript
import { api } from "@/convex/_generated/api";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function Onboarding() {
  const router = useRouter();
  const createWorkspace = useMutation(api.workspaces.create);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await createWorkspace({ name });
      router.replace("/home");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Workspace gagal dibuat. Silakan coba lagi.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Selamat datang di Kin Finance</Text>
      <Text style={styles.subtitle}>
        Buat Workspace pertama untuk mulai mengelola keuangan Anda.
      </Text>
      <TextInput
        style={styles.input}
        value={name}
        placeholder="Nama Workspace"
        onChangeText={setName}
        maxLength={50}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {isLoading ? (
        <ActivityIndicator size="large" />
      ) : (
        <Button
          title="Buat Workspace"
          onPress={handleCreate}
          disabled={name.trim().length < 3}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  error: {
    color: "#d32f2f",
    fontSize: 14,
  },
});
```

- [ ] **Step 2: Verify onboarding screen renders**

Run: `npx expo start`
Expected: Navigate to `/onboarding` manually, verify form renders correctly

- [ ] **Step 3: Commit**

```bash
git add app/onboarding.tsx
git commit -m "feat: add onboarding screen with workspace creation form"
```

---

### Task 4: Add Onboarding Screen to Layout

**Files:**
- Modify: `app/_layout.tsx:23-33` (SignedInRoutes)

**Interfaces:**
- Consumes: `app/onboarding.tsx` screen
- Produces: `onboarding` route available in SignedInRoutes

- [ ] **Step 1: Add onboarding screen to SignedInRoutes Stack**

In `app/_layout.tsx`, modify `SignedInRoutes` to include onboarding:

```typescript
function SignedInRoutes() {
  const { isSignedIn } = useAuth();

  return (
    <Stack.Protected guard={!!isSignedIn}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="home" />
        <Stack.Screen name="onboarding" />
      </Stack>
    </Stack.Protected>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: add onboarding route to signed-in stack"
```

---

### Task 5: Modify Home Screen with Workspace Check

**Files:**
- Modify: `app/home.tsx`

**Interfaces:**
- Consumes: `api.workspaces.getActive` query
- Produces: workspace check on mount, redirect to onboarding if no workspace

- [ ] **Step 1: Add workspace check and redirect**

Replace `app/home.tsx` with:

```typescript
import { useAuth, useUser } from "@clerk/expo";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native";

export default function Home() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const store = useMutation(api.users.store);
  const me = useQuery(api.users.getMe);
  const workspace = useQuery(api.workspaces.getActive);
  const [syncError, setSyncError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setSyncError(null);
    try {
      await store();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Gagal menyinkronkan user.");
    }
  }, [store]);

  useEffect(() => {
    void sync();
  }, [sync]);

  useEffect(() => {
    if (workspace === null) {
      router.replace("/onboarding");
    }
  }, [workspace, router]);

  if (workspace === undefined || workspace === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kin Finance</Text>
      <Text style={styles.subtitle}>
        Halo, {me?.email ?? user?.primaryEmailAddress?.emailAddress ?? "Pengguna"}!
      </Text>
      <Text style={styles.workspace}>Workspace: {workspace.name}</Text>
      {syncError && <Text style={styles.error}>{syncError}</Text>}
      {syncError && <Button title="Coba Lagi" onPress={() => void sync()} />}
      <Button
        title="Keluar"
        onPress={() => {
          void signOut();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 16,
  },
  workspace: {
    fontSize: 14,
    color: "#555",
  },
  error: {
    color: "#d32f2f",
    fontSize: 14,
  },
});
```

- [ ] **Step 2: Verify full flow**

Run: `npx expo start`
Expected:
1. New user → login → redirected to onboarding → create workspace → redirected to home with workspace name
2. Returning user → login → home with workspace name

- [ ] **Step 3: Commit**

```bash
git add app/home.tsx
git commit -m "feat: add workspace check and redirect to home screen"
```

---

### Task 6: End-to-End Verification

**Files:**
- None (testing only)

- [ ] **Step 1: Test create workspace flow**

1. Sign up new user
2. Verify redirect to `/onboarding`
3. Enter workspace name (test validation: <3 chars, >50 chars, empty)
4. Submit → verify redirect to `/home`
5. Verify workspace name displayed on home

- [ ] **Step 2: Test returning user flow**

1. Sign out
2. Sign in again
3. Verify direct to `/home` (no onboarding)
4. Verify workspace name displayed

- [ ] **Step 3: Test error states**

1. Try creating workspace with empty name → verify button disabled
2. Try creating workspace with 2 chars → verify button disabled
3. Test network error handling (mock if possible)

- [ ] **Step 4: Run lint**

Run: `npx expo lint`
Expected: No errors

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: workspace feature end-to-end fixes"
```
