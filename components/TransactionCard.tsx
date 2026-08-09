import Feather from "@expo/vector-icons/Feather";
import { Colors, Radius } from "@/constants/theme";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { formatNumber } from "@/utils/format";
import { formatTime } from "@/utils/date";

type Props = {
  categoryName: string | null;
  isTransfer: boolean;
  toAccountName?: string;
  note: string | null;
  amount: number;
  type: "income" | "expense" | "transfer";
  date: number;
  onPress: () => void;
};

export function TransactionCard({
  categoryName,
  isTransfer,
  toAccountName,
  note,
  amount,
  type,
  date,
  onPress,
}: Props) {
  const [pressed, setPressed] = useState(false);

  const displayNote =
    note && note.length > 0
      ? note
      : isTransfer
        ? toAccountName
          ? `Transfer to ${toAccountName}`
          : "Transfer"
        : (categoryName ?? "");

  const amountLabel =
    type === "expense"
      ? `-${formatNumber(Math.abs(amount))}`
      : type === "income"
        ? `+${formatNumber(amount)}`
        : formatNumber(amount);

  const amountColor =
    type === "income"
      ? Colors.success
      : type === "expense"
        ? Colors.error
        : Colors.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-[16px] px-4 py-3"
      style={pressed ? { backgroundColor: Colors.surface } : undefined}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: Radius.sm,
          backgroundColor: Colors.surface,
        }}
        className="items-center justify-center"
      >
        <Feather
          name={isTransfer ? "arrow-right" : "tag"}
          size={18}
          color={Colors.primary}
        />
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-base text-text-primary">
          {displayNote}
        </Text>
        <Text className="text-xs text-text-secondary">{formatTime(date)}</Text>
      </View>
      <Text
        className="text-base font-semibold"
        style={{ color: amountColor }}
      >
        {amountLabel}
      </Text>
    </Pressable>
  );
}
