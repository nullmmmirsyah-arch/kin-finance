import { Colors, Radius } from "@/constants/theme";
import { Text, TextInput, TextInputProps, View } from "react-native";

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
};

export function Input({ label, error, style, ...props }: Props) {
  return (
    <View className="w-full gap-1.5">
      {label ? (
        <Text className="text-sm font-medium text-text-primary">{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={Colors.textSecondary}
        style={[
          {
            borderRadius: Radius.sm,
            borderWidth: 1,
            borderColor: error ? Colors.error : Colors.border,
            backgroundColor: "#FFF",
            height: 48,
            paddingHorizontal: 16,
          },
          style,
        ]}
        className="w-full text-base text-text-primary"
        {...props}
      />
      {error ? (
        <Text className="text-sm text-error">{error}</Text>
      ) : null}
    </View>
  );
}
