import { useAuth, useUser } from "@clerk/expo";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native";

export default function Home() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const store = useMutation(api.users.store);
  const me = useQuery(api.users.getMe);
  const household = useQuery(api.households.getActive);
  const [syncError, setSyncError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setSyncError(null);
    try {
      await store();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Failed to sync user.");
    }
  }, [store]);

  useEffect(() => {
    void sync();
  }, [sync]);

  useEffect(() => {
    if (household !== undefined && household === null) {
      router.replace("/onboarding");
    }
  }, [household, router]);

  if (household === undefined || household === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kin Finance</Text>
      <Text style={styles.subtitle}>
        Hello, {me?.email ?? user?.primaryEmailAddress?.emailAddress ?? "User"}!
      </Text>
      <Text style={styles.household}>Household: {household.name}</Text>
      {syncError && <Text style={styles.error}>{syncError}</Text>}
      {syncError && <Button title="Try Again" onPress={() => void sync()} />}
      <Button
        title="Sign Out"
        onPress={() => {
          void signOut();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 16,
  },
  household: {
    fontSize: 14,
    color: "#555",
  },
  error: {
    color: "#d32f2f",
    fontSize: 14,
  },
});
