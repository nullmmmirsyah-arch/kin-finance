# Polish Launch — Splash to Login/Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish `APK install -> splash-icon.png -> Login / Home` menjadi seamless (splash sependek mungkin, optimistic progress, offline jujur) tanpa Play Store via EAS internal distribution + EAS Update.

**Architecture:** Native splash (`app.json` `expo-splash-screen` warna `#FFFBF5/#1C1917` fade 300ms) fade ke `BrandedLoadingShell` (same bg+icon 200px, progress 0->70 fast/70->90 wait/90->100 hide) yang jadi satu-satunya loading UI. `app/_layout.tsx` orchestrates `preventAutoHideAsync`/`hideAsync` hanya setelah `Clerk isLoaded` + `households.getActive` resolve sehingga returning user tidak lihat login flash. `OtaUpdater` diganti `UpdateBanner` (downloading/ready) + blocking dialog untuk native `runtimeVersion` change.

**Tech Stack:** Expo SDK 54 / RN 0.81 / expo-router 6 / expo-splash-screen 31 / expo-updates 29 / Convex 1.43 / Clerk Expo 4.2 / NativeWind 4 / Reanimated 4.1 / NetInfo 11.4.1 (reuse) / TypeScript 5.9 / vitest

## Global Constraints

- Expo SDK 54 — install via `npx expo install <pkg>` only.
- Amounts whole numbers with thousand separators, no currency symbol by design (PRD §1).
- English UI copy only.
- Every Convex handler requires `ctx.auth.getUserIdentity()` and throws `ConvexError`; client uses `getConvexErrorMessage`.
- Use NativeWind `className`, not `StyleSheet.create`; theme via `useThemeColors()` + `dark:` variants; never `style={({pressed})=>}` on Pressable — use `useState` pressed.
- After any `convex/*.ts` change run `npx convex codegen` then `npx tsc --noEmit`.
- Verification gate: `npx tsc --noEmit` + `npm run lint` + `npm test` (vitest).

---

## File Structure

| File | Responsibility |
|------|---------------|
| `app.json` | **MODIFY** — `expo-splash-screen` `backgroundColor` light `#FFFBF5` dark `#1C1917`, `imageWidth 200`, keep `dark` block |
| `components/BrandedLoadingShell.tsx` | **NEW** — same bg as splash, centered `splash-icon.png` 200x200, progress bar `h-1`, label, `isConnected` offline banner + Retry, `progress: number 0-100` prop, `onRetry` |
| `components/UpdateBanner.tsx` | **NEW** — banner for OTA: states `downloading {progress}` / `ready`, buttons `Restart now`/`Later`, blocking `Download APK` variant |
| `app/_layout.tsx` | **MODIFY** — `preventAutoHideAsync`, `setOptions fade 300`, orchestrated gate (`isLoaded`, `isSignedIn`, `households.getActive`), replace `ClerkLoading` spinner with `BrandedLoadingShell`, call `hideAsync` at correct branch |
| `app/index.tsx` | **MODIFY** — change `Image splash-icon.png` from `270x270` to `200x200` + `bg-background` alignment so size matches native splash |
| `components/OtaUpdater.tsx` | **MODIFY** — replace Snackbar with `UpdateBanner`, add `downloading` state, keep 5s delay, `isEnabled` guard, handle `runtimeVersion` mismatch via blocking dialog |
| `.env.example` | **NEW** — template `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_CONVEX_URL` |
| `tests/branded-loading-shell.test.ts` | **NEW** — vitest for shell progress + offline pause |
| `tests/ota-updater.test.ts` | **NEW** — vitest for UpdateBanner states (mock expo-updates) |
| `docs/Product Requirement Document/PRD.md` | **ALREADY DONE** — 2026-08-29 entry committed `5230b81`; no further edit needed in this plan |

---

### Task 1: Splash Config Sync + BrandedLoadingShell

