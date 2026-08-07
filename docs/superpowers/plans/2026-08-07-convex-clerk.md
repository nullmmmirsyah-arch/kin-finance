# Convex + Clerk Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the kin-finance Expo app to a Convex backend and sync the Clerk-signed-in user into a Convex `users` table (upsert on app load), proving the Convex ↔ Clerk auth round trip on the home screen.

**Architecture:** `ClerkProvider` wraps `ConvexProviderWithClerk` (from `convex/react-clerk`), which injects the Clerk JWT into every Convex request. The backend validates tokens against the Clerk issuer in `convex/auth.config.ts`. A `users` table keyed by `tokenIdentifier` is upserted by the `store` mutation on home-screen mount and read back by the `getMe` query, which the home screen renders.

**Tech Stack:** Convex `convex` 1.43.x, `@clerk/expo` 4.2.2 (provides `useAuth`), Expo SDK 54, expo-router, React Native, TypeScript.

## Global Constraints

- Expo SDK is pinned to 54. Before writing any code, consult the versioned docs at https://docs.expo.dev/versions/v54.0.0/.
- The app uses the root `app/` directory (not `src/app`).
- The Convex client URL var name is `EXPO_PUBLIC_CONVEX_URL` (already in `.env.local`).
- `npx convex dev` must be running in a separate terminal for the whole plan — it syncs `convex/` functions, schema, and `auth.config.ts` to the dev deployment and regenerates `convex/_generated/` on save.
- No comments in code unless the existing file has them.
- Do NOT run `git commit` steps unless the user explicitly asks for commits.
- Verification commands: `npx tsc --noEmit` and `npx expo lint`. There is no unit-test runner configured; each task is verified by these two commands plus the Convex checks listed in the task.
- Everything in code is English; user-facing copy is Indonesian (per the existing conversation).
- `useAuth` is imported from `@clerk/expo` (re-exports `@clerk/react`'s hook) — no separate `@clerk/react` install is needed.
- Dev deployment: `brainy-marmot-13` (team `native-app`, project `kin-finance`). Clerk issuer: `https://eminent-lizard-48.clerk.accounts.dev`.

---

### Task 1: Backend — auth config, schema, and `users` functions

**Files:**
- Create: `convex/auth.config.ts`
- Create: `convex/schema.ts`
- Create: `convex/users.ts`
- Modify: `.env.local` (add `CLERK_JWT_ISSUER_DOMAIN`)

**Interfaces:**
- Produces: auth provider `{ domain, applicationID }` validated by Convex; table `users` with index `by_tokenIdentifier`; functions `api.users.store` (mutation, `args: {}`, throws `ConvexError("Unauthenticated")` when no identity) and `api.users.getMe` (query, `args: {}`, returns the user doc or `null`). Later tasks rely on these exact names and the `users` table fields.

- [ ] **Step 1: Add the Clerk issuer domain to `.env.local`**

Append to `.env.local` (already created by `npx convex dev`):

```env
CLERK_JWT_ISSUER_DOMAIN=https://eminent-lizard-48.clerk.accounts.dev
```

- [ ] **Step 2: Set the backend env var on the Convex deployment**

Run:
```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://eminent-lizard-48.clerk.accounts.dev
```
Expected: `Set CLERK_JWT_ISSUER_DOMAIN` targeting `brainy-marmot-13`. This is required because `auth.config.ts` reads `process.env.CLERK_JWT_ISSUER_DOMAIN` server-side; the app's `.env.local` is not read by the Convex backend.

- [ ] **Step 3: Create `convex/auth.config.ts`**

```ts
import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
```

- [ ] **Step 4: Create `convex/schema.ts`**

```ts
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
});
```

- [ ] **Step 5: Create `convex/users.ts`**

```ts
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError("Unauthenticated");
    }
    const data = {
      tokenIdentifier: identity.tokenIdentifier,
      clerkUserId: identity.subject,
      name: identity.name,
      email: identity.email,
      imageUrl: identity.pictureUrl,
    };
    const existing = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (existing === null) {
      await ctx.db.insert("users", data);
    } else {
      await ctx.db.patch(existing._id, data);
    }
  },
});

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }
    return await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
  },
});
```

- [ ] **Step 6: Regenerate Convex types and verify**

With `npx convex dev` running (it regenerates `convex/_generated/` and syncs the auth config/schema to `brainy-marmot-13`), run:

```bash
npx convex codegen
npx tsc --noEmit
```
Expected: `convex/_generated/api.ts` and `dataModel.d.ts` now include `users`/`api.users.store`/`api.users.getMe`; `tsc` reports no errors.

Run: `npx expo lint`
Expected: no errors.

---

### Task 2: Root layout — wrap with `ConvexProviderWithClerk`

**Files:**
- Modify: `app/_layout.tsx` (replace entire file, 36 lines)

**Interfaces:**
- Consumes: `EXPO_PUBLIC_CONVEX_URL` from `.env.local` (Task 0 setup, already present); `useAuth` from `@clerk/expo`.
- Produces: `ClerkProvider` → `ConvexProviderWithClerk client={convex} useAuth={useAuth}` root wrapper. All screens keep existing behavior; signed-in stack still exposes only `home`, signed-out stack only `index`.

- [ ] **Step 1: Rewrite the root layout**

Replace `app/_layout.tsx` entirely with:

```tsx
import { ClerkLoaded, ClerkLoading, ClerkProvider, Show, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!publishableKey) {
  throw new Error("Add your Clerk Publishable Key to the .env file");
}

if (!convexUrl) {
  throw new Error("Add your Convex URL to the .env.local file");
}

const convex = new ConvexReactClient(convexUrl, {
  unsavedChangesWarning: false,
});

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ClerkLoading>
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <ActivityIndicator size="large" />
          </View>
        </ClerkLoading>
        <ClerkLoaded>
          <Show when="signed-in">
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="home" />
            </Stack>
          </Show>
          <Show when="signed-out">
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
            </Stack>
          </Show>
        </ClerkLoaded>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors. (`ConvexProviderWithClerk`'s `useAuth` prop is structurally satisfied by `@clerk/expo`'s `useAuth`.)

Run: `npx expo lint`
Expected: no errors.

---

### Task 3: Home screen — sync the user and read it back from Convex

**Files:**
- Modify: `app/home.tsx` (replace entire file, 34 lines)

**Interfaces:**
- Consumes: `useAuth` (signOut), `useUser` (Clerk email fallback) from `@clerk/expo`; `useQuery`/`useMutation` from `convex/react`; `api.users.store` + `api.users.getMe` from Task 1; import alias `@/convex/_generated/api`.
- Produces: On mount, calls `store()` once (upserts the Clerk user); renders the Convex user's `email`/`name` as proof of sync, falling back to the Clerk `useUser()` email while syncing.

- [ ] **Step 1: Replace `app/home.tsx`**

Replace the whole file with:

```tsx
import { useAuth, useUser } from "@clerk/expo";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

export default function Home() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const store = useMutation(api.users.store);
  const me = useQuery(api.users.getMe);

  useEffect(() => {
    void store();
  }, [store]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kin Finance</Text>
      <Text style={styles.subtitle}>
        Halo, {me?.email ?? user?.primaryEmailAddress?.emailAddress ?? "Pengguna"}!
      </Text>
      <Text style={styles.note}>
        {me ? `Convex: ${me.name ?? me.email ?? me._id}` : "Menyinkronkan user ke Convex..."}
      </Text>
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
  note: {
    fontSize: 14,
    color: "#555",
  },
});
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors. (`api.users.store` / `api.users.getMe` exist in generated `convex/_generated/api`.)

