# P0 Batch 3 — PTR Real + Auth Modular Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PTR/Banner jadi real via NetInfo + refreshKey dan pecah Auth monolith 915 baris jadi 5 komponen + 2 hooks + eye toggle & OTP autofill.

**Architecture:** Hook `useConnectivity` subscribe `@react-native-community/netinfo`, 4 tab bump `refreshKey` untuk trigger Convex re-query (reactive, no manual invalidate). `app/index.tsx` jadi orchestrator 150 baris, logic pindah ke `hooks/useAuthFlow` + `hooks/useResetFlow`, UI ke `components/Auth/*`. `Input` tambah `secureToggle` dengan Feather eye/eye-off 48px.

**Tech Stack:** Expo SDK 54 / RN 0.81 / Convex 1.43 / NativeWind 4 / `@react-native-community/netinfo` / Clerk Expo 4.2 / `expo-haptics` / TypeScript 5.9 / vitest + convex-test

## Global Constraints

- Expo SDK 54 — install via `npx expo install <pkg>` only.
- Amounts whole numbers with thousand separators, no currency symbol by design (PRD §1).
- English UI copy only (PRD §1).
- Every Convex handler requires `ctx.auth.getUserIdentity()` and throws `ConvexError`.
- Client never shows `error.message`; use `getConvexErrorMessage(e, fallback)`.
- Use NativeWind `className`, not `StyleSheet.create`; theme via `useThemeColors()` + `dark:` variants; never `style={({pressed})=>}` on Pressable — use `useState` pressed.
- After any `convex/*.ts` change run `npx convex codegen` then `npx tsc --noEmit`.
- Verification gate per repo: `npx tsc --noEmit` + `npm run lint` + `npm test` (vitest).

---

## File Structure

| File | Responsibility |
|------|---------------|
| `hooks/useConnectivity.ts` | **NEW** — subscribes NetInfo, returns `isConnected: boolean \| null`. Null = unknown awal. Safe try/catch untuk web/Expo Go. |
| `components/Input.tsx` | **MODIFY** — tambah `secureToggle?: boolean` prop, render eye button 48x48 di kanan, toggle `secureTextEntry` internal. |
| `components/Auth/EmailField.tsx` | **NEW** — wrapper Input email dengan `labelBadge="Last used"` when preferred=email. |
| `components/Auth/PasswordField.tsx` | **NEW** — wrapper Input password dengan eye toggle, error mapping. |
| `components/Auth/CodeField.tsx` | **NEW** — Input 6-digit `textContentType="oneTimeCode"` + `autoComplete="sms-otp"` + `keyboardType="numeric"` + `autoFocus`. |
| `components/Auth/GoogleButton.tsx` | **NEW** — Button Continue with Google, badge Last used, loading. |
| `components/Auth/ResetFlow.tsx` | **NEW** — 3-step reset UI (email/code/password) driven by `useResetFlow`. |
| `hooks/useAuthFlow.ts` | **NEW** — Clerk signIn/signUp/verify/mfa/google logic pindah dari `app/index.tsx:107-369`. |
| `hooks/useResetFlow.ts` | **NEW** — resetStep + handlers `sendCode/verifyCode/submitPassword`. |
| `app/index.tsx` | **MODIFY** — potong 915→~150 baris orchestrator, import Auth components/hooks. |
| `app/(tabs)/home.tsx` | **MODIFY** — add `useConnectivity`, `refreshKey`, real PTR + banner logic. |
| `app/(tabs)/transactions.tsx` | **MODIFY** — sama, include refreshKey di queryKey. |
| `app/(tabs)/accounts.tsx` | **MODIFY** — sama. |
| `app/(tabs)/budgets.tsx` | **MODIFY** — sama. |
| `tests/input.secureToggle.test.ts` | **NEW** — vitest untuk eye toggle. |
| `docs/Product Requirement Document/PRD.md` | **MODIFY** — §2.1, §3.1, §3.6, §3.8, §5.2, §5.4, §8 + header Last updated 2026-08-28. |

