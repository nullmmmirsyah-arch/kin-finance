import { useState } from "react";
import { useSignIn } from "@clerk/expo";
import { setLastAuthMethod } from "@/lib/auth-preference";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_REGEX = /^\d{6}$/;

export type ResetStep = "email" | "code" | "password" | null;

export function useResetFlow(
  emailAddress: string,
  setEmailError: (s: string | null) => void,
  setPasswordError: (s: string | null) => void,
  setError: (s: string | null) => void,
) {
  const { signIn } = useSignIn();
  const [resetStep, setResetStep] = useState<ResetStep>(null);
  const [code, setCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendResetCode = async () => {
    if (isLoading) return;
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
    if (!signIn) {
      setError("Reset is not ready. Please try again.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signIn.create({ identifier: trimmedEmail });
      if (error) {
        setError(error.message);
        return;
      }
      const { error: sendError } =
        await signIn.resetPasswordEmailCode.sendCode();
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
    if (isLoading) return;
    setError(null);
    if (!signIn) {
      setError("Reset is not ready. Please try again.");
      return;
    }
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
    if (isLoading) return;
    setError(null);
    const trimmedCode = code.trim();
    if (!CODE_REGEX.test(trimmedCode)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    if (!signIn) {
      setError("Verification is not ready. Please try again.");
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
    if (isLoading) return;
    setError(null);
    setPasswordError(null);
    if (!resetPassword) {
      setPasswordError("Please enter a new password.");
      return;
    }
    if (!signIn) {
      setError("Reset is not ready. Please try again.");
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
      } else {
        setError("Password reset is not complete. Please try again.");
      }
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    resetStep,
    setResetStep,
    code,
    setCode,
    resetPassword,
    setResetPassword,
    isLoading,
    setIsLoading,
    handleSendResetCode,
    handleResendResetCode,
    handleVerifyResetCode,
    handleSubmitNewPassword,
  };
}