Run: `npx expo lint`
Expected: no errors.

---

### Task 4: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Static checks**

Run: `npx tsc --noEmit`
Run: `npx expo lint`
Expected: both clean.

- [ ] **Step 2: Verify the backend config synced**

With `npx convex dev` running, check the deployment has the issuer env var and no auth errors:

```bash
npx convex env list --names-only
```
Expected: output includes `CLERK_JWT_ISSUER_DOMAIN`.

- [ ] **Step 3: Manual QA in Expo Go**

Run: `npx expo start`, scan the QR code with Expo Go.

1. App opens to the **Masuk** screen (signed out).
2. Sign in with an existing account (or sign up + verify email code).
3. On **home**, the greeting shows the user's email and the line `Convex: ...` appears (initially "Menyinkronkan user ke Convex...", then the Convex email/name).
4. Sign out → back to **Masuk**. Sign in again → same Convex line appears.

- [ ] **Step 4: Verify the `users` table in the Convex dashboard**

Open https://dashboard.convex.dev/d/brainy-marmot-13 → **Data → users**.

Expected: exactly one row for the signed-in user (`tokenIdentifier` in `"<clerkUserId>|<issuer>"` format, `email`/`name`/`imageUrl` populated). Reload the home screen and confirm the row count stays 1 (no duplicates — upsert works).