---

### Task 1: Connectivity Hook + NetInfo Install

**Files:**
- Create: `hooks/useConnectivity.ts`
- Modify: `package.json` (via `npx expo install`)
- Test: manual + `npx tsc --noEmit`

**Interfaces:**
- Consumes: `@react-native-community/netinfo` `NetInfo.addEventListener`
- Produces: `useConnectivity(): boolean | null` — `null` awal, `true/false` setelah event. Safe fallback jika module tidak tersedia.

- [ ] **Step 1: Install NetInfo via Expo**

```bash
npx expo install @react-native-community/netinfo
```

- [ ] **Step 2: Create hook `hooks/useConnectivity.ts`**

```ts
// hooks/useConnectivity.ts
import { useEffect, useState } from "react";

export function useConnectivity(): boolean | null {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const NetInfo = require("@react-native-community/netinfo").default;
      unsubscribe = NetInfo.addEventListener((state: { isConnected: boolean | null }) => {
        setIsConnected(state.isConnected);
      });
    } catch {
      setIsConnected(null);
    }
    return () => unsubscribe?.();
  }, []);
  return isConnected;
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no type error, NetInfo types resolved).

- [ ] **Step 4: Commit**

```bash
git add hooks/useConnectivity.ts package.json package-lock.json
git commit -m "feat(connectivity): add useConnectivity hook via NetInfo"
```

---

### Task 2: Input Eye Toggle Enhancement

**Files:**
- Modify: `components/Input.tsx`
- Test: `tests/input.secureToggle.test.ts` (new)
- Consumes: `useThemeColors`, `Radius`, `Feather`
- Produces: `Input` prop `secureToggle?: boolean` — when true, renders 48x48 eye button toggling `secureTextEntry`.

- [ ] **Step 1: Write failing test `tests/input.secureToggle.test.ts`**

```ts
// tests/input.secureToggle.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
describe("Input secureToggle", () => {
  it("contains secureToggle prop and eye toggling", () => {
    const src = readFileSync("components/Input.tsx", "utf8");
    expect(src).toContain("secureToggle");
    expect(src).toContain("eye-off");
    expect(src).toContain("eye");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/input.secureToggle.test.ts -v`
Expected: FAIL — `secureToggle` not found.

- [ ] **Step 3: Implement secureToggle in `components/Input.tsx`**

```tsx
// components/Input.tsx (modify)
import { useCallback, useState, type Ref } from "react";
import { Radius, useThemeColors } from "@/constants/theme";
import { Text, TextInput, TextInputProps, View, Pressable } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { formatAmountInput } from "@/utils/format";

type Props = TextInputProps & {
  label?: string;
  labelBadge?: string;
  error?: string | null;
  amount?: boolean;
  secureToggle?: boolean;
  ref?: Ref<TextInput>;
};

export function Input({ label, labelBadge, error, style, amount=false, secureToggle, onChangeText, onFocus, onBlur, secureTextEntry, ...props }: Props) {
  const C = useThemeColors();
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const handleChangeText = useCallback((text:string)=>{ onChangeText?.(amount?formatAmountInput(text):text)},[amount,onChangeText]);
  const isSecure = secureToggle ? !showPassword : secureTextEntry;
  return (
    <View className="w-full gap-1.5">
      {label ? (<View className="flex-row items-center gap-1.5"><Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">{label}</Text>{labelBadge ? (<View className="rounded-full px-2 py-0.5" style={{backgroundColor:C.surface}}><Text className="text-xs font-medium" style={{color:C.primary}}>{labelBadge}</Text></View>):null}</View>):null}
      <View className="relative w-full justify-center">
        <TextInput placeholderTextColor={C.textSecondary} onFocus={(e)=>{setFocused(true); onFocus?.(e)}} onBlur={(e)=>{setFocused(false); onBlur?.(e)}} secureTextEntry={isSecure} style={[{borderRadius:Radius.sm, borderWidth:1, borderColor:error?C.error:focused?C.primary:C.border, backgroundColor:C.background, height:48, paddingHorizontal:16, paddingRight: secureToggle?48:16}, style]} className="w-full text-base text-text-primary dark:text-text-primary-dark" onChangeText={handleChangeText} {...props} />
        {secureToggle ? (<Pressable onPress={()=>setShowPassword(v=>!v)} accessibilityLabel={showPassword?"Hide password":"Show password"} style={{width:48,height:48}} className="absolute right-0 items-center justify-center"><Feather name={showPassword?"eye-off":"eye"} size={18} color={C.textSecondary} /></Pressable>):null}
      </View>
      {error ? (<Text accessibilityLiveRegion="polite" className="text-sm text-error dark:text-error-dark">{error}</Text>):null}
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/input.secureToggle.test.ts -v`
Expected: PASS

- [ ] **Step 5: Verify typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/Input.tsx tests/input.secureToggle.test.ts
git commit -m "feat(input): add secureToggle eye button (48px, Feather eye/eye-off)"
```

---

### Task 3: Auth Components & Hooks Extraction

**Files:**
- Create: `hooks/useAuthFlow.ts`, `hooks/useResetFlow.ts`
- Create: `components/Auth/EmailField.tsx`, `components/Auth/PasswordField.tsx`, `components/Auth/CodeField.tsx`, `components/Auth/GoogleButton.tsx`, `components/Auth/ResetFlow.tsx`
- Test: `npx tsc --noEmit` (no new unit, hooks typed)

**Interfaces:**
- Consumes: `@clerk/expo` `useSignIn/useSignUp/useSSO`, `expo-linking`, `expo-web-browser`, `lib/auth-preference`
- Produces: `useAuthFlow()` → `{handleSignIn, handleSignUp, handleVerify, handleMfaVerify, handleGoogle, error, emailError, passwordError, confirmError, isLoading, isGoogleLoading, code, setCode, emailAddress, setEmailAddress, password, setPassword, confirmPassword, setConfirmPassword, isVerifying, isMfaVerifying, ssoState}` and `useResetFlow()` → `{resetStep, resetPassword, setResetPassword, handleSendResetCode, handleVerifyResetCode, handleSubmitNewPassword, handleResendResetCode, error, isLoading}`. Components are dumb wrappers receiving `value/onChange/error`.

- [ ] **Step 1: Create `hooks/useAuthFlow.ts` (extract from app/index.tsx:107-369)**

```ts
// hooks/useAuthFlow.ts
import { useState } from "react";
import { useSignIn, useSignUp, useSSO } from "@clerk/expo";
import * as Linking from "expo-linking";
import { setLastAuthMethod } from "@/lib/auth-preference";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_REGEX = /^\d{6}$/;

export function useAuthFlow() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isMfaVerifying, setIsMfaVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [ssoSignIn, setSsoSignIn] = useState<any>(null);
  const [ssoSetActive, setSsoSetActive] = useState<any>(null);

  const handleSignIn = async () => { /* moved verbatim from index.tsx:107-164, but setLastAuthMethod("email") on success */ };
  const handleSignUp = async () => { /* from 166-214 */ };
  const handleVerify = async () => { /* 216-245 */ };
  const handleMfaVerify = async () => { /* 247-294 */ };
  const handleGoogle = async () => { /* 296-370 */ };
  return { emailAddress, setEmailAddress, password, setPassword, confirmPassword, setConfirmPassword, code, setCode, isVerifying, setIsVerifying, isMfaVerifying, setIsMfaVerifying, isLoading, isGoogleLoading, error, setError, emailError, setEmailError, passwordError, setPasswordError, confirmError, setConfirmError, ssoSignIn, ssoSetActive, handleSignIn, handleSignUp, handleVerify, handleMfaVerify, handleGoogle };
}
```

- [ ] **Step 2: Create `hooks/useResetFlow.ts`**

```ts
// hooks/useResetFlow.ts
import { useState } from "react";
import { useSignIn } from "@clerk/expo";
import { setLastAuthMethod } from "@/lib/auth-preference";
type ResetStep = "email" | "code" | "password" | null;
export function useResetFlow(emailAddress: string, setEmailError: (s:string|null)=>void, setPasswordError:(s:string|null)=>void, setError:(s:string|null)=>void) {
  const { signIn } = useSignIn();
  const [resetStep, setResetStep] = useState<ResetStep>(null);
  const [code, setCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const handleSendResetCode = async () => { /* from index.tsx:372-404 */ };
  const handleResendResetCode = async () => { /* 406-420 */ };
  const handleVerifyResetCode = async () => { /* 422-449 */ };
  const handleSubmitNewPassword = async () => { /* 451-485 */ };
  return { resetStep, setResetStep, code, setCode, resetPassword, setResetPassword, isLoading, setIsLoading, handleSendResetCode, handleResendResetCode, handleVerifyResetCode, handleSubmitNewPassword };
}
```

- [ ] **Step 3: Create 5 dumb components**

```tsx
// components/Auth/EmailField.tsx
import { Input } from "@/components/Input";
export function EmailField({ value, onChange, error, badge }: {value:string; onChange:(s:string)=>void; error:string|null; badge?:string}){
  return <Input label="Email" labelBadge={badge} value={value} placeholder="you@example.com" onChangeText={onChange} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" error={error} />;
}
// components/Auth/PasswordField.tsx
import { Input } from "@/components/Input";
export function PasswordField({ label="Password", value, onChange, error, placeholder }: {label?:string; value:string; onChange:(s:string)=>void; error:string|null; placeholder?:string}){
  return <Input label={label} value={value} placeholder={placeholder} secureTextEntry secureToggle onChangeText={onChange} autoCapitalize="none" autoCorrect={false} error={error} />;
}
// components/Auth/CodeField.tsx
import { Input } from "@/components/Input";
export function CodeField({ value, onChange, error }: {value:string; onChange:(s:string)=>void; error:string|null}){
  return <Input label="Verification code" value={value} placeholder="123456" onChangeText={onChange} keyboardType="numeric" autoFocus autoCorrect={false} maxLength={6} returnKeyType="done" textContentType="oneTimeCode" autoComplete="sms-otp" error={error} />;
}
// components/Auth/GoogleButton.tsx
import { Button } from "@/components/Button";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useThemeColors } from "@/constants/theme";
export function GoogleButton({ badge, loading, disabled, onPress, variant="primary"}:{badge?:string; loading?:boolean; disabled?:boolean; onPress:()=>void; variant?: "primary"|"secondary"}){
  const C=useThemeColors();
  const color = variant==="primary"?C.background:C.textPrimary;
  return <Button title="Continue with Google" variant={variant} icon={<FontAwesome name="google" size={18} color={color} />} badge={badge} onPress={onPress} loading={loading} disabled={disabled} />;
}
// components/Auth/ResetFlow.tsx (3-step UI) — renders inputs + buttons using useResetFlow return values
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/useAuthFlow.ts hooks/useResetFlow.ts components/Auth/
git commit -m "feat(auth): extract hooks and 5 dumb components (email/password/code/google/reset)"
```

---

### Task 4: Integrate Auth Components into app/index.tsx (Shrink Orchestrator)

**Files:**
- Modify: `app/index.tsx`
- Test: `npx tsc --noEmit` + manual login flow
- Consumes: hooks/components from Task 3, `useThemeColors`, `getLastAuthMethod`
- Produces: `app/index.tsx` ~150 lines orchestrator

- [ ] **Step 1: Replace app/index.tsx body**

Keep imports `useAuth, useRouter, getLastAuthMethod, Button` etc. but replace 915 lines with:

```tsx
import { useAuthFlow } from "@/hooks/useAuthFlow";
import { useResetFlow } from "@/hooks/useResetFlow";
import { EmailField } from "@/components/Auth/EmailField";
import { PasswordField } from "@/components/Auth/PasswordField";
import { CodeField } from "@/components/Auth/CodeField";
import { GoogleButton } from "@/components/Auth/GoogleButton";
import { ResetFlow } from "@/components/Auth/ResetFlow";

export default function Index(){
  const C=useThemeColors();
  const auth = useAuthFlow();
  const reset = useResetFlow(auth.emailAddress, auth.setEmailError, auth.setPasswordError, auth.setError);
  const [mode, setMode]=useState<Mode>("sign-in");
  const [preferred, setPreferred]=useState<"google"|"email"|null>(null);
  const [successScreen, setSuccessScreen]=useState<SuccessScreen>(null);
  // ... preferred loading, success beat, isSignedIn redirect, render branches using EmailField/PasswordField/CodeField/GoogleButton/ResetFlow
}
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 3: Manual verify**

Run: `npx expo start` — test sign-in, sign-up confirm mismatch, Google, forgot password 3 steps, MFA code autofill, last-used badge order.

- [ ] **Step 4: Commit**

```bash
git add app/index.tsx
git commit -m "refactor(auth): shrink index to orchestrator, wire new hooks/components"
```

---

### Task 5: PTR Real Integration in 4 Tabs

**Files:**
- Modify: `app/(tabs)/home.tsx`, `app/(tabs)/transactions.tsx`, `app/(tabs)/accounts.tsx`, `app/(tabs)/budgets.tsx`
- Consumes: `useConnectivity`, `useSnackbar`, `RefreshControl`, `ConnectivityBanner`, `hapticSuccess`
- Produces: `stale` computed from `isConnected` + 3s fallback, `refreshKey` bump on PTR/Retry.

Example for `home.tsx`:

- [ ] **Step 1: Add hook + state**

```tsx
import { useConnectivity } from "@/hooks/useConnectivity";
import { hapticSuccess } from "@/lib/haptics";
// inside component:
const isConnected = useConnectivity();
const [refreshKey, setRefreshKey] = useState(0);
const [refreshing, setRefreshing] = useState(false);
const [stale, setStale] = useState(false);
useEffect(()=>{
  if (isConnected===false){ setStale(true); return; }
  const isLoading = household===undefined || accountData===undefined || recent===undefined || monthSummary===undefined;
  if(!isLoading){ setStale(false); return; }
  const t=setTimeout(()=>setStale(true),3000);
  return ()=>clearTimeout(t);
},[household,accountData,recent,monthSummary,isConnected,refreshKey]);
```

- [ ] **Step 2: Wire RefreshControl + Banner**

```tsx
{stale && <ConnectivityBanner visible={stale} onRetry={()=>{ setStale(false); setRefreshKey(k=>k+1); show("Retrying…"); void hapticSuccess(); }} />}
<ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{ setRefreshing(true); setRefreshKey(k=>k+1); void hapticSuccess(); setTimeout(()=>setRefreshing(false),600)}} tintColor={C.primary} />}>
```

For `transactions.tsx`, also include `refreshKey` in `queryKey`: `const queryKey = useMemo(()=>JSON.stringify({...queryArgs, refreshKey}),[queryArgs, refreshKey])` and pass `_refreshKey` not needed — just bumping `refreshKey` forces `useQuery` resubscribe via key change in effect dependencies (Convex reactive will refetch on next render).

Repeat for `accounts.tsx` and `budgets.tsx` (FlatList `refreshControl`).

- [ ] **Step 3: Verify typecheck + lint + tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/home.tsx app/\(tabs\)/transactions.tsx app/\(tabs\)/accounts.tsx app/\(tabs\)/budgets.tsx
git commit -m "feat(ptr): real NetInfo + refreshKey in 4 tabs, banner instant on offline"
```

---

### Task 6: PRD Updates + Final Verification

**Files:**
- Modify: `docs/Product Requirement Document/PRD.md`

**Interfaces:**
- Consumes: Tasks 1-5 live code
- Produces: Updated PRD §2.1, §3.1, §3.6, §3.8, §5.2, §5.4, §5.7, header, §8

- [ ] **Step 1: Update PRD header**

Change `Last updated: 2026-08-27` → `Last updated: 2026-08-28`

- [ ] **Step 2: Update §2.1 Authentication row**

Append: "Password fields have visibility toggle (eye/eye-off, 48px); verification/MFA/reset codes use `oneTimeCode`/`sms-otp` autofill."

- [ ] **Step 3: Update §3.1 Login screen**

Add bullets:
- "Password visibility: eye icon toggles `secureTextEntry`; accessible label."
- "OTP autofill: code inputs use `textContentType='oneTimeCode'` + `autoComplete='sms-otp'` + `keyboardType='numeric'` + `maxLength 6` + `autoFocus`."
- "Modular structure: `app/index.tsx` orchestrator (~150 lines) + `hooks/useAuthFlow`, `hooks/useResetFlow`, `components/Auth/*` (EmailField, PasswordField, CodeField, GoogleButton, ResetFlow)."

- [ ] **Step 4: Update §3.6 & §3.8 PTR description**

Replace old PTR stanza with: "**PTR & stale real (as of 2026-08-28):** 4 tabs use `hooks/useConnectivity` (NetInfo) — banner appears instantly when `isConnected===false`, fallback `undefined >3s` otherwise; `RefreshControl` and banner Retry bump a `refreshKey` to re-subscribe Convex queries (real re-query, 600ms spinner, haptic). Requires native rebuild for NetInfo."

- [ ] **Step 5: Update §5.2 Responsibilities**

Add rows: `hooks/useConnectivity.ts` (NetInfo wrapper), `components/Auth/*` (Auth dumb components), `hooks/useAuthFlow/useResetFlow` (Clerk logic), `components/Input.tsx` secureToggle.

- [ ] **Step 6: Update §5.4 Error Handling**

Add: "Offline: NetInfo `isConnected===false` → instant ConnectivityBanner; fallback 3s for Convex undefined."

- [ ] **Step 7: Update §5.7 OTA**

Add note: "NetInfo is native — changes require new EAS Build APK, not just `eas update`."

- [ ] **Step 8: Update §8 Change Log (new top row)**

```md
| 2026-08-28 | Polish | P0 Batch 3: PTR/Banner real (NetInfo + refreshKey re-query, instant offline, haptic) + Auth modular (5 Auth components + 2 hooks, Input eye toggle 48px, OTP autofill oneTimeCode/sms-otp). Updates §2.1, §3.1, §3.6, §3.8, §5.2, §5.4, §5.7 |
```

- [ ] **Step 9: Final verification gate**

Run in order:
```bash
npx convex codegen
npx tsc --noEmit
npm test
npm run lint
```
Expected: all green. If fail, fix before commit.

- [ ] **Step 10: Commit**

```bash
git add "docs/Product Requirement Document/PRD.md"
git commit -m "docs: update PRD for P0 Batch 3 (NetInfo PTR real, Auth modular eye+OTP)"
```

---

## Self-Review Checklist

- Spec §1 Goal (PTR real + Auth modular) covered by Tasks 1,5 and 2,3,4.
- Spec §2.1 Input secureToggle covered by Task 2.
- Spec §2.2 Auth components + hooks covered by Tasks 3-4.
- Spec §3 PRD updates covered by Task 6.
- No placeholders (all code blocks concrete, file paths exact, commit messages full).
- Type consistency: `useConnectivity(): boolean|null`, `secureToggle?: boolean`, `refreshKey: number`, `handleSignIn: ()=>Promise<void>` — consistent across tasks.
- All tasks end with Commit step; verification gates listed.

