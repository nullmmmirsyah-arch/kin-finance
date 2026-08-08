import Feather from "@expo/vector-icons/Feather";
import { Colors, Radius, Shadow } from "@/constants/theme";
import { ACCOUNT_TYPES, AccountType } from "@/constants/accounts";
import { formatNumber } from "@/utils/format";
import { Text, View } from "react-native";

type Props = {
  name: string;
  type: AccountType;
  balance: number;
};

export function AccountCard({ name, type, balance }: Props) {
  const meta = ACCOUNT_TYPES.find((t) => t.id === type) ?? ACCOUNT_TYPES[0];

  return (
    <View
      style={[
        Shadow.card,
        {
          borderRadius: Radius.md,
          backgroundColor: "#FFF",
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
      <Text className="text-base font-semibold text-text-primary">
        {formatNumber(balance)}
      </Text>
    </View>
  );
}
