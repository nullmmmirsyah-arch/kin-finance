# Last Used Auth Method — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the last-used login method (Google vs email) in SecureStore and use it to reorder/wrap the login screen's CTA layout, wording, and a "Last used" badge.

**Architecture:** New helper module `lib/auth-preference.ts` (SecureStore read/write). Extended `Button` component with optional `badge` prop. Login screen (`app/index.tsx`) reads the preference on mount, writes it after each successful auth, and conditionally reorders the Google/email CTA blocks based on the preference.

**Tech Stack:** Expo SDK 54, React 19, expo-secure-store, NativeWind, Clerk

## Global Constraints

- Install dependencies with `npx expo install <pkg>` — never bare `npm install`.
- NativeWind v4: no `style` callback functions on `Pressable`; use `className` or static `style`.
- Verify with `npx tsc --noEmit` and `npm run lint` — there is no test framework.
- After any change to `convex/*.ts`, run `npx convex codegen` (not applicable here).
- All auth handlers must include `if (isLoading || isGoogleLoading) return` guard.
- Theme colors via `useThemeColors()` — never hardcode hex.
- 48px minimum touch targets on all interactive elements.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/auth-preference.ts` | **Create** | SecureStore read/write helpers for the last-used auth method |
| `components/Button.tsx` | **Modify** | Add optional `badge` prop — renders "Last used" pill beside label |
| `app/index.tsx` | **Modify** | Read preference on mount; write on auth success; reorder/wrap CTA layout and wording per matrix; add divider helper component |

---

## Task 1: Create `lib/auth-preference.ts`

**Files:**
- Create: `lib/auth-preference.ts`

**Interfaces:**
- Produces: `getLastAuthMethod(): Promise<"google" | "email" | null>`
- Produces: `setLastAuthMethod(method: "google" | "email"): Promise<void>`

- [ ] **Step 1: Write `lib/auth-preference.ts`**

```ts
import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "last-auth-method";

export async function getLastAuthMethod(): Promise<"google" | "email" | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (raw === "google" || raw === "email") {
      return raw;
    }
  } catch {
    // SecureStore read failure falls back to null (default layout).
  }
  return null;
}

export async function setLastAuthMethod(
  method: "google" | "email",
): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, method);
  } catch {
    // Non-blocking persistence failure; session still completes.
  }
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors

Run: `npm run lint`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/auth-preference.ts
git commit -m "Add auth-preference helper for last-used login method"
```

---

## Task 2: Extend Button with `badge` prop

**Files:**
- Modify: `components/Button.tsx`

**Interfaces:**
- Consumes: (nothing new)
- Produces: `badge?: string` prop on Button — renders a small pill to the right of the label

- [ ] **Step 1: Add `badge` to Props and render it**

At `components/Button.tsx`, update the Props type and render logic.

```tsx
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  icon?: ReactNode;
  badge?: string;
};
```

Update the destructured props to include `badge`.

In the render, inside the `{loading ? (...) : (...)}` branch's else arm, render the badge after the Text:

```tsx
<View className="flex-row items-center gap-2">
  {icon}
  <Text className={`text-base font-semibold ${labelStyles[variant]}`}>
    {title}
  </Text>
  {badge ? (
    <View
      className="rounded-full px-2 py-0.5"
      style={{ backgroundColor: C.surface }}
    >
      <Text
        className="text-xs font-medium"
        style={{ color: C.primary }}
      >
        {badge}
      </Text>
    </View>
  ) : null}
</View>
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors

