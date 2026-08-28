import { Button } from "@/components/Button";
import { CodeField } from "@/components/Auth/CodeField";
import { EmailField } from "@/components/Auth/EmailField";
import { GoogleButton } from "@/components/Auth/GoogleButton";
import { PasswordField } from "@/components/Auth/PasswordField";
import { ResetFlow } from "@/components/Auth/ResetFlow";
import { useAuthFlow } from "@/hooks/useAuthFlow";
import { useResetFlow } from "@/hooks/useResetFlow";
import { getLastAuthMethod } from "@/lib/auth-preference";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { Image, Platform, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

type Mode = "sign-in" | "sign-up";
type SuccessScreen = "verify" | "reset" | null;

function Divider({ text }: { text: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-px flex-1 bg-border dark:bg-border-dark" />
      <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">{text}</Text>
      <View className="h-px flex-1 bg-border dark:bg-border-dark" />
    </View>
  );
}

export default function Index() {
  useWarmUpBrowser();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [preferred, setPreferred] = useState<"google" | "email" | null>(null);
  const [successScreen, setSuccessScreen] = useState<SuccessScreen>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const auth = useAuthFlow({ onVerifySuccess: () => setSuccessScreen("verify") });
  const reset = useResetFlow(auth.emailAddress, auth.setEmailError, auth.setPasswordError, auth.setError, {
    onResetSuccess: () => setSuccessScreen("reset"),
  });

  useEffect(() => {
    if (isSignedIn && !successScreen) router.replace("/home");
  }, [isSignedIn, router, successScreen]);

  useEffect(() => {
    void getLastAuthMethod().then((m) => {
      if (m) setPreferred(m);
    });
  }, []);

  useEffect(() => {
    if (!successScreen) return;
    const t = setTimeout(() => setSuccessScreen(null), 1500);
    return () => clearTimeout(t);
  }, [successScreen]);

  const resetVerification = () => {
    auth.setCode("");
    reset.setCode("");
    auth.setError(null);
    auth.setEmailError(null);
    auth.setPasswordError(null);
    auth.setConfirmError(null);
  };

  const backToAuth = () => {
    const wasMfa = auth.isMfaVerifying;
    auth.resetAuth();
    resetVerification();
    if (wasMfa) void auth.setIsMfaVerifying(false);
  };

  const startReset = () => {
    resetVerification();
    reset.setResetStep("email");
  };
  const backToResetEmail = () => {
    reset.setResetStep("email");
    reset.setCode("");
    auth.setError(null);
  };
  const cancelReset = () => {
    reset.resetState();
    auth.setError(null);
    auth.setEmailError(null);
    auth.setPasswordError(null);
  };

  const googlePrimary = preferred === "google";
  const subtitle =
    mode === "sign-in"
      ? googlePrimary
        ? "One tap to get back in with Google."
        : "Welcome back. Sign in to your family's ledger."
      : googlePrimary
        ? "Join in one tap with Google."
        : "Create an account and start your family's ledger.";
  const dividerEmail = mode === "sign-in" ? "or sign in with email" : "or sign up with email";

  const emailInputs = (
    <>
      <EmailField
        value={auth.emailAddress}
        onChange={auth.setEmailAddress}
        error={auth.emailError}
        badge={preferred === "email" ? "Last used" : undefined}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <PasswordField
        ref={passwordRef}
        label="Password"
        value={auth.password}
        onChange={auth.setPassword}
        error={auth.passwordError}
        placeholder={mode === "sign-in" ? "Your password" : "Create a password"}
        autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
        textContentType={mode === "sign-in" ? "password" : "newPassword"}
        returnKeyType={mode === "sign-in" ? "go" : "next"}
        onSubmitEditing={mode === "sign-in" ? auth.handleSignIn : () => confirmRef.current?.focus()}
      />
      {mode === "sign-up" ? (
        <PasswordField
          ref={confirmRef}
          label="Confirm password"
          value={auth.confirmPassword}
          onChange={auth.setConfirmPassword}
          error={auth.confirmError}
          placeholder="Re-enter password"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={auth.handleSignUp}
        />
      ) : null}
      {mode === "sign-in" ? (
        <Pressable onPress={startReset} accessibilityRole="button" className="min-h-12 items-end justify-center">
          <Text className="text-sm font-medium text-primary dark:text-primary-dark">Forgot password?</Text>
        </Pressable>
      ) : null}
      {auth.error ? (
        <Text accessibilityLiveRegion="polite" className="text-center text-sm text-error dark:text-error-dark">
          {auth.error}
        </Text>
      ) : null}
    </>
  );

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="flex-grow justify-center px-4 py-10"
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >
        <View className="items-center gap-6">
          <Image source={require("../assets/images/splash-icon.png")} style={{ width: 270, height: 270 }} resizeMode="contain" />
          {successScreen ? (
            <View className="w-full gap-4">
              <Text className="text-center text-display font-semibold text-text-primary dark:text-text-primary-dark">
                {successScreen === "verify" ? "You're all set" : "Password updated"}
              </Text>
              <Text className="text-center text-base text-text-secondary dark:text-text-secondary-dark">
                {successScreen === "verify" ? "Welcome to your family's ledger." : "Welcome back to your family's ledger."}
              </Text>
            </View>
          ) : auth.isMfaVerifying || auth.isVerifying ? (
            <View className="w-full gap-4">
              <View className="items-center gap-2">
                <Text className="text-center text-display font-semibold text-text-primary dark:text-text-primary-dark">
                  {auth.isMfaVerifying ? "A quick check" : "Check your email"}
                </Text>
                <Text className="text-center text-base text-text-secondary dark:text-text-secondary-dark">
                  {auth.isMfaVerifying ? "Enter the code we emailed you to keep your family's money safe." : "Enter the 6-digit code we sent to your email."}
                </Text>
              </View>
              <CodeField
                value={auth.code}
                onChange={auth.setCode}
                error={auth.error}
                onSubmitEditing={auth.isMfaVerifying ? auth.handleMfaVerify : auth.handleVerify}
              />
              <Button title="Verify" onPress={auth.isMfaVerifying ? auth.handleMfaVerify : auth.handleVerify} loading={auth.isLoading} />
              <Pressable onPress={backToAuth} accessibilityRole="button" className="min-h-12 items-center justify-center py-2">
                <Text className="text-sm font-medium text-primary dark:text-primary-dark">Back</Text>
              </Pressable>
            </View>
          ) : reset.resetStep ? (
            <ResetFlow
              resetStep={reset.resetStep}
              emailAddress={auth.emailAddress}
              onEmailChange={auth.setEmailAddress}
              emailError={auth.emailError}
              code={reset.code}
              onCodeChange={reset.setCode}
              resetPassword={reset.resetPassword}
              onResetPasswordChange={reset.setResetPassword}
              passwordError={auth.passwordError}
              error={auth.error}
              isLoading={reset.isLoading}
              onSendCode={reset.handleSendResetCode}
              onResendCode={reset.handleResendResetCode}
              onVerifyCode={reset.handleVerifyResetCode}
              onSubmitPassword={reset.handleSubmitNewPassword}
              onBackToEmail={backToResetEmail}
              onCancel={cancelReset}
            />
          ) : (
            <View className="w-full gap-4">
              <View className="items-center gap-2">
                <Text className="text-center text-base text-text-secondary dark:text-text-secondary-dark">{subtitle}</Text>
              </View>
              {googlePrimary ? (
                <>
                  {emailInputs}
                  <Button
                    title={mode === "sign-in" ? "Sign In" : "Sign Up"}
                    variant="secondary"
                    onPress={mode === "sign-in" ? auth.handleSignIn : auth.handleSignUp}
                    loading={auth.isLoading}
                    disabled={auth.isGoogleLoading}
                  />
                  <Divider text="or continue with Google" />
                  <GoogleButton badge="Last used" loading={auth.isGoogleLoading} disabled={auth.isLoading} onPress={auth.handleGoogle} />
                </>
              ) : (
                <>
                  <GoogleButton
                    loading={auth.isGoogleLoading}
                    disabled={auth.isLoading}
                    onPress={auth.handleGoogle}
                    variant="secondary"
                  />
                  <Divider text={dividerEmail} />
                  {emailInputs}
                  <Button
                    title={mode === "sign-in" ? "Sign In" : "Sign Up"}
                    onPress={mode === "sign-in" ? auth.handleSignIn : auth.handleSignUp}
                    loading={auth.isLoading}
                    disabled={auth.isGoogleLoading}
                  />
                </>
              )}
              <Pressable
                onPress={() => {
                  setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                  auth.setError(null);
                  auth.setEmailError(null);
                  auth.setPasswordError(null);
                  auth.setConfirmError(null);
                  auth.setPassword("");
                  auth.setConfirmPassword("");
                }}
                accessibilityRole="button"
                className="min-h-12 items-center justify-center py-2"
              >
                <Text className="text-sm font-medium text-primary dark:text-primary-dark">
                  {mode === "sign-in" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </Text>
              </Pressable>
            </View>
          )}
          <View nativeID="clerk-captcha" />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
