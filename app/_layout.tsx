import "../global.css";

import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { cssInterop } from "nativewind";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  KeyboardAwareScrollView,
  KeyboardProvider,
} from "react-native-keyboard-controller";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SnackbarProvider } from "@/components/Snackbar";
import { OtaUpdater } from "@/components/OtaUpdater";
import { BrandedLoadingShell } from "@/components/BrandedLoadingShell";
import { hapticSuccess } from "@/lib/haptics";
import { api } from "@/convex/_generated/api";

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 300, fade: true });

cssInterop(LinearGradient, { className: "style" });
cssInterop(KeyboardAwareScrollView, {
  className: "style",
  contentContainerClassName: "contentContainerStyle",
});

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

const convex = convexUrl
  ? new ConvexReactClient(convexUrl, {
      unsavedChangesWarning: false,
    })
  : (null as unknown as ConvexReactClient);

function RootNavigator() {
  const { isLoaded, isSignedIn } = useAuth();
  const household = useQuery(api.households.getActive);
  const [progress, setProgress] = useState(0);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!isLoaded || household === undefined) {
      const t1 = setTimeout(() => setProgress(70), 400);
      return () => clearTimeout(t1);
    }
  }, [isLoaded, household, retryKey]);

  useEffect(() => {
    if (retryKey > 0) {
      setProgress(70);
    }
  }, [retryKey]);

  useEffect(() => {
    if (progress >= 70 && progress < 90 && isLoaded && household !== undefined) {
      const t = setTimeout(() => setProgress(90), 800);
      return () => clearTimeout(t);
    }
  }, [progress, isLoaded, household]);

  const ready = isLoaded && (!isSignedIn || household !== undefined);

  useEffect(() => {
    if (ready) {
      setProgress(100);
      const t = setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {});
      }, 200);
      return () => clearTimeout(t);
    }
  }, [ready]);

  useEffect(() => {
    if (isLoaded && isSignedIn && household === undefined) {
      const t = setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {});
      }, 3500);
      return () => clearTimeout(t);
    }
  }, [isLoaded, isSignedIn, household]);

  if (!isLoaded || (isSignedIn && household === undefined)) {
    return (
      <BrandedLoadingShell
        key={retryKey}
        progress={progress}
        onRetry={() => {
          setRetryKey((k) => k + 1);
          void hapticSuccess();
        }}
      />
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!isSignedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="account-form" />
        <Stack.Screen name="categories" />
        <Stack.Screen name="category-form" />
        <Stack.Screen name="transaction-form" />
        <Stack.Screen name="budget-form" />
        <Stack.Screen name="members" />
        <Stack.Screen name="household" />
        <Stack.Screen name="search" />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="index" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (!publishableKey || !convexUrl) {
      const t = setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {});
      }, 500);
      return () => clearTimeout(t);
    }
  }, []);

  if (!publishableKey || !convexUrl) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark px-6 gap-4">
            <Text className="text-center text-base font-semibold text-text-primary dark:text-text-primary-dark">
              Configuration missing
            </Text>
            <Text className="text-center text-sm text-text-secondary dark:text-text-secondary-dark">
              {!publishableKey ? "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY" : "EXPO_PUBLIC_CONVEX_URL"} is not set in EAS Environment Variables. Set it per environment (production/preview/development) in expo.dev and rebuild.
            </Text>
          </View>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <ThemeProvider>
            <ClerkProvider publishableKey={publishableKey!} tokenCache={tokenCache}>
              <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
                <SnackbarProvider>
                  <OtaUpdater />
                  <RootNavigator />
                </SnackbarProvider>
              </ConvexProviderWithClerk>
            </ClerkProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
