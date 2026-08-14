import Feather from "@expo/vector-icons/Feather";
import { Pressable, Text, View } from "react-native";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { formatDateShort } from "@/utils/date";

type Props = {
  createdAt: number;
  expiresAt: number;
  onRevoke: () => void;
};

export function PendingInviteCard({ createdAt, expiresAt, onRevoke }: Props) {
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
      className="flex-row items-center justify-between px-4 py-4"
    >
      <View className="flex-1 flex-row items-center gap-3">
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: Radius.sm,
            backgroundColor: C.surface,
          }}
          className="items-center justify-center"
        >
          <Feather name="mail" size={20} color={C.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
            Pending invite
          </Text>
          <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
            Created {formatDateShort(createdAt)} · Expires{" "}
            {formatDateShort(expiresAt)}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onRevoke}
        accessibilityRole="button"
        accessibilityLabel="Revoke invite"
        className="rounded-[12px] border border-error px-3 py-2"
      >
        <Text className="text-sm font-medium text-error dark:text-error-dark">
          Revoke
        </Text>
      </Pressable>
    </View>
  );
}