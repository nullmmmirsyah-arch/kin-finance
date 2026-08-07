# Clerk Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Clerk authentication (email + password sign-up/sign-in, Google OAuth) to the kin-finance Expo app using the custom flow, with route guarding between the auth screen and a home screen.

**Architecture:** `ClerkProvider` wraps the root layout with the publishable key and `tokenCache` (session persisted in `expo-secure-store`). `SignedIn`/`SignedOut` from `@clerk/expo` swap which screen the `Stack` exposes: signed-out users see only the auth screen (`app/index.tsx`), signed-in users see only the home screen (`app/home.tsx`). Auth uses Clerk's `useSignIn`, `useSignUp`, and `useSSO` hooks; Google OAuth runs via a redirect browser (works in Expo Go, no dev build).

**Tech Stack:** Expo SDK 54, expo-router, React Native, TypeScript, Clerk `@clerk/expo` 4.x, `expo-secure-store`, `expo-auth-session`, `expo-crypto`, `expo-web-browser`, `expo-linking`.

## Global Constraints

- Expo SDK is pinned to 54. Before writing any code, consult the versioned docs at https://docs.expo.dev/versions/v54.0.0/.
- Use `npx expo install` for all new dependencies so versions match the SDK.
- The app uses the root `app/` directory (not `src/app`).
- `.env` publishable key var name: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- Google OAuth uses the app scheme `kinfinance` (already in `app.json`) via `Linking.createURL`.
- No comments in code unless the existing file has them.
- Do NOT run `git commit` steps unless the user explicitly asks for commits.
- Verification commands: `npx tsc --noEmit` and `npx expo lint`. There is no unit-test runner configured in this project; each task is verified by these two commands plus the manual QA checklist in Task 5.
- Everything is English in code; user-facing copy is Indonesian (per the existing conversation).

---

### Task 1: Install dependencies, register plugins, create `.env`

**Files:**
- Modify: `package.json` (via `npx expo install`)
- Modify: `app.json:28-42` (plugins array)
- Modify: `.gitignore:33-34` (local env files block)
- Create: `.env`

**Interfaces:**
- Produces: `app.json` plugins `["expo-router", ["expo-splash-screen", {...}], "expo-secure-store", "@clerk/expo"]`; `.env` containing `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`; `.gitignore` covering `.env`.

- [ ] **Step 1: Install Clerk and storage/oauth dependencies**

Run: `npx expo install @clerk/expo expo-secure-store expo-auth-session expo-crypto`

Expected: installs `@clerk/expo` 4.x plus SDK-54-compatible versions of `expo-secure-store`, `expo-auth-session`, `expo-crypto`. (`expo-web-browser` is already a dependency.)

- [ ] **Step 2: Register the config plugins in `app.json`**

Edit the `plugins` array in `app.json` (currently lines 28-42) to add `"expo-secure-store"` and `"@clerk/expo"`:

```json
"plugins": [
  "expo-router",
  [
    "expo-splash-screen",
    {
      "image": "./assets/images/splash-icon.png",
      "imageWidth": 200,
      "resizeMode": "contain",
      "backgroundColor": "#ffffff",
      "dark": {
        "backgroundColor": "#000000"
      }
    }
  ],
  "expo-secure-store",
  "@clerk/expo"
]
```

- [ ] **Step 3: Gitignore the env file**

Edit `.gitignore` — replace the `# local env files` block (lines 33-34):

```gitignore
# local env files
.env
.env.*
```

- [ ] **Step 4: Create `.env` with the publishable key**

Create `.env` at the project root:

```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder
```

Then ask the user to paste their real Publishable Key from the Clerk Dashboard (API Keys → Quick Copy). Do not proceed until the value is a real `pk_...` key.

- [ ] **Step 5: Verify config**

Run: `npx expo config --type public`
Expected: output includes the plugins `expo-secure-store` and `@clerk/expo`.

---

### Task 2: Root layout with `ClerkProvider` and route guard

**Files:**
- Modify: `app/_layout.tsx` (replace entire file, 5 lines)

