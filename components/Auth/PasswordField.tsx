import { Input } from "@/components/Input";
import type { Ref } from "react";
import type { TextInput, TextInputProps } from "react-native";

type Props = Omit<TextInputProps, "value" | "onChange" | "onChangeText"> & {
  label?: string;
  value: string;
  onChange: (s: string) => void;
  error: string | null;
  placeholder?: string;
  ref?: Ref<TextInput>;
};

export function PasswordField({
  label = "Password",
  value,
  onChange,
  error,
  placeholder,
  onSubmitEditing,
  returnKeyType,
  autoCapitalize = "none",
  autoCorrect = false,
  autoComplete,
  textContentType,
  ...rest
}: Props) {
  return (
    <Input
      label={label}
      value={value}
      placeholder={placeholder}
      secureTextEntry
      secureToggle
      onChangeText={onChange}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      autoComplete={autoComplete}
      textContentType={textContentType}
      returnKeyType={returnKeyType}
      onSubmitEditing={onSubmitEditing}
      error={error}
      {...rest}
    />
  );
}
