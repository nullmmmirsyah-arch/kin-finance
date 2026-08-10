import { api } from "@/convex/_generated/api";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useThemeColors, useThemeGradients, Shadow } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@clerk/expo";

type Mode = "create" | "join";

const MODES: { id: Mode; label: string }[] = [
  { id: "create", label: "Create Household" },
  { id: "join", label: "Join with Code" },
];

export default function Onboarding() {
  const router = useRouter();
  const { signOut } = useAuth();
  const createHousehold = useMutation(api.households.create);
  const redeemInvite = useMutation(api.invitations.redeem);
  const [mode, setMode] = useState<Mode>("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const C = useThemeColors();
  const gradients = useThemeGradients();

  const trimmedName = name.trim();
  const trimmedCode = code.trim().toUpperCase();
  const canSubmit =
    !isLoading &&
    (mode === "create"
      ? trimmedName.length >= 3
      : trimmedCode.length === 8);

  const handleCreate = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await createHousehold({ name: trimmedName });
      router.replace("/home");
    } catch (e: any) {
      setError(e?.message ?? "Failed to create household. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await redeemInvite({ code: trimmedCode });
      router.replace("/home");
    } catch (e: any) {
      setError(e?.message ?? "Failed to join household. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setError(null);
    setName("");
    setCode("");
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
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
              colors={gradients.card}
              style={[
                Shadow.card,
                {
                  width: 200,
                  height: 200,
                  borderRadius: 100,
                  borderWidth: 1,
                  borderColor: C.primaryLight,
                },
              ]}
              className="items-center justify-center"
            >
              <Feather name="users" size={72} color={C.primary} />
            </LinearGradient>

            <View className="items-center gap-2">
              <Text className="text-center text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
                Welcome to Kin Finance
              </Text>
              <Text className="text-center text-base text-text-secondary dark:text-text-secondary-dark">
                {mode === "create"
                  ? "Create your Household to start managing your family's finances."
                  : "Join an existing Household using an invite code."}
              </Text>
            </View>

            <View className="w-full flex-row rounded-[12px] border border-border dark:border-border-dark overflow-hidden">
              {MODES.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => handleModeChange(m.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === m.id }}
                  className="flex-1 items-center py-3"
                  style={{
                    backgroundColor:
                      mode === m.id ? C.primary : "transparent",
                  }}
                >
                  <Text
                    className={`text-sm font-medium ${
                      mode === m.id
                        ? "text-white"
                        : "text-text-secondary dark:text-text-secondary-dark"
                    }`}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="w-full gap-4">
              {mode === "create" ? (
                <>
                  <View className="w-full gap-2 rounded-[16px] border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark">
                    <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                      What&apos;s a Household?
                    </Text>
                    <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
                      A Household is your shared space for money. You&apos;re the Owner
                      — you can add family members later and control what they see
                      and do.
                    </Text>
                  </View>
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
                </>
              ) : (
                <>
                  <Input
                    value={code}
                    placeholder="Enter 8-character invite code"
                    onChangeText={(text) =>
                      setCode(text.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                    }
                    maxLength={8}
                    autoCapitalize="characters"
                    error={error}
                  />
                  <Button
                    title="Join Household"
                    onPress={handleJoin}
                    loading={isLoading}
                    disabled={!canSubmit}
                  />
                </>
              )}
            </View>

            <Pressable
              onPress={() => void signOut()}
              accessibilityRole="button"
              className="min-h-12 items-center justify-center py-2"
            >
              <Text className="text-sm font-medium text-primary dark:text-primary-dark">
                Back to login
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
