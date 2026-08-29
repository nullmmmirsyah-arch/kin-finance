import * as Linking from "expo-linking";
import { Pressable, Text, View } from "react-native";
import { useThemeColors } from "@/constants/theme";
export function UpdateBanner({ state, progress=0, onRestart, onDismiss, downloadUrl }: { state: "downloading"|"ready"|"blocking"; progress?: number; onRestart?: ()=>void; onDismiss?: ()=>void; downloadUrl?: string }) {
  const C = useThemeColors();
  if (state==="downloading") {
    return (
      <View className="w-full bg-surface dark:bg-surface-dark px-4 py-3 gap-2 border-b border-border dark:border-border-dark">
        <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">Downloading update… {Math.round(progress)}%</Text>
        <View className="h-1 w-full rounded-full bg-border dark:bg-border-dark overflow-hidden">
          <View style={{ width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: C.primary }} className="h-full" />
        </View>
      </View>
    );
  }
  if (state==="blocking") {
    return (
      <View className="w-full bg-surface dark:bg-surface-dark px-4 py-3 gap-2 border-b border-border dark:border-border-dark">
        <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">New version available — Download</Text>
        <Pressable accessibilityRole="button" onPress={()=>{ if (downloadUrl) void Linking.openURL(downloadUrl); }} className="min-h-12 items-center justify-center rounded-lg" style={{ backgroundColor: C.primary }}>
          <Text className="text-sm font-semibold text-white">Download</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View className="w-full bg-surface dark:bg-surface-dark px-4 py-3 flex-row items-center justify-between border-b border-border dark:border-border-dark">
      <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">New update ready</Text>
      <View className="flex-row gap-2">
        <Pressable onPress={onDismiss} className="min-h-12 justify-center px-3"><Text className="text-sm font-medium text-primary dark:text-primary-dark">Later</Text></Pressable>
        <Pressable onPress={onRestart} className="min-h-12 justify-center px-3 rounded-lg" style={{ backgroundColor: C.primary }}><Text className="text-sm font-semibold text-white">Restart now</Text></Pressable>
      </View>
    </View>
  );
}
