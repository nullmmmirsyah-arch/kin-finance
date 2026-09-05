import Feather from "@expo/vector-icons/Feather";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/convex/_generated/api";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { ThemePreference, useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/Button";
import { useSnackbar } from "@/components/Snackbar";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { getConvexErrorMessage } from "@/lib/errors";

const THEME_OPTIONS: {
  id: ThemePreference;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { id: "system", label: "System", icon: "smartphone" },
  { id: "light", label: "Light", icon: "sun" },
  { id: "dark", label: "Dark", icon: "moon" },
];

const BALANCE_MODE_OPTIONS: { id: "fresh" | "carryOver"; label: string }[] = [
  { id: "fresh", label: "Fresh" },
  { id: "carryOver", label: "Carry Over" },
];

export default function Settings() {
  const { preference, setPreference } = useTheme();
  const router = useRouter();
  const C = useThemeColors();

  const household = useQuery(api.households.getActive);
  const members = useQuery(
    api.households.listMembers,
    household?._id ? { householdId: household._id } : "skip",
  );
  const me = useQuery(api.users.getMe);
  const updateBalanceMode = useMutation(api.households.updateBalanceMode);
  const deleteHousehold = useMutation(api.households.deleteHousehold);
  const leaveHousehold = useMutation(api.households.leaveHousehold);

  const memberCount = members?.members.length ?? 1;

  const { signOut } = useAuth();
  const { show } = useSnackbar();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUpdatingBalanceMode, setIsUpdatingBalanceMode] = useState(false);
  const [isDeletingHousehold, setIsDeletingHousehold] = useState(false);

  const isOwner = (() => {
    if (me === undefined || members === undefined) return undefined;
    if (me === null || members === null) return false;
    const found = members.members.find((m) => m.userId === me._id);
    return found?.role === "owner";
  })();

  const balanceMode = ((household as unknown as { balanceMode?: "fresh" | "carryOver" })?.balanceMode ?? "fresh") as
    | "fresh"
    | "carryOver";
  const balanceModeLabel = balanceMode === "fresh" ? "Fresh" : "Carry Over";

  const handleBalanceModeChange = useCallback(
    async (mode: "fresh" | "carryOver") => {
      if (!household?._id || mode === balanceMode || isUpdatingBalanceMode) return;
      setIsUpdatingBalanceMode(true);
      try {
        await updateBalanceMode({ householdId: household._id, balanceMode: mode });
        void hapticSuccess();
        show(`Balance mode: ${mode === "fresh" ? "Fresh" : "Carry Over"}`);
      } catch (e: unknown) {
        show(getConvexErrorMessage(e, "Failed to update balance mode."));
      } finally {
        setIsUpdatingBalanceMode(false);
      }
    },
    [household?._id, balanceMode, isUpdatingBalanceMode, updateBalanceMode, show],
  );

  const handleDeleteOrLeave = useCallback(() => {
    if (!household?._id || isDeletingHousehold) return;
    if (isOwner) {
      Alert.alert(
        "Delete Household?",
        "This will permanently delete all household data for everyone. This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Transfer Ownership",
            onPress: () => router.push("/members"),
          },
          {
            text: "Delete All",
            style: "destructive",
            onPress: () => {
              Alert.alert("Confirm Delete", "Are you absolutely sure? All accounts, categories, transactions, budgets and invites will be deleted.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    setIsDeletingHousehold(true);
                    try {
                      await deleteHousehold({ householdId: household._id });
                      void hapticSuccess();
                      show("Household deleted");
                      router.replace("/onboarding");
                    } catch (e: unknown) {
                      void hapticError();
                      show(getConvexErrorMessage(e, "Failed to delete household."));
                    } finally {
                      setIsDeletingHousehold(false);
                    }
                  },
                },
              ]);
            },
          },
        ],
      );
    } else {
      Alert.alert("Leave Household?", "You will lose access to all household data. Your transactions will remain in the household.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            setIsDeletingHousehold(true);
            try {
              await leaveHousehold({ householdId: household._id });
              void hapticSuccess();
              show("Left household");
              router.replace("/onboarding");
            } catch (e: unknown) {
              void hapticError();
              show(getConvexErrorMessage(e, "Failed to leave household."));
            } finally {
              setIsDeletingHousehold(false);
            }
          },
        },
      ]);
    }
  }, [household?._id, isOwner, isDeletingHousehold, deleteHousehold, leaveHousehold, router, show]);

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out?",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => {
            setIsSigningOut(true);
            signOut().catch(() => {
              setIsSigningOut(false);
              show("Unable to sign out. Please try again.");
            });
          },
        },
      ],
    );
  };

  useEffect(() => {
    if (household === null) {
      router.replace("/onboarding");
    }
  }, [household, router]);

  if (household === undefined || household === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color={C.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
          Settings
        </Text>
      </View>

      <View className="mt-6 px-5">
        <Text className="mb-2 text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
          Household
        </Text>

        <Pressable
          onPress={() => router.push("/household" as never)}
          accessibilityLabel={`${household?.name}, ${memberCount} member${memberCount === 1 ? "" : "s"}`}
          style={[
            Shadow.card,
            {
              borderRadius: Radius.md,
              backgroundColor: C.background,
              borderWidth: 1,
              borderColor: C.border,
            },
          ]}
          className="flex-row items-center justify-between px-4 py-4"
        >
          <View className="flex-row items-center gap-3">
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: Radius.sm,
                backgroundColor: C.surface,
              }}
              className="items-center justify-center"
            >
              <Feather name="users" size={20} color={C.primary} />
            </View>
            <View>
              <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
                {household?.name ?? "Household"}
              </Text>
              <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
                {memberCount === 1
                  ? "1 member"
                  : `${memberCount} members`}
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={C.textSecondary} />
        </Pressable>

        <View className="mt-3">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-xs font-medium text-text-secondary dark:text-text-secondary-dark">
              Balance Mode
            </Text>
            {isOwner === false ? (
              <View className="flex-row items-center gap-1">
                <Feather name="info" size={12} color={C.textSecondary} />
                <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">Owner only</Text>
              </View>
            ) : null}
          </View>

          {isOwner === undefined ? (
            <View className="mt-2 items-center justify-center py-3">
              <ActivityIndicator size="small" color={C.primary} />
            </View>
          ) : isOwner ? (
            <View className="mt-2 flex-row overflow-hidden rounded-[12px] border border-border dark:border-border-dark">
              {BALANCE_MODE_OPTIONS.map((option) => {
                const selected = balanceMode === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => void handleBalanceModeChange(option.id)}
                    disabled={isUpdatingBalanceMode}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Balance mode ${option.label}`}
                    style={{
                      backgroundColor: selected ? C.primary : C.background,
                      opacity: isUpdatingBalanceMode && !selected ? 0.6 : 1,
                    }}
                    className="flex-1 items-center justify-center py-3"
                  >
                    <Text
                      className={`text-sm font-medium ${
                        selected
                          ? "text-background dark:text-background-dark"
                          : "text-text-secondary dark:text-text-secondary-dark"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View
              style={{
                borderRadius: Radius.md,
                backgroundColor: C.background,
                borderWidth: 1,
                borderColor: C.border,
              }}
              className="mt-2 flex-row items-center justify-between px-4 py-3"
            >
              <View className="flex-row items-center gap-2">
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: Radius.sm,
                    backgroundColor: C.surface,
                  }}
                  className="items-center justify-center"
                >
                  <Feather name="info" size={16} color={C.primary} />
                </View>
                <View>
                  <Text className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                    {balanceModeLabel}
                  </Text>
                  <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
                    Balance per period
                  </Text>
                </View>
              </View>
              <View
                style={{ backgroundColor: C.surface, borderRadius: 999 }}
                className="px-2.5 py-1"
              >
                <Text className="text-xs font-medium" style={{ color: C.textSecondary }}>
                  Read only
                </Text>
              </View>
            </View>
          )}

          <View className="mt-1.5 flex-row items-center gap-1">
            <Feather name="info" size={12} color={C.textSecondary} />
            <Text className="flex-1 text-xs text-text-secondary dark:text-text-secondary-dark">
              {balanceMode === "fresh" ? "Each period starts fresh" : "Closing balance carries to next period"}
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-6 px-5">
        <Text className="mb-2 text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
          Appearance
        </Text>

        <View className="flex-row overflow-hidden rounded-[12px] border border-border dark:border-border-dark">
          {THEME_OPTIONS.map((option) => {
            const selected = preference === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setPreference(option.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                className="flex-1 items-center gap-1 py-3"
                style={{
                  backgroundColor: selected ? C.primary : "transparent",
                }}
              >
                <Feather
                  name={option.icon}
                  size={18}
                  color={selected ? C.background : C.textSecondary}
                />
                <Text
                  className={`text-sm font-medium ${
                    selected
                      ? "text-background dark:text-background-dark"
                      : "text-text-secondary dark:text-text-secondary-dark"
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="mt-6 px-5">
        <Text className="mb-2 text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
          Categories
        </Text>

        <Pressable
          onPress={() => router.push("/categories")}
          accessibilityLabel="Categories"
          style={[
            Shadow.card,
            {
              borderRadius: Radius.md,
              backgroundColor: C.background,
              borderWidth: 1,
              borderColor: C.border,
            },
          ]}
          className="flex-row items-center justify-between px-4 py-4"
        >
          <View className="flex-row items-center gap-3">
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: Radius.sm,
                backgroundColor: C.surface,
              }}
              className="items-center justify-center"
            >
              <Feather name="tag" size={20} color={C.primary} />
            </View>
            <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
              Categories
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={C.textSecondary} />
        </Pressable>
      </View>

      <View className="mt-6 px-5">
        <Text className="mb-2 text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
          Danger Zone
        </Text>
        <View
          style={[
            Shadow.card,
            {
              borderRadius: Radius.md,
              backgroundColor: C.background,
              borderWidth: 1,
              borderColor: C.error,
            },
          ]}
          className="gap-3 px-4 py-4"
        >
          <View className="flex-row items-center gap-2">
            <Feather name="alert-triangle" size={18} color={C.error} />
            <Text className="text-sm font-semibold" style={{ color: C.error }}>
              {isOwner ? "Delete Household" : "Leave Household"}
            </Text>
          </View>
          <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
            {isOwner
              ? "Permanently delete all household data for everyone. This cannot be undone."
              : "You will lose access to all household data. Your transactions will remain in the household."}
          </Text>
          <Button
            title={isOwner ? "Delete Household" : "Leave Household"}
            variant="danger"
            onPress={handleDeleteOrLeave}
            loading={isDeletingHousehold}
            disabled={isDeletingHousehold || isOwner === undefined}
          />
          {isOwner ? (
            <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
              To keep the household, transfer ownership in Members first.
            </Text>
          ) : null}
        </View>
      </View>

      <View className="mt-6 px-5">
        <Text className="mb-2 text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
          Account
        </Text>

        <Button
          title="Sign Out"
          variant="danger"
          onPress={handleSignOut}
          loading={isSigningOut}
          disabled={isSigningOut}
        />
      </View>
    </SafeAreaView>
  );
}
