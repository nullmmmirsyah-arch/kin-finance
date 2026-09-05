import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";

type Props = {
  name: string;
  email: string;
  role: "owner" | "member";
  onRemove?: () => void;
};

export function MemberCard({ name, email, role, onRemove }: Props) {
  const C = useThemeColors();
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        Shadow.card,
        {
          borderRadius: Radius.md,
          backgroundColor: pressed ? C.surface : C.background,
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
          <Feather
            name={role === "owner" ? "shield" : "user"}
            size={20}
            color={C.primary}
          />
        </View>
        <View className="flex-1">
          <Text
            numberOfLines={1}
            style={{ fontSize: 13, fontWeight: "800", color: C.textPrimary }}
          >
            {name}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontSize: 11, fontWeight: "600", color: C.textSecondary }}
          >
            {email}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        <View
          testID="role-pill"
          style={{
            borderRadius: 999,
            backgroundColor: role === "owner" ? C.primary : "#FDE68A",
            borderWidth: 2,
            borderColor: "#FFFFFF",
          }}
          className="px-2.5 py-1"
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "800",
              color: role === "owner" ? "#FFFFFF" : C.primary,
            }}
          >
            {role === "owner" ? "Owner" : "Member"}
          </Text>
        </View>

        {onRemove && role !== "owner" ? (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel="Remove member"
            style={{ width: 48, height: 48 }}
            className="items-center justify-center"
          >
            <Feather name="x-circle" size={20} color={C.error} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}
