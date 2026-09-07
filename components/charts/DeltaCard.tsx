import { GradientCard } from "@/components/GradientCard";
import { useThemeColors } from "@/constants/theme";
import { calcDelta } from "@/utils/analytics";
import { formatNumber } from "@/utils/format";
import Feather from "@expo/vector-icons/Feather";
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

type Props = {
  currentClosing: number;
  prevClosing: number;
  currentLabel: string;
  prevLabel: string;
  // compat aliases (before periodBalances, callers used net)
  currentNet?: number;
  prevNet?: number;
  periodType?: "monthly" | "weekly" | "yearly";
};

export function DeltaCard({ currentClosing, prevClosing, currentNet, prevNet, currentLabel, prevLabel, periodType = "monthly" }: Props) {
  const C = useThemeColors();
  const effectiveCurrent = currentClosing ?? currentNet ?? 0;
  const effectivePrev = prevClosing ?? prevNet ?? 0;
  const periodNoun = periodType === "weekly" ? "week" : periodType === "yearly" ? "year" : "month";
  const { deltaPct, label } = calcDelta(effectiveCurrent, effectivePrev, periodNoun);
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = 0.9;
    scale.value = withSpring(1, { damping: 10 });
  }, [deltaPct, scale]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const deltaColor =
    deltaPct === null ? C.textSecondary : deltaPct > 0 ? C.success : deltaPct < 0 ? C.error : C.textSecondary;
  const iconName: keyof typeof Feather.glyphMap =
    deltaPct === null ? "minus" : deltaPct > 0 ? "trending-up" : deltaPct < 0 ? "trending-down" : "minus";

  return (
    <GradientCard>
      <View className="flex-row items-center justify-between">
        <View className="gap-1">
          <Text className="text-[13px] leading-4 tracking-wide text-text-secondary dark:text-text-secondary-dark">{currentLabel} net</Text>
          <Text className="text-[16px] font-bold leading-5 tracking-[-0.015em] tabular-nums text-text-primary dark:text-text-primary-dark">
            {formatNumber(effectiveCurrent)}
          </Text>
          <Text className="text-[13px] leading-4 tracking-wide text-text-secondary dark:text-text-secondary-dark">
            Prev {prevLabel}: {formatNumber(effectivePrev)}
          </Text>
        </View>
        <Animated.View style={[aStyle]} className="flex-row items-center gap-1.5">
          <Feather name={iconName} size={15} color={deltaColor} />
          <Text style={{ color: deltaColor }} className="text-[13px] font-semibold leading-4 tracking-wide tabular-nums">{label}</Text>
        </Animated.View>
      </View>
    </GradientCard>
  );
}
