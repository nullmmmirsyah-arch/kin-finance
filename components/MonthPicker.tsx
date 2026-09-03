import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { getPeriodBounds } from "@/utils/period";
import { zonedMonthStart } from "@/utils/date";

export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function isFutureMonth(
  year: number,
  month: number,
  tz: string,
  now: number,
): boolean {
  const start = zonedMonthStart(year, month, tz);
  const cur = getPeriodBounds(now, tz, "monthly").start;
  return start > cur;
}

type Props = {
  visible: boolean;
  selectedPeriodStart: number;
  tz: string;
  onSelect: (periodStart: number) => void;
  onClose: () => void;
};

export function MonthPicker({
  visible,
  selectedPeriodStart,
  tz,
  onSelect,
  onClose,
}: Props) {
  const C = useThemeColors();
  const selYearStr = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
  }).format(new Date(selectedPeriodStart));
  const [year, setYear] = useState<number>(Number(selYearStr));
  useEffect(() => {
    if (visible) {
      const y = Number(
        new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric" }).format(new Date(selectedPeriodStart)),
      );
      setYear(y);
    }
  }, [visible, selectedPeriodStart, tz]);
  const now = Date.now();
  const curYear = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
    }).format(new Date(now)),
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 justify-end bg-black/40 px-5 pb-8"
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={Shadow.card}
          className="rounded-2xl bg-background p-5 dark:bg-background-dark"
        >
          {/* Tabs: Week | Month | Year */}
          <View className="flex-row justify-center gap-6">
            <Text className="text-sm text-text-secondary opacity-40">Week</Text>
            <Text
              className="rounded-full px-3 py-1 text-sm font-semibold text-text-primary"
              style={{ backgroundColor: `${C.primary}22` }}
            >
              Month
            </Text>
            <Text className="text-sm text-text-secondary opacity-40">Year</Text>
          </View>
          <View className="flex-row justify-center gap-2">
            <Text className="text-xs text-text-secondary opacity-60">
              Coming soon
            </Text>
          </View>

          {/* Year nav */}
          <View className="mt-4 flex-row items-center justify-center gap-4">
            <Pressable
              onPress={() => setYear((y) => y - 1)}
              className="h-10 w-10 items-center justify-center rounded-full bg-surface"
            >
              <Feather name="chevron-left" size={18} color={C.textPrimary} />
            </Pressable>
            <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
              {year}
            </Text>
            <Pressable
              onPress={() => {
                if (year < curYear) setYear((y) => y + 1);
              }}
              disabled={year >= curYear}
              style={{ opacity: year >= curYear ? 0.4 : 1 }}
              className="h-10 w-10 items-center justify-center rounded-full bg-surface"
            >
              <Feather name="chevron-right" size={18} color={C.textPrimary} />
            </Pressable>
          </View>

          {/* Grid 3x4 Jan-Dec */}
          <View className="mt-4 flex-row flex-wrap justify-between gap-2">
            {MONTH_LABELS.map((label, idx) => {
              const month = idx + 1;
              const ps = zonedMonthStart(year, month, tz);
              const isSelected = ps === selectedPeriodStart;
              const isFuture = isFutureMonth(year, month, tz, now);
              return (
                <Pressable
                  key={label}
                  disabled={isFuture}
                  onPress={() => {
                    if (isFuture) return;
                    onSelect(ps);
                    onClose();
                  }}
                  style={{
                    width: "31%",
                    opacity: isFuture ? 0.4 : 1,
                    backgroundColor: isSelected ? C.primary : C.surface,
                    borderRadius: Radius.md,
                  }}
                  className="items-center py-3"
                >
                  <Text
                    style={{
                      color: isSelected ? C.background : C.textPrimary,
                    }}
                    className="text-sm font-medium"
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Bottom X / check */}
          <View className="mt-4 flex-row justify-between">
            <Pressable
              onPress={onClose}
              className="h-12 w-12 items-center justify-center"
            >
              <Feather name="x" size={20} color={C.textPrimary} />
            </Pressable>
            <Pressable
              onPress={onClose}
              className="h-12 w-12 items-center justify-center"
            >
              <Feather name="check" size={20} color={C.primary} />
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
