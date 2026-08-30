import { GradientCard } from "@/components/GradientCard";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { calcDelta } from "@/utils/analytics";
import { formatNumber } from "@/utils/format";
import Feather from "@expo/vector-icons/Feather";
import { useEffect } from "react";
import { Text, View, useColorScheme } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

type Props = {
  currentNet: number;
  prevNet: number;
  currentLabel: string;
  prevLabel: string;
};

export function DeltaCard({ currentNet, prevNet, currentLabel, prevLabel }: Props) {
  const C = useThemeColors();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const { deltaPct, label } = calcDelta(currentNet, prevNet);
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = 0.9;
    scale.value = withSpring(1, { damping: 10 });
  }, [deltaPct, scale]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Light mode: solid tints for clear contrast on GradientCard cream; Dark mode: subtle alpha on dark surface
  const badgeBg = (() => {
    if (deltaPct === null) return C.background;
    if (deltaPct > 0) return isDark ? `${C.success}26` : "#DCFCE7";
    if (deltaPct < 0) return isDark ? `${C.error}26` : "#FEE2E2";
    return C.background;
  })();
  const badgeColor =
    deltaPct === null ? C.textSecondary : deltaPct > 0 ? C.success : deltaPct < 0 ? C.error : C.textSecondary;
  const iconName: keyof typeof Feather.glyphMap =
    deltaPct === null ? "minus" : deltaPct > 0 ? "trending-up" : deltaPct < 0 ? "trending-down" : "minus";
  const badgeBorderColor = (() => {
    if (deltaPct === null) return C.border;
    if (deltaPct > 0) return isDark ? `${C.success}40` : "#86EFAC";
    if (deltaPct < 0) return isDark ? `${C.error}40` : "#FCA5A5";
    return C.border;
  })();

  return (
    <GradientCard>
      <View className="flex-row items-center justify-between">
        <View className="gap-1">
          <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">{currentLabel} net</Text>
          <Text className="text-base font-bold text-text-primary dark:text-text-primary-dark">
            {formatNumber(currentNet)}
          </Text>
          <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
            Prev {prevLabel}: {formatNumber(prevNet)}
          </Text>
        </View>
        <Animated.View
          style={[
            aStyle,
            Shadow.card,
            {
              backgroundColor: badgeBg,
              borderRadius: Radius.md,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: badgeBorderColor,
            },
          ]}
          className="flex-row items-center gap-1"
        >
          <Feather name={iconName} size={14} color={badgeColor} />
          <Text style={{ color: badgeColor, fontWeight: "600", fontSize: 12 }}>{label}</Text>
        </Animated.View>
      </View>
    </GradientCard>
  );
}
