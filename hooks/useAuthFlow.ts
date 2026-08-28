import { useState } from "react";
import { useSignIn, useSignUp, useSSO } from "@clerk/expo";
import * as Linking from "expo-linking";
import { setLastAuthMethod } from "@/lib/auth-preference";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_REGEX = /^\d{6}$/;

export function useAuthFlow(opts?: { onVerifySuccess?: () => void }) {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO();

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
  const [ssoSignIn, setSsoSignIn] = useState<NonNullable<
    Awaited<ReturnType<typeof startSSOFlow>>["signIn"]
  > | null>(null);
  const [ssoSetActive, setSsoSetActive] = useState<NonNullable<
    Awaited<ReturnType<typeof startSSOFlow>>["setActive"]
  > | null>(null);

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
    if (!signIn) {
      setError("Sign in is not ready. Please try again.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signIn.password({
        emailAddress: trimmedEmail,
        password,
      });
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
    if (!signUp) {
      setError("Sign up is not ready. Please try again.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signUp.password({
        emailAddress: trimmedEmail,
        password,
      });
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
    if (!CODE_REGEX.test(trimmedCode)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    if (!signUp) {
      setError("Verification is not ready. Please try again.");
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
      opts?.onVerifySuccess?.();
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetAuth = () => {
    setIsVerifying(false);
    setIsMfaVerifying(false);
    setSsoSignIn(null);
    setSsoSetActive(null);
    setCode("");
    setError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmError(null);
    try {
      void signIn?.reset?.();
    } catch {}
    try {
      void signUp?.reset?.();
    } catch {}
  };

  const handleMfaVerify = async () => {
    if (isLoading || isGoogleLoading) return;
    setError(null);
    const trimmedCode = code.trim();
    if (!CODE_REGEX.test(trimmedCode)) {
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
      if (!signIn) {
        setError("Verification is not ready. Please try again.");
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
      const {
        createdSessionId,
        setActive,
        signIn: ssoSignInResult,
        signUp: ssoSignUp,
      } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: Linking.createURL("/", { scheme: "kinfinance" }),
      });
      if (createdSessionId) {
        if (!setActive) {
          setError("Google sign in could not be completed. Please try again.");
          return;
        }
        await setActive({ session: createdSessionId });
        void setLastAuthMethod("google");
        return;
      }
      if (ssoSignInResult?.status === "needs_client_trust") {
        const emailCodeFactor = ssoSignInResult.supportedSecondFactors?.find(
          (factor) => factor.strategy === "email_code",
        );
        if (emailCodeFactor) {
          if (!setActive) {
            setError(
              "Google sign in could not be completed. Please try again.",
            );
            return;
          }
          await ssoSignInResult.prepareSecondFactor({ strategy: "email_code" });
          setSsoSignIn(ssoSignInResult);
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
            if (!setActive) {
              setError(
                "Google sign in could not be completed. Please try again.",
              );
              return;
            }
            await setActive({ session: updated.createdSessionId });
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

  return {
    emailAddress,
    setEmailAddress,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    code,
    setCode,
    isVerifying,
    setIsVerifying,
    isMfaVerifying,
    setIsMfaVerifying,
    isLoading,
    isGoogleLoading,
    error,
    setError,
    emailError,
    setEmailError,
    passwordError,
    setPasswordError,
    confirmError,
    setConfirmError,
    ssoSignIn,
    ssoSetActive,
    handleSignIn,
    handleSignUp,
    handleVerify,
    handleMfaVerify,
    handleGoogle,
    resetAuth,
  };
}
