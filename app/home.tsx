import { useAuth, useUser } from "@clerk/expo";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

export default function Home() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const store = useMutation(api.users.store);
  const me = useQuery(api.users.getMe);
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kin Finance</Text>
      <Text style={styles.subtitle}>
        Halo, {me?.email ?? user?.primaryEmailAddress?.emailAddress ?? "Pengguna"}!
      </Text>
      <Text style={styles.note}>
        {syncError
          ? syncError
          : me
            ? `Convex: ${me.name ?? me.email ?? me._id}`
            : "Menyinkronkan user ke Convex..."}
      </Text>
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
  note: {
    fontSize: 14,
    color: "#555",
  },
});
