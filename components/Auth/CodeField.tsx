import { Input } from "@/components/Input";

type Props = {
  value: string;
  onChange: (s: string) => void;
  error: string | null;
};

export function CodeField({ value, onChange, error }: Props) {
  return (
    <Input
      label="Verification code"
      value={value}
      placeholder="123456"
      onChangeText={onChange}
      keyboardType="numeric"
      autoFocus
      autoCorrect={false}
      maxLength={6}
      returnKeyType="done"
      textContentType="oneTimeCode"
      autoComplete="sms-otp"
      error={error}
    />
  );
}
