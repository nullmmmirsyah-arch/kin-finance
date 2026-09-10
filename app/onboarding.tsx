import { api } from "@/convex/_generated/api";
import { getConvexErrorMessage } from "@/lib/errors";
import { validateInviteCode, INVITE_CODE_LENGTH } from "@/constants/validation";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import {
  Alert,
  Pressable,
  Text,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { Radius, Shadow, useThemeColors, useThemeGradients } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@clerk/expo";
import { getCalendars } from "expo-localization";
import { hapticError, hapticSuccess } from "@/lib/haptics";

type Mode = "create" | "join";

const MODES: { id: Mode; label: string }[] = [
  { id: "create", label: "Create Household" },
  { id: "join", label: "Join with Code" },
];

export default function Onboarding() {
  const router = useRouter();
  const { mode: modeParam, add } = useLocalSearchParams<{ mode?: Mode; add?: string }>();
  const { signOut } = useAuth();
  const createHousehold = useMutation(api.households.create);
  const redeemInvite = useMutation(api.invitations.redeem);
  const switchActive = useMutation(api.households.switchActive);
  const [mode, setMode] = useState<Mode>(modeParam === "join" ? "join" : "create");
  const isAdd = add === "1";
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
      : validateInviteCode(trimmedCode) === null);

  const handleCreate = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const created = await createHousehold({
        name: trimmedName,
        timezone: getCalendars()[0]?.timeZone ?? "UTC",
      });
      const newId = created?._id;
      if (newId == null) {
        setError("Failed to create household. Please try again.");
        return;
      }
      if (!isAdd) {
        router.replace("/home");
        return;
      }
      const message = `Switch to ${trimmedName} now?`;
      Alert.alert("Household added", message, [
        { text: "Stay here", style: "cancel", onPress: () => router.replace("/home") },
        {
          text: "Switch",
          onPress: async () => {
            try {
              await switchActive({ householdId: newId });
              void hapticSuccess();
            } catch (e: unknown) {
              void hapticError();
              setError(getConvexErrorMessage(e, "Added, but failed to switch."));
              return;
            }
            router.replace("/home");
          },
        },
      ]);
    } catch (e: any) {
      setError(getConvexErrorMessage(e, "Failed to create household. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    setError(null);
    const err = validateInviteCode(trimmedCode);
    if (err) {
      setError(err);
      return;
    }
    setIsLoading(true);
    try {
      const joined = await redeemInvite({ code: trimmedCode });
      const newId = joined.householdId;
      if (newId == null) {
        setError("Failed to join household. Please try again.");
        return;
      }
      if (!isAdd) {
        router.replace("/home");
        return;
      }
      const message = "Switch to the new household now?";
      Alert.alert("Household added", message, [
        { text: "Stay here", style: "cancel", onPress: () => router.replace("/home") },
        {
          text: "Switch",
          onPress: async () => {
            try {
              await switchActive({ householdId: newId });
              void hapticSuccess();
            } catch (e: unknown) {
              void hapticError();
              setError(getConvexErrorMessage(e, "Added, but failed to switch."));
              return;
            }
            router.replace("/home");
          },
        },
      ]);
    } catch (e: any) {
      setError(getConvexErrorMessage(e, "Failed to join household. Please try again."));
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
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="flex-grow justify-center px-4 py-10"
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >
          <View className="items-center gap-6">
            <LinearGradient
              colors={gradients.card}
              style={[
                Shadow.card,
                {
                  width: 96,
                  height: 96,
                  borderRadius: Radius.lg,
                  borderWidth: 1,
                  borderColor: C.primaryLight,
                },
              ]}
              className="items-center justify-center"
            >
              <Feather name="users" size={40} color={C.primary} />
            </LinearGradient>

            <View className="items-center gap-2">
              <Text className="text-center text-display font-semibold text-text-primary dark:text-text-primary-dark">
                Welcome to Kin Finance
              </Text>
              <Text className="text-center text-base text-text-secondary dark:text-text-secondary-dark">
                {mode === "create"
                  ? isAdd
                    ? "Add another household — your current one stays untouched."
                    : "Create your Household to start managing your family's finances."
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
                    className={`text-[14px] font-semibold tracking-[0.02em] leading-5 ${
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
                    <Text className="text-[14px] font-semibold tracking-[0.02em] leading-5 text-text-primary dark:text-text-primary-dark">
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
                    placeholder={`Enter ${INVITE_CODE_LENGTH}-character invite code`}
                    onChangeText={(text) =>
                      setCode(text.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                    }
                    maxLength={INVITE_CODE_LENGTH}
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

            {isAdd ? null : (
            <Pressable
              onPress={() => void signOut()}
              accessibilityRole="button"
              className="min-h-12 items-center justify-center py-2"
            >
              <Text className="text-[14px] font-semibold tracking-[0.02em] leading-5 text-primary dark:text-primary-dark">
                Back to login
              </Text>
            </Pressable>
            )}
          </View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
  );
}
