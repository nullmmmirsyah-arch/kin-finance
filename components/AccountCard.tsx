import Feather from "@expo/vector-icons/Feather";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { ACCOUNT_TYPES, AccountType } from "@/constants/accounts";
import { formatNumber } from "@/utils/format";
import { Pressable, Text, View } from "react-native";

type Props = {
  name: string;
  type: AccountType;
  balance: number;
  hidden?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function AccountCard({ name, type, balance, hidden, onEdit, onDelete }: Props) {
  const C = useThemeColors();
  const meta = ACCOUNT_TYPES.find((t) => t.id === type) ?? ACCOUNT_TYPES[0];

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
        <Feather name={meta.icon} size={20} color={C.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
          {name}
        </Text>
        <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
          {meta.label}
        </Text>
        {hidden ? (
          <View className="mt-1 self-start rounded-full border border-border bg-background px-2 py-0.5 dark:border-border-dark dark:bg-background-dark">
            <View className="flex-row items-center gap-1">
              <Feather name="eye-off" size={12} color={C.textSecondary} />
              <Text className="text-xs font-medium text-text-secondary dark:text-text-secondary-dark">
                Hidden
              </Text>
            </View>
          </View>
        ) : null}
      </View>
      {onEdit !== undefined || onDelete !== undefined ? (
        <View className="flex-row items-center gap-1">
          {onEdit !== undefined ? (
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit account"
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
              accessibilityLabel="Delete account"
              style={{ width: 48, height: 48 }}
              className="items-center justify-center"
            >
              <Feather name="trash-2" size={18} color={C.error} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
        {formatNumber(balance)}
      </Text>
    </View>
  );
}
