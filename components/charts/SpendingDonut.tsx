import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { hapticSuccess } from "@/lib/haptics";
import { formatNumber } from "@/utils/format";
import { useState, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

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

  const palette = useMemo<string[]>(
    () => [C.accountCash, C.accountBank, C.accountEwallet, C.accountCreditCard, C.primary, C.chartAmber, C.chartEmerald],
    [C.accountCash, C.accountBank, C.accountEwallet, C.accountCreditCard, C.primary, C.chartAmber, C.chartEmerald],
  );

  const visible = useMemo(() => segments.slice(0, 5), [segments]);
  const overflow = segments.length - 5;
  const overflowAmount = useMemo(
    () => (overflow > 0 ? segments.slice(5).reduce((s, x) => s + x.amount, 0) : 0),
    [segments, overflow],
  );

  const chartSegments = useMemo(() => {
    const base = visible.map((s, i) => ({
      name: s.name,
      amount: s.amount,
      color: palette[i % palette.length] ?? C.primary,
    }));
    if (overflow > 0) {
      base.push({
        name: "Others",
        amount: overflowAmount,
        color: C.textSecondary,
      });
    }
    return base;
  }, [visible, overflow, overflowAmount, palette, C.primary, C.textSecondary]);

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

  // Build donut arcs via strokeDasharray (circumference = 100 when r=15.915)
  let cumulativePct = 0;
  const arcs = chartSegments.map((seg) => {
    const pct = total > 0 ? seg.amount / total : 0;
    const dash = pct * 100;
    const gap = 100 - dash;
    // 25 = 90deg offset to start at top
    const offset = 25 - cumulativePct * 100;
    cumulativePct += pct;
    return { ...seg, pct, dash, gap, offset };
  });

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
        <View style={{ width: 140, height: 140, alignItems: "center", justifyContent: "center" }}>
          <Svg width={140} height={140} viewBox="0 0 42 42">
            {/* track */}
            <Circle cx="21" cy="21" r="15.915" fill="transparent" stroke={C.border} strokeWidth="7" />
            {arcs.map((arc) => {
              const isSel = sel === arc.name;
              const isDimmed = sel !== null && !isSel;
              return (
                <Circle
                  key={arc.name}
                  cx="21"
                  cy="21"
                  r="15.915"
                  fill="transparent"
                  stroke={arc.color}
                  strokeWidth={isSel ? "8.5" : "7"}
                  strokeDasharray={`${arc.dash} ${arc.gap}`}
                  strokeDashoffset={arc.offset}
                  strokeLinecap="butt"
                  opacity={isDimmed ? 0.35 : 1}
                  // rotate -90 to start at top (already via offset 25, but keep transform for safety)
                />
              );
            })}
          </Svg>
          <View
            style={{
              position: "absolute",
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: C.background,
              alignItems: "center",
              justifyContent: "center",
              // inner shadow to mimic cutout
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
            <Animated.View entering={FadeIn.delay(visible.length * 40)}>
              <Pressable
                onPress={() => {
                  const isSel = sel === "Others";
                  setSel(isSel ? null : "Others");
                  void hapticSuccess();
                }}
                style={{
                  backgroundColor: sel === "Others" ? C.surface : "transparent",
                  borderRadius: Radius.sm,
                }}
                className="flex-row items-center justify-between px-2 py-1.5"
              >
                <View className="flex-row items-center gap-2">
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.textSecondary }} />
                  <Text className="text-sm text-text-primary dark:text-text-primary-dark">Others</Text>
                </View>
                <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                  {sel === "Others"
                    ? `${total > 0 ? ((overflowAmount / total) * 100).toFixed(1) : "0"}% • ${formatNumber(overflowAmount)}`
                    : `+${overflow} more`}
                </Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
