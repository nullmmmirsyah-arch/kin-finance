# Polish Launch — Splash to Login/Home (EAS Update-First, no Play Store) Design

> Date: 2026-08-29
> Scope: Polish cold start `APK install -> splash-icon.png -> Login / Home` dengan clarity, splash sependek mungkin + optimistic progress, offline jujur. Tanpa Play Store, via EAS Internal Distribution + EAS Update.
> Status: Approved (Approach B)
> Source: `app.json:32`, `app/_layout.tsx:64`, `components/OtaUpdater.tsx`, `constants/theme.ts:6`, `hooks/useConnectivity.ts`, `eas.json:18`

## 1. Goal & Constraints

**Goal:** User yang install APK baru (sideload internal, bukan Play Store) melihat transisi mulus: native splash (`splash-icon.png`) -> branded loading shell dengan progress optimistik -> `Login` (signed-out) atau `Home` (returning, sudah `isSignedIn` + `households.getActive`). Durasi splash minimal, progress selalu maju (positive), offline langsung diinfo tanpa harapan palsu. Kurangi frekuensi install APK dengan `EAS Update` untuk JS-only changes.

**Non-Goals:** Tidak ubah `convex/schema.ts`, permission matrix, household/invite logic. Tidak masuk Play Store.

**Global Constraints (AGENTS.md):**
- Expo SDK 54 (`expo ~54.0.37`, `expo-splash-screen ~31.0.13`, `expo-updates ~29.0.20`) — install via `npx expo install`.
- NativeWind `className` only, theme via `useThemeColors()` + `dark:` variants (`constants/theme.ts`).
- Jangan pakai `style={({pressed})=>}` di Pressable.
- Amounts whole number, no currency symbol (PRD §1).
- English UI copy only.
- Setiap Convex handler pakai `ctx.auth.getUserIdentity()` + `ConvexError`.
- Setelah ubah `convex/*.ts` jalankan `npx convex codegen` lalu `npx tsc --noEmit`.
- Gate: `npx tsc --noEmit` + `npm run lint` + `npm test`.

## 2. Architecture

### 2.1 Launch Orchestration & Splash Contract

```text
Android PackageInstaller (sideload) -> MainActivity windowBackground
  -> Native splash (expo-splash-screen, background #FFFBF5 / #1C1917, image 200px, fade 300ms)
    -> JS bundle (Hermes)
      -> app/_layout.tsx: preventAutoHideAsync()
        -> BrandedLoadingShell (same bg + same icon 200px center, progress 0->70 fast)
          -> Clerk isLoaded? households.getActive? -> hideAsync() -> Login / Onboarding / Home
```

- `app.json` plugin `expo-splash-screen` ubah `backgroundColor` dari `#ffffff/#000000` ke `theme.ts` `Colors.background #FFFBF5` / `DarkColors.background #1C1917`. `imageWidth 200` tetap, `resizeMode contain`.
- `app/_layout.tsx` tambah `import * as SplashScreen from "expo-splash-screen"` + `SplashScreen.preventAutoHideAsync()` di top-level, `SplashScreen.setOptions({duration: 300, fade: true})` untuk fade. `hideAsync()` dipanggil hanya setelah `Clerk isLoaded && (isSignedIn===false || households.getActive !== undefined)` dan shell siap (bukan saat mount saja).
- `fallbackToCacheTimeout: 0` + `checkAutomatically: ON_ERROR_RECOVERY` (`app.json:64-65`) tetap — cold boot tidak blokir di SQLite `expo-updates` (fix ANR PRD §5.7).

### 2.2 Branded Loading Shell + Optimistic Progress

- Komponen baru `components/BrandedLoadingShell.tsx`: `flex-1 bg-background dark:bg-background-dark`, centered `Image splash-icon.png 200x200 contain`, bawah `View h-1 bg-border` + animated fill `bg-primary`, label `text-xs text-text-secondary`.
- Progress optimistik via `react-native-reanimated`: `0->70%` dalam 400ms (timer), `70->90%` lambat 800ms sambil tunggu `Clerk` + `Convex`, `90->100%` 200ms saat `hideAsync` + `hapticSuccess`.
- Dipakai di dua gate: (a) `Clerk isLoaded===false`, (b) `isSignedIn && getActive===undefined`.
- Menggantikan `ClerkLoading` spinner tengah `app/_layout.tsx:74-77`.

### 2.3 Auth & Household Gate

```text
isLoaded===false -> Shell
isLoaded && !isSignedIn -> Login (app/index.tsx, splash-icon 200px aligned, no flash)
isSignedIn && getActive===undefined -> Shell (pause 90% if offline else 70->90)
getActive===null -> Onboarding
getActive !== null -> Home
```

