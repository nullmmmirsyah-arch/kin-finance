import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  icon?: ReactNode;
};

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-primary dark:bg-primary-dark",
  secondary:
    "bg-background border border-border dark:bg-background-dark dark:border-border-dark",
  ghost: "bg-transparent",
  danger:
    "bg-transparent border border-error dark:border-error-dark",
};

const labelStyles: Record<Variant, string> = {
  primary: "text-background dark:text-background-dark",
  secondary:
    "text-text-primary dark:text-text-primary-dark",
  ghost: "text-primary dark:text-primary-dark",
  danger: "text-error dark:text-error-dark",
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  className = "",
  icon,
}: Props) {
  const isDisabled = disabled || loading;
  const [pressed, setPressed] = useState(false);
  const C = useThemeColors();
  const indicatorColor =
    variant === "primary"
      ? C.background
      : variant === "danger"
        ? C.error
        : C.primary;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[
        Shadow.card,
        { borderRadius: Radius.md },
        isDisabled ? { opacity: 0.5 } : pressed ? { opacity: 0.92 } : undefined,
      ]}
      className={`h-12 w-full items-center justify-center ${variantStyles[variant]} ${className}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={indicatorColor} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon}
          <Text className={`text-base font-semibold ${labelStyles[variant]}`}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
