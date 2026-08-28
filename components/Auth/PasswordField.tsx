import { Input } from "@/components/Input";

type Props = {
  label?: string;
  value: string;
  onChange: (s: string) => void;
  error: string | null;
  placeholder?: string;
};

export function PasswordField({
  label = "Password",
  value,
  onChange,
  error,
  placeholder,
}: Props) {
  return (
    <Input
      label={label}
      value={value}
      placeholder={placeholder}
      secureTextEntry
      secureToggle
      onChangeText={onChange}
      autoCapitalize="none"
      autoCorrect={false}
      error={error}
    />
  );
}
