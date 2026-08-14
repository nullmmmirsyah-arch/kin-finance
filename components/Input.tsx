import { useCallback, useState, type Ref } from "react";
import { Radius, useThemeColors } from "@/constants/theme";
import { Text, TextInput, TextInputProps, View } from "react-native";
import { formatAmountInput } from "@/utils/format";

type Props = TextInputProps & {
  label?: string;
  labelBadge?: string;
  error?: string | null;
  amount?: boolean;
  ref?: Ref<TextInput>;
};

export function Input({
  label,
  labelBadge,
  error,
  style,
  amount = false,
  onChangeText,
  onFocus,
  onBlur,
  ...props
}: Props) {
  const C = useThemeColors();
  const [focused, setFocused] = useState(false);
  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText?.(amount ? formatAmountInput(text) : text);
    },
    [amount, onChangeText],
  );

  return (
    <View className="w-full gap-1.5">
      {label ? (
        <View className="flex-row items-center gap-1.5">
          <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
            {label}
          </Text>
          {labelBadge ? (
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: C.surface }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: C.primary }}
              >
                {labelBadge}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <TextInput
        placeholderTextColor={C.textSecondary}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            borderRadius: Radius.sm,
            borderWidth: 1,
            borderColor: error ? C.error : focused ? C.primary : C.border,
            backgroundColor: C.background,
            height: 48,
            paddingHorizontal: 16,
          },
          style,
        ]}
        className="w-full text-base text-text-primary dark:text-text-primary-dark"
        onChangeText={handleChangeText}
        {...props}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" className="text-sm text-error dark:text-error-dark">{error}</Text>
      ) : null}
    </View>
  );
}
