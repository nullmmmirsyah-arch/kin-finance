import { ClerkLoaded, ClerkLoading, ClerkProvider, Show, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

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

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ClerkLoading>
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <ActivityIndicator size="large" />
          </View>
        </ClerkLoading>
        <ClerkLoaded>
          <Show when="signed-in">
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="home" />
            </Stack>
          </Show>
          <Show when="signed-out">
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
            </Stack>
          </Show>
        </ClerkLoaded>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
