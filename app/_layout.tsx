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
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  KeyboardAwareScrollView,
  KeyboardProvider,
} from "react-native-keyboard-controller";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SnackbarProvider } from "@/components/Snackbar";
import { OtaUpdater } from "@/components/OtaUpdater";
import { BrandedLoadingShell } from "@/components/BrandedLoadingShell";
import { api } from "@/convex/_generated/api";

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 300, fade: true });

cssInterop(LinearGradient, { className: "style" });
cssInterop(KeyboardAwareScrollView, {
  className: "style",
  contentContainerClassName: "contentContainerStyle",
});

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!publishableKey) {
  throw new Error("Add your Clerk Publishable Key to the .env file");
}

if (!convexUrl) {
  throw new Error("Add your Convex URL to the .env.local file");
}

const convex = new ConvexReactClient(convexUrl, {
  unsavedChangesWarning: false,
});

function RootNavigator() {
  const { isLoaded, isSignedIn } = useAuth();
  const household = useQuery(api.households.getActive);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isLoaded || household === undefined) {
      const t1 = setTimeout(() => setProgress(70), 400);
      return () => clearTimeout(t1);
    }
  }, [isLoaded, household]);

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

  if (!isLoaded || (isSignedIn && household === undefined)) {
    return <BrandedLoadingShell progress={progress} onRetry={() => {}} />;
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
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="index" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ThemeProvider>
          <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
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
  );
}
