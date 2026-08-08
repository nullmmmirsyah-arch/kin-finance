import { useAuth, useSignIn, useSignUp, useSSO } from "@clerk/expo";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { Colors, Gradients, Radius, Shadow } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

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

export default function Index() {
  useWarmUpBrowser();

  const { isSignedIn } = useAuth();
  const router = useRouter();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isMfaVerifying, setIsMfaVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn) {
      router.replace("/home");
    }
  }, [isSignedIn, router]);

  const handleSignIn = async () => {
    setError(null);
    const trimmedEmail = emailAddress.trim();
    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
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
    setError(null);
    const trimmedEmail = emailAddress.trim();
    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
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
    setError(null);
    setIsLoading(true);
    try {
      const { error } = await signUp.verifications.verifyEmailCode({ code });
      if (error) {
        setError(error.message);
        return;
      }
      const { error: finalizeError } = await signUp.finalize();
      if (finalizeError) {
        setError(finalizeError.message);
      }
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaVerify = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { error } = await signIn.mfa.verifyEmailCode({ code });
      if (error) {
        setError(error.message);
        return;
      }
      if (signIn.status === "complete") {
        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) {
          setError(finalizeError.message);
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
    setError(null);
    setIsLoading(true);
    try {
      const { createdSessionId, setActive, signIn: ssoSignIn, signUp: ssoSignUp } =
        await startSSOFlow({
          strategy: "oauth_google",
          redirectUrl: Linking.createURL("/", { scheme: "kinfinance" }),
        });
      if (createdSessionId) {
        await setActive?.({ session: createdSessionId });
        return;
      }
      if (ssoSignIn?.status === "needs_client_trust") {
        const emailCodeFactor = ssoSignIn.supportedSecondFactors?.find(
          (factor) => factor.strategy === "email_code",
        );
        if (emailCodeFactor) {
          const { error: sendError } = await signIn.mfa.sendEmailCode();
          if (sendError) {
            setError(sendError.message);
            return;
          }
          setIsMfaVerifying(true);
          return;
        }
      }
      if (ssoSignUp?.status === "missing_requirements") {
        setIsVerifying(true);
        return;
      }
      setError("Google sign in failed. Please try again.");
    } catch {
      setError("Google sign in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetVerification = () => {
    setCode("");
    setError(null);
  };

  const backToAuth = () => {
    setIsMfaVerifying(false);
    setIsVerifying(false);
    void signUp.reset();
    resetVerification();
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center gap-6">
            <LinearGradient
              colors={Gradients.card}
              style={[
                Shadow.card,
                {
                  width: 96,
                  height: 96,
                  borderRadius: Radius.lg,
                  borderWidth: 1,
                  borderColor: Colors.primaryLight,
                },
              ]}
              className="items-center justify-center"
            >
              <Feather name="home" size={40} color={Colors.primary} />
            </LinearGradient>

            {isMfaVerifying || isVerifying ? (
              <View className="w-full gap-4">
                <View className="items-center gap-2">
                  <Text className="text-center text-[28px] font-bold text-text-primary">
                    {isMfaVerifying
                      ? "Security Check"
                      : "Check Your Email"}
                  </Text>
                  <Text className="text-center text-base text-text-secondary">
                    {isMfaVerifying
                      ? "Enter the verification code sent to your email."
                      : "Enter the verification code we sent to you."}
                  </Text>
                </View>
                <Input
                  value={code}
                  placeholder="Verification code"
                  onChangeText={setCode}
                  keyboardType="numeric"
                  error={error}
                />
                <Button
                  title="Verify"
                  onPress={isMfaVerifying ? handleMfaVerify : handleVerify}
                  loading={isLoading}
                  disabled={code.trim().length === 0}
                />
                <Pressable
                  onPress={backToAuth}
                  accessibilityRole="button"
                  className="min-h-12 items-center justify-center py-2"
                >
                  <Text className="text-sm font-medium text-primary">
                    Back
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View className="w-full gap-4">
                <View className="items-center gap-2">
                  <Text className="text-center text-[28px] font-bold text-text-primary">
                    Kin Finance
                  </Text>
                  <Text className="text-center text-base text-text-secondary">
                    {mode === "sign-in"
                      ? "Welcome back. Sign in to continue."
                      : "Create an account to get started."}
                  </Text>
                </View>
                <Input
                  value={emailAddress}
                  placeholder="Email"
                  onChangeText={setEmailAddress}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={error}
                />
                <Input
                  value={password}
                  placeholder="Password"
                  secureTextEntry
                  onChangeText={setPassword}
                />
                <Button
                  title={mode === "sign-in" ? "Sign In" : "Sign Up"}
                  onPress={mode === "sign-in" ? handleSignIn : handleSignUp}
                  loading={isLoading}
                />
                <Button
                  title="Continue with Google"
                  variant="secondary"
                  onPress={handleGoogle}
                  disabled={isLoading}
                />
                <Pressable
                  onPress={() => {
                    setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                    setError(null);
                  }}
                  accessibilityRole="button"
                  className="min-h-12 items-center justify-center py-2"
                >
                  <Text className="text-sm font-medium text-primary">
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
