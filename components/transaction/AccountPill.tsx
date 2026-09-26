import { Pressable, Text, View } from "react-native";
import { AccountIcon } from "@/components/AccountIcon";
import { Shadow, useThemeColors } from "@/constants/theme";

type AccountRef = {
  name: string;
  type: string;
  subType: string;
} | null;

type Props = {
  label: string;
  account: AccountRef;
  onPress: () => void;
  subLabel?: string | null;
  subLabelDanger?: boolean;
};

export function AccountPill({ label, account, onPress, subLabel, subLabelDanger }: Props) {
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
      <AccountIcon subType={account?.subType ?? "other"} size={20} />
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text
          numberOfLines={1}
          className="text-sm font-medium"
          style={{ color: C.textPrimary }}
        >
          {account?.name ?? label}
        </Text>
        {subLabel ? (
          <Text
            numberOfLines={1}
            className="text-xs tabular-nums"
            style={{ color: subLabelDanger ? C.error : C.textSecondary }}
          >
            {subLabel}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