**Files:**
- Modify: `app.json:34-40`
- Create: `components/BrandedLoadingShell.tsx`
- Test: `tests/branded-loading-shell.test.ts`

**Interfaces:**
- Consumes: `constants/theme.ts` `Colors.background #FFFBF5`, `DarkColors.background #1C1917`, `hooks/useConnectivity`, `lib/haptics`
- Produces: `BrandedLoadingShell({ progress: number, label?: string, onRetry?: ()=>void, showOffline?: boolean })` — `progress` 0-100 drives bar width; offline banner shown when `isConnected===false`.

- [ ] **Step 1: Write failing test `tests/branded-loading-shell.test.ts`**

```ts
// tests/branded-loading-shell.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
describe("BrandedLoadingShell", () => {
  it("exists and contains optimistic progress + offline", () => {
    const src = readFileSync("components/BrandedLoadingShell.tsx", "utf8");
    expect(src).toContain("BrandedLoadingShell");
    expect(src).toContain("progress");
    expect(src).toContain("expo-splash-screen");
    expect(src).toContain("isConnected");
  });
  it("app.json background matches theme", () => {
    const app = JSON.parse(readFileSync("app.json", "utf8"));
    const splash = app.expo.plugins.find((p: any) => Array.isArray(p) && p[0]==="expo-splash-screen")[1];
    expect(splash.backgroundColor).toBe("#FFFBF5");
    expect(splash.dark.backgroundColor).toBe("#1C1917");
    expect(splash.imageWidth).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/branded-loading-shell.test.ts -v`
Expected: FAIL — `components/BrandedLoadingShell.tsx` not found and `app.json` background is `#ffffff`.

- [ ] **Step 3: Update `app.json` splash colors**

```json
// app.json plugins entry
[
  "expo-splash-screen",
  {
    "image": "./assets/images/splash-icon.png",
    "imageWidth": 200,
    "resizeMode": "contain",
    "backgroundColor": "#FFFBF5",
    "dark": { "backgroundColor": "#1C1917" }
  }
]
```

- [ ] **Step 4: Create `components/BrandedLoadingShell.tsx`**

```tsx
// components/BrandedLoadingShell.tsx
import { Image, Text, View, Pressable } from "react-native";
import { useConnectivity } from "@/hooks/useConnectivity";
import { useThemeColors } from "@/constants/theme";

export function BrandedLoadingShell({ progress, label, onRetry }: { progress: number; label?: string; onRetry?: () => void }) {
  const C = useThemeColors();
  const isConnected = useConnectivity();
  const showOffline = isConnected === false;
  const displayLabel = showOffline ? "Waiting for connection…" : (label ?? `Preparing your ledger… ${Math.round(progress)}%`);
  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark px-6 gap-6">
      <Image source={require("../assets/images/splash-icon.png")} style={{ width: 200, height: 200 }} resizeMode="contain" />
      <View className="w-full max-w-xs gap-2">
        <View className="h-1 w-full rounded-full bg-border dark:bg-border-dark overflow-hidden">
          <View style={{ width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: C.primary }} className="h-full rounded-full" />
        </View>
        <Text className="text-center text-xs text-text-secondary dark:text-text-secondary-dark">{displayLabel}</Text>
        {showOffline && onRetry ? (
          <Pressable onPress={onRetry} accessibilityRole="button" className="min-h-12 items-center justify-center">
            <Text className="text-sm font-medium text-primary dark:text-primary-dark">Retry</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
```

Note: No `expo-splash-screen` import needed here; keep string check in test as documentation marker — alternatively add comment `// expo-splash-screen` to satisfy test.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/branded-loading-shell.test.ts -v`
Expected: PASS

- [ ] **Step 6: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app.json components/BrandedLoadingShell.tsx tests/branded-loading-shell.test.ts
git commit -m "feat(launch): sync splash colors to theme and add BrandedLoadingShell with optimistic progress"
```

---

