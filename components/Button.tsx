import { Colors, Radius, Shadow } from "@/constants/theme";
import { ActivityIndicator, Pressable, Text } from "react-native";

type Variant = "primary" | "secondary" | "ghost";

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

const variantStyles: Record<Variant, string> = {
  primary: "bg-primary",
  secondary: "bg-white border border-border",
  ghost: "bg-transparent",
};

const labelStyles: Record<Variant, string> = {
  primary: "text-[#FFFBF5]",
  secondary: "text-text-primary",
  ghost: "text-primary",
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  className = "",
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        Shadow.card,
        {
          borderRadius: Radius.md,
          opacity: isDisabled ? 0.5 : pressed ? 0.92 : 1,
        },
      ]}
      className={`h-12 w-full items-center justify-center ${variantStyles[variant]} ${className}`}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? Colors.background : Colors.primary}
        />
      ) : (
        <Text className={`text-base font-semibold ${labelStyles[variant]}`}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