Run: `npm run lint`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/Button.tsx
git commit -m "Add optional badge prop to Button"
```

---

## Task 3: Wire preference into login screen

**Files:**
- Modify: `app/index.tsx`

**Interfaces:**
- Consumes: `getLastAuthMethod`, `setLastAuthMethod` from `lib/auth-preference`
- Consumes: `badge` prop from `components/Button`

- [ ] **Step 1: Add imports and `preferred` state**

Add to imports at top of `app/index.tsx`:

```ts
import { getLastAuthMethod, setLastAuthMethod } from "@/lib/auth-preference";
```

Add new state after the existing state declarations (near `successScreen`):

```ts
const [preferred, setPreferred] = useState<"google" | "email" | null>(null);
```

- [ ] **Step 2: Read preference on mount**

Add a new `useEffect` (after the `isSignedIn` redirect, before the `successScreen` timer):

```ts
useEffect(() => {
  void getLastAuthMethod().then((method) => {
    if (method) setPreferred(method);
  });
}, []);
```

- [ ] **Step 3: Write preference on auth success**

**handleGoogle** — insert `void setLastAuthMethod("google")` at every success return path:

1. After `createdSessionId` path (`await setActive?.(...)`):
```ts
if (createdSessionId) {
  await setActive?.({ session: createdSessionId });
  void setLastAuthMethod("google");
  return;
}
```

2. In `ssoSignUp` update success path (after `setActive?.(...)`):
```ts
const updated = await ssoSignUp.update(updateParams);
if (updated.status === "complete" && updated.createdSessionId) {
  await setActive?.({ session: updated.createdSessionId });
  void setLastAuthMethod("google");
  return;
}
```

**handleSignIn** — insert at `signIn.finalize()` success:

```ts
if (signIn.status === "complete") {
  const { error: finalizeError } = await signIn.finalize();
  if (finalizeError) {
    setError(finalizeError.message);
  } else {
    void setLastAuthMethod("email");
  }
}
```

**handleVerify** — insert after `signUp.finalize()` success, before `setSuccessScreen`:

```ts
void setLastAuthMethod("email");
setSuccessScreen("verify");
```

**handleMfaVerify** — insert at both success return paths:

1. SSO branch (after `ssoSetActive`):
```ts
await ssoSetActive({ session: updated.createdSessionId });
void setLastAuthMethod("google");
return;
```

2. Email MFA branch (after `signIn.finalize()` success):
```ts
if (signIn.status === "complete") {
  const { error: finalizeError } = await signIn.finalize();
  if (finalizeError) {
    setError(finalizeError.message);
  } else {
    void setLastAuthMethod("email");
  }
}
```

**handleSubmitNewPassword** — insert after `signIn.finalize()` success:
```ts
void setLastAuthMethod("email");
setSuccessScreen("reset");
```

- [ ] **Step 4: Add a reusable Divider component**

Add inside `app/index.tsx`, above the `Index` function (but below helpers/types):

```tsx
function Divider({ text }: { text: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-px flex-1 bg-border dark:bg-border-dark" />
      <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
        {text}
      </Text>
      <View className="h-px flex-1 bg-border dark:bg-border-dark" />
    </View>
  );
}
```

- [ ] **Step 5: Compute layout variables and reorder the main form JSX**

Inside the `Index` function, add these computed values before the `return`:

```ts
const googlePrimary = preferred === "google";

const subtitle =
  mode === "sign-in"
    ? googlePrimary
      ? "One tap to get back in with Google."
      : "Welcome back. Sign in to your family's ledger."
    : googlePrimary
      ? "Join in one tap with Google."
      : "Create an account and start your family's ledger.";

const dividerEmail =
  mode === "sign-in" ? "or sign in with email" : "or sign up with email";
