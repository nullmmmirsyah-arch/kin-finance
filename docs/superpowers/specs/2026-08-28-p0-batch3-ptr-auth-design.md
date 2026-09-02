# P0 Batch 3 — PTR Real + Auth Modular Design

> Date: 2026-08-28
> Scope: Polish eksisting P0 #1 (PTR/Banner real via NetInfo) + #2 (Auth monolith pecah + visibility + OTP)
> Status: Approved (Approach B Modular)
> Source: `app/index.tsx:53`, `components/ConnectivityBanner.tsx`, `components/Input.tsx`, `app/(tabs)/*`

## 1. Goal & Constraints

**Goal:** Hilangkan "kebohongan UX" — PTR dan Retry saat ini hanya `setTimeout 600ms` + `Snackbar("Retrying…")` tanpa re-query (`home.tsx:277`, `transactions.tsx:483`, `accounts.tsx:193`, `budgets.tsx:275`). Dan pecah `app/index.tsx` 915 baris menjadi unit kecil yang testable, plus tambah password eye toggle & OTP autofill tanpa ubah flow Clerk.

**Non-Goals:** Tidak ubah `convex/schema.ts`, tidak ubah permission matrix, tidak ubah invite/budget logic.

**Global Constraints (AGENTS.md):**
- Expo SDK 54 — install via `npx expo install <pkg>` saja.
- NativeWind `className` only, theme via `useThemeColors()` + `dark:`.
- Jangan pakai `style={({pressed})=>}` di Pressable — pakai `useState` pressed.
- Amounts whole number, no currency symbol (PRD §1).
- English UI copy only.
- Setiap handler Convex pakai `ctx.auth.getUserIdentity()` + `ConvexError`.
- Setelah ubah `convex/*.ts` jalankan `npx convex codegen` lalu `npx tsc --noEmit`.
- Gate: `npx tsc --noEmit` + `npm run lint` + `npm test`.

## 2. Architecture

### 2.1 PTR/Banner Real

```text
NetInfo (native) ──► useConnectivity() hook ──► isConnected boolean
                                          │
        ┌─────────────────────────────────┴──────────────────────────────┐
        │  4 tabs: home / transactions / accounts / budgets             │
        │  visible = isConnected===false || (query===undefined >3s)     │
        │  <ConnectivityBanner visible={stale} onRetry={bumpKey} />     │
        │  <ScrollView refreshControl={<RefreshControl ... />} />       │
        └───────────────────────────────────────────────────────────────┘
```

- Dependency baru: `@react-native-community/netinfo` (Expo SDK 54 compatible, `npx expo install`).
- Hook baru `hooks/useConnectivity.ts`: `useEffect(()=> NetInfo.addEventListener(s=> setConnected(s.isConnected)), [])`, return `isConnected: boolean | null` (null = unknown awal, preserves null contract).
- Banner logic: `stale = isConnected===false || (result===undefined && timer3s)`. Saat offline, banner muncul instan tanpa tunggu 3s. Saat online tapi Convex lambat, tetap 3s timer sebagai fallback.
- PTR: `const [refreshKey, setRefreshKey]=useState(0)` di tiap tab, `refreshKey` trigger visual spinner + clear stale + haptic; data fresh mengandalkan Convex reactive subscription (no manual invalidation). `onRefresh={()=>{ setRefreshing(true); setRefreshKey(k=>k+1); void hapticSuccess(); setTimeout(()=>setRefreshing(false),600)}}`. `onRetry` sama (`setStale(false); setRefreshKey(k=>k+1); show("Retrying…")`).
- Tetap 600ms spinner agar tactile, mengandalkan subscription reaktif.

### 2.2 Auth Modular

```text
app/index.tsx (orchestrator ~120 baris)
  ├─ hooks/useAuthFlow.ts      (signIn password, signUp, verify, mfa, google SSO state)
  ├─ hooks/useResetFlow.ts     (reset email/code/password steps)
  ├─ components/Auth/EmailField.tsx         (Input + labelBadge Last used)
  ├─ components/Auth/PasswordField.tsx      (Input + eye toggle)
  ├─ components/Auth/CodeField.tsx          (Input oneTimeCode, numeric, 6 max, autoFocus)
  ├─ components/Auth/GoogleButton.tsx       (variant + badge Last used)
  └─ components/Auth/ResetFlow.tsx         (3-step UI)
```

