import { Button } from "@/components/Button";
import { useThemeColors } from "@/constants/theme";
import FontAwesome from "@expo/vector-icons/FontAwesome";

type Props = {
  badge?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  variant?: "primary" | "secondary";
};

export function GoogleButton({
  badge,
  loading,
  disabled,
  onPress,
  variant = "primary",
}: Props) {
  const C = useThemeColors();
  const color = variant === "primary" ? C.background : C.textPrimary;
  return (
    <Button
      title="Continue with Google"
      variant={variant}
      icon={<FontAwesome name="google" size={18} color={color} />}
      badge={badge}
      onPress={onPress}
      loading={loading}
      disabled={disabled}
    />
  );
}
