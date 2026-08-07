# Convex + Clerk Integration for kin-finance

Date: 2026-08-07

## Goal

Connect the kin-finance Expo app (SDK 54, expo-router, root `app/` directory, Clerk auth already integrated) to a Convex backend, and wire Convex authentication to the existing Clerk session so backend queries/mutations can identify the logged-in user.

The quickstart's sample `tasks` table is intentionally replaced with a **`users`** table synced from Clerk, since this is a finance app and the next feature builds on user-specific data.

## Requirements

- Install the Convex client + server library (`convex`).
- Create a Convex dev deployment (`npx convex dev`) — **done** (deployment `brainy-marmot-13`, team `native-app`, project `kin-finance`).
- Configure Convex to validate Clerk JWTs (`convex/auth.config.ts`).
- Wrap the app with `ConvexProviderWithClerk` inside `ClerkProvider`.
- Create a `users` table in Convex and an **upsert-on-app-load** sync of the Clerk user.
- Show the synced user (from Convex, not only Clerk) on the home screen as proof of sync.

## Architecture

### Dependencies

- `convex` (`^1.43.0`) — already installed; provides `ConvexReactClient` (client) and `convex/server` (backend).
- `@clerk/react` — optional peer; Convex docs use it as the source of `useAuth` for `ConvexProviderWithClerk`. With `@clerk/expo`, `useAuth` is re-exported from `@clerk/expo`, so we import `useAuth` from there and do **not** need a separate install. Verify at implementation time; add `@clerk/react` only if the types/peer deps require it.

### Environment variables

`.env.local` (created by `npx convex dev`):

- `CONVEX_DEPLOYMENT=dev:brainy-marmot-13 # team: native-app, project: kin-finance`
- `EXPO_PUBLIC_CONVEX_URL=https://brainy-marmot-13.convex.cloud`
- `EXPO_PUBLIC_CONVEX_SITE_URL=https://brainy-marmot-13.convex.site`

Add:

- `CLERK_JWT_ISSUER_DOMAIN=https://eminent-lizard-48.clerk.accounts.dev` — Clerk Frontend API URL, used by the Convex backend to validate tokens. `npx convex dev` syncs variables from `.env.local` into the dev deployment; verify at implementation time (fallback: set it on the Convex dashboard / `npx convex env set` for the dev deployment).

`.env` (existing) — unchanged; keeps `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.

### Backend functions (`convex/`)

#### `convex/auth.config.ts`

Server-side validation config. Clerk provider with issuer domain from env and audience `convex`:

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

#### `convex/schema.ts`

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(), // e.g. "<clerkUserId>|<issuer>"
    clerkUserId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),
});
```

The unique token identifier (`identity.tokenIdentifier`) is the natural key for upserts and maps 1:1 to a Clerk user.

#### `convex/users.ts`

- `store` (mutation, `args: {}`): reads `ctx.auth.getUserIdentity()`. If `null`, throw `new ConvexError("Unauthenticated")`. Otherwise upsert the `users` row matching `tokenIdentifier` with `clerkUserId`, `name`, `email`, `imageUrl` from the identity. Return the stored user.
- `getMe` (query, `args: {}`): reads identity; returns the matching `users` row, or `null` if unauthenticated / not yet stored.

Both functions require `ctx.auth` (auth-aware); `store` is idempotent so repeated app loads do not duplicate rows.

### Client wiring (`app/`)

#### `app/_layout.tsx`

Wrap `ClerkProvider` → `ConvexProviderWithClerk` (from `convex/react-clerk`) with the module-level client:

```ts
const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false, // required on React Native
});
```

Structure:

```
ClerkProvider publishableKey tokenCache
└─ ConvexProviderWithClerk client={convex} useAuth={useAuth}   // useAuth from @clerk/expo
   └─ ClerkLoading (spinner)
   └─ ClerkLoaded
      └─ Show when="signed-in" → Stack [home]
      └─ Show when="signed-out" → Stack [index]
```

`ClerkProvider` must stay outside `ConvexProviderWithClerk` (Convex reads the Clerk context to fetch tokens). Keep the existing `publishableKey` + missing-key guard.

#### `app/home.tsx`

Inside an `<Authenticated>` block (from `convex/react`):

- `useEffect` → call `store` mutation once on mount (upsert the Clerk user into Convex).
- `useQuery(api.users.getMe)` → show `name` / `email` read back from Convex (plus the existing Clerk `useUser()` email and "Keluar" button).

`home.tsx` is only reachable when signed in (route guard in `_layout`), so auth-aware queries run in a valid context. `app/index.tsx` (auth screen) is unchanged.

## Data Flow

1. User signs in via Clerk (existing flow).
2. `ClerkProvider` holds the session; `ConvexProviderWithClerk` fetches a JWT from Clerk on sign-in.
3. `ConvexReactClient` attaches the token to Convex requests; the backend validates it against the issuer in `auth.config.ts`.
4. On home screen mount, `store` upserts the user (read via `getUserIdentity`) into `users`.
5. `getMe` reads the row back and renders it — proof the Convex ↔ Clerk round trip works.

## Error Handling

- `store` throws `ConvexError("Unauthenticated")` if no identity — surfaced by Convex client; prevented in practice by the signed-in route guard + `<Authenticated>`.
- `getMe` returns `null` (never throws) for unauthenticated/unknown users; UI shows a fallback text.
- Missing `EXPO_PUBLIC_CONVEX_URL` → the existing pattern of a thrown error at module init (matching the Clerk key guard).

## Testing / Verification

- `npx tsc --noEmit` — type check.
- `npx expo lint` — lint.
- `npx convex dev` running (syncs `auth.config.ts`, schema, and functions).
- Manual: sign in → home shows the email read back from Convex; check `users` table in the Convex dashboard has exactly one row per signed-in user (no duplicates on reload).

## Out of Scope

- Sample `tasks` table / `sampleData.jsonl` from the quickstart.
- Webhook-based user sync (from Clerk) — chosen approach is upsert-on-load.
- Convex production deployment config.
- Other Convex tables / app features.

## Manual steps already completed by the user

- Ran `npx convex dev` (deployment `brainy-marmot-13` created, `.env.local` written).
- Activated the Convex integration in the Clerk Dashboard.
- Provided the Clerk Frontend API URL (`https://eminent-lizard-48.clerk.accounts.dev`).
