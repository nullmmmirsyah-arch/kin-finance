import { api } from "@/convex/_generated/api";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function Onboarding() {
  const router = useRouter();
  const createHousehold = useMutation(api.households.create);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await createHousehold({ name });
      router.replace("/home");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to create household. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Kin Finance</Text>
      <Text style={styles.subtitle}>
        Create your Household to start managing your family{"'"}s finances.
      </Text>
      <TextInput
        style={styles.input}
        value={name}
        placeholder="Household name"
        onChangeText={setName}
        maxLength={50}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {isLoading ? (
        <ActivityIndicator size="large" />
      ) : (
        <Button
          title="Create Household"
          onPress={handleCreate}
          disabled={name.trim().length < 3}
        />
      )}
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
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
});
