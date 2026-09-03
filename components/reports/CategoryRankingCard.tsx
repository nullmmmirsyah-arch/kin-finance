import { useState, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { formatNumber } from "@/utils/format";
import { SpendingDonut } from "@/components/charts/SpendingDonut";

type Segment = {
  name: string;
  amount: number;
};

type Props = {
  type: "expenses" | "income";
  segments: Segment[];
  total: number;
  othersAmount?: number;
  onToggle: () => void;
};

export function CategoryRankingCard({ type, segments, total, othersAmount, onToggle }: Props) {
  const C = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const [togglePressed, setTogglePressed] = useState(false);
  const [expandPressed, setExpandPressed] = useState(false);

  const visible = useMemo(() => (expanded ? segments : segments.slice(0, 5)), [expanded, segments]);

  return (
    <View
      style={[Shadow.card, { backgroundColor: C.background, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border }]}
      className="px-4 py-4"
    >
      {/* Header */}
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">Category Ranking</Text>
        <Pressable
          onPress={onToggle}
          onPressIn={() => setTogglePressed(true)}
          onPressOut={() => setTogglePressed(false)}
          accessibilityRole="button"
          accessibilityLabel={`Toggle to ${type === "expenses" ? "Income" : "Expenses"}`}
          style={{
            backgroundColor: togglePressed ? "#fde68a" : "#fde68a",
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
            opacity: togglePressed ? 0.85 : 1,
          }}
        >
          <Text className="text-xs font-semibold text-text-primary">{type === "expenses" ? "Expenses" : "Income"} ⇌</Text>
        </Pressable>
      </View>

      {/* Dummy Top level category pill */}
      <View className="mt-2 flex-row justify-end">
        <View style={{ backgroundColor: "#fde68a", borderRadius: 999 }} className="px-3 py-1">
          <Text className="text-xs font-medium text-text-primary">Top level category ⇌</Text>
        </View>
      </View>

      {/* Donut */}
      <View className="mt-3">
        {segments.length === 0 ? (
          <View className="items-center py-6">
            <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
              {type === "income" ? "No income this period" : "No data"}
            </Text>
          </View>
        ) : (
          <SpendingDonut segments={segments as { name: string; amount: number }[]} total={total} othersAmount={othersAmount} />
        )}
      </View>

      {/* Ranked list */}
      {segments.length > 0 && (
        <View className="mt-4 gap-2">
          {visible.map((s, idx) => {
            const pct = total > 0 ? (s.amount / total) * 100 : 0;
            return (
              <View key={s.name} className="gap-1">
                <View className="flex-row items-center justify-between">
                  <Text numberOfLines={1} className="flex-1 text-sm text-text-primary dark:text-text-primary-dark">
                    {idx + 1} {s.name}
                  </Text>
                  <Text className="ml-2 text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                    {formatNumber(s.amount)}
                  </Text>
                </View>
                <View className="h-1.5 overflow-hidden rounded-full bg-border dark:bg-border-dark">
                  <View style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: C.primary }} className="h-full rounded-full" />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Show more toggle */}
      {segments.length > 5 && (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          onPressIn={() => setExpandPressed(true)}
          onPressOut={() => setExpandPressed(false)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Show less" : "Show more"}
          style={{ opacity: expandPressed ? 0.7 : 1 }}
          className="mt-3 items-center justify-center py-2"
        >
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={C.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}
