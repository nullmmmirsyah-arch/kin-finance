import "../global.css";

import { ClerkLoaded, ClerkLoading, ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { Stack } from "expo-router";
import { cssInterop } from "nativewind";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  KeyboardAwareScrollView,
  KeyboardProvider,
} from "react-native-keyboard-controller";
import { useThemeColors } from "@/constants/theme";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SnackbarProvider } from "@/components/Snackbar";
import { OtaUpdater } from "@/components/OtaUpdater";

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
  const { isSignedIn } = useAuth();

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
  const C = useThemeColors();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ThemeProvider>
          <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
            <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
              <SnackbarProvider>
                <OtaUpdater />
                <ClerkLoading>
                  <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
                    <ActivityIndicator size="large" color={C.primary} />
                  </View>
                </ClerkLoading>
                <ClerkLoaded>
                  <RootNavigator />
                </ClerkLoaded>
              </SnackbarProvider>
            </ConvexProviderWithClerk>
          </ClerkProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
