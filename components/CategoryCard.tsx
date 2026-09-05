import { useState } from "react";
import Feather from "@expo/vector-icons/Feather";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { CategoryType } from "@/constants/categories";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Pressable, Text, View } from "react-native";

type Props = {
  name: string;
  type: CategoryType;
  icon?: string;
  hidden: boolean;
  onToggleVisibility?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function CategoryCard({
  name,
  type,
  icon,
  hidden,
  onToggleVisibility,
  onEdit,
  onDelete,
}: Props) {
  const isIncome = type === "income";
  const C = useThemeColors();

  return (
    <View
      style={[
        Shadow.card,
        {
          borderRadius: Radius.md,
          backgroundColor: C.background,
          borderWidth: 1,
          borderColor: C.border,
        },
      ]}
      className="flex-row items-center gap-3 px-4 py-4"
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: Radius.sm,
          backgroundColor: C.surface,
        }}
        className="items-center justify-center overflow-hidden"
      >
        <CategoryIcon name={icon} size={32} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
          {name}
        </Text>
        <View className="mt-1 self-start rounded-full border border-border bg-background px-2 py-0.5 dark:border-border-dark dark:bg-background-dark">
          <Text
            className={`text-xs font-medium ${isIncome ? "text-success dark:text-success-dark" : "text-error dark:text-error-dark"}`}
          >
            {isIncome ? "Income" : "Expense"}
          </Text>
        </View>
      </View>
      {onToggleVisibility !== undefined ||
      onEdit !== undefined ||
      onDelete !== undefined ? (
        <View className="flex-row items-center gap-1">
          {onToggleVisibility !== undefined ? (
            <Pressable
              onPress={onToggleVisibility}
              accessibilityRole="button"
              accessibilityLabel={
                hidden
                  ? "Show category to members"
                  : "Hide category from members"
              }
              style={{ width: 48, height: 48 }}
              className="items-center justify-center"
            >
              <Feather
                name={hidden ? "eye-off" : "eye"}
                size={18}
                color={C.textSecondary}
              />
            </Pressable>
          ) : null}
          {onEdit !== undefined ? (
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit category"
              style={{ width: 48, height: 48 }}
              className="items-center justify-center"
            >
              <Feather name="edit-2" size={18} color={C.primary} />
            </Pressable>
          ) : null}
          {onDelete !== undefined ? (
            <Pressable
              onPress={onDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete category"
              style={{ width: 48, height: 48 }}
              className="items-center justify-center"
            >
              <Feather name="trash-2" size={18} color={C.error} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Plush variant — cat-chip style for the 2-col grid.
 * Spec: white 2.5px border radius 18px, icon 36px peach2 (#FFE9C9), name 13px 800, hidden eye-off.
 * Claymorphism via Shadow.card + useThemeColors(); no Pressable style callback.
 */
export function PlushCategoryCard({
  name,
  type,
  icon,
  hidden,
  onToggleVisibility,
  onEdit,
  onDelete,
}: Props) {
  const C = useThemeColors();
  const isDark = C.background === "#1C1917";
  const cardBg = isDark ? C.surface : "#FFFFFF";
  const creamBorder = "#FFFFFF";
  const muted = C.textSecondary;
  const [eyePressed, setEyePressed] = useState(false);
  const [editPressed, setEditPressed] = useState(false);
  const [deletePressed, setDeletePressed] = useState(false);

  return (
    <View
      testID="plush-category-card"
      accessibilityLabel={`plush-category-${name}`}
      style={[
        Shadow.card,
        {
          flex: 1,
          backgroundColor: cardBg,
          borderWidth: 2.5,
          borderColor: creamBorder,
          borderRadius: 18,
          padding: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        },
      ]}
    >
      {/* icon 36px peach2 #FFE9C9, border 2px white radius 12 */}
      <View
        testID="plush-category-icon"
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: "#FFE9C9",
          borderWidth: 2,
          borderColor: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <CategoryIcon name={icon} size={22} />
      </View>

      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        {/* name 13px 800 */}
        <Text
          numberOfLines={1}
          style={{ fontSize: 13, fontWeight: "800", color: C.textPrimary }}
        >
          {name}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontSize: 11, fontWeight: "700", color: muted }}
        >
          {type === "income" ? "Income" : "Expense"}
          {hidden ? " • hidden" : ""}
        </Text>
      </View>

      {/* hidden eye-off indicator */}
      {hidden ? (
        <View
          testID="plush-hidden"
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            backgroundColor: isDark ? C.background : "#FFF8EC",
            borderWidth: 1,
            borderColor: isDark ? C.border : "#F3E6CD",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="eye-off" size={12} color={muted} />
        </View>
      ) : null}

      {/* owner actions: eye/edit/delete mini pills */}
      {onToggleVisibility !== undefined ||
      onEdit !== undefined ||
      onDelete !== undefined ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {onToggleVisibility !== undefined ? (
            <Pressable
              onPress={onToggleVisibility}
              onPressIn={() => setEyePressed(true)}
              onPressOut={() => setEyePressed(false)}
              accessibilityRole="button"
              accessibilityLabel={hidden ? "Show category to members" : "Hide category from members"}
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: "#F3E6CD",
                backgroundColor: eyePressed ? "#FFF8EC" : cardBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name={hidden ? "eye-off" : "eye"} size={16} color={muted} />
            </Pressable>
          ) : null}
          {onEdit !== undefined ? (
            <Pressable
              onPress={onEdit}
              onPressIn={() => setEditPressed(true)}
              onPressOut={() => setEditPressed(false)}
              accessibilityRole="button"
              accessibilityLabel="Edit category"
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: "#F3E6CD",
                backgroundColor: editPressed ? "#FFF8EC" : cardBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="edit-2" size={16} color={C.primary} />
            </Pressable>
          ) : null}
          {onDelete !== undefined ? (
            <Pressable
              onPress={onDelete}
              onPressIn={() => setDeletePressed(true)}
              onPressOut={() => setDeletePressed(false)}
              accessibilityRole="button"
              accessibilityLabel="Delete category"
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: "#F3E6CD",
                backgroundColor: deletePressed ? "#FFF8EC" : cardBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="trash-2" size={16} color={C.error} />
            </Pressable>
          ) : null}
        </View>
      ) : null}


    </View>
  );
}

export const CategoryCardPlush = PlushCategoryCard;
export const PlushCategoryChip = PlushCategoryCard;
