import { useCallback } from "react";
import { Radius, useThemeColors } from "@/constants/theme";
import { Text, TextInput, TextInputProps, View } from "react-native";
import { formatAmountInput } from "@/utils/format";

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  amount?: boolean;
};

export function Input({
  label,
  error,
  style,
  amount = false,
  onChangeText,
  ...props
}: Props) {
  const C = useThemeColors();
  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText?.(amount ? formatAmountInput(text) : text);
    },
    [amount, onChangeText],
  );

  return (
    <View className="w-full gap-1.5">
      {label ? (
        <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={C.textSecondary}
        style={[
          {
            borderRadius: Radius.sm,
            borderWidth: 1,
            borderColor: error ? C.error : C.border,
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
        <Text className="text-sm text-error dark:text-error-dark">{error}</Text>
      ) : null}
    </View>
  );
}
