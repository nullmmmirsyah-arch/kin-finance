import { Colors, Radius, Shadow } from "@/constants/theme";
import { useState } from "react";
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
  const [pressed, setPressed] = useState(false);

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
