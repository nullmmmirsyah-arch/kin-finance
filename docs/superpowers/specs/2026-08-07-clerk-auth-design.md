# Clerk Authentication for kin-finance

Date: 2026-08-07

## Goal

Integrate Clerk authentication into the kin-finance Expo app (SDK 54, expo-router, root `app/` directory). Users sign in/up with email + password and optionally Google (OAuth). The chosen approach is the **custom flow**: authentication UI built with React Native components using Clerk's hooks. Works in Expo Go, no dev build required, full control over UI.

Fingerprint/biometric unlock on the user's device is out of scope for this change. It is handled separately with `expo-local-authentication` at a later stage and does not conflict with any Clerk approach.

## Requirements

- Sign in with email + password.
- Sign up with email + password + email verification code.
- Sign in with Google via OAuth redirect (custom flow, works in Expo Go).
- Session persists across app restarts (stored in `expo-secure-store`).
- Signed-out users see only the auth screen; signed-in users see the home screen.
- Route guard: signed-out users cannot see the home screen; signed-in users cannot see the auth screen.

## Architecture

### Dependencies

Install via `npx expo install` (SDK-compatible versions):

- `@clerk/expo` — Clerk SDK: `ClerkProvider`, hooks, helpers.
- `expo-secure-store` — encrypted storage for the Clerk session token.
- `expo-auth-session` — required for the Google OAuth flow.
- `expo-crypto` — required by Clerk for OAuth.
- `expo-web-browser` — already present in `package.json` (`~15.0.11`).

### Configuration

- `.env`: add `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=<publishable key>`.
- `app.json`: add `expo-secure-store` and `@clerk/expo` to the `plugins` array.
- Google OAuth uses the existing app `scheme: "kinfinance"` as the redirect base. No Clerk Native applications page entry is required for the custom flow (OAuth runs via redirect browser, not native OAuth).

### Screens

#### `app/_layout.tsx` (root layout)

- Wrap the app in `ClerkProvider` with `publishableKey` read from `process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `tokenCache` from `@clerk/expo/token-cache`.
- Throw if the publishable key is missing.
- Route guard using Clerk's `SignedIn`/`SignedOut` components:
  - Signed out → `Stack` containing only the auth screen (`index`).
  - Signed in → `Stack` containing only the home screen (`home`).

#### `app/index.tsx` (auth screen)

Single screen with two modes toggled by the user:

- **Sign-in mode**
  - Email field (`autoCapitalize="none"`, `keyboardType="email-address"`).
  - Password field (`secureTextEntry`).
  - "Sign in" button → `useSignIn().signIn.password({ emailAddress, password })`.
  - "Continue with Google" button → `useSSO({ strategy: 'oauth_google' })` → `startSSOFlow()`.
  - Link to switch to sign-up mode.
- **Sign-up mode**
  - Email + password fields.
  - "Sign up" button → `useSignUp().signUp.password({ emailAddress, password })`, then `signUp.verifications.sendEmailCode()`, then show the code field.
  - Code field (`keyboardType="numeric"`) + "Verify" button → `signUp.verifications.verifyEmailCode({ code })` then `signUp.finalize()`.
  - Link to switch back to sign-in mode.
- Element `<View nativeID="clerk-captcha" />` for Expo web (Clerk skips browser CAPTCHA on iOS/Android).
- Loading states while auth actions run.
- Clerk errors (`error` fields returned by hooks) shown inline on the screen.

#### `app/home.tsx` (home placeholder)

- Shows the signed-in user's email/name via `useUser()`.
- "Sign out" button → `useAuth().signOut()`.
- "Kin Finance" placeholder content for future development.

## Data Flow

1. **Sign up (email + password):** `signUp.password(...)` creates the sign-up attempt → `sendEmailCode()` emails a verification code → `verifyEmailCode({ code })` verifies it → `finalize()` creates an active session. `useAuth()` then reports `isSignedIn: true`.
2. **Sign in (email + password):** `signIn.password({ emailAddress, password })` creates a session directly.
3. **Google:** `startSSOFlow()` opens the redirect browser; on success Clerk creates the session. If `createdSessionId` is present, call `setActive({ session: createdSessionId })`. If `createdSessionId` is absent (e.g., the user exists but no new session was created), show an error to the user.

## Error Handling

- All failures surface Clerk's structured `error` result; display a user-friendly message inline.
- Loading/disable controls while requests are in flight to prevent double submits.
- `isLoaded` from `useAuth()` guards rendering to avoid flicker while Clerk restores the session.

## Testing / Verification

- `npx tsc --noEmit` — type check.
- `npx expo lint` — lint.
- Manual run via `npx expo start` (Expo Go): sign up with email, verify code, sign out, sign in, sign in with Google.

## Out of Scope

- Fingerprint / biometric unlock (`expo-local-authentication`) — later feature.
- Branded home screen / app features — later.
- Social connections other than Google.
- Native OAuth / Clerk Native applications page setup.
