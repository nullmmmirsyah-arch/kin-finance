import { useAuth, useSignIn, useSignUp, useSSO } from "@clerk/expo";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Radius, Shadow, useThemeColors, useThemeGradients } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { getLastAuthMethod, setLastAuthMethod } from "@/lib/auth-preference";

WebBrowser.maybeCompleteAuthSession();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function useWarmUpBrowser() {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

type Mode = "sign-in" | "sign-up";
type ResetStep = "email" | "code" | "password";
type SuccessScreen = "verify" | "reset" | null;

function Divider({ text }: { text: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-px flex-1 bg-border dark:bg-border-dark" />
      <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
        {text}
      </Text>
      <View className="h-px flex-1 bg-border dark:bg-border-dark" />
    </View>
  );
}

export default function Index() {
  useWarmUpBrowser();
  const C = useThemeColors();
  const gradients = useThemeGradients();

  const { isSignedIn } = useAuth();
  const router = useRouter();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isMfaVerifying, setIsMfaVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [ssoSignIn, setSsoSignIn] = useState<
    NonNullable<Awaited<ReturnType<typeof startSSOFlow>>["signIn"]> | null
  >(null);
  const [ssoSetActive, setSsoSetActive] = useState<
    NonNullable<Awaited<ReturnType<typeof startSSOFlow>>["setActive"]> | null
  >(null);
  const [resetStep, setResetStep] = useState<ResetStep | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [successScreen, setSuccessScreen] = useState<SuccessScreen>(null);
  const [preferred, setPreferred] = useState<"google" | "email" | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isSignedIn && !successScreen) {
      router.replace("/home");
    }
  }, [isSignedIn, router, successScreen]);

  useEffect(() => {
    void getLastAuthMethod().then((method) => {
      if (method) setPreferred(method);
    });
  }, []);

  useEffect(() => {
    if (!successScreen) return;
    const timer = setTimeout(() => setSuccessScreen(null), 1500);
    return () => clearTimeout(timer);
  }, [successScreen]);

  const handleSignIn = async () => {
    if (isLoading || isGoogleLoading) return;
    setError(null);
    setEmailError(null);
    setPasswordError(null);
    const trimmedEmail = emailAddress.trim();
    if (!trimmedEmail) {
      setEmailError("Please enter your email.");
      return;
    }
    if (!password) {
      setPasswordError("Please enter your password.");
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signIn.password({ emailAddress: trimmedEmail, password });
      if (error) {
        setError(error.message);
        return;
      }
      if (signIn.status === "complete") {
        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) {
          setError(finalizeError.message);
        } else {
          void setLastAuthMethod("email");
        }
      } else if (signIn.status === "needs_client_trust") {
        const emailCodeFactor = signIn.supportedSecondFactors?.find(
          (factor) => factor.strategy === "email_code",
        );
        if (emailCodeFactor) {
          const { error: sendError } = await signIn.mfa.sendEmailCode();
          if (sendError) {
            setError(sendError.message);
            return;
          }
          setIsMfaVerifying(true);
        } else {
          setError("No email verification method is available.");
        }
      } else {
        setError("Sign in failed. Please check your email and password.");
      }
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (isLoading || isGoogleLoading) return;
    setError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmError(null);
    const trimmedEmail = emailAddress.trim();
    if (!trimmedEmail) {
      setEmailError("Please enter your email.");
      return;
    }
    if (!password) {
      setPasswordError("Please enter your password.");
      return;
    }
    if (!confirmPassword) {
      setConfirmError("Please confirm your password.");
      return;
    }
    if (password !== confirmPassword) {
      setConfirmError("Passwords do not match.");
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signUp.password({ emailAddress: trimmedEmail, password });
      if (error) {
        setError(error.message);
        return;
      }
      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) {
        setError(sendError.message);
        return;
      }
      setIsVerifying(true);
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (isLoading || isGoogleLoading) return;
    setError(null);
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signUp.verifications.verifyEmailCode({
        code: trimmedCode,
      });
      if (error) {
        setError(error.message);
        return;
      }
      const { error: finalizeError } = await signUp.finalize();
      if (finalizeError) {
        setError(finalizeError.message);
        return;
      }
      void setLastAuthMethod("email");
      setSuccessScreen("verify");
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaVerify = async () => {
    if (isLoading || isGoogleLoading) return;
    setError(null);
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setIsLoading(true);
    try {
      if (ssoSignIn) {
        const updated = await ssoSignIn.attemptSecondFactor({
          strategy: "email_code",
          code: trimmedCode,
        });
        if (updated.status === "complete" && updated.createdSessionId) {
          if (!ssoSetActive) {
            setError("Session could not be activated. Please try again.");
            return;
          }
          await ssoSetActive({ session: updated.createdSessionId });
          void setLastAuthMethod("google");
          return;
        }
        setError("Verification is not complete. Please try again.");
        return;
      }
      const { error } = await signIn.mfa.verifyEmailCode({ code: trimmedCode });
      if (error) {
        setError(error.message);
        return;
      }
      if (signIn.status === "complete") {
        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) {
          setError(finalizeError.message);
        } else {
          void setLastAuthMethod("email");
        }
      } else {
        setError("Verification is not complete. Please try again.");
      }
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (isLoading || isGoogleLoading) return;
    setError(null);
    setIsGoogleLoading(true);
    try {
      const { createdSessionId, setActive, signIn: ssoSignIn, signUp: ssoSignUp } =
        await startSSOFlow({
          strategy: "oauth_google",
          redirectUrl: Linking.createURL("/", { scheme: "kinfinance" }),
        });
      if (createdSessionId) {
        await setActive?.({ session: createdSessionId });
        void setLastAuthMethod("google");
        return;
      }
      if (ssoSignIn?.status === "needs_client_trust") {
        const emailCodeFactor = ssoSignIn.supportedSecondFactors?.find(
          (factor) => factor.strategy === "email_code",
        );
        if (emailCodeFactor) {
          if (!setActive) {
            setError(
              "Google sign in could not be completed. Please try again.",
            );
            return;
          }
          await ssoSignIn.prepareSecondFactor({ strategy: "email_code" });
          setSsoSignIn(ssoSignIn);
          setSsoSetActive(setActive);
          setIsMfaVerifying(true);
          return;
        }
        setError("No email verification method is available.");
        return;
      }
      if (ssoSignUp?.status === "missing_requirements") {
        const missingFields = ssoSignUp.missingFields ?? [];
        const updateParams: Record<string, string> = {};
        if (missingFields.includes("password") && password) {
          updateParams.password = password;
        }
        if (Object.keys(updateParams).length > 0) {
          const updated = await ssoSignUp.update(updateParams);
          if (updated.status === "complete" && updated.createdSessionId) {
            await setActive?.({ session: updated.createdSessionId });
            void setLastAuthMethod("google");
            return;
          }
        }
        setError(
          "Google sign-up requires additional information. Please sign up with email instead.",
        );
        return;
      }
      setError("Google sign in failed. Please try again.");
    } catch {
      setError("Google sign in failed. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSendResetCode = async () => {
    if (isLoading || isGoogleLoading) return;
    setError(null);
    setEmailError(null);
    const trimmedEmail = emailAddress.trim();
    if (!trimmedEmail) {
      setEmailError("Please enter your email.");
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signIn.create({ identifier: trimmedEmail });
      if (error) {
        setError(error.message);
        return;
      }
      const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
      if (sendError) {
        setError(sendError.message);
        return;
      }
      setResetStep("code");
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    if (isLoading || isGoogleLoading) return;
    setError(null);
    setIsLoading(true);
    try {
      const { error } = await signIn.resetPasswordEmailCode.sendCode();
      if (error) {
        setError(error.message);
      }
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyResetCode = async () => {
    if (isLoading || isGoogleLoading) return;
    setError(null);
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signIn.resetPasswordEmailCode.verifyCode({
        code: trimmedCode,
      });
      if (error) {
        setError(error.message);
        return;
      }
      if (signIn.status === "needs_new_password") {
        setResetStep("password");
      } else {
        setError("We couldn't verify that code. Please try again.");
      }
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitNewPassword = async () => {
    if (isLoading || isGoogleLoading) return;
    setError(null);
    setPasswordError(null);
    if (!resetPassword) {
      setPasswordError("Please enter a new password.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signIn.resetPasswordEmailCode.submitPassword({
        password: resetPassword,
        signOutOfOtherSessions: true,
      });
      if (error) {
        setError(error.message);
        return;
      }
      if (signIn.status === "complete") {
        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) {
          setError(finalizeError.message);
          return;
        }
        void setLastAuthMethod("email");
        setSuccessScreen("reset");
      } else {
        setError("Password reset is not complete. Please try again.");
      }
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetVerification = () => {
    setCode("");
    setError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmError(null);
  };

  const backToAuth = () => {
    const wasMfa = isMfaVerifying;
    setIsMfaVerifying(false);
    setIsVerifying(false);
    if (ssoSignIn) {
      setSsoSignIn(null);
      setSsoSetActive(null);
    } else if (wasMfa) {
      void signIn.reset();
    } else {
      void signUp.reset();
    }
    resetVerification();
  };

  const startReset = () => {
    resetVerification();
    setResetStep("email");
  };

  const backToResetEmail = () => {
    setResetStep("email");
    setCode("");
    setError(null);
  };

  const cancelReset = () => {
    setResetStep(null);
    setCode("");
    setResetPassword("");
    setError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmError(null);
    void signIn.reset();
  };

  const resetHeadings: Record<ResetStep, { title: string; subtitle: string }> = {
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
      subtitle:
        "Pick something you'll remember — your family's money stays safe.",
    },
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

  const dividerEmail =
    mode === "sign-in" ? "or sign in with email" : "or sign up with email";

  const emailInputs = (
    <>
      <Input
        label="Email"
        accessibilityLabel="Email"
        value={emailAddress}
        placeholder="you@example.com"
        onChangeText={setEmailAddress}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={emailError}
      />
      <Input
        ref={passwordRef}
        label="Password"
        accessibilityLabel="Password"
        value={password}
        placeholder={
          mode === "sign-in" ? "Your password" : "Create a password"
        }
        secureTextEntry
        onChangeText={setPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={
          mode === "sign-in" ? "current-password" : "new-password"
        }
        textContentType={mode === "sign-in" ? "password" : "newPassword"}
        returnKeyType={mode === "sign-in" ? "go" : "next"}
        onSubmitEditing={
          mode === "sign-in"
            ? handleSignIn
            : () => confirmRef.current?.focus()
        }
        error={passwordError}
      />
      {mode === "sign-up" ? (
        <Input
          ref={confirmRef}
          label="Confirm password"
          accessibilityLabel="Confirm password"
          value={confirmPassword}
          placeholder="Re-enter password"
          secureTextEntry
          onChangeText={setConfirmPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={handleSignUp}
          error={confirmError}
        />
      ) : null}
      {mode === "sign-in" ? (
        <Pressable
          onPress={startReset}
          accessibilityRole="button"
          className="min-h-12 items-end justify-center"
        >
          <Text className="text-sm font-medium text-primary dark:text-primary-dark">
            Forgot password?
          </Text>
        </Pressable>
      ) : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" className="text-center text-sm text-error dark:text-error-dark">
          {error}
        </Text>
      ) : null}
    </>
  );

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-4 py-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center gap-6">
            <LinearGradient
              colors={gradients.card}
              style={[
                Shadow.card,
                {
                  width: 96,
                  height: 96,
                  borderRadius: Radius.lg,
                  borderWidth: 1,
                  borderColor: C.primaryLight,
                },
              ]}
              className="items-center justify-center"
            >
              <Feather name="home" size={40} color={C.primary} />
            </LinearGradient>

            {successScreen ? (
              <View className="w-full gap-4">
                <Text className="text-center text-display font-semibold text-text-primary dark:text-text-primary-dark">
                  {successScreen === "verify"
                    ? "You're all set"
                    : "Password updated"}
                </Text>
                <Text className="text-center text-base text-text-secondary dark:text-text-secondary-dark">
                  {successScreen === "verify"
                    ? "Welcome to your family's ledger."
                    : "Welcome back to your family's ledger."}
                </Text>
              </View>
            ) : isMfaVerifying || isVerifying ? (
              <View className="w-full gap-4">
                <View className="items-center gap-2">
                  <Text className="text-center text-display font-semibold text-text-primary dark:text-text-primary-dark">
                    {isMfaVerifying ? "A quick check" : "Check your email"}
                  </Text>
                  <Text className="text-center text-base text-text-secondary dark:text-text-secondary-dark">
                    {isMfaVerifying
                      ? "Enter the code we emailed you to keep your family's money safe."
                      : "Enter the 6-digit code we sent to your email."}
                  </Text>
                </View>
                <Input
                  label="Verification code"
                  accessibilityLabel="Verification code"
                  value={code}
                  placeholder="123456"
                  onChangeText={setCode}
                  keyboardType="numeric"
                  autoFocus
                  autoCorrect={false}
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={() =>
                    isMfaVerifying ? void handleMfaVerify() : void handleVerify()
                  }
                  error={error}
                />
                <Button
                  title="Verify"
                  onPress={isMfaVerifying ? handleMfaVerify : handleVerify}
                  loading={isLoading}
                />
                <Pressable
                  onPress={backToAuth}
                  accessibilityRole="button"
                  className="min-h-12 items-center justify-center py-2"
                >
                  <Text className="text-sm font-medium text-primary dark:text-primary-dark">
                    Back
                  </Text>
                </Pressable>
              </View>
            ) : resetStep ? (
              <View className="w-full gap-4">
                <View className="items-center gap-2">
                  <Text className="text-center text-display font-semibold text-text-primary dark:text-text-primary-dark">
                    {resetHeadings[resetStep].title}
                  </Text>
                  <Text className="text-center text-base text-text-secondary dark:text-text-secondary-dark">
                    {resetHeadings[resetStep].subtitle}
                  </Text>
                </View>
                {resetStep === "email" ? (
                  <>
                    <Input
                      label="Email"
                      accessibilityLabel="Email"
                      value={emailAddress}
                      placeholder="you@example.com"
                      onChangeText={setEmailAddress}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                      returnKeyType="go"
                      onSubmitEditing={handleSendResetCode}
                      error={emailError}
                    />
                    {error ? (
                      <Text accessibilityLiveRegion="polite" className="text-center text-sm text-error dark:text-error-dark">
                        {error}
                      </Text>
                    ) : null}
                    <Button
                      title="Send reset code"
                      onPress={handleSendResetCode}
                      loading={isLoading}
                    />
                  </>
                ) : resetStep === "code" ? (
                  <>
                    <Input
                      label="Reset code"
                      accessibilityLabel="Reset code"
                      value={code}
                      placeholder="123456"
                      onChangeText={setCode}
                      keyboardType="numeric"
                      autoFocus
                      autoCorrect={false}
                      maxLength={6}
                      returnKeyType="done"
                      onSubmitEditing={handleVerifyResetCode}
                      error={error}
                    />
                    <Button
                      title="Continue"
                      onPress={handleVerifyResetCode}
                      loading={isLoading}
                    />
                    <Pressable
                      onPress={handleResendResetCode}
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
                      accessibilityLabel="New password"
                      value={resetPassword}
                      placeholder="Choose a new password"
                      onChangeText={setResetPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="new-password"
                      textContentType="newPassword"
                      returnKeyType="done"
                      onSubmitEditing={handleSubmitNewPassword}
                      error={passwordError}
                    />
                    {error ? (
                      <Text accessibilityLiveRegion="polite" className="text-center text-sm text-error dark:text-error-dark">
                        {error}
                      </Text>
                    ) : null}
                    <Button
                      title="Save new password"
                      onPress={handleSubmitNewPassword}
                      loading={isLoading}
                    />
                  </>
                )}
                <Pressable
                  onPress={resetStep === "code" ? backToResetEmail : cancelReset}
                  accessibilityRole="button"
                  className="min-h-12 items-center justify-center py-2"
                >
                  <Text className="text-sm font-medium text-primary dark:text-primary-dark">
                    Back
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View className="w-full gap-4">
                <View className="items-center gap-2">
                  <Text className="text-center text-display font-semibold text-text-primary dark:text-text-primary-dark">
                    Kin Finance
                  </Text>
                  <Text className="text-center text-base text-text-secondary dark:text-text-secondary-dark">
                    {subtitle}
                  </Text>
                </View>

                {googlePrimary ? (
                  <>
                    {emailInputs}
                    <Button
                      title={mode === "sign-in" ? "Sign In" : "Sign Up"}
                      variant="secondary"
                      onPress={mode === "sign-in" ? handleSignIn : handleSignUp}
                      loading={isLoading}
                      disabled={isGoogleLoading}
                    />
                    <Divider text="or continue with Google" />
                    <Button
                      title="Continue with Google"
                      icon={<FontAwesome name="google" size={18} color={C.background} />}
                      badge="Last used"
                      onPress={handleGoogle}
                      loading={isGoogleLoading}
                      disabled={isLoading}
                    />
                  </>
                ) : (
                  <>
                    <Button
                      title="Continue with Google"
                      variant="secondary"
                      icon={<FontAwesome name="google" size={18} color={C.textPrimary} />}
                      onPress={handleGoogle}
                      loading={isGoogleLoading}
                      disabled={isLoading}
                    />
                    <Divider text={dividerEmail} />
                    {emailInputs}
                    <Button
                      title={mode === "sign-in" ? "Sign In" : "Sign Up"}
                      onPress={mode === "sign-in" ? handleSignIn : handleSignUp}
                      loading={isLoading}
                      disabled={isGoogleLoading}
                      badge={preferred === "email" ? "Last used" : undefined}
                    />
                  </>
                )}

                <Pressable
                  onPress={() => {
                    setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                    setError(null);
                    setEmailError(null);
                    setPasswordError(null);
                    setConfirmError(null);
                    setPassword("");
                    setConfirmPassword("");
                  }}
                  accessibilityRole="button"
                  className="min-h-12 items-center justify-center py-2"
                >
                  <Text className="text-sm font-medium text-primary dark:text-primary-dark">
                    {mode === "sign-in"
                      ? "Don't have an account? Sign up"
                      : "Already have an account? Sign in"}
                  </Text>
                </Pressable>
              </View>
            )}
            <View nativeID="clerk-captcha" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