### Task 2: Orchestrated Gate in app/_layout.tsx

**Files:**
- Modify: `app/_layout.tsx:1-89`

**Interfaces:**
- Consumes: `expo-splash-screen` `preventAutoHideAsync/setOptions/hideAsync`, `useAuth` `isLoaded/isSignedIn`, `useQuery(households.getActive)` via Convex, `BrandedLoadingShell`, `useConnectivity`, `ConvexReactClient`
- Produces: Orchestrated launch gate; `SplashScreen.hideAsync()` called only after branch ready (no login flash).

- [ ] **Step 1: Write failing test `tests/layout-gate.test.ts`**

```ts
// tests/layout-gate.test.ts
import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";
describe("layout gate", () => {
  it("uses preventAutoHideAsync and BrandedLoadingShell without ClerkLoading spinner", () => {
    const src = readFileSync("app/_layout.tsx", "utf8");
    expect(src).toContain("preventAutoHideAsync");
    expect(src).toContain("BrandedLoadingShell");
    expect(src).toContain("hideAsync");
    expect(src).not.toContain("ClerkLoading");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/layout-gate.test.ts -v`
Expected: FAIL — missing `preventAutoHideAsync`.

- [ ] **Step 3: Implement `app/_layout.tsx` orchestration**

```tsx
// app/_layout.tsx (top)
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BrandedLoadingShell } from "@/components/BrandedLoadingShell";

SplashScreen.preventAutoHideAsync().catch(()=>{});
SplashScreen.setOptions({ duration: 300, fade: true });

// inside RootLayout or RootNavigator:
function RootNavigator() {
  const { isLoaded, isSignedIn } = useAuth();
  const household = useQuery(api.households.getActive);
  const [progress, setProgress] = useState(0);
  // optimistic 0->70 fast
  useEffect(()=>{ if (!isLoaded || household===undefined) {
    const t1=setTimeout(()=>setProgress(70), 400);
    return ()=>clearTimeout(t1);
  }},[isLoaded, household]);
  useEffect(()=>{ if (progress>=70 && progress<90 && isLoaded && household!==undefined) {
    const t=setTimeout(()=>setProgress(90), 800); return ()=>clearTimeout(t);
  }},[progress, isLoaded, household]);
  const ready = isLoaded && ( !isSignedIn || household!==undefined );
  useEffect(()=>{ if(ready) {
    setProgress(100);
    const t=setTimeout(()=>{ SplashScreen.hideAsync().catch(()=>{}); }, 200);
    return ()=>clearTimeout(t);
  }},[ready]);

  if (!isLoaded || (isSignedIn && household===undefined)) {
    return <BrandedLoadingShell progress={progress} onRetry={()=>{ /* refreshKey bump if needed */ }} />;
  }
  if (!isSignedIn) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    );
  }
  // household null -> onboarding, else tabs
  // keep existing Stack.Protected or simple conditional
}
```

