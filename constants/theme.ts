import { useColorScheme } from "react-native";

export const Colors = {
  primary: "#92400E",
  primaryLight: "#FDE68A",
  background: "#FFFBF5",
  surface: "#FEF3C7",
  textPrimary: "#1C1917",
  textSecondary: "#6E675F",
  success: "#065F46",
  error: "#991B1B",
  border: "#E7E5E4",
} as const;

export const DarkColors = {
  primary: "#F59E0B",
  primaryLight: "#78350F",
  background: "#1C1917",
  surface: "#292524",
  textPrimary: "#FAF9F7",
  textSecondary: "#A8A29E",
  success: "#34D399",
  error: "#F87171",
  border: "#44403C",
} as const;

export function useThemeColors() {
  const scheme = useColorScheme();
  return scheme === "dark" ? DarkColors : Colors;
}

export const Gradients = {
  card: ["#FFFBF5", "#FEF3C7"],
} as const;

export const DarkGradients = {
  card: ["#292524", "#3A3224"],
} as const;

export function useThemeGradients() {
  const scheme = useColorScheme();
  return scheme === "dark" ? DarkGradients : Gradients;
}

export const Shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  elevated: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const Radius = {
  sm: 12,
  md: 16,
  lg: 24,
} as const;

export const Typography = {
  h1: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: Colors.textPrimary,
  },
  h2: {
    fontSize: 20,
    fontWeight: "600" as const,
    color: Colors.textPrimary,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    color: Colors.textPrimary,
  },
  caption: {
    fontSize: 14,
    fontWeight: "400" as const,
    color: Colors.textSecondary,
  },
  small: {
    fontSize: 12,
    fontWeight: "400" as const,
    color: Colors.textSecondary,
  },
} as const;
