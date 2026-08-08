import Feather from "@expo/vector-icons/Feather";
import { Colors, Shadow } from "@/constants/theme";
import { Pressable } from "react-native";

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
};

export function Fab({ onPress, accessibilityLabel }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        Shadow.elevated,
        {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: Colors.primary,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      className="absolute bottom-6 right-6 items-center justify-center"
    >
      <Feather name="plus" size={26} color={Colors.background} />
    </Pressable>
  );
}
