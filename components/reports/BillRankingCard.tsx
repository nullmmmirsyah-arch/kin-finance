import { Text, View } from "react-native";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { formatNumber } from "@/utils/format";

type Segment = {
  name: string;
  amount: number;
};

type Props = {
  type: "expenses" | "income";
  segments: Segment[];
};

export function BillRankingCard({ type, segments }: Props) {
  const C = useThemeColors();
  const top10 = segments.slice(0, 10);

  return (
    <View
      style={[Shadow.card, { backgroundColor: C.background, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border }]}
      className="px-4 py-4"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">Bill Amount Ranking TOP 10</Text>
        <View style={{ backgroundColor: C.primaryLight, borderRadius: 999 }} className="px-3 py-1">
          <Text className="text-xs font-semibold" style={{ color: C.textPrimary }}>
            {type === "expenses" ? "Expenses" : "Income"}
          </Text>
        </View>
      </View>

      {top10.length === 0 ? (
        <View className="items-center py-6">
          <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">No data</Text>
        </View>
      ) : (
        <View className="mt-3 gap-2">
          {top10.map((s, idx) => (
            <View key={`${s.name}-${idx}`} className="flex-row items-center justify-between py-1.5">
              <Text numberOfLines={1} className="flex-1 text-sm text-text-primary dark:text-text-primary-dark">
                {idx + 1} {s.name}
              </Text>
              <Text className="ml-2 text-sm font-medium text-text-primary dark:text-text-primary-dark">{formatNumber(s.amount)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
