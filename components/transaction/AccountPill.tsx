import { Pressable, Text } from "react-native";
import { AccountIcon } from "@/components/AccountIcon";
import { Shadow, useThemeColors } from "@/constants/theme";

type AccountRef = {
  name: string;
  type: string;
} | null;

type Props = {
  label: string;
  account: AccountRef;
  onPress: () => void;
};

export function AccountPill({ label, account, onPress }: Props) {
  const C = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        Shadow.card,
        {
          flex: 1,
          minWidth: 0,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: C.border,
          backgroundColor: C.background,
          paddingHorizontal: 16,
          paddingVertical: 8,
          flexDirection: "row",
          gap: 8,
          alignItems: "center",
        },
      ]}
    >
      <AccountIcon type={account?.type ?? "asset"} size={20} />
      <Text
        numberOfLines={1}
        className="flex-1 text-sm font-medium"
        style={{ color: C.textPrimary }}
      >
        {account?.name ?? label}
      </Text>
    </Pressable>
  );
}
