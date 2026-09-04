import Feather from "@expo/vector-icons/Feather";
import { Radius, useThemeColors } from "@/constants/theme";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { formatNumber } from "@/utils/format";
import { Icon } from "@/modules/icon-registry";

type Props = {
  categoryName: string | null;
  categoryIcon?: string | null;
  isTransfer: boolean;
  toAccountName?: string;
  accountName?: string;
  note: string | null;
  amount: number;
  type: "income" | "expense" | "transfer";
  date: number;
  timezone?: string;
  onPress: () => void;
};

export function TransactionCard({
  categoryName,
  categoryIcon,
  isTransfer,
  toAccountName,
  accountName,
  note,
  amount,
  type,
  date,
  timezone: _timezone = "UTC",
  onPress,
}: Props) {
  const [pressed, setPressed] = useState(false);
  const C = useThemeColors();

  const displayNote =
    note && note.length > 0
      ? note
      : isTransfer
        ? toAccountName
          ? `Transfer to ${toAccountName}`
          : "Transfer"
        : (categoryName ?? "Transaction");

  const amountLabel =
    type === "expense"
      ? `-${formatNumber(Math.abs(amount))}`
      : type === "income"
        ? `+${formatNumber(amount)}`
        : formatNumber(amount);

  const amountColor =
    type === "income"
      ? C.success
      : type === "expense"
        ? C.error
        : C.textPrimary;

  const subtitle = isTransfer
    ? accountName && toAccountName
      ? `${accountName} → ${toAccountName}`
      : (accountName ?? "Transfer")
    : `${categoryName ?? "No category"}${accountName ? ` • ${accountName}` : ""}`;

  void date;
  void _timezone;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-[16px] px-4 py-3"
      style={pressed ? { backgroundColor: C.surface } : undefined}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: Radius.sm,
          backgroundColor: C.surface,
        }}
        className="items-center justify-center overflow-hidden"
      >
        {isTransfer ? (
          <Feather name="arrow-right" size={18} color={C.primary} />
        ) : (
          <Icon ref={categoryIcon ?? "other"} size={28} />
        )}
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-base text-text-primary dark:text-text-primary-dark">
          {displayNote}
        </Text>
        <Text
          numberOfLines={1}
          className="text-xs text-text-secondary dark:text-text-secondary-dark"
        >
          {subtitle}
        </Text>
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