- Satu orchestrator di `app/_layout.tsx:42 RootNavigator`, bukan 2 `Stack.Protected` yang kedip.
- `SplashScreen.hideAsync()` di `useEffect` setelah cabang 2/4/5 commit, jadi returning user tidak lihat `Login` 1 frame.

### 2.4 Distribution & OTA (EAS Update-First, no Play Store)

- `eas.json: production {distribution: internal, buildType: apk, channel: production, autoIncrement: true, appVersionSource: remote}` tetap.
- `app.json runtimeVersion: {policy: appVersion}` + `updates.url https://u.expo.dev/3d0f78fd...` + `channel` per profile (`development`/`preview`/`production`).
- Workflow:
  - Native change (plugin, native dep, SDK) -> `eas build --profile production` -> link `expo.dev` untuk install (internal, tanpa Play Store).
  - JS-only (`app/`, `components/`, `constants/`, `hooks/`) -> `eas update --channel production` -> `OtaUpdater.tsx` (5s delay) `checkForUpdateAsync` -> `fetchUpdateAsync` -> banner ready.
- `components/OtaUpdater.tsx` polish: ganti `Snackbar` "A new update is ready. Restart" jadi `UpdateBanner` (mirip `ConnectivityBanner`) dengan state `downloading` (progress) / `ready` (`Restart now` / `Later`). `Later` auto-apply next cold start. Jika `runtimeVersion` mismatch (butuh APK baru) -> `Blocking Dialog` "New version available — Download" dengan link EAS artifact.

## 3. Components & File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `app.json` | **MODIFY** | `expo-splash-screen` `backgroundColor` -> `#FFFBF5` / dark `#1C1917`, keep `imageWidth 200` |
| `app/_layout.tsx` | **MODIFY** | `preventAutoHideAsync`, `setOptions fade 300`, orchestrated gate, hide after `getActive` resolve, mount `BrandedLoadingShell`, keep `OtaUpdater` |
| `components/BrandedLoadingShell.tsx` | **NEW** | Shell sama warna splash, icon 200px center, optimistic progress bar + label, `useConnectivity` offline banner + `Retry`, `progress` prop 0-100, a11y |
| `components/UpdateBanner.tsx` | **NEW** | Banner untuk OTA: `downloading`/`ready` states, `onRestart` -> `Updates.reloadAsync()`, `onDismiss` |
| `components/OtaUpdater.tsx` | **MODIFY** | Ganti Snackbar ke `UpdateBanner`, tambah `downloading` progress, keep 5s delay, `isEnabled` guard, silent fail |
| `app/index.tsx` | **MODIFY** | Samakan `Image splash-icon.png` ke `200x200` dan `bg-background` agar align dengan shell (dari `270x270`), hindari lompat size |
| `hooks/useConnectivity.ts` | **REUSE** | Sudah ada NetInfo, dipakai di shell juga |
| `constants/theme.ts` | **REUSE** | Source warna `#FFFBF5`/`#1C1917` |
| `eas.json` | **NO CHANGE** | Dokumentasi workflow saja |
| `.env.example` | **NEW** | Template `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_CONVEX_URL` |
| `docs/Product Requirement Document/PRD.md` | **MODIFY** | §5.7, §3.1, §5.2, §8 Change Log |

## 4. Data Flow

### Cold Start (returning, signed-in, has household)
1. Native splash 300-600ms -> JS `preventAutoHideAsync` active -> `BrandedLoadingShell` progress 0->70 (400ms).
2. `Clerk isLoaded true` + `isSignedIn true` -> shell stay, progress 70->90 sambil `households.getActive` query (Convex) `undefined`.
3. Jika `isConnected===false` -> progress pause 90, label `Waiting for connection…`, banner `You’re offline — showing cached data` + `Retry` instan. Tap Retry -> `refreshKey++` + `haptic`.
4. `getActive` resolved -> progress 90->100 + `hideAsync()` + fade 300ms -> `Home` (dashboard). Convex reactive data mengalir.

### Cold Start (signed-out)
1-2 sama, tapi `isSignedIn false` -> shell 90->100 -> hide -> `Login` dengan icon 200px di posisi sama (seamless).

### OTA
1. 5s setelah launch `checkForUpdateAsync` -> jika available -> `fetchUpdateAsync` dengan `UpdateBanner downloading` 0->100.
2. Selesai -> `UpdateBanner ready` "New update ready" + `Restart now` (`reloadAsync`) / `Later` (auto next cold start).
3. Jika `runtimeVersion` beda -> `Blocking Dialog` download APK link.

## 5. Error Handling & Edge Cases

