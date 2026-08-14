# Design: "Last Used" Auth Method on Login

**Date:** 2026-08-14
**Status:** Approved by user

## Problem

Every visit to the login screen shows both Google SSO and email/password with equal visual weight. A household that consistently signs in with one method has to re-find that method each time. The last-used method should lead the interface: primary position, closer to the thumb, with a "Last used" flag and adapted wording.

## Decision

**Approach 1 — Primary CTA at the bottom (thumb zone).** Email fields always render first (they need typed input). The last-used method gets the primary (filled amber) variant and is positioned at the bottom of the form, nearest the thumb. A small "Last used" flag sits beside it. The subtitle adapts to the preferred method.

## Requirements

### Storage
- Key `last-auth-method` in `expo-secure-store`, values `"google"` | `"email"`.
- New helper module `lib/auth-preference.ts`:
  - `getLastAuthMethod(): Promise<"google" | "email" | null>`
  - `setLastAuthMethod(method: "google" | "email"): Promise<void>`
- Follow the existing `ThemeProvider` SecureStore pattern (async write, non-blocking, safe read with fallback).

### When the preference is written
- After a **successful** auth:
  - Google SSO succeeds (session active, `setActive` path, or SSO MFA complete) → `setLastAuthMethod("google")`.
  - Email sign-in completes (`handleSignIn` finalize success) → `setLastAuthMethod("email")`.
  - Email sign-up verification completes (`handleVerify` finalize success) → `setLastAuthMethod("email")`.
  - Email MFA verification completes (`handleMfaVerify` finalize success) → `setLastAuthMethod("email")`.
- **Never deleted**; only updated.

### Login screen state
- `const [preferred, setPreferred] = useState<"google" | "email" | null>(null)`.
- On mount, `getLastAuthMethod()` resolves the value.
- Until resolved (or when null), render the default email-primary layout — no flash, no loading gate.

### Visual matrix (Approach 1)

| | **preferred = google** | **preferred = email / null** |
|---|---|---|
| Subtitle sign-in | "One tap to get back in with Google." | "Welcome back. Sign in to your family's ledger." |
| Subtitle sign-up | "Join in one tap with Google." | "Create an account and start your family's ledger." |
| Order | Email fields → Sign In/Sign Up (secondary) → divider → Google (primary) | Google (secondary) → divider → Email fields → Sign In/Sign Up (primary) |
| Divider | "or continue with Google" | "or sign in with email" / "or sign up with email" |
| "Last used" flag | beside Google CTA | next to the "Email" input label |

- Divider present in both states; only order and label swap.
- Forgot-password link (sign-in), mode toggle, and verification/reset flows are unaffected.

### "Last used" flag
- Small pill (12px/500), label "Last used", rendered without changing surrounding heights.
- Placement: Google path → beside the Google CTA label; email path → next to the "Email" input label (not on the Sign In button).

## Edge cases
- First run (null preference): default email-primary layout, no flag.
- Preference read failure: fall back to email-primary.
- Write failure: non-blocking; the session still completes.
- Sign-up mode: same ordering logic, sign-up wording variants.

## Out of scope
- Biometrics / passkeys.
- Server-side storage of the preference.
- Changing wording of verification/reset flows.
- Clearing the preference on sign-out.

## Verification
- `npx tsc --noEmit`
- `npm run lint`
- Manual: login with Google → sign out → login screen shows Google primary at bottom with flag and "One tap to get back in with Google."; repeat for email path.
