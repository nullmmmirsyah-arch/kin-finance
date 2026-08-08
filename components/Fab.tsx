import Feather from "@expo/vector-icons/Feather";
import { Colors } from "@/constants/theme";
import { useState } from "react";
import { Pressable } from "react-native";

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
};

export function Fab({ onPress, accessibilityLabel }: Props) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="absolute bottom-6 right-6 h-[56px] w-[56px] items-center justify-center rounded-full bg-primary shadow-md"
      style={pressed ? { opacity: 0.92 } : undefined}
    >
      <Feather name="plus" size={26} color={Colors.background} />
    </Pressable>
  );
}
