# Theme Preference (System / Light / Dark)

> Date: 2026-08-13
> Status: Approved

## Background

The app already supports dark mode that follows the system. NativeWind `dark:` variants are controlled by the `dark` class that NativeWind toggles from `useColorScheme()` (tailwind.config.js uses `darkMode: "class"`), and `useThemeColors()` / `useThemeGradients()` in `constants/theme.ts` read `useColorScheme()` directly. `app.json` has `userInterfaceStyle: "automatic"`.

The feature adds a user preference to override the theme: **System** (default, current behavior), **Light**, or **Dark**, persisted per device. Choosing Light or Dark should apply app-wide instantly and across app restarts; System follows the device scheme.

The key mechanism: `Appearance.setColorScheme("light" | "dark" | null)` from react-native sets an app-level override that `useColorScheme()` returns. Because both NativeWind `dark:` variants and the theme hooks read `useColorScheme()`, this single call propagates to the entire app without touching any screen or `constants/theme.ts`.

## Design

### New — `components/ThemeProvider.tsx`

A context provider following the `components/Snackbar` pattern.

- `type ThemePreference = "system" | "light" | "dark"`.
- Context value: `{ preference: ThemePreference, setPreference: (p: ThemePreference) => void }`. A default context throws if used outside the provider.
- Storage key: `"theme-preference"` in `expo-secure-store` (already installed and registered in `app.json` plugins — no new dependencies).
- On mount:
  1. Read the stored preference (default `"system"`); wrap in try/catch — on failure fall back to `"system"` and continue.
  2. Apply it: `Appearance.setColorScheme(pref === "system" ? null : pref)`.
  3. Render children only after the stored value resolves, so the first frame already uses the correct theme (no flash).
- `setPreference(p)`:
  1. Update context state (re-render).
  2. Persist to SecureStore (try/catch, non-blocking).
  3. Apply `Appearance.setColorScheme(p === "system" ? null : p)`.

### `app/_layout.tsx`

- Wrap the app tree with `ThemeProvider` (inside `SnackbarProvider`, around `ClerkLoading`/`ClerkLoaded`).
- While the preference is still loading, render the existing loading view pattern (flex-1 centered `ActivityIndicator` with themed background) instead of the app content.

### `app/(tabs)/settings.tsx`

- Add an **Appearance** section (between Household and Categories) with a 3-option segmented control: **System** / **Light** / **Dark**, each with a Feather icon (`smartphone` / `sun` / `moon`).
- Reuse the segmented-control pattern from `app/onboarding.tsx` (lines 122-146): a bordered rounded row of equal-width `Pressable`s, active option highlighted with `C.primary` background and white text, inactive with secondary text.
- Selected option bound to `useTheme().preference`; pressing calls `setPreference`.

### `constants/theme.ts`

No changes. `Appearance.setColorScheme` makes `useColorScheme()` return the override, so `useThemeColors`, `useThemeGradients`, and NativeWind `dark:` variants all follow automatically.

## Data Flow

User taps "Dark" → `setPreference("dark")` → context state updates → `SecureStore.setItemAsync` → `Appearance.setColorScheme("dark")` → `useColorScheme()` changes → NativeWind `dark` class + theme hooks update → whole app re-renders dark; Settings control highlights "Dark". On next launch, ThemeProvider reads "dark" and applies it before first render.

## Error Handling

- SecureStore read/write failures: catch, fall back to `"system"`, never crash or block rendering.
- `Appearance.setColorScheme` is synchronous and non-throwing.
- Native status bar follows the applied scheme automatically via `userInterfaceStyle: "automatic"` (verify on device during implementation).

## Verification

No schema changes. After implementation, run `npx tsc --noEmit` and `npm run lint`. Manual test on device/simulator:
1. Switch System → Light → Dark; confirm instant app-wide change.
2. Force-quit and relaunch; confirm the chosen theme persists.
3. With System selected, toggle the device's dark mode; confirm the app follows.