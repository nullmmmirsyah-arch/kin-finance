import Feather from "@expo/vector-icons/Feather";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { ThemePreference, useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/Button";
import { Skeleton } from "@/components/Skeleton";
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

export default function Settings() {
  const { preference, setPreference } = useTheme();
  const router = useRouter();
  const C = useThemeColors();

  const household = useQuery(api.households.getActive);
  const mine = useQuery(api.households.listMine);
  const switchActive = useMutation(api.households.switchActive);
  const [switchingId, setSwitchingId] = useState<Id<"households"> | null>(null);

  const { signOut } = useAuth();
  const { show } = useSnackbar();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleInlineSwitch = useCallback(
    async (id: Id<"households">) => {
      if (switchingId !== null) return;
      setSwitchingId(id);
      try {
        await switchActive({ householdId: id });
        void hapticSuccess();
        show("Household switched");
      } catch (e: unknown) {
        void hapticError();
        show(getConvexErrorMessage(e, "Failed to switch household."));
      } finally {
        setSwitchingId(null);
      }
    },
    [switchingId, switchActive, show],
  );

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
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
      <View className="px-5 pt-4">
        <Text className="text-[18px] font-bold leading-6 tracking-[-0.02em] text-text-primary dark:text-text-primary-dark">
          Settings
        </Text>
      </View>

      <View className="mt-6 px-5">
        <Text className="mb-2 text-[14px] font-semibold tracking-[0.02em] leading-5 text-text-secondary dark:text-text-secondary-dark">
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
                  className={`text-[14px] font-semibold tracking-[0.02em] leading-5 ${
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
        <Text className="mb-2 text-[14px] font-semibold tracking-[0.02em] leading-5 text-text-secondary dark:text-text-secondary-dark">
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
            <Text className="text-[16px] font-semibold tracking-[-0.01em] leading-5 text-text-primary dark:text-text-primary-dark">
              Categories
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={C.textSecondary} />
        </Pressable>
      </View>

      <View className="mt-6 px-5">
        <Text className="mb-2 text-[14px] font-semibold tracking-[0.02em] leading-5 text-text-secondary dark:text-text-secondary-dark">
          Households
        </Text>
        <View
          style={[
            Shadow.card,
            {
              borderRadius: Radius.md,
              backgroundColor: C.background,
              borderWidth: 1,
              borderColor: C.border,
            },
          ]}
          className="gap-3 px-4 py-4"
        >
          {mine === undefined ? (
            <>
              <Skeleton style={{ height: 56, borderRadius: Radius.md }} />
              <Skeleton style={{ height: 56, borderRadius: Radius.md }} />
            </>
          ) : (
            mine.map(({ household: h, role, isActive }) => (
              <Pressable
                key={h._id}
                onPress={() => router.push(`/members?householdId=${h._id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${h.name}${isActive ? ", active household" : ""}`}
                className="flex-row items-center gap-3"
              >
                <View className="flex-1">
                  <Text className="text-[16px] font-semibold tracking-[-0.01em] leading-5 text-text-primary dark:text-text-primary-dark">
                    {h.name}
                  </Text>
                  <Text className="text-[13px] leading-4 tracking-wide text-text-secondary dark:text-text-secondary-dark">
                    {role === "owner" ? "Owner" : "Member"}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  {isActive ? (
                    <View style={{ backgroundColor: `${C.primary}14`, borderRadius: 999 }} className="px-2.5 py-1">
                      <Text className="text-[11px] font-semibold tracking-[0.08em] leading-none" style={{ color: C.primary }}>
                        Active
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => void handleInlineSwitch(h._id)}
                      disabled={switchingId !== null}
                      accessibilityRole="button"
                      accessibilityLabel={`Set ${h.name} as active household`}
                      style={{ opacity: switchingId !== null ? 0.5 : 1 }}
                      className="flex-row items-center gap-1 rounded-full border border-border px-3 py-2 dark:border-border-dark"
                    >
                      {switchingId === h._id ? (
                        <ActivityIndicator size="small" color={C.primary} />
                      ) : (
                        <Feather name="check" size={14} color={C.primary} />
                      )}
                      <Text className="text-[12px] font-semibold tracking-[0.02em] text-primary dark:text-primary-dark">
                        Set active
                      </Text>
                    </Pressable>
                  )}
                  <Feather name="chevron-right" size={20} color={C.textSecondary} />
                </View>
              </Pressable>
            ))
          )}
          <Button
            title="New Household"
            variant="secondary"
            onPress={() => router.push("/onboarding?mode=create&add=1")}
            icon={<Feather name="plus" size={18} color={C.primary} />}
          />
          <Button
            title="Join with Code"
            variant="secondary"
            onPress={() => router.push("/onboarding?mode=join&add=1")}
            icon={<Feather name="user-plus" size={18} color={C.primary} />}
          />
        </View>
      </View>

      <View className="mt-6 px-5">
        <Text className="mb-2 text-[14px] font-semibold tracking-[0.02em] leading-5 text-text-secondary dark:text-text-secondary-dark">
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
      </ScrollView>
    </SafeAreaView>
  );
}
