# Theme Preference (System / Light / Dark) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user choose System / Light / Dark theme, persisted per device, applying app-wide instantly and across restarts.

**Architecture:** A `ThemeProvider` context reads the stored preference (default `"system"`) and calls `Appearance.setColorScheme(pref === "system" ? null : pref)`. Because `useColorScheme()` returns the override, NativeWind `dark:` variants, `useThemeColors`, and `useThemeGradients` all follow with zero changes to screens or `constants/theme.ts`. The preference is stored in `expo-secure-store` (already installed and registered as a plugin in `app.json`). The Settings screen gets a 3-option segmented control.

**Tech Stack:** React Native `Appearance`, `expo-secure-store`, React context, NativeWind, Expo SDK 54.

## Global Constraints

- No new dependencies. Use `expo-secure-store` (already in `package.json` and `app.json` plugins).
- There is NO test framework. Verification = `npx tsc --noEmit` then `npm run lint` after every task.
- Follow NativeWind v4 rule: never use `style` callback functions on `Pressable`; use static `style` + `className`.
- Use `useThemeColors()` from `@/constants/theme` for runtime colors — never `Colors` directly.
- Import theme from `@/constants/theme`; do not hardcode colors.
- Path alias `@/*` → repo root.

---

### Task 1: Create `components/ThemeProvider.tsx`

**Files:**
- Create: `components/ThemeProvider.tsx`

**Interfaces:**
- Produces:
  - `export type ThemePreference = "system" | "light" | "dark"`
  - `export function ThemeProvider({ children }: { children: ReactNode })` — wraps the app; applies and persists the preference.
  - `export function useTheme(): { preference: ThemePreference; setPreference: (p: ThemePreference) => void }` — throws if used outside `ThemeProvider`.

- [ ] **Step 1: Create the file**

`components/ThemeProvider.tsx`:

```tsx
import * as SecureStore from "expo-secure-store";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { Appearance } from "react-native";

export type ThemePreference = "system" | "light" | "dark";

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const STORAGE_KEY = "theme-preference";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

function applyColorScheme(preference: ThemePreference) {
  Appearance.setColorScheme(preference === "system" ? null : preference);
}

function readStoredPreference(): ThemePreference {
  try {
    const raw = SecureStore.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") {
      return raw;
    }
  } catch {
    // SecureStore read failure falls back to following the system.
  }
  return "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const stored = readStoredPreference();
    applyColorScheme(stored);
    return stored;
  });

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    applyColorScheme(next);
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {
      // Non-blocking persistence; the in-memory preference still applies.
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

> Note on the sync read: `SecureStore.getItem` (synchronous) lets the theme apply on the very first render, so no loading gate or flash is needed — this is a refinement over the spec's async-load design.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ThemeProvider.tsx
git commit -m "feat: add ThemeProvider with persisted system/light/dark preference"
```

---

### Task 2: Wire `ThemeProvider` into `app/_layout.tsx`

**Files:**
- Modify: `app/_layout.tsx:1-13` (imports) and `54-73` (RootLayout return)

**Interfaces:**
- Consumes: `ThemeProvider` from Task 1.

- [ ] **Step 1: Add the import**

After the existing `import { useThemeColors } from "@/constants/theme";` (line 12), add:

```tsx
import { ThemeProvider } from "@/components/ThemeProvider";
```

- [ ] **Step 2: Wrap the app tree**

Replace the `GestureHandlerRootView` children (lines 57-72) so `ThemeProvider` wraps `ClerkProvider`:

```tsx
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <SnackbarProvider>
              <ClerkLoading>
                <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
                  <ActivityIndicator size="large" color={C.primary} />
                </View>
              </ClerkLoading>
              <ClerkLoaded>
                <RootNavigator />
              </ClerkLoaded>
            </SnackbarProvider>
          </ConvexProviderWithClerk>
        </ClerkProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
```

`ThemeProvider` sits outermost (inside the gesture root) so the `Appearance` override applies before Clerk, Convex, or any screen renders.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: wrap app in ThemeProvider"
```

---

### Task 3: Add Appearance section to Settings screen

**Files:**
- Modify: `app/(tabs)/settings.tsx:1-8` (imports), `9-17` (component body — add constants + hook), `90-129` (insert Appearance section between Household and Categories)

**Interfaces:**
- Consumes: `useTheme` and type `ThemePreference` from `components/ThemeProvider.tsx` (Task 1).

- [ ] **Step 1: Add imports**

After the existing `import { Radius, Shadow, useThemeColors } from "@/constants/theme";` (line 7), add:

```tsx
import { ThemePreference, useTheme } from "@/components/ThemeProvider";
```

- [ ] **Step 2: Add the options constant and hook**

At the top of `export default function Settings()` (line 10), before `const router = useRouter();`, add the constant and hook:

```tsx
const THEME_OPTIONS: {
  id: ThemePreference;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { id: "system", label: "System", icon: "smartphone" },
  { id: "light", label: "Light", icon: "sun" },
  { id: "dark", label: "Dark", icon: "moon" },
];

export default function Settings() {
  const { preference, setPreference } = useTheme();
  const router = useRouter();
```

- [ ] **Step 3: Insert the Appearance section**

Insert this block between the Household section's closing `</View>` (line 90) and the Categories section label `View` (line 92):

```tsx
      <View className="mt-6 px-5">
        <Text className="mb-2 text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
          Appearance
        </Text>

        <View className="flex-row overflow-hidden rounded-[12px] border border-border dark:border-border-dark">
          {THEME_OPTIONS.map((option) => {
            const selected = preference === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setPreference(option.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                className="flex-1 items-center gap-1 py-3"
                style={{
                  backgroundColor: selected ? C.primary : "transparent",
                }}
              >
                <Feather
                  name={option.icon}
                  size={18}
                  color={selected ? C.background : C.textSecondary}
                />
                <Text
                  className={`text-sm font-medium ${
                    selected
                      ? "text-background dark:text-background-dark"
                      : "text-text-secondary dark:text-text-secondary-dark"
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
```

This mirrors the segmented-control pattern from `app/onboarding.tsx:122-146`. Selected-option contrast is handled by `text-background dark:text-background-dark` (primary is dark brown in light mode, amber in dark mode).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/settings.tsx"
git commit -m "feat: add Appearance theme selector to Settings"
```

---

### Task 4: Final verification

**Files:**
- No changes.

- [ ] **Step 1: Full typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass with no errors.

- [ ] **Step 2: Manual test on device/simulator**

1. Open Settings → Appearance. The currently selected option is highlighted.
2. Tap **Light**: app switches to light instantly; control highlights Light.
3. Tap **Dark**: app switches to dark instantly; control highlights Dark.
4. Tap **System**: app follows the device scheme.
5. With **Dark** selected, force-quit the app and relaunch: the app opens dark (persistence works; no flash of light).
6. Select **System**, then toggle the device's dark mode setting: the app follows the system both ways.