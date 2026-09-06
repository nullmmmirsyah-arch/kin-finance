import Feather from "@expo/vector-icons/Feather";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { Pressable, Text, View } from "react-native";
import { CategoryIcon } from "@/components/CategoryIcon";
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
        {/* Quiet jar — flat lid, no wood */}
        <View style={{ width: 52, alignItems: "center", gap: 5 }}>
          {/* flat neutral lid */}
          <View
            style={{
              width: 32,
              height: 7,
              borderRadius: 3,
              backgroundColor: C.surface,
              borderWidth: 1,
              borderColor: C.border,
              marginBottom: -3,
              zIndex: 1,
            }}
          />
          <View
            style={{
              width: 44,
              height: 54,
              borderRadius: 10,
              borderTopLeftRadius: 6,
              borderTopRightRadius: 6,
              borderWidth: 1,
              borderColor: C.border,
              backgroundColor: C.background,
              overflow: "hidden",
              justifyContent: "flex-end",
            }}
          >
            {/* subtle glass highlight */}
            <View
              style={{
                position: "absolute",
                left: 5,
                top: 5,
                bottom: 5,
                width: 5,
                borderRadius: 999,
                backgroundColor: C.background,
                opacity: 0.5,
              }}
            />
            {spent !== undefined ? (
              <View
                style={{
                  height: `${honeyLevel * 100}%`,
                  backgroundColor: overBudget ? C.error : C.primary,
                  opacity: overBudget ? 0.9 : 0.85,
                }}
              >
                {/* soft top edge */}
                <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.3)" }} />
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
            style={{ color: overBudget ? C.error : C.textSecondary }}
            className="text-[11px] font-medium tracking-wide"
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

          {/* Thin quiet track */}
          {spent === undefined ? (
            <View
              style={{
                height: 6,
                borderRadius: 999,
                backgroundColor: C.surface,
                borderWidth: 1,
                borderColor: C.border,
                borderStyle: "dashed",
              }}
            />
          ) : (
            <View
              style={{
                height: 6,
                borderRadius: 999,
                backgroundColor: C.surface,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${honeyLevel * 100}%`,
                  height: "100%",
                  borderRadius: 999,
                  backgroundColor: overBudget ? C.error : C.primary,
                  opacity: overBudget ? 0.9 : 0.7,
                }}
              />
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
