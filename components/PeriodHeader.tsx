import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { Radius, useThemeColors } from "@/constants/theme";

type Props = {
  label: string;
  a11yLabel: string;
  onPrev: () => void;
  onNext: () => void;
  isPrevDisabled: boolean;
  isNextDisabled: boolean;
  onOpenPicker: () => void;
  pickerA11yLabel?: string;
};

export function PeriodHeader({ label, a11yLabel, onPrev, onNext, isPrevDisabled, isNextDisabled, onOpenPicker, pickerA11yLabel = "Open month picker" }: Props) {
  const C = useThemeColors();
  const [prevPressed, setPrevPressed] = useState(false);
  const [nextPressed, setNextPressed] = useState(false);
  const [headerPressed, setHeaderPressed] = useState(false);
  const arrow = (disabled: boolean, pressed: boolean) => ({
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: pressed ? C.surface : C.background,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    opacity: disabled ? 0.35 : 1,
  });
  return (
    <View className="flex-row items-center justify-between">
      <Pressable
        onPress={onPrev}
        onPressIn={() => setPrevPressed(true)}
        onPressOut={() => setPrevPressed(false)}
        disabled={isPrevDisabled}
        accessibilityRole="button"
        accessibilityLabel="Previous period"
        accessibilityElementsHidden={isPrevDisabled}
        importantForAccessibility={isPrevDisabled ? "no-hide-descendants" : "auto"}
        style={arrow(isPrevDisabled, prevPressed)}
      >
        <Feather name="chevron-left" size={18} color={C.textSecondary} />
      </Pressable>
      <Pressable
        onPress={onOpenPicker}
        onPressIn={() => setHeaderPressed(true)}
        onPressOut={() => setHeaderPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={pickerA11yLabel}
        style={{ flex: 1, alignItems: "center", opacity: headerPressed ? 0.7 : 1 }}
        className="min-h-12 flex-row items-center justify-center gap-1 px-4"
      >
        <Text accessibilityLabel={a11yLabel} className="text-[18px] font-bold leading-6 tracking-[-0.02em] text-text-primary dark:text-text-primary-dark">
          {label}
        </Text>
        <Feather name="chevron-down" size={16} color={C.textSecondary} />
      </Pressable>
      <Pressable
        onPress={onNext}
        onPressIn={() => setNextPressed(true)}
        onPressOut={() => setNextPressed(false)}
        disabled={isNextDisabled}
        accessibilityRole="button"
        accessibilityLabel="Next period"
        accessibilityElementsHidden={isNextDisabled}
        importantForAccessibility={isNextDisabled ? "no-hide-descendants" : "auto"}
        style={arrow(isNextDisabled, nextPressed)}
      >
        <Feather name="chevron-right" size={18} color={C.textSecondary} />
      </Pressable>
    </View>
  );
}
