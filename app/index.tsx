import { useAuth, useSignIn, useSignUp, useSSO } from "@clerk/expo";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

WebBrowser.maybeCompleteAuthSession();

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn) {
      router.replace("/home");
    }
  }, [isSignedIn, router]);

  const handleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { error } = await signIn.password({ emailAddress, password });
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
        setError("Verifikasi keamanan sedang diproses...");
      } else {
        setError("Masuk gagal. Periksa kembali email dan password.");
      }
    } catch {
      setError("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { error } = await signUp.password({ emailAddress, password });
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
      setError("Terjadi kesalahan jaringan. Coba lagi.");
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
      setError("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: Linking.createURL("/", { scheme: "kinfinance" }),
      });
      if (createdSessionId) {
        await setActive?.({ session: createdSessionId });
      }
    } catch {
      setError("Login Google gagal. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Masukkan kode verifikasi</Text>
        <TextInput
          style={styles.input}
          value={code}
          placeholder="Kode verifikasi"
          onChangeText={setCode}
          keyboardType="numeric"
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Button
          title="Verifikasi"
          onPress={handleVerify}
          disabled={isLoading}
        />
        <Text
          style={styles.link}
          onPress={() => {
            void signUp.reset();
            setIsVerifying(false);
            setCode("");
            setError(null);
          }}
        >
          Kembali
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kin Finance</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        value={emailAddress}
        placeholder="Email"
        onChangeText={setEmailAddress}
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        value={password}
        placeholder="Password"
        secureTextEntry
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {isLoading ? (
        <ActivityIndicator size="large" />
      ) : (
        <>
          <Button
            title={mode === "sign-in" ? "Masuk" : "Daftar"}
            onPress={mode === "sign-in" ? handleSignIn : handleSignUp}
          />
          <Button title="Lanjut dengan Google" onPress={handleGoogle} />
          <Text
            style={styles.link}
            onPress={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setError(null);
            }}
          >
            {mode === "sign-in"
              ? "Belum punya akun? Daftar"
              : "Sudah punya akun? Masuk"}
          </Text>
        </>
      )}
      <View nativeID="clerk-captcha" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  error: {
    color: "#d32f2f",
    fontSize: 14,
  },
  link: {
    color: "#1e88e5",
    textAlign: "center",
    marginTop: 8,
  },
});
