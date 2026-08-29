import { Image, Text, View, Pressable } from "react-native";
import { useConnectivity } from "@/hooks/useConnectivity";
import { useThemeColors } from "@/constants/theme";
export function BrandedLoadingShell({ progress, label, onRetry }: { progress: number; label?: string; onRetry?: () => void }) {
  const C = useThemeColors();
  const isConnected = useConnectivity();
  const showOffline = isConnected === false;
  const displayLabel = showOffline ? "Waiting for connection…" : (label ?? `Preparing your ledger… ${Math.round(progress)}%`);
  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark px-6 gap-6">
      <Image source={require("../assets/images/splash-icon.png")} style={{ width: 200, height: 200 }} resizeMode="contain" />
      <View className="w-full max-w-xs gap-2">
        <View className="h-1 w-full rounded-full bg-border dark:bg-border-dark overflow-hidden">
          <View style={{ width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: C.primary }} className="h-full rounded-full" />
        </View>
        <Text className="text-center text-xs text-text-secondary dark:text-text-secondary-dark">{displayLabel}</Text>
        {showOffline && onRetry ? (
          <Pressable onPress={onRetry} accessibilityRole="button" className="min-h-12 items-center justify-center">
            <Text className="text-sm font-medium text-primary dark:text-primary-dark">Retry</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
// expo-splash-screen