```

Now replace the main-form `<View className="w-full gap-4">` block (the non-reset, non-verify, non-success branch) with this. Extract the shared email input blocks into named elements for clarity:

```tsx
const emailInputs = (
  <>
    <Input
      label="Email"
      accessibilityLabel="Email"
      value={emailAddress}
      placeholder="you@example.com"
      onChangeText={setEmailAddress}
      keyboardType="email-address"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="email"
      textContentType="emailAddress"
      returnKeyType="next"
      onSubmitEditing={() => passwordRef.current?.focus()}
      error={emailError}
    />
    <Input
      ref={passwordRef}
      label="Password"
      accessibilityLabel="Password"
      value={password}
      placeholder={
        mode === "sign-in" ? "Your password" : "Create a password"
      }
      secureTextEntry
      onChangeText={setPassword}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete={
        mode === "sign-in" ? "current-password" : "new-password"
      }
      textContentType={mode === "sign-in" ? "password" : "newPassword"}
      returnKeyType={mode === "sign-in" ? "go" : "next"}
      onSubmitEditing={
        mode === "sign-in"
          ? handleSignIn
          : () => confirmRef.current?.focus()
      }
      error={passwordError}
    />
    {mode === "sign-up" ? (
      <Input
        ref={confirmRef}
        label="Confirm password"
        accessibilityLabel="Confirm password"
        value={confirmPassword}
        placeholder="Re-enter password"
        secureTextEntry
        onChangeText={setConfirmPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={handleSignUp}
        error={confirmError}
      />
    ) : null}
    {mode === "sign-in" ? (
      <Pressable
        onPress={startReset}
        accessibilityRole="button"
        className="min-h-12 items-end justify-center"
      >
        <Text className="text-sm font-medium text-primary dark:text-primary-dark">
          Forgot password?
        </Text>
      </Pressable>
    ) : null}
    {error ? (
      <Text accessibilityLiveRegion="polite" className="text-center text-sm text-error dark:text-error-dark">
        {error}
      </Text>
    ) : null}
  </>
);
```

Place `emailInputs` just before the `return` block (not inside JSX — as a named element in the function scope). The main form `<View className="w-full gap-4">` then becomes:

```tsx
<View className="w-full gap-4">
  <View className="items-center gap-2">
    <Text className="text-center text-display font-semibold text-text-primary dark:text-text-primary-dark">
      Kin Finance
    </Text>
    <Text className="text-center text-base text-text-secondary dark:text-text-secondary-dark">
      {subtitle}
    </Text>
  </View>

  {googlePrimary ? (
    <>
      {emailInputs}
      <Button
        title={mode === "sign-in" ? "Sign In" : "Sign Up"}
        variant="secondary"
        onPress={mode === "sign-in" ? handleSignIn : handleSignUp}
        loading={isLoading}
        disabled={isGoogleLoading}
      />
      <Divider text="or continue with Google" />
      <Button
        title="Continue with Google"
        icon={<FontAwesome name="google" size={18} color={C.background} />}
        badge="Last used"
        onPress={handleGoogle}
        loading={isGoogleLoading}
        disabled={isLoading}
      />
    </>
  ) : (
    <>
      <Button
        title="Continue with Google"
        variant="secondary"
        icon={<FontAwesome name="google" size={18} color={C.textPrimary} />}
        onPress={handleGoogle}
        loading={isGoogleLoading}
        disabled={isLoading}
      />
      <Divider text={dividerEmail} />
      {emailInputs}
      <Button
        title={mode === "sign-in" ? "Sign In" : "Sign Up"}
        onPress={mode === "sign-in" ? handleSignIn : handleSignUp}
        loading={isLoading}
        disabled={isGoogleLoading}
        badge={preferred === "email" ? "Last used" : undefined}
      />
    </>
  )}

  <Pressable
    onPress={() => {
      setMode(mode === "sign-in" ? "sign-up" : "sign-in");
      setError(null);
      setEmailError(null);
      setPasswordError(null);
      setConfirmError(null);
      setPassword("");
      setConfirmPassword("");
    }}
    accessibilityRole="button"
    className="min-h-12 items-center justify-center py-2"
  >
    <Text className="text-sm font-medium text-primary dark:text-primary-dark">
      {mode === "sign-in"
        ? "Don't have an account? Sign up"
        : "Already have an account? Sign in"}
    </Text>
  </Pressable>
</View>
```

**Important:** Move `emailInputs` as a named element at the top of the `Index` function body (before the `return`), not inside the JSX. This keeps the JSX readable while sharing the input blocks across both layout branches.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: no errors

Run: `npm run lint`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add app/index.tsx
git commit -m "Login screen: reorder/wrap CTA based on last-used auth method"
```

---

## Final Verification (all tasks complete)

Run both commands from project root:

```bash
npx tsc --noEmit && npm run lint
```

Expected: both pass with no errors.

**Manual QA checklist:**
1. First visit (no preference stored): email-primary layout, no badge, subtitle = "Welcome back. Sign in to your family's ledger."
2. Sign in with Google → navigate away → return to login screen → Google is primary at bottom, badge "Last used", subtitle "One tap to get back in with Google."
3. Sign in with email → navigate away → return → email is primary at bottom, badge "Last used", subtitle "Welcome back. Sign in to your family's ledger."
4. Toggle sign-in ↔ sign-up: subtitle changes correctly per matrix; confirm-password field appears/disappears in sign-up.
5. MFA/SMS verify flows are unchanged (no badge, no reordering).
6. Dark mode: badge uses `C.surface`/`C.primary` which adapt correctly in dark theme.
