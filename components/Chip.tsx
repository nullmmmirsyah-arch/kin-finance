import { Colors } from "@/constants/theme";
import { Pressable, Text } from "react-native";

type Props = {
  label: string;
  active: boolean;
  onPress: () => void;
};

export function Chip({ label, active, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        {
          borderRadius: 999,
          backgroundColor: active ? Colors.primary : "#FFF",
          borderWidth: 1,
          borderColor: active ? Colors.primary : Colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      className="min-h-11 items-center justify-center px-4"
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