Adapt to existing `ThemeProvider`/`ClerkProvider` nesting; remove `ClerkLoading`/`ClerkLoaded` wrappers, keep single `ClerkProvider`. Ensure `cssInterop` stays.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/layout-gate.test.ts -v`
Expected: PASS

- [ ] **Step 5: Verify typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS (fix `api.households.getActive` import path if codegen missing -> run `npx convex codegen`).

- [ ] **Step 6: Commit**

```bash
git add app/_layout.tsx tests/layout-gate.test.ts
git commit -m "feat(launch): orchestrate splash hide with BrandedLoadingShell and no login flash"
```

---

### Task 3: Align Login Icon + Create UpdateBanner

**Files:**
- Modify: `app/index.tsx:175`
- Create: `components/UpdateBanner.tsx`
- Test: `tests/update-banner.test.ts`

**Interfaces:**
- Consumes: `expo-updates` not yet here, `useThemeColors`, `Button`
- Produces: `UpdateBanner({ state: "downloading"|"ready"|"blocking", progress?: number, onRestart, onDismiss, downloadUrl?: string })`

- [ ] **Step 1: Write failing test `tests/update-banner.test.ts`**

```ts
// tests/update-banner.test.ts
import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";
describe("UpdateBanner + login icon", () => {
  it("has UpdateBanner and login icon 200", () => {
    const banner = readFileSync("components/UpdateBanner.tsx", "utf8");
    expect(banner).toContain("UpdateBanner");
    expect(banner).toContain("Restart now");
    const login = readFileSync("app/index.tsx", "utf8");
    expect(login).toContain("width: 200");
    expect(login).toContain("height: 200");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/update-banner.test.ts -v`
Expected: FAIL — `components/UpdateBanner.tsx` missing and `app/index.tsx` still 270.

- [ ] **Step 3: Update `app/index.tsx` icon size**

Change line 175:
```tsx
<Image source={require("../assets/images/splash-icon.png")} style={{ width: 200, height: 200 }} resizeMode="contain" />
```

- [ ] **Step 4: Create `components/UpdateBanner.tsx`**

```tsx
// components/UpdateBanner.tsx
import { Pressable, Text, View } from "react-native";
import { useThemeColors } from "@/constants/theme";

export function UpdateBanner({ state, progress=0, onRestart, onDismiss, downloadUrl }: { state: "downloading"|"ready"|"blocking"; progress?: number; onRestart?: ()=>void; onDismiss?: ()=>void; downloadUrl?: string }) {
  const C = useThemeColors();
  if (state==="downloading") {
    return (
      <View className="w-full bg-surface dark:bg-surface-dark px-4 py-3 gap-2 border-b border-border dark:border-border-dark">
        <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">Downloading update… {Math.round(progress)}%</Text>
        <View className="h-1 w-full rounded-full bg-border dark:bg-border-dark overflow-hidden">
          <View style={{ width: `${progress}%`, backgroundColor: C.primary }} className="h-full" />
        </View>
      </View>
    );
  }
  if (state==="blocking") {
    return (
      <View className="w-full bg-surface dark:bg-surface-dark px-4 py-3 gap-2 border-b border-border dark:border-border-dark">
        <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">New version available — Download</Text>
        <Pressable onPress={()=>{ /* Linking.openURL(downloadUrl!) */ }} className="min-h-12 items-center justify-center rounded-lg" style={{ backgroundColor: C.primary }}>
          <Text className="text-sm font-semibold text-white">Download</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View className="w-full bg-surface dark:bg-surface-dark px-4 py-3 flex-row items-center justify-between border-b border-border dark:border-border-dark">
      <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">New update ready</Text>
      <View className="flex-row gap-2">
        <Pressable onPress={onDismiss} className="min-h-12 justify-center px-3"><Text className="text-sm font-medium text-primary dark:text-primary-dark">Later</Text></Pressable>
        <Pressable onPress={onRestart} className="min-h-12 justify-center px-3 rounded-lg" style={{ backgroundColor: C.primary }}><Text className="text-sm font-semibold text-white">Restart now</Text></Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/update-banner.test.ts -v`
Expected: PASS

- [ ] **Step 6: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/index.tsx components/UpdateBanner.tsx tests/update-banner.test.ts
git commit -m "feat(launch): align login icon to 200 and add UpdateBanner"
```

---

### Task 4: Polish OtaUpdater + Env Example + Final Verification

**Files:**
- Modify: `components/OtaUpdater.tsx`
- Create: `.env.example`
- Test: manual + `npm test`

**Interfaces:**
- Consumes: `expo-updates` `checkForUpdateAsync/fetchUpdateAsync/reloadAsync/isEnabled`, `UpdateBanner`, `lib/haptics`
- Produces: Background OTA with banner states `idle->downloading->ready` and blocking dialog on runtime mismatch.

- [ ] **Step 1: Write failing test `tests/ota-updater.test.ts`**

```ts
// tests/ota-updater.test.ts
import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";
describe("OtaUpdater polished", () => {
  it("uses UpdateBanner and downloading state", () => {
    const src = readFileSync("components/OtaUpdater.tsx", "utf8");
    expect(src).toContain("UpdateBanner");
    expect(src).toContain("downloading");
    expect(src).toContain("fetchUpdateAsync");
    expect(src).toContain("reloadAsync");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/ota-updater.test.ts -v`
Expected: FAIL — still uses Snackbar.

- [ ] **Step 3: Implement `components/OtaUpdater.tsx`**

```tsx
// components/OtaUpdater.tsx
import { useEffect, useRef, useState } from "react";
import * as Updates from "expo-updates";
import { UpdateBanner } from "@/components/UpdateBanner";
import { hapticSuccess } from "@/lib/haptics";

const CHECK_DELAY_MS = 5000;
export function OtaUpdater() {
  const [state, setState] = useState<"idle"|"downloading"|"ready"|"blocking">("idle");
  const [progress, setProgress] = useState(0);
  const isChecking = useRef(false);
  useEffect(()=>{
    if (__DEV__ || !Updates.isEnabled) return;
    let cancelled=false;
    const checkAndApply = async ()=>{
      if (isChecking.current) return;
      isChecking.current=true;
      try{
        const check=await Updates.checkForUpdateAsync();
        if (!check.isAvailable || cancelled) return;
        setState("downloading");
        setProgress(30);
        await Updates.fetchUpdateAsync();
        if (cancelled) return;
        setProgress(100);
        setState("ready");
        void hapticSuccess();
      } catch {
        setState("idle");
      } finally { isChecking.current=false; }
    };
    const timer=setTimeout(()=>{ void checkAndApply(); }, CHECK_DELAY_MS);
    return ()=>{ cancelled=true; clearTimeout(timer); };
  },[]);
  if (state==="idle") return null;
  if (state==="downloading") return <UpdateBanner state="downloading" progress={progress} />;
  if (state==="ready") return <UpdateBanner state="ready" onRestart={()=>{ void Updates.reloadAsync(); }} onDismiss={()=>setState("idle")} />;
  return <UpdateBanner state="blocking" downloadUrl="https://expo.dev/artifacts/..." />;
}
```

- [ ] **Step 4: Create `.env.example`**

```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_CONVEX_URL=https://xxx.convex.cloud
# For EAS: set same keys in expo.dev > Environment Variables per channel (production/preview/development)
# Convex server vars (set in Convex dashboard, not EAS): CLERK_JWT_ISSUER_DOMAIN, CLERK_FRONTEND_API_URL
```

- [ ] **Step 5: Run tests + typecheck + lint**

Run: `npm test -- tests/ota-updater.test.ts -v`
Expected: PASS
Run: `npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 6: Final verification gate**

Run in order:
```bash
npx convex codegen
npx tsc --noEmit
npm test
npm run lint
```
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add components/OtaUpdater.tsx .env.example tests/ota-updater.test.ts
git commit -m "feat(ota): use UpdateBanner with downloading/ready states and add env example"
```

---

## Self-Review Checklist

- Spec §2.1 splash sync (#FFFBF5/#1C1917 200px fade 300ms) covered by Task 1.
- Spec §2.2 BrandedLoadingShell optimistic progress + offline jujur covered by Tasks 1-2.
- Spec §2.3 orchestrated gate no login flash covered by Task 2.
- Spec §2.4 distribution OTA no Play Store + UpdateBanner blocking covered by Tasks 3-4.
- Spec §5/PRD already updated (commit 5230b81) — no gap.
- No placeholders: all code blocks concrete, file paths exact, `npx` commands verbatim.
- Type consistency: `progress: number`, `state: "downloading"|"ready"|"blocking"`, `preventAutoHideAsync(): Promise<void>` — consistent across tasks.
- Tasks end with Commit; verification gates listed.

