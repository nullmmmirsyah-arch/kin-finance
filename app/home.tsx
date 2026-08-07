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
  const workspace = useQuery(api.workspaces.getActive);
  const [syncError, setSyncError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setSyncError(null);
    try {
      await store();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Gagal menyinkronkan user.");
    }
  }, [store]);

  useEffect(() => {
    void sync();
  }, [sync]);

  useEffect(() => {
    if (workspace === null) {
      router.replace("/onboarding");
    }
  }, [workspace, router]);

  if (workspace === undefined) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (workspace === null) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kin Finance</Text>
      <Text style={styles.subtitle}>
        Halo, {me?.email ?? user?.primaryEmailAddress?.emailAddress ?? "Pengguna"}!
      </Text>
      <Text style={styles.workspace}>Workspace: {workspace.name}</Text>
      {syncError && <Text style={styles.error}>{syncError}</Text>}
      {syncError && <Button title="Coba Lagi" onPress={() => void sync()} />}
      <Button
        title="Keluar"
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
  workspace: {
    fontSize: 14,
    color: "#555",
  },
  error: {
    color: "#d32f2f",
    fontSize: 14,
  },
});