import Feather from "@expo/vector-icons/Feather";
import { Text, View } from "react-native";
import { Shadow, useThemeColors } from "@/constants/theme";

type Props = {
  title: string;
  kicker: string;
  icon: keyof typeof Feather.glyphMap;
  accessory?: React.ReactNode;
};

/**
 * Shared screen header — canonical Accounts style (DESIGN.md micro spec).
 * 44px Shadow.card icon tile + 18px title + 11px ALL-CAPS kicker.
 */
export function ScreenHeader({ title, kicker, icon, accessory }: Props) {
  const C = useThemeColors();
  return (
    <View className="flex-row items-center gap-3">
      <View
        style={[
          Shadow.card,
          {
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: C.surface,
            borderWidth: 1,
            borderColor: C.border,
          },
        ]}
        className="items-center justify-center"
      >
        <Feather name={icon} size={20} color={C.primary} />
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-[18px] font-bold leading-6 tracking-[-0.02em] text-text-primary dark:text-text-primary-dark">
          {title}
        </Text>
        <Text className="text-[11px] font-semibold uppercase leading-3 tracking-[0.08em] text-text-secondary dark:text-text-secondary-dark">
          {kicker}
        </Text>
      </View>
      {accessory ?? null}
    </View>
  );
}
