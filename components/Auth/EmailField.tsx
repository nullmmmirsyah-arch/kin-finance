import { Input } from "@/components/Input";

type Props = {
  value: string;
  onChange: (s: string) => void;
  error: string | null;
  badge?: string;
};

export function EmailField({ value, onChange, error, badge }: Props) {
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
      error={error}
    />
  );
}
