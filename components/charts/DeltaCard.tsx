import { GradientCard } from "@/components/GradientCard";
import { useThemeColors } from "@/constants/theme";
import { calcDelta } from "@/utils/analytics";
import { formatNumber } from "@/utils/format";
import Feather from "@expo/vector-icons/Feather";
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

type Props = {
  currentNet: number;
  prevNet: number;
  currentLabel: string;
  prevLabel: string;
};

export function DeltaCard({ currentNet, prevNet, currentLabel, prevLabel }: Props) {
  const C = useThemeColors();
  const { deltaPct, label } = calcDelta(currentNet, prevNet);
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
          <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">{currentLabel} net</Text>
          <Text className="text-base font-bold text-text-primary dark:text-text-primary-dark">
            {formatNumber(currentNet)}
          </Text>
          <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
            Prev {prevLabel}: {formatNumber(prevNet)}
          </Text>
        </View>
        <Animated.View style={[aStyle]} className="flex-row items-center gap-1">
          <Feather name={iconName} size={14} color={deltaColor} />
          <Text style={{ color: deltaColor, fontWeight: "600", fontSize: 12 }}>{label}</Text>
        </Animated.View>
      </View>
    </GradientCard>
  );
}
