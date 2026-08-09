import Feather from "@expo/vector-icons/Feather";
import { Colors, Shadow } from "@/constants/theme";
import { useState } from "react";
import { Pressable, Text } from "react-native";

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  label?: string;
};

export function Fab({ onPress, accessibilityLabel, label }: Props) {
  const [pressed, setPressed] = useState(false);

  if (label !== undefined) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        className="absolute bottom-6 right-6 flex-row items-center gap-2 rounded-full bg-primary px-5"
        style={[
          Shadow.elevated,
          { height: 56 },
          pressed ? { opacity: 0.92 } : undefined,
        ]}
      >
        <Feather name="plus" size={24} color={Colors.background} />
        <Text className="text-base font-semibold text-background">{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="absolute bottom-6 right-6 h-[56px] w-[56px] items-center justify-center rounded-full bg-primary"
      style={[Shadow.elevated, pressed ? { opacity: 0.92 } : undefined]}
    >
      <Feather name="plus" size={26} color={Colors.background} />
    </Pressable>
  );
}
