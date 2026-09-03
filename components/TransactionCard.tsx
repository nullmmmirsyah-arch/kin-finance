import Feather from "@expo/vector-icons/Feather";
import { Radius, useThemeColors } from "@/constants/theme";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { formatNumber } from "@/utils/format";

const CATEGORY_ICONS: Record<string, string> = {
  Groceries: "shopping-cart",
  Food: "coffee",
  Dining: "coffee",
  Transport: "truck",
  Rent: "home",
  Utilities: "zap",
  Salary: "briefcase",
  Freelance: "briefcase",
  Shopping: "shopping-bag",
  Entertainment: "film",
  Health: "heart",
  Education: "book",
  Savings: "dollar-sign",
  Gifts: "gift",
  Travel: "map",
  Subscriptions: "repeat",
  Insurance: "shield",
  Debt: "credit-card",
  Investments: "trending-up",
  Other: "tag",
};

function getCategoryIcon(categoryName: string | null): string {
  if (!categoryName) return "tag";
  return CATEGORY_ICONS[categoryName] ?? "tag";
}

type Props = {
  categoryName: string | null;
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
        className="items-center justify-center"
      >
        <Feather
          name={(isTransfer ? "arrow-right" : getCategoryIcon(categoryName)) as any}
          size={18}
          color={isTransfer ? C.primary : type === "income" ? C.success : C.error}
        />
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
