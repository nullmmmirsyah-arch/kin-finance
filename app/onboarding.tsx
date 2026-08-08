import { api } from "@/convex/_generated/api";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { Colors, Gradients, Shadow } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

export default function Onboarding() {
  const router = useRouter();
  const createHousehold = useMutation(api.households.create);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = name.trim().length >= 3 && !isLoading;

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
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center gap-6">
            <LinearGradient
              colors={Gradients.card}
              style={[
                Shadow.card,
                {
                  width: 200,
                  height: 200,
                  borderRadius: 100,
                  borderWidth: 1,
                  borderColor: Colors.primaryLight,
                },
              ]}
              className="items-center justify-center"
            >
              <Feather name="users" size={72} color={Colors.primary} />
            </LinearGradient>

            <View className="items-center gap-2">
              <Text className="text-center text-[28px] font-bold text-text-primary">
                Welcome to Kin Finance
              </Text>
              <Text className="text-center text-base text-text-secondary">
                Create your Household to start managing your family{"'"}s finances.
              </Text>
            </View>

            <View className="w-full gap-4">
              <Input
                value={name}
                placeholder="Household name"
                onChangeText={setName}
                maxLength={50}
                error={error}
              />
              <Button
                title="Create Household"
                onPress={handleCreate}
                loading={isLoading}
                disabled={!canSubmit}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