**Interfaces:**
- Consumes: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` from `.env` (Task 1); `tokenCache` from `@clerk/expo/token-cache`.
- Produces: `<ClerkProvider>` root wrapper that renders a `SignedIn` stack with screen `home` and a `SignedOut` stack with screen `index`. Later tasks rely on routes named `index` and `home` existing.

- [ ] **Step 1: Rewrite the root layout**

Replace `app/_layout.tsx` entirely with:

```tsx
import { ClerkProvider, SignedIn, SignedOut } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error("Add your Clerk Publishable Key to the .env file");
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <SignedIn>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="home" />
        </Stack>
      </SignedIn>
      <SignedOut>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
        </Stack>
      </SignedOut>
    </ClerkProvider>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors. (Clerk's `ClerkProvider` accepts `publishableKey` and `tokenCache` props; `SignedIn`/`SignedOut` exist in `@clerk/expo`.)

Run: `npx expo lint`
Expected: no errors.

---

### Task 3: Auth screen with sign-in/sign-up toggle and Google

**Files:**
- Modify: `app/index.tsx` (replace entire file, 15 lines)

**Interfaces:**
- Consumes: `useSignIn`, `useSignUp`, `useSSO` from `@clerk/expo`; `expo-linking`; `expo-web-browser`; `Linking.createURL("/", { scheme: "kinfinance" })`.
- Produces: The auth screen at route `/`. When a session becomes active, `SignedIn` in the root layout (Task 2) swaps the stack to `home`. Exposes `signUp.verifications.verifyEmailCode({ code })` then `signUp.finalize()` for the verify step.

- [ ] **Step 1: Replace `app/index.tsx`**

Replace the whole file with:

```tsx
import { useSignIn, useSignUp, useSSO } from "@clerk/expo";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

type Mode = "sign-in" | "sign-up";

export default function Index() {
  useWarmUpBrowser();

  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO({ strategy: "oauth_google" });

  const [mode, setMode] = useState<Mode>("sign-in");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { error } = await signIn.password({ emailAddress, password });
      if (error) {
        setError(error.message);
        return;
      }
      if (signIn.status === "complete") {
        await signIn.finalize();
      } else {
        setError("Masuk gagal. Periksa kembali email dan password.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { error } = await signUp.password({ emailAddress, password });
      if (error) {
        setError(error.message);
        return;
      }
      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) {
        setError(sendError.message);
        return;
      }
      setIsVerifying(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { error } = await signUp.verifications.verifyEmailCode({ code });
      if (error) {
        setError(error.message);
        return;
      }
      const { error: finalizeError } = await signUp.finalize();
      if (finalizeError) {
        setError(finalizeError.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        redirectUrl: Linking.createURL("/", { scheme: "kinfinance" }),
      });
      if (createdSessionId) {
        await setActive?.({ session: createdSessionId });
      }
    } catch {
      setError("Login Google gagal. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Masukkan kode verifikasi</Text>
        <TextInput
          style={styles.input}
          value={code}
          placeholder="Kode verifikasi"
          onChangeText={setCode}
          keyboardType="numeric"
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Button
          title="Verifikasi"
          onPress={handleVerify}
          disabled={isLoading}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kin Finance</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        value={emailAddress}
        placeholder="Email"
        onChangeText={setEmailAddress}
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        value={password}
        placeholder="Password"
        secureTextEntry
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {isLoading ? (
        <ActivityIndicator size="large" />
      ) : (
        <>
          <Button
            title={mode === "sign-in" ? "Masuk" : "Daftar"}
            onPress={mode === "sign-in" ? handleSignIn : handleSignUp}
          />
          <Button title="Lanjut dengan Google" onPress={handleGoogle} />
          <Text
            style={styles.link}
            onPress={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setError(null);
            }}
          >
            {mode === "sign-in"
              ? "Belum punya akun? Daftar"
              : "Sudah punya akun? Masuk"}
          </Text>
        </>
      )}
      <View nativeID="clerk-captcha" />
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
    marginBottom: 16,
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
  link: {
    color: "#1e88e5",
    textAlign: "center",
    marginTop: 8,
  },
});
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors. If `signIn.finalize()` or `signUp.finalize()` signature errors appear, the optional `navigate` argument is not required — pass no args.

Run: `npx expo lint`
Expected: no errors.

---

### Task 4: Home screen

**Files:**
- Create: `app/home.tsx`

**Interfaces:**
- Consumes: `useUser` (for user email), `useAuth` (for `signOut`) from `@clerk/expo`.
- Produces: route `/home`, registered only in the signed-in stack from Task 2.

- [ ] **Step 1: Create the home screen**

Create `app/home.tsx`:

```tsx
import { useAuth, useUser } from "@clerk/expo";
import { Button, StyleSheet, Text, View } from "react-native";

export default function Home() {
  const { signOut } = useAuth();
  const { user } = useUser();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kin Finance</Text>
      <Text style={styles.subtitle}>
        Halo, {user?.primaryEmailAddress?.emailAddress ?? "Pengguna"}!
      </Text>
      <Button title="Keluar" onPress={() => signOut()} />
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
});
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx expo lint`
Expected: no errors.

---

### Task 5: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Static checks**

Run: `npx tsc --noEmit`
Run: `npx expo lint`
Expected: both clean.

- [ ] **Step 2: Manual QA in Expo Go**

Run: `npx expo start`, scan the QR code with Expo Go.

Walk through each case and confirm behavior:

1. App opens to the **Masuk** (sign-in) screen.
2. Tap **Belum punya akun? Daftar** → shows sign-up form.
3. Sign up with a new email + password → verification code screen appears; enter the emailed code → **Verifikasi** → app lands on **home** showing the user's email.
4. Tap **Keluar** → returns to the sign-in screen.
5. Sign in again with the same email + password → lands on **home**.
6. Tap **Lanjut dengan Google** → browser OAuth flow → returns signed in → **home**.
7. Kill and reopen the app → session persists (still signed in, straight to **home**).
8. While signed out, `/home` is not reachable; while signed in, the auth screen is not reachable.