- **Convex `undefined >3s` atau `isConnected===false`**: shell tidak hide, banner instan + `Retry` (`useConnectivity` `isConnected===false` || timer 3s). Tidak white flash.
- **Clerk error / token expired**: shell -> `Can’t reach Kin Finance. Check your connection.` + `Try again` + `Sign in again`, tidak loop `Protected` guard.
- **Household `null` vs error**: `null` -> `Onboarding`, error -> shell retry (bedakan di `findUserAndMembership` pattern).
- **OtaUpdater fail**: swallow silent, no spam toast (existing).
- **ANR low-end**: `ON_ERROR_RECOVERY` + `fallbackToCacheTimeout 0` jaga first launch tidak blokir SQLite hashing (PRD §5.7).
- **Theme**: shell `bg-background` sync light/dark vs native splash, test both.
- **Expo Go**: `Updates.isEnabled===false` -> skip OTA, shell tetap jalan (no crash).
- **Free tier**: 1.000 MAU / 15 builds; jika habis -> fallback local `prebuild` + `gradlew` dan OTA self-host optional.

## 6. Testing & Verification

- `npx convex codegen` (jika sentuh convex — tidak di batch ini, tapi gate tetap).
- `npx tsc --noEmit` — cek `SplashScreen` types, shell props, `OtaUpdater` imports.
- `npm run lint` — expo lint.
- `npm test` — vitest: `tests/branded-loading-shell.test.tsx` (progress 0->70 fast, pause offline, 90->100 on ready), `tests/ota-updater.test.tsx` (mock `expo-updates` `checkForUpdateAsync`/`fetchUpdateAsync`/`reloadAsync`, banner states).
- Manual device: (1) cold start low-end Android airplane mode -> shell + offline banner, (2) returning signed-in -> no login flash, (3) signed-out -> login icon aligned, (4) `eas update --channel production` -> UpdateBanner downloading -> Restart, (5) light/dark splash color no flicker, (6) low-end first install no ANR.
- `npx expo install` untuk deps baru (tidak ada native baru, tapi verify SDK 54 compat).

## 7. PRD Updates

- Header `Last updated: 2026-08-29`
- §3.1 Login: catat `splash-icon 200px` aligned dengan shell, seamless transition
- §5.2 Responsibilities: tambah `BrandedLoadingShell`, `UpdateBanner`, update `app/_layout.tsx` orchestration
- §5.7 OTA & Distribution: tambah internal link workflow, `build` vs `update` rule, UpdateBanner behavior, Free tier notes
- §8 Change Log: `| 2026-08-29 | Polish | Launch polish B: native splash sync #FFFBF5/#1C1917 fade 300ms + BrandedLoadingShell optimistic 0->100 + orchestrated gate (no login flash) + UpdateBanner downloading/ready + EAS internal no-Play-Store. Updates §3.1, §5.2, §5.7 |`

## 8. Trade-offs & Alternatives Considered

| Approach | Pro | Kontra | Putusan |
|----------|-----|--------|---------|
| A Minimal (splash-sync only) | Cepat 1-2 hari | Tetap sideload friction, no OTA clarity | Ditolak |
| **B EAS Update-First (dipilih)** | Tanpa Play Store, 90% update tanpa install APK, progress optimistik + offline jujur, splash minimal | Butuh disiplin `appVersion` vs `channel` | **Dipilih** |
| C Custom Self-Hosted Installer | Kontrol penuh download APK progress | Butuh backend, `REQUEST_INSTALL_PACKAGES`, kompleks | Ditolak |

## 9. Isolation & Boundaries

- `BrandedLoadingShell` hanya tahu `progress`, `isConnected`, `onRetry` — tidak tahu Clerk/Convex.
- `UpdateBanner` hanya tahu `state`/`onRestart`/`onDismiss`.
- `app/_layout.tsx` orchestrator satu-satunya yang tahu `isLoaded`/`isSignedIn`/`getActive`/`SplashScreen`.
- `OtaUpdater` hanya tahu `expo-updates` — tidak tahu UI shell.

Setiap unit bisa diganti tanpa merusak consumer.

## 10. Open Risks

- `@react-native-community/netinfo` sudah ada, tapi butuh `eas build` baru jika update native — dokumentasikan di §5.7 (bukan `eas update` saja).
- `expo-splash-screen` fade 300ms di low-end perlu test — jika terasa lambat, turun ke 200ms.
- Free tier 1.000 MAU / 15 builds: untuk keluarga aman, tapi jika scale >1.000 butuh `Starter $19` atau self-host OTA (open protocol).

## 11. Environment Variables (manual)

Di `expo.dev` > `kin-finance` > `Environment Variables` (per `production`/`preview`/`development`):
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (Sensitive, copy `.env:1`)
- `EXPO_PUBLIC_CONVEX_URL` (Plain, copy `.env.local:3`, ganti ke prod URL setelah `npx convex deploy --prod`)
- Tidak perlu `CONVEX_DEPLOYMENT` di EAS; `CLERK_JWT_ISSUER_DOMAIN` set di Convex Cloud via `npx convex env set`.

## 12. Visual Companion Note

Tidak pakai browser companion — semua keputusan progress/offline lebih jelas via teks + progress bar, bukan mockup.

