import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { Pressable, Text, View } from "react-native";
import { getCategoryIconSource } from "@/constants/categoryIcons";

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
  const overBudget = spent !== undefined && spent > budgetAmount;
  const progress =
    spent === undefined ? 0 : budgetAmount > 0 ? Math.min(spent / budgetAmount, 1) : 0;

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
      className="gap-2 px-4 py-4"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-2">
          {categoryIcon ? (
            <Image
              source={getCategoryIconSource(categoryIcon)}
              style={{ width: 24, height: 24 }}
              contentFit="contain"
            />
          ) : null}
          <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
            {categoryName}
          </Text>
          {categoryHidden ? (
            <Feather name="eye-off" size={14} color={C.textSecondary} />
          ) : null}
        </View>
        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel="Edit budget"
            style={{ width: 48, height: 48 }}
            className="items-center justify-center"
          >
            <Feather name="edit-2" size={18} color={C.primary} />
          </Pressable>
          <Pressable
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete budget"
            style={{ width: 48, height: 48 }}
            className="items-center justify-center"
          >
            <Feather name="trash-2" size={18} color={C.error} />
          </Pressable>
        </View>
      </View>

      <View className="flex-row items-end justify-between">
        <Text
          className={`text-sm ${overBudget ? "text-error dark:text-error-dark" : "text-text-secondary dark:text-text-secondary-dark"}`}
        >
          {spent === undefined ? "—" : spent.toLocaleString("en-US")} /{" "}
          {budgetAmount.toLocaleString("en-US")}
        </Text>
        {overBudget ? (
          <Text className="text-xs font-medium text-error dark:text-error-dark">
            Over budget
          </Text>
        ) : null}
      </View>

      {spent === undefined ? null : (
        <View
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: C.border,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: "100%",
              width: `${progress * 100}%`,
              backgroundColor: overBudget ? C.error : C.primary,
              borderRadius: 4,
            }}
          />
        </View>
      )}
    </View>
  );
}
