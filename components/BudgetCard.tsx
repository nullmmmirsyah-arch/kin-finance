import Feather from "@expo/vector-icons/Feather";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { Pressable, Text, View } from "react-native";
import { CategoryIcon } from "@/components/CategoryIcon";
import { LinearGradient } from "expo-linear-gradient";
import { BearFaceless } from "@/components/BearFaceless";
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

function bearVariantFromName(name: string): "papa" | "mama" | "cub" {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  const m = h % 3;
  return m === 0 ? "papa" : m === 1 ? "mama" : "cub";
}

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
  const progress =
    spent === undefined ? 0 : budgetAmount > 0 ? Math.min(spent / budgetAmount, 1) : spent > 0 ? 1 : 0;
  const pct = Math.round(progress * 100);
  const remaining = spent !== undefined ? budgetAmount - spent : budgetAmount;
  const variant = bearVariantFromName(categoryName);

  const honeyColors: [string, string] =
    spent === undefined
      ? [C.border, C.border]
      : overBudget
        ? [C.error, C.error]
        : [C.primaryLight, C.primary];

  // status pill
  const statusLabel =
    spent === undefined ? "Private" : overBudget ? "Over" : pct >= 80 ? "Almost" : "On track";
  const statusBg =
    spent === undefined
      ? C.surface
      : overBudget
        ? `${C.error}14`
        : pct >= 80
          ? C.primaryLight
          : `${C.success}14`;
  const statusColor =
    spent === undefined
      ? C.textSecondary
      : overBudget
        ? C.error
        : pct >= 80
          ? C.primary
          : C.success;

  return (
    <View
      style={[
        Shadow.card,
        {
          borderRadius: 20,
          backgroundColor: pressed ? C.surface : C.background,
          borderWidth: 1,
          borderColor: C.border,
          overflow: "hidden",
        },
      ]}
      className="gap-0"
    >
      {/* Wooden lid */}
      <View
        style={{
          height: 18,
          backgroundColor: C.pantryWood,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <View style={{ width: 36, height: 4, borderRadius: 999, backgroundColor: C.pantryWoodDark, opacity: 0.6 }} />
        <View style={{ width: 20, height: 4, borderRadius: 999, backgroundColor: C.pantryWoodDark, opacity: 0.35 }} />
        <View style={{ position: "absolute", top: -8, alignSelf: "center" }}>
          <View
            style={{
              width: 22,
              height: 10,
              borderRadius: 6,
              backgroundColor: C.pantryWoodDeep,
              borderWidth: 1,
              borderColor: C.pantryWoodDark,
            }}
          />
        </View>
      </View>
      {/* wood grain line */}
      <View style={{ height: 2, backgroundColor: C.pantryWoodDark, opacity: 0.25 }} />

      <Pressable
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`${categoryName} budget, ${spent !== undefined ? `${formatNumber(spent)} of ${formatNumber(budgetAmount)}` : "private"}`}
        className="flex-row gap-3 px-3 py-3"
      >
        {/* Jar visual */}
        <View style={{ width: 78, alignItems: "center", justifyContent: "flex-start", paddingTop: 6 }}>
          {/* Bear sitting on rim */}
          <View style={{ marginBottom: -10, zIndex: 2 }}>
            <BearFaceless size={32} variant={variant} />
          </View>
          {/* Glass jar */}
          <View
            style={{
              width: 64,
              height: 74,
              borderRadius: 14,
              borderWidth: 2,
              borderColor: C.border,
              backgroundColor: C.background,
              overflow: "hidden",
              justifyContent: "flex-end",
              shadowColor: "#000",
              shadowOpacity: 0.04,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            {/* glass highlight */}
            <View
              style={{
                position: "absolute",
                left: 6,
                top: 6,
                bottom: 6,
                width: 8,
                borderRadius: 999,
                backgroundColor: C.background,
                opacity: 0.45,
              }}
            />
            {/* honey fill */}
            {spent !== undefined ? (
              <View
                style={{
                  height: `${progress * 100}%`,
                  minHeight: progress > 0 ? 12 : 0,
                  overflow: "hidden",
                  borderBottomLeftRadius: 12,
                  borderBottomRightRadius: 12,
                }}
              >
                <LinearGradient
                  colors={honeyColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ flex: 1 }}
                >
                  {/* wave top */}
                  <View
                    style={{
                      height: 10,
                      marginTop: -1,
                      backgroundColor: "rgba(255,255,255,0.22)",
                      borderBottomLeftRadius: 999,
                      borderBottomRightRadius: 999,
                      transform: [{ scaleX: 1.2 }],
                    }}
                  />
                  {/* bubbles */}
                  {progress > 0.15 && (
                    <>
                      <View
                        style={{
                          position: "absolute",
                          right: 10,
                          top: 10,
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          backgroundColor: "rgba(255,255,255,0.45)",
                        }}
                      />
                      <View
                        style={{
                          position: "absolute",
                          right: 18,
                          top: 18,
                          width: 3,
                          height: 3,
                          borderRadius: 999,
                          backgroundColor: "rgba(255,255,255,0.35)",
                        }}
                      />
                    </>
                  )}
                </LinearGradient>
                {overBudget && (
                  <View
                    style={{
                      position: "absolute",
                      bottom: -6,
                      alignSelf: "center",
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: honeyColors[1],
                    }}
                  />
                )}
              </View>
            ) : (
              <View
                style={{
                  flex: 1,
                  backgroundColor: C.surface,
                  opacity: 0.7,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="eye-off" size={16} color={C.textSecondary} />
              </View>
            )}
            {/* jar label texture line */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 28,
                height: 1,
                backgroundColor: "rgba(0,0,0,0.06)",
              }}
            />
          </View>
          {/* wood shelf shadow under jar */}
          <View
            style={{
              marginTop: 4,
              width: 48,
              height: 4,
              borderRadius: 999,
              backgroundColor: C.pantryWood,
              opacity: 0.12,
            }}
          />
          <Text
            style={{ color: overBudget ? C.error : pct >= 80 ? C.primary : C.textSecondary }}
            className="mt-1 text-[11px] font-bold tracking-widest"
          >
            {spent === undefined ? "—" : `${pct}%`}
          </Text>
        </View>

        {/* Content */}
        <View className="flex-1 gap-2 py-1">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1 flex-row items-center gap-2">
              {categoryIcon ? (
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: Radius.sm,
                    backgroundColor: C.surface,
                    borderWidth: 1,
                    borderColor: C.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CategoryIcon name={categoryIcon} size={22} />
                </View>
              ) : null}
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Text
                    numberOfLines={1}
                    className="flex-1 text-[15px] font-semibold text-text-primary dark:text-text-primary-dark"
                  >
                    {categoryName}
                  </Text>
                  {categoryHidden ? <Feather name="eye-off" size={12} color={C.textSecondary} /> : null}
                </View>
                {/* paper label sticker */}
                <View
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 4,
                    backgroundColor: C.surface,
                    borderColor: C.border,
                    borderWidth: 1,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    transform: [{ rotate: "-0.6deg" }],
                  }}
                  className="flex-row items-center gap-1.5"
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: spent === undefined ? C.textSecondary : overBudget ? C.error : C.primary,
                    }}
                  />
                  <Text className="text-[11px] font-semibold tracking-widest text-text-secondary dark:text-text-secondary-dark">
                    {spent === undefined ? "PRIVATE JAR" : overBudget ? "OVERFLOW" : `${formatNumber(remaining)} LEFT`}
                  </Text>
                </View>
              </View>
            </View>
            <View
              style={{
                backgroundColor: statusBg,
                borderColor: overBudget ? `${C.error}22` : C.border,
                borderWidth: 1,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: statusColor }} className="text-[11px] font-bold tracking-widest">
                {statusLabel.toUpperCase()}
              </Text>
            </View>
          </View>

          <View className="flex-row items-baseline gap-1.5">
            <Text
              className={`text-sm font-semibold ${overBudget ? "text-error dark:text-error-dark" : "text-text-primary dark:text-text-primary-dark"}`}
            >
              {spent === undefined ? "—" : formatNumber(spent)}
            </Text>
            <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">/ {formatNumber(budgetAmount)}</Text>
            {spent !== undefined && !overBudget && (
              <Text className="ml-auto text-xs font-medium" style={{ color: C.success }}>
                • {(progress * 100).toFixed(0)}% filled
              </Text>
            )}
            {overBudget && (
              <Text className="ml-auto text-xs font-semibold text-error dark:text-error-dark">• {formatNumber(spent - budgetAmount)} over</Text>
            )}
          </View>

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
              <Text className="text-[9px] tracking-widest text-text-secondary dark:text-text-secondary-dark">HIDDEN • FROSTED GLASS</Text>
            </View>
          ) : (
            <View
              style={{
                height: 10,
                borderRadius: 999,
                backgroundColor: C.background,
                borderWidth: 1,
                borderColor: C.border,
                overflow: "hidden",
                padding: 2,
              }}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: 999,
                  overflow: "hidden",
                  backgroundColor: C.border,
                }}
              >
                <LinearGradient
                  colors={honeyColors as [string, string]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ width: `${progress * 100}%`, flex: 1, borderRadius: 999 }}
                />
              </View>
            </View>
          )}

          <View className="flex-row items-center gap-1 pt-1">
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit budget"
              style={{ flex: 1, height: 40, borderRadius: Radius.sm, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }}
              className="flex-row items-center justify-center gap-1.5"
            >
              <Feather name="edit-2" size={14} color={C.primary} />
              <Text className="text-xs font-semibold text-primary dark:text-primary-dark">Edit</Text>
            </Pressable>
            <Pressable
              onPress={onDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete budget"
              style={{ width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: `${C.error}0F`, borderWidth: 1, borderColor: `${C.error}22` }}
              className="items-center justify-center"
            >
              <Feather name="trash-2" size={16} color={C.error} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </View>
  );
}