- `app/index.tsx` simpan hanya: `mode`, `preferred`, `successScreen`, `isGoogleLoading`, wrapper `KeyboardAwareScrollView` + `WarmUpBrowser` + routing. Semua handler dipindah ke hooks.
- `components/Input.tsx` enhancement: tambah prop `secureToggle?: boolean` dan `rightIcon?: ReactNode`. Jika `secureToggle` true, render `Pressable` eye/eye-off 48x48 di kanan absolute, toggle `secureTextEntry` state internal. Jaga `style` array tetap static.
- `CodeField` selalu pakai `textContentType="oneTimeCode"` + `keyboardType="numeric"` + `maxLength={6}` + `autoFocus` untuk autofill OTP (email-delivered, no sms-otp).

## 3. Components & File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `hooks/useConnectivity.ts` | **NEW** | Subscribe NetInfo, return `isConnected`. Safe no-op di web/Expo Go jika module tidak ada. |
| `components/Input.tsx` | **MODIFY** | Tambah `secureToggle?: boolean` prop; render eye button jika true; internal `showPassword` state. |
| `components/Auth/EmailField.tsx` | **NEW** | Wrapper Input email dengan labelBadge Last used, validation hint. |
| `components/Auth/PasswordField.tsx` | **NEW** | Wrapper Input password dengan eye toggle + error. |
| `components/Auth/CodeField.tsx` | **NEW** | Input kode 6 digit, oneTimeCode, numeric. |
| `components/Auth/GoogleButton.tsx` | **NEW** | Button Google dengan badge, loading. |
| `components/Auth/ResetFlow.tsx` | **NEW** | UI 3-step reset (email/code/password) dengan props dari hook. |
| `hooks/useAuthFlow.ts` | **NEW** | Logic signIn/signUp/verify/mfa/google (pindah dari `index.tsx:107-369`). Return `{handleSignIn, handleSignUp, handleVerify, handleMfaVerify, handleGoogle, error, loading}`. |
| `hooks/useResetFlow.ts` | **NEW** | Logic `resetStep`, `handleSendResetCode`, `handleVerifyResetCode`, `handleSubmitNewPassword`. |
| `app/index.tsx` | **MODIFY** | Potong 915→~150 baris, import Auth components/hooks, hapus duplicated state. |
| `app/(tabs)/home.tsx` | **MODIFY** | Import `useConnectivity`, tambah `refreshKey`, ganti stale logic, RefreshControl real. |
| `app/(tabs)/transactions.tsx` | **MODIFY** | Sama + include `refreshKey` di `queryKey`. |
| `app/(tabs)/accounts.tsx` | **MODIFY** | Sama. |
| `app/(tabs)/budgets.tsx` | **MODIFY** | Sama. |
| `components/ConnectivityBanner.tsx` | **MODIFY** | Tidak ubah API (keep `visible/onRetry`), tapi dokumentasi tambah NetInfo note. |
| `package.json` | **MODIFY** | Tambah `netinfo` via `npx expo install`. |
| `docs/Product Requirement Document/PRD.md` | **MODIFY** | §2.1, §3.1, §3.6, §3.8, §5.2, §5.4, §8 ChangeLog. |

## 4. Data Flow

### PTR Flow
1. `NetInfo` event → `isConnected=false` → `stale=true` instan → banner muncul.
2. User pull → `RefreshControl` trigger → `setRefreshKey+1` → visual spinner + stale clear + haptic; Convex reactive subscription delivers fresh data → `refreshing=false` setelah 600ms.
3. User tap Retry pada banner → `setStale(false); setRefreshKey+1; show("Retrying…"); void hapticSuccess()`.

