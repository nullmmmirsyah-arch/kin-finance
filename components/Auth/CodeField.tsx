import { Input } from "@/components/Input";
import type { TextInputProps } from "react-native";

type Props = Omit<TextInputProps, "value" | "onChange" | "onChangeText"> & {
  value: string;
  onChange: (s: string) => void;
  error: string | null;
  label?: string;
};

export function CodeField({
  value,
  onChange,
  error,
  label = "Verification code",
  onSubmitEditing,
  autoFocus = true,
  ...rest
}: Props) {
  return (
    <Input
      label={label}
      accessibilityLabel={label}
      value={value}
      placeholder="123456"
      onChangeText={onChange}
      keyboardType="numeric"
      autoFocus={autoFocus}
      autoCorrect={false}
      maxLength={6}
      returnKeyType="done"
      textContentType="oneTimeCode"
      onSubmitEditing={onSubmitEditing}
      error={error}
      {...rest}
    />
  );
}
