import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { hapticSuccess } from "@/lib/haptics";
import { formatNumber } from "@/utils/format";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

type Segment = {
  name: string;
  amount: number;
};

type Props = {
  segments: Segment[];
  total: number;
};

export function SpendingDonut({ segments, total }: Props) {
  const C = useThemeColors();
  const [sel, setSel] = useState<string | null>(null);

  if (segments.length === 0) {
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
        <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">No spending this month</Text>
      </View>
    );
  }

  const palette = [
    C.accountCash,
    C.accountBank,
    C.accountEwallet,
    C.accountCreditCard,
    C.primary,
    "#D97706",
    "#059669",
  ];

  const visible = segments.slice(0, 5);
  const overflow = segments.length - 5;

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
      <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">Spending by Category</Text>
      <View className="mt-4 flex-row items-center gap-4">
        <View
          style={{
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: C.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: C.background,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">Total</Text>
            <Text className="text-sm font-bold text-text-primary dark:text-text-primary-dark">{formatNumber(total)}</Text>
          </View>
        </View>
        <View className="flex-1 gap-2">
          {visible.map((s, i) => {
            const color = palette[i % palette.length] ?? C.primary;
            const pct = total > 0 ? ((s.amount / total) * 100).toFixed(1) : "0";
            const isSel = sel === s.name;
            return (
              <Animated.View entering={FadeIn.delay(i * 40)} key={s.name}>
                <Pressable
                  onPress={() => {
                    setSel(isSel ? null : s.name);
                    void hapticSuccess();
                  }}
                  style={{
                    backgroundColor: isSel ? C.surface : "transparent",
                    borderRadius: Radius.sm,
                  }}
                  className="flex-row items-center justify-between px-2 py-1.5"
                >
                  <View className="flex-1 flex-row items-center gap-2">
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                    <Text numberOfLines={1} className="flex-1 text-sm text-text-primary dark:text-text-primary-dark">
                      {s.name}
                    </Text>
                  </View>
                  <Text className="ml-2 text-sm font-medium text-text-primary dark:text-text-primary-dark">
                    {isSel ? `${pct}% • ${formatNumber(s.amount)}` : formatNumber(s.amount)}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}
          {overflow > 0 ? (
            <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">+{overflow} more</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
