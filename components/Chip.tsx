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
      className={`min-h-12 items-center justify-center rounded-full border px-4 ${
        active
          ? "border-primary bg-primary dark:border-primary-dark dark:bg-primary-dark"
          : "border-border bg-background dark:border-border-dark dark:bg-background-dark"
      }`}
      style={pressed ? { opacity: 0.85 } : undefined}
    >
      <Text
        className={`text-sm font-medium ${
          active
            ? "text-background dark:text-background-dark"
            : "text-text-secondary dark:text-text-secondary-dark"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
