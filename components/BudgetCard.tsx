import Feather from "@expo/vector-icons/Feather";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { Pressable, Text, View } from "react-native";
import { CategoryIcon } from "@/components/CategoryIcon";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { formatNumber } from "@/utils/format";

type Props = {
  categoryName: string;
  categoryIcon?: string;
  categoryHidden: boolean;
  budgetAmount: number;
  spent?: number;
  onEdit: () => void;
  onDelete: () => void;
};

export function BudgetCard({
  categoryName,
  categoryIcon,
  categoryHidden,
  budgetAmount,
  spent,
  onEdit,
  onDelete,
}: Props) {
  const C = useThemeColors();
  const [pressed, setPressed] = useState(false);
  const overBudget = spent !== undefined && spent > budgetAmount;
  const progressUsed =
    spent === undefined ? 0 : budgetAmount > 0 ? Math.min(spent / budgetAmount, 1) : spent > 0 ? 1 : 0;
  const honeyLevel = spent === undefined ? 0 : Math.max(1 - progressUsed, 0);
  const pctLeft = Math.round(honeyLevel * 100);
  const remaining = spent !== undefined ? budgetAmount - spent : budgetAmount;

  const statusText =
    spent === undefined ? "Private" : overBudget ? "Over" : progressUsed >= 0.8 ? "Almost empty" : "On track";
  const statusColor =
    spent === undefined
      ? C.textSecondary
      : overBudget
        ? C.error
        : progressUsed >= 0.8
          ? C.primary
          : C.textSecondary;

  return (
    <View
      style={[
        Shadow.card,
        {
          borderRadius: Radius.md,
          backgroundColor: pressed ? C.surface : C.background,
          borderWidth: 1,
          borderColor: C.border,
        },
      ]}
      className="px-4 py-4"
    >
      <Pressable
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`${categoryName} budget, ${spent !== undefined ? `${formatNumber(spent)} of ${formatNumber(budgetAmount)}` : "private"}`}
        className="flex-row gap-4"
      >
        {/* Cute jar — prominent honey, still no wood */}
        <View style={{ width: 56, alignItems: "center", gap: 4 }}>
          {/* cute screw cap — wider, honey dot */}
          <View
            style={{
              width: 48,
              height: 11,
              borderRadius: 6,
              backgroundColor: C.surface,
              borderWidth: 1,
              borderColor: C.border,
              marginBottom: -5,
              zIndex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <View style={{ width: 18, height: 2.5, borderRadius: 999, backgroundColor: C.border, opacity: 0.55 }} />
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                backgroundColor: overBudget ? C.error : C.primary,
                opacity: honeyLevel > 0 ? 0.9 : 0.25,
              }}
            />
            <View style={{ width: 10, height: 2.5, borderRadius: 999, backgroundColor: C.border, opacity: 0.32 }} />
          </View>
          <View
            style={{
              width: 48,
              height: 64,
              borderRadius: 14,
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
              borderWidth: 1.5,
              borderColor: C.border,
              backgroundColor: "#FFFFFF",
              overflow: "hidden",
              justifyContent: "flex-end",
              shadowColor: "#000",
              shadowOpacity: 0.04,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            {/* glossy glass highlight */}
            <View
              style={{
                position: "absolute",
                left: 6,
                top: 6,
                bottom: 6,
                width: 6,
                borderRadius: 999,
                backgroundColor: "white",
                opacity: 0.55,
              }}
            />
            {spent !== undefined ? (
              <View
                style={{
                  height: `${honeyLevel * 100}%`,
                  minHeight: honeyLevel > 0 ? 14 : 0,
                  overflow: "hidden",
                  borderBottomLeftRadius: 12,
                  borderBottomRightRadius: 12,
                }}
              >
                <LinearGradient
                  colors={overBudget ? [C.error, "#7F1D1D"] : [C.primaryLight, C.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ flex: 1 }}
                >
                  {/* honey shine */}
                  <View
                    style={{
                      height: 8,
                      marginTop: -1,
                      backgroundColor: "rgba(255,255,255,0.28)",
                      borderBottomLeftRadius: 999,
                      borderBottomRightRadius: 999,
                      transform: [{ scaleX: 1.15 }],
                    }}
                  />
                  {honeyLevel > 0.2 && (
                    <View
                      style={{
                        position: "absolute",
                        right: 10,
                        top: 12,
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        backgroundColor: "rgba(255,255,255,0.5)",
                      }}
                    />
                  )}
                  {honeyLevel > 0.35 && (
                    <View
                      style={{
                        position: "absolute",
                        right: 18,
                        top: 22,
                        width: 3,
                        height: 3,
                        borderRadius: 999,
                        backgroundColor: "rgba(255,255,255,0.45)",
                      }}
                    />
                  )}
                </LinearGradient>
              </View>
            ) : (
              <View
                style={{
                  flex: 1,
                  backgroundColor: C.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="eye-off" size={14} color={C.textSecondary} />
              </View>
            )}
          </View>
          <Text
            style={{ color: overBudget ? C.error : honeyLevel < 0.3 ? C.primary : C.textSecondary }}
            className="text-[11px] font-bold tracking-wide"
          >
            {spent === undefined ? "—" : overBudget ? "Empty" : `${pctLeft}% left`}
          </Text>
        </View>

        {/* Content — restrained hierarchy */}
        <View className="flex-1 gap-3">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1 flex-row items-center gap-2.5">
              {categoryIcon ? (
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: Radius.sm,
                    backgroundColor: C.surface,
                    borderWidth: 1,
                    borderColor: C.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CategoryIcon name={categoryIcon} size={20} />
                </View>
              ) : null}
              <View className="flex-1 gap-1">
                <View className="flex-row items-center gap-1.5">
                  <Text
                    numberOfLines={1}
                    className="flex-1 text-[15px] font-semibold text-text-primary dark:text-text-primary-dark"
                  >
                    {categoryName}
                  </Text>
                  {categoryHidden ? <Feather name="eye-off" size={12} color={C.textSecondary} /> : null}
                </View>
                <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
                  {spent === undefined
                    ? "Private • frosted"
                    : overBudget
                      ? `${formatNumber(Math.abs(remaining))} over`
                      : `${formatNumber(remaining)} left • ${formatNumber(budgetAmount)} budget`}
                </Text>
              </View>
            </View>
            <Text
              style={{ color: statusColor }}
              className="text-[11px] font-semibold tracking-widest"
            >
              {statusText.toUpperCase()}
            </Text>
          </View>

          <View className="flex-row items-baseline gap-1.5">
            <Text
              className={`text-sm font-medium ${overBudget ? "text-error dark:text-error-dark" : "text-text-primary dark:text-text-primary-dark"}`}
            >
              {spent === undefined ? "—" : formatNumber(spent)}
            </Text>
            <Text className="text-sm font-normal text-text-secondary dark:text-text-secondary-dark">
              / {formatNumber(budgetAmount)}
            </Text>
          </View>

          {/* Cute prominent track */}
          {spent === undefined ? (
            <View
              style={{
                height: 8,
                borderRadius: 999,
                backgroundColor: C.surface,
                borderWidth: 1,
                borderColor: C.border,
                borderStyle: "dashed",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text className="text-[8px] font-bold tracking-wide text-text-secondary dark:text-text-secondary-dark">FROSTED</Text>
            </View>
          ) : (
            <View
              style={{
                height: 8,
                borderRadius: 999,
                backgroundColor: "#FFFFFF",
                borderWidth: 1,
                borderColor: C.border,
                overflow: "hidden",
                padding: 2,
              }}
            >
              <View style={{ flex: 1, borderRadius: 999, backgroundColor: C.surface, overflow: "hidden" }}>
                <LinearGradient
                  colors={overBudget ? [C.error, "#7F1D1D"] : [C.primaryLight, C.primary]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ width: `${honeyLevel * 100}%`, flex: 1, borderRadius: 999 }}
                />
              </View>
            </View>
          )}

          {/* Quiet actions — text links, not filled buttons */}
          <View className="flex-row items-center gap-3 pt-1">
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit budget"
              className="min-h-12 flex-row items-center gap-1 pr-2"
            >
              <Feather name="edit-2" size={13} color={C.primary} />
              <Text className="text-xs font-medium text-primary dark:text-primary-dark">Edit</Text>
            </Pressable>
            <Pressable
              onPress={onDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete budget"
              className="min-h-12 flex-row items-center gap-1"
            >
              <Feather name="trash-2" size={13} color={C.textSecondary} />
              <Text className="text-xs font-medium text-text-secondary dark:text-text-secondary-dark">
                Delete
              </Text>
            </Pressable>
            {spent !== undefined && !overBudget && (
              <Text className="ml-auto text-xs text-text-secondary dark:text-text-secondary-dark">
                {pctLeft}% honey left
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
}
