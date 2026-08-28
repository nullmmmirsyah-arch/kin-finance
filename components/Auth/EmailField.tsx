import { Input } from "@/components/Input";
import type { Ref } from "react";
import type { TextInput, TextInputProps } from "react-native";

type Props = Omit<TextInputProps, "value" | "onChange" | "onChangeText"> & {
  value: string;
  onChange: (s: string) => void;
  error: string | null;
  badge?: string;
  ref?: Ref<TextInput>;
};

export function EmailField({
  value,
  onChange,
  error,
  badge,
  onSubmitEditing,
  returnKeyType,
  autoFocus,
  ...rest
}: Props) {
  return (
    <Input
      label="Email"
      labelBadge={badge}
      value={value}
      placeholder="you@example.com"
      onChangeText={onChange}
      keyboardType="email-address"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="email"
      textContentType="emailAddress"
      returnKeyType={returnKeyType}
      onSubmitEditing={onSubmitEditing}
      autoFocus={autoFocus}
      error={error}
      {...rest}
    />
  );
}
