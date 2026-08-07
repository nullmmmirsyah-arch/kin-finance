export const Colors = {
  primary: "#92400E",
  primaryLight: "#FDE68A",
  background: "#FFFBF5",
  surface: "#FEF3C7",
  textPrimary: "#1C1917",
  textSecondary: "#78716C",
  success: "#065F46",
  error: "#991B1B",
  border: "#E7E5E4",
} as const;

export const Gradients = {
  card: ["#FFFBF5", "#FEF3C7"],
} as const;

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
