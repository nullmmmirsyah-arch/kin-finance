import Feather from "@expo/vector-icons/Feather";
import { Pressable, Text, View } from "react-native";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";

export function ConnectivityBanner({
  visible,
  onRetry,
}: {
  visible: boolean;
  onRetry?: () => void;
}) {
  const C = useThemeColors();
  if (!visible) return null;
  return (
    <View
      style={[
        Shadow.card,
        {
          backgroundColor: C.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: C.border,
        },
      ]}
      className="mx-5 flex-row items-center justify-between px-4 py-3"
    >
      <View className="flex-1 flex-row items-center gap-2">
        <Feather name="wifi-off" size={16} color={C.primary} />
        <Text className="flex-1 text-sm text-text-primary dark:text-text-primary-dark">
          You&apos;re offline — showing cached data
        </Text>
      </View>
      {onRetry && (
        <Pressable onPress={onRetry} className="ml-3 min-h-12 justify-center">
          <Text className="text-sm font-medium text-primary dark:text-primary-dark">Retry</Text>
        </Pressable>
      )}
    </View>
  );
}
