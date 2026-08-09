import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Radius, Shadow } from "@/constants/theme";

export default function Settings() {
  const router = useRouter();
  const [pressed, setPressed] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-5 pt-4">
        <Text className="text-[28px] font-bold text-text-primary">Settings</Text>
      </View>

      <View className="mt-4 px-5">
        <Text className="text-sm font-medium text-text-primary">Household</Text>
        <Pressable
          onPress={() => router.push("/categories")}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          accessibilityRole="button"
          accessibilityLabel="Categories"
          style={[
            Shadow.card,
            {
              borderRadius: Radius.md,
              backgroundColor: Colors.background,
              borderWidth: 1,
              borderColor: Colors.border,
            },
            pressed ? { backgroundColor: Colors.surface } : undefined,
          ]}
          className="mt-2 flex-row items-center justify-between px-4 py-4"
        >
          <View className="flex-row items-center gap-3">
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: Radius.sm,
                backgroundColor: Colors.surface,
              }}
              className="items-center justify-center"
            >
              <Feather name="tag" size={20} color={Colors.primary} />
            </View>
            <Text className="text-base font-semibold text-text-primary">
              Categories
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
