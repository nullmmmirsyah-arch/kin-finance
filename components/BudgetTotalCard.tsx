import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { formatNumber } from "@/utils/format";
import type { BudgetSummary } from "@/utils/budgets";

type Props = {
  summary: BudgetSummary;
  jarCount: number;
  onPress: () => void;
};

export function BudgetTotalCard({ summary, jarCount, onPress }: Props) {
  const C = useThemeColors();
  const [pressed, setPressed] = useState(false);
  const { budgeted, spent, hasRedacted, progress, honeyLevel, remaining } = summary;
  const over = !hasRedacted && progress > 1;
  const status = hasRedacted ? "SOME PRIVATE" : over ? "OVER" : progress > 0.8 ? "ALMOST EMPTY" : "ON TRACK";
  const statusColor = hasRedacted ? C.textSecondary : over ? C.error : progress > 0.8 ? C.primary : C.textSecondary;
  const caption = hasRedacted
    ? "— left • some jars private"
    : remaining >= 0
      ? `${formatNumber(remaining)} left • ${Math.round(honeyLevel * 100)}% honey`
      : `${formatNumber(Math.abs(remaining))} over • empty`;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={`Total budget ${formatNumber(budgeted)}, ${caption}`}
      style={[Shadow.card, { backgroundColor: pressed ? C.surface : C.background, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border }]}
      className="flex-row items-center gap-4 px-4 py-4"
    >
      <View style={{ width: 56, alignItems: "center", gap: 4 }}>
        <View style={{ width: 48, height: 11, borderRadius: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, marginBottom: -5, zIndex: 1, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: over ? C.error : C.primary, opacity: honeyLevel > 0 ? 0.9 : 0.25 }} />
        </View>
        <View style={{ width: 48, height: 64, borderRadius: 14, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.jarGlass, overflow: "hidden", justifyContent: "flex-end" }}>
          <View style={{ position: "absolute", left: 6, top: 6, bottom: 6, width: 6, borderRadius: 999, backgroundColor: "white", opacity: 0.55 }} />
          {hasRedacted ? (
            <View style={{ flex: 1, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}>
              <Feather name="eye-off" size={14} color={C.textSecondary} />
            </View>
          ) : (
            <View style={{ height: `${honeyLevel * 100}%`, minHeight: honeyLevel > 0 ? 14 : 0, overflow: "hidden", borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
              <LinearGradient colors={over ? [C.error, C.overBudgetDeep] : [C.primaryLight, C.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
                <View style={{ height: 8, marginTop: -1, backgroundColor: "rgba(255,255,255,0.28)", borderBottomLeftRadius: 999, borderBottomRightRadius: 999, transform: [{ scaleX: 1.15 }] }} />
              </LinearGradient>
            </View>
          )}
        </View>
        <Text style={{ color: over ? C.error : honeyLevel < 0.3 ? C.primary : C.textSecondary }} className="text-[11px] font-bold tracking-[0.08em] leading-3">
          {hasRedacted ? "—" : over ? "EMPTY" : `${Math.round(honeyLevel * 100)}%`}
        </Text>
      </View>
      <View className="flex-1 gap-1.5">
        <View className="flex-row items-center justify-between">
          <Text className="text-[11px] font-semibold uppercase leading-3 tracking-[0.08em] text-text-secondary dark:text-text-secondary-dark">
            Total • {jarCount} {jarCount === 1 ? "jar" : "jars"}
          </Text>
          <Text style={{ color: statusColor }} className="text-[11px] font-semibold tracking-[0.08em] leading-3">{status}</Text>
        </View>
        <Text className="text-[28px] font-bold leading-7 tracking-[-0.02em] tabular-nums text-text-primary dark:text-text-primary-dark">
          {formatNumber(budgeted)}
        </Text>
        <Text className="text-[13px] leading-4 tracking-wide text-text-secondary dark:text-text-secondary-dark">{caption}</Text>
        {hasRedacted ? (
          <View style={{ height: 8, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderStyle: "dashed" }} />
        ) : (
          <View style={{ height: 8, borderRadius: 999, backgroundColor: C.jarGlass, borderWidth: 1, borderColor: C.border, overflow: "hidden", padding: 2 }}>
            <View style={{ flex: 1, borderRadius: 999, backgroundColor: C.surface, overflow: "hidden" }}>
              <LinearGradient colors={over ? [C.error, C.overBudgetDeep] : [C.primaryLight, C.primary]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ width: `${honeyLevel * 100}%`, flex: 1, borderRadius: 999 }} />
            </View>
          </View>
        )}
        <Text className="text-[13px] leading-4 tracking-wide text-text-secondary dark:text-text-secondary-dark">
          {hasRedacted ? "— spent • some jars private" : `Spent ${formatNumber(spent)}`}
        </Text>
      </View>
    </Pressable>
  );
}