### Auth Flow
1. User input email/password → `PasswordField` dengan eye toggle (state lokal, tidak lift).
2. User submit → `useAuthFlow.handleSignIn()` → Clerk API → success → `setLastAuthMethod("email")` + `setPreferred`.
3. Jika `needs_client_trust` → `CodeField` muncul → user terima SMS/email → OS autofill via `oneTimeCode` → `value` terisi otomatis → user tap Verify.
4. Google SSO: `GoogleButton` → `useAuthFlow.handleGoogle()` → `startSSOFlow` → sama.

## 5. Error Handling & Edge Cases

- **NetInfo unavailable (web/Expo Go):** `try { NetInfo } catch { return null }`, fallback ke heuristik `undefined >3s` lama.
- **Convex handler:** tetap `ConvexError`, client pakai `getConvexErrorMessage`.
- **Input eye toggle:** tombol 48px, `accessibilityLabel="Toggle password visibility"`, tidak break NativeWind (pakai `useState` + static style).
- **OTP:** `textContentType="oneTimeCode"` untuk autofill kode email (tanpa `autoComplete="sms-otp"` yang spesifik SMS).
- **PTR:** jika offline, PTR tetap bisa di-pull tapi akan tetap show banner setelah retry (tidak hide spinner paksa).
- **Auth:** toggling `mode` sign-in/up tetap clear password fields (behavior lama dipertahankan).

## 6. Testing & Verification

- `npx convex codegen` (jika ada perubahan convex — batch ini tidak ada, tapi tetap gate).
- `npx tsc --noEmit` — cek Input prop baru, hooks types.
- `npm run lint` — eslint Expo.
- `npm test` — vitest; tambah `tests/input.secureToggle.test.ts` (render Input dengan secureToggle, tap eye → secureTextEntry flips).
- Manual: airplane mode → banner instan, PTR spinner + data fresh, eye toggle, OTP autofill di device (iOS simulator → Features → OTP autofill).

## 7. PRD Updates

- Header `Last updated: 2026-08-28`
- §2.1 Authentication row: tambah "password visibility toggle (eye), OTP auto-fill via oneTimeCode"
- §3.1 Login screen: tambah bullet eye toggle + OTP autofill, tambah modular breakdown note
- §3.6 Transactions & §3.8 Home: ubah PTR description dari "600ms visual" menjadi "real re-query via NetInfo + refreshKey bump + ConnectivityBanner instan saat offline"
- §5.2 Responsibilities: tambah `hooks/useConnectivity.ts`, `components/Auth/*`, `hooks/useAuthFlow/ResetFlow`
- §5.4 Error Handling: tambah NetInfo offline stanza
- §8 Change Log: entry baru `| 2026-08-28 | Polish | P0 Batch 3: PTR/Banner real (NetInfo + refreshKey), Auth modular (5 komponen + 2 hooks + eye toggle + OTP autofill). Updates §2.1, §3.1, §3.6, §3.8, §5.2, §5.4 |`

## 8. Trade-offs & Alternatives Considered

| Approach | Pro | Kontra | Putusan |
|----------|-----|--------|---------|
| A Minimal | Sedikit file, cepat | NetInfo tidak akurat, Auth tetap god object | Ditolak |
| **B Modular (dipilih)** | Banner instan, PTR real, Auth testable, Input reusable | Tambah 7 file baru | **Dipilih** |
| C Over-engineered | Context, polling | YAGNI, kompleks | Ditolak |

## 9. Isolation & Boundaries

- `useConnectivity` tidak tahu soal Convex — hanya boolean.
- `PasswordField` tidak tahu soal Clerk — hanya `value/onChange/error`.
- `useAuthFlow` tidak tahu soal UI — hanya Clerk + SecureStore.

Setiap unit bisa diganti tanpa merusak consumer.

## 10. Open Risks

- `@react-native-community/netinfo` butuh native rebuild untuk EAS Build (bukan JS-only). Rilis butuh `eas build` baru, tidak cukup `eas update`. Dokumentasikan di §5.7.
- OTP autofill di Android emulator kadang tidak muncul tanpa Google Play Services — test di device fisik.
