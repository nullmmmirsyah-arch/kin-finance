import Feather from "@expo/vector-icons/Feather";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { CategoryType } from "@/constants/categories";
import { Pressable, Text, View } from "react-native";

type Props = {
  name: string;
  type: CategoryType;
  hidden: boolean;
  onToggleVisibility?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function CategoryCard({
  name,
  type,
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
        className="items-center justify-center"
      >
        <Feather name="tag" size={20} color={C.primary} />
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
