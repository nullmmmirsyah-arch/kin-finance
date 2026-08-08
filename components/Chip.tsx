import { useState } from "react";
import { Pressable, Text } from "react-native";

type Props = {
  label: string;
  active: boolean;
  onPress: () => void;
};

export function Chip({ label, active, onPress }: Props) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`min-h-11 items-center justify-center rounded-full border px-4 ${
        active
          ? "border-primary bg-primary"
          : "border-border bg-white"
      }`}
      style={pressed ? { opacity: 0.85 } : undefined}
    >
      <Text
        className={`text-sm font-medium ${
          active ? "text-[#FFFBF5]" : "text-text-secondary"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
