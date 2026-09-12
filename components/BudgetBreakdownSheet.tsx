import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { Shadow, useThemeColors } from "@/constants/theme";
import { formatNumber } from "@/utils/format";

export type BreakdownRow = {
  _id: string;
  amount: number;
  spent?: number;
  category?: { name: string; hidden: boolean; icon?: string };
};

type Props = {
  visible: boolean;
  budgets: BreakdownRow[];
  periodLabel: string;
  onClose: () => void;
  onViewAll: () => void;
};

export function BudgetBreakdownSheet({ visible, budgets, periodLabel, onClose, onViewAll }: Props) {
  const C = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} accessibilityLabel="Budget breakdown">
      <Pressable className="flex-1 justify-end bg-black/40 px-5 pb-8" onPress={onClose}>
        <Pressable className="max-h-[80%] overflow-hidden rounded-2xl bg-background p-5 dark:bg-background-dark" style={Shadow.card} onPress={(e) => e.stopPropagation()}>
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
              Budget breakdown • {periodLabel}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close breakdown" className="h-12 w-12 items-center justify-center">
              <Feather name="x" size={18} color={C.textSecondary} />
            </Pressable>
          </View>
          <ScrollView className="mt-3 flex-grow" showsVerticalScrollIndicator={false}>
            <View className="gap-3 pb-2">
              {budgets.map((b) => {
                const spent = b.spent;
                const over = spent !== undefined && spent > b.amount;
                const used = spent === undefined ? 0 : b.amount > 0 ? Math.min(spent / b.amount, 1) : spent > 0 ? 1 : 0;
                const level = spent === undefined ? 0 : Math.max(1 - used, 0);
                const remaining = spent !== undefined ? b.amount - spent : b.amount;
                return (
                  <Pressable
                    key={b._id}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel={`${b.category?.name ?? "Budget"}: ${spent !== undefined ? `${formatNumber(spent)} of ${formatNumber(b.amount)}` : "details unavailable"}`}
                    style={{ borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.background }}
                    className="flex-row items-center gap-3 px-3 py-3"
                  >
                    <View style={{ width: 34, height: 44, borderRadius: 9, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.jarGlass, overflow: "hidden", justifyContent: "flex-end" }}>
                      {spent === undefined ? (
                        <View style={{ flex: 1, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}>
                          <Feather name="eye-off" size={12} color={C.textSecondary} />
                        </View>
                      ) : (
                        <View style={{ height: `${level * 100}%`, minHeight: level > 0 ? 8 : 0 }}>
                          <LinearGradient colors={over ? [C.error, C.overBudgetDeep] : [C.primaryLight, C.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
                        </View>
                      )}
                    </View>
                    <View className="flex-1 gap-0.5">
                      <View className="flex-row items-center gap-1.5">
                        <Text numberOfLines={1} className="flex-1 text-[15px] font-medium text-text-primary dark:text-text-primary-dark">
                          {b.category?.name ?? "Budget"}
                        </Text>
                        {b.category?.hidden ? <Feather name="eye-off" size={12} color={C.textSecondary} /> : null}
                      </View>
                      <Text className="text-[13px] text-text-secondary dark:text-text-secondary-dark">
                        {spent === undefined ? "Private • frosted" : over ? `${formatNumber(Math.abs(remaining))} over • ${formatNumber(spent)} / ${formatNumber(b.amount)}` : `${formatNumber(remaining)} left • ${formatNumber(spent)} / ${formatNumber(b.amount)}`}
                      </Text>
                    </View>
                    <Text style={{ color: over ? C.error : C.textSecondary }} className="text-[11px] font-bold">
                      {spent === undefined ? "—" : over ? "EMPTY" : `${Math.round(level * 100)}%`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <Pressable onPress={onViewAll} accessibilityRole="button" accessibilityLabel="View all budgets" style={{ backgroundColor: C.primary, borderRadius: 12 }} className="mt-3 h-12 items-center justify-center">
            <Text style={{ color: C.background }} className="text-[15px] font-bold">View all budgets</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
