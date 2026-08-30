import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { hapticSuccess } from "@/lib/haptics";
import { maxBarValue } from "@/utils/analytics";
import { formatNumber } from "@/utils/format";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

type Datum = {
  periodStart: number;
  label: string;
  income: number;
  expense: number;
  net: number;
};

type Props = {
  data: Datum[];
  timezone: string;
};

function AnimatedBar({ heightPercent, color, delay }: { heightPercent: number; color: string; delay: number }) {
  const sv = useSharedValue(0);

  useEffect(() => {
    sv.value = withDelay(delay, withTiming(1, { duration: 400 }));
  }, [delay, sv]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: 100 * sv.value * (heightPercent / 100),
  }));

  return <Animated.View style={[{ width: 12, borderRadius: 6, backgroundColor: color }, animatedStyle]} />;
}

export function CashflowBarChart({ data, timezone }: Props) {
  void timezone;
  const C = useThemeColors();
  const [selected, setSelected] = useState<number | null>(null);
  const max = maxBarValue(data);

  if (data.length === 0) {
    return (
      <View
        style={[
          Shadow.card,
          {
            backgroundColor: C.background,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: C.border,
          },
        ]}
        className="items-center px-4 py-6"
      >
        <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
          No transactions in last 6 months
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        Shadow.card,
        {
          backgroundColor: C.background,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: C.border,
        },
      ]}
      className="px-4 py-4"
    >
      <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">Cashflow (6 months)</Text>
      <View className="mt-4 flex-row items-end justify-between" style={{ height: 120 }}>
        {data.map((d, i) => {
          const incH = (d.income / max) * 100;
          const expH = (d.expense / max) * 100;
          const isSel = selected === i;
          return (
            <Pressable
              key={d.periodStart}
              onPress={() => {
                setSelected(isSel ? null : i);
                void hapticSuccess();
              }}
              className="flex-1 items-center gap-1"
            >
              <View className="flex-row items-end gap-1" style={{ height: 100 }}>
                <AnimatedBar heightPercent={incH} color={C.success} delay={i * 60} />
                <AnimatedBar heightPercent={expH} color={C.error} delay={i * 60} />
              </View>
              <Text
                className={`text-xs ${isSel ? "font-semibold text-primary dark:text-primary-dark" : "text-text-secondary dark:text-text-secondary-dark"}`}
              >
                {d.label.slice(0, 3)}
              </Text>
              {isSel ? (
                <View
                  style={[
                    Shadow.elevated,
                    {
                      backgroundColor: C.surface,
                      borderRadius: Radius.sm,
                      padding: 8,
                    },
                  ]}
                  className="absolute -top-14 z-10 min-w-[110px]"
                >
                  <Text className="text-xs text-text-primary dark:text-text-primary-dark">+{formatNumber(d.income)}</Text>
                  <Text className="text-xs text-text-primary dark:text-text-primary-dark">-{formatNumber(d.expense)}</Text>
                  <Text className="text-xs font-semibold text-text-primary dark:text-text-primary-dark">
                    Net {formatNumber(d.net)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View className="mt-2 flex-row justify-center gap-3">
        <View className="flex-row items-center gap-1">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.success }} />
          <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">Income</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.error }} />
          <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">Expense</Text>
        </View>
      </View>
    </View>
  );
}
