# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Commands & Verification

- Verify with `npx tsc --noEmit` (typecheck), `npm run lint` (expo lint), and `npm test` (vitest — run when a change touches pure utils or Convex functions).
- After any change to `convex/*.ts`, run `npx convex codegen` first to regenerate `convex/_generated/` (gitignored), then typecheck.
- Run `npx convex dev` in a separate terminal — it pushes `convex/` schema, functions, and `auth.config.ts` to the dev deployment and regenerates `_generated/` on save.
- Install dependencies with `npx expo install <pkg>` so versions match SDK 54 — never bare `npm install`.

# Environment

- `.env` → `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`; `.env.local` → Convex vars (`CONVEX_DEPLOYMENT`, `EXPO_PUBLIC_CONVEX_URL`, `CLERK_JWT_ISSUER_DOMAIN`, `CLERK_FRONTEND_API_URL`). `.env.local` is written by `npx convex dev`. Both are gitignored; `app/_layout.tsx` throws if the Clerk/Convex keys are missing.

# Styling Rules

- Use NativeWind (`className`), not `StyleSheet.create`.
- Import theme from `constants/theme.ts` — do not hardcode colors.
- Dark mode: `useThemeColors()` / `useThemeGradients()` hooks and `dark:` class variants (`dark:text-primary-dark`, etc.). Do not use `Colors` directly for runtime values; use the hooks.
- Gradient cards: `expo-linear-gradient` + `Gradients.card`.
- Shadows: `Shadow.card` or `Shadow.elevated`.
- Icons: `@expo/vector-icons/Feather`.
- **NativeWind v4 gotcha:** Never use `style` callback functions on `Pressable` (e.g. `style={({ pressed }) => [...]}`). This breaks all style rendering including `className`. Use `useState` for pressed state + static `style` or `className` instead. See [GitHub #847](https://github.com/nativewind/nativewind/issues/847).
- Money/amount inputs: use the shared `Input` component with the `amount` prop (e.g. `<Input amount />`) for automatic thousand-separator formatting. Never format amount inputs ad hoc.

# Architecture

- Path alias: `@/*` → repo root.
- `app/` is expo-router. Auth gating uses `<Stack.Protected guard={...}>` in `app/_layout.tsx`, where Clerk + Convex providers live. Tabs live in `app/(tabs)/`; forms are top-level routes (`account-form`, `category-form`, `transaction-form`).
- `convex/schema.ts` is the executable source of truth — check `schema.ts` before assuming a table/function exists.
- Backend invariants (see `docs/Product Requirement Document/PRD.md`): amounts are signed (+income, −expense, +transfer magnitude); owner vs member permission matrix; hidden account/category visibility rules. Every `convex/*.ts` handler requires sign-in via `ctx.auth.getUserIdentity()` and throws `ConvexError`.
- NativeWind wiring: `babel.config.js`, `metro.config.js`, `global.css`, `tailwind.config.js`; `cssInterop(LinearGradient, { className: "style" })` is required in `app/_layout.tsx`.

# Documentation

- PRD / Product Specification: `docs/Product Requirement Document/PRD.md`
- Colors, typography, spacing: `constants/theme.ts`
- Feature plans & specs: `docs/superpowers/plans/`, `docs/superpowers/specs/` (they record the verification workflow above)
