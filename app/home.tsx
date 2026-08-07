import { useAuth, useUser } from "@clerk/expo";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

export default function Home() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const store = useMutation(api.users.store);
  const me = useQuery(api.users.getMe);

  useEffect(() => {
    void store();
  }, [store]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kin Finance</Text>
      <Text style={styles.subtitle}>
        Halo, {me?.email ?? user?.primaryEmailAddress?.emailAddress ?? "Pengguna"}!
      </Text>
      <Text style={styles.note}>
        {me ? `Convex: ${me.name ?? me.email ?? me._id}` : "Menyinkronkan user ke Convex..."}
      </Text>
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
