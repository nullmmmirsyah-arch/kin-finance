import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Text, View, Pressable } from "react-native";

type ResetStep = "email" | "code" | "password";

type Props = {
  resetStep: ResetStep;
  emailAddress: string;
  onEmailChange: (s: string) => void;
  emailError: string | null;
  code: string;
  onCodeChange: (s: string) => void;
  resetPassword: string;
  onResetPasswordChange: (s: string) => void;
  passwordError: string | null;
  error: string | null;
  isLoading: boolean;
  onSendCode: () => void;
  onResendCode: () => void;
  onVerifyCode: () => void;
  onSubmitPassword: () => void;
  onBackToEmail: () => void;
  onCancel: () => void;
};

const headings: Record<ResetStep, { title: string; subtitle: string }> = {
  email: {
    title: "Reset your password",
    subtitle: "Enter your email and we'll send a code to get you back in.",
  },
  code: {
    title: "Check your email",
    subtitle: "Enter the 6-digit code we sent to your email.",
  },
  password: {
    title: "Choose a new password",
    subtitle: "Pick something you'll remember — your family's money stays safe.",
  },
};

export function ResetFlow({
  resetStep,
  emailAddress,
  onEmailChange,
  emailError,
  code,
  onCodeChange,
  resetPassword,
  onResetPasswordChange,
  passwordError,
  error,
  isLoading,
  onSendCode,
  onResendCode,
  onVerifyCode,
  onSubmitPassword,
  onBackToEmail,
  onCancel,
}: Props) {
  return (
    <View className="w-full gap-4">
      <View className="items-center gap-2">
        <Text className="text-center text-display font-semibold text-text-primary dark:text-text-primary-dark">
          {headings[resetStep].title}
        </Text>
        <Text className="text-center text-base text-text-secondary dark:text-text-secondary-dark">
          {headings[resetStep].subtitle}
        </Text>
      </View>
      {resetStep === "email" ? (
        <>
          <Input
            label="Email"
            value={emailAddress}
            placeholder="you@example.com"
            onChangeText={onEmailChange}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="go"
            onSubmitEditing={onSendCode}
            error={emailError}
          />
          {error ? (
            <Text
              accessibilityLiveRegion="polite"
              className="text-center text-sm text-error dark:text-error-dark"
            >
              {error}
            </Text>
          ) : null}
          <Button title="Send reset code" onPress={onSendCode} loading={isLoading} />
        </>
      ) : resetStep === "code" ? (
        <>
          <Input
            label="Reset code"
            value={code}
            placeholder="123456"
            onChangeText={onCodeChange}
            keyboardType="numeric"
            autoFocus
            autoCorrect={false}
            maxLength={6}
            returnKeyType="done"
            textContentType="oneTimeCode"
            onSubmitEditing={onVerifyCode}
            error={error}
          />
          <Button title="Continue" onPress={onVerifyCode} loading={isLoading} />
          <Pressable
            onPress={onResendCode}
            accessibilityRole="button"
            className="min-h-12 items-center justify-center py-2"
          >
            <Text className="text-sm font-medium text-primary dark:text-primary-dark">
              Didn&apos;t get the code? Resend
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Input
            label="New password"
            value={resetPassword}
            placeholder="Choose a new password"
            onChangeText={onResetPasswordChange}
            secureTextEntry
            secureToggle
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={onSubmitPassword}
            error={passwordError}
          />
          {error ? (
            <Text
              accessibilityLiveRegion="polite"
              className="text-center text-sm text-error dark:text-error-dark"
            >
              {error}
            </Text>
          ) : null}
          <Button title="Save new password" onPress={onSubmitPassword} loading={isLoading} />
        </>
      )}
      <Pressable
        onPress={resetStep === "code" ? onBackToEmail : onCancel}
        accessibilityRole="button"
        className="min-h-12 items-center justify-center py-2"
      >
        <Text className="text-sm font-medium text-primary dark:text-primary-dark">
          Back
        </Text>
      </Pressable>
    </View>
  );
}
