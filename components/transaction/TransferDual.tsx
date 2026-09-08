import { Pressable, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useThemeColors } from "@/constants/theme";
import { AccountPill } from "./AccountPill";

type Props = {
  fromAcc: { name: string; type: string } | null;
  toAcc: { name: string; type: string } | null;
  onSelectFrom: () => void;
  onSelectTo: () => void;
  onSwap: () => void;
};

export function TransferDual({ fromAcc, toAcc, onSelectFrom, onSelectTo, onSwap }: Props) {
  const C = useThemeColors();
  return (
    <View className="flex-row items-center justify-between gap-3 px-4 py-3">
      <AccountPill label="Payment account" account={fromAcc} onPress={onSelectFrom} />
      <Pressable
        onPress={onSwap}
        accessibilityRole="button"
        accessibilityLabel="Swap payment and receive accounts"
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          backgroundColor: C.surface,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: C.border,
        }}
      >
        <Feather name="repeat" size={18} color={C.primary} />
      </Pressable>
      <AccountPill label="Receive account" account={toAcc} onPress={onSelectTo} />
    </View>
  );
}
