import Feather from "@expo/vector-icons/Feather";
import { Colors, Radius, Shadow } from "@/constants/theme";
import { ACCOUNT_TYPES, AccountType } from "@/constants/accounts";
import { formatNumber } from "@/utils/format";
import { Pressable, Text, View } from "react-native";

type Props = {
  name: string;
  type: AccountType;
  balance: number;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function AccountCard({ name, type, balance, onEdit, onDelete }: Props) {
  const meta = ACCOUNT_TYPES.find((t) => t.id === type) ?? ACCOUNT_TYPES[0];

  return (
    <View
      style={[
        Shadow.card,
        {
          borderRadius: Radius.md,
          backgroundColor: Colors.background,
          borderWidth: 1,
          borderColor: Colors.border,
        },
      ]}
      className="flex-row items-center gap-3 px-4 py-4"
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: Radius.sm,
          backgroundColor: Colors.surface,
        }}
        className="items-center justify-center"
      >
        <Feather name={meta.icon} size={20} color={Colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-text-primary">{name}</Text>
        <Text className="text-sm text-text-secondary">{meta.label}</Text>
      </View>
      {onEdit !== undefined || onDelete !== undefined ? (
        <View className="flex-row items-center gap-1">
          {onEdit !== undefined ? (
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit account"
              style={{ width: 40, height: 40 }}
              className="items-center justify-center"
            >
              <Feather name="edit-2" size={18} color={Colors.primary} />
            </Pressable>
          ) : null}
          {onDelete !== undefined ? (
            <Pressable
              onPress={onDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
              style={{ width: 40, height: 40 }}
              className="items-center justify-center"
            >
              <Feather name="trash-2" size={18} color={Colors.error} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Text className="text-base font-semibold text-text-primary">
        {formatNumber(balance)}
      </Text>
    </View>
  );
}
