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