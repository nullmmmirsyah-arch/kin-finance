# Kin Finance

Shared household finance tracker built with Expo (React Native), Convex, and Clerk.

Track income, expenses, and transfers across accounts in a shared household. Owners manage accounts, categories, budgets, and invites; members see shared data with per-item visibility rules.

## Stack

- **Expo SDK 54 / React Native 0.81 / Expo Router 6** — Android-first app
- **Convex** — backend: schema, queries, mutations, auth
- **Clerk** — authentication (email/password + Google SSO), custom flow
- **NativeWind v4 / Tailwind** — styling with `className` + dark mode
- **Vitest + convex-test** — backend unit tests

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Configure environment variables:

   - `.env` — `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `.env.local` — Convex vars (`CONVEX_DEPLOYMENT`, `EXPO_PUBLIC_CONVEX_URL`, `CLERK_FRONTEND_API_URL`, `CLERK_JWT_ISSUER_DOMAIN`); written by `npx convex dev`
   - Convex env var `INVITE_SECRET` — secret used to HMAC invite codes

   `app/_layout.tsx` throws if the Clerk or Convex keys are missing.

3. Start the dev servers:

   ```sh
   npx convex dev   # terminal 1 — pushes schema/functions to the dev deployment
   npm run start    # terminal 2 — Expo dev server
   ```

## Scripts

| Command            | Description                                       |
| ------------------ | ------------------------------------------------- |
| `npm run start`    | Start Expo dev server                             |
| `npm run android`  | Start Expo and open on Android                    |
| `npm run web`      | Start Expo web                                    |
| `npm run lint`     | Run `expo lint`                                   |
| `npm test`         | Run the Convex unit tests (Vitest + convex-test)  |
| `npx convex codegen` | Regenerate `convex/_generated/` after any change to `convex/*.ts`; then run `npx tsc --noEmit` |
| `npx tsc --noEmit` | Typecheck                                         |

## Structure

```text
app/            Expo Router screens (tabs, forms, auth, onboarding)
components/     Shared UI components (cards, inputs, fields, snackbar, skeleton)
constants/      Theme tokens + account/category/transaction constants
convex/         Backend: schema.ts, per-domain functions, helpers.ts
docs/           PRD + design specs and implementation plans
lib/            Client utilities (error extraction)
utils/          Date and number formatting helpers
tests/          Vitest suites (convex-test)
```

`convex/schema.ts` is the executable source of truth for the database schema and backend invariants.

## Backend Invariants

- Amounts are signed: `+` income, `−` expense, `+` transfer magnitude; whole numbers only.
- Every `convex/*.ts` handler requires a signed-in identity and throws `ConvexError` otherwise.
- Owner vs member permission matrix and hidden account/category visibility rules are enforced server-side (see `docs/Product Requirement Document/PRD.md`).

## Documentation

- Product requirements: `docs/Product Requirement Document/PRD.md`
- Design specs: `docs/superpowers/specs/`
- Implementation plans: `docs/superpowers/plans/`