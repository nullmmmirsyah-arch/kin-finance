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
  accountCash: "#065F46",
  accountBank: "#92400E",
  accountEwallet: "#1D4ED8",
  accountCreditCard: "#991B1B",
  deltaPositiveBg: "#DCFCE7",
  deltaPositiveBorder: "#86EFAC",
  deltaNegativeBg: "#FEE2E2",
  deltaNegativeBorder: "#FCA5A5",
  chartAmber: "#D97706",
  chartEmerald: "#059669",
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
  accountCash: "#34D399",
  accountBank: "#F59E0B",
  accountEwallet: "#60A5FA",
  accountCreditCard: "#F87171",
  deltaPositiveBg: "rgba(52,211,153,0.15)",
  deltaPositiveBorder: "rgba(52,211,153,0.25)",
  deltaNegativeBg: "rgba(248,113,113,0.15)",
  deltaNegativeBorder: "rgba(248,113,113,0.25)",
  chartAmber: "#F59E0B",
  chartEmerald: "#34D399",
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

export const Radius = {
  sm: 12,
  md: 16,
  lg: 24,
} as const;

export const FontSize = {
  display: 28,
  heading: 18,
  body: 16,
  label: 14,
  caption: 12,
} as const;
