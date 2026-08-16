import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/convex/_generated/api";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { ThemePreference, useTheme } from "@/components/ThemeProvider";
import { SelectField } from "@/components/SelectField";
import { TIMEZONE_OPTIONS, formatTimezoneLabel } from "@/constants/timezones";
import { useSnackbar } from "@/components/Snackbar";
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
  const { show } = useSnackbar();

  const household = useQuery(api.households.getActive);
  const me = useQuery(api.users.getMe);
  const members = useQuery(
    api.households.listMembers,
    household?._id ? { householdId: household._id } : "skip",
  );
  const updateTimezone = useMutation(api.households.updateTimezone);

  const memberCount = members?.members.length ?? 1;
  const isOwner =
    members?.members.some(
      (m) => m.userId === me?._id && m.role === "owner",
    ) ?? false;

  const handleTimezoneChange = async (timezone: string) => {
    if (!household?._id) return;
    try {
      await updateTimezone({ householdId: household._id, timezone });
      show(`Timezone set to ${formatTimezoneLabel(timezone)}`);
    } catch (e: any) {
      show(getConvexErrorMessage(e, "Failed to update timezone."));
    }
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
          onPress={() => router.push("/members")}
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
          {isOwner ? (
            <SelectField
              label="Timezone"
              placeholder="Select a timezone"
              value={household?.timezone ?? "UTC"}
              options={TIMEZONE_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
              onSelect={handleTimezoneChange}
            />
          ) : (
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
              className="px-4 py-4"
            >
              <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
                Timezone
              </Text>
              <Text className="mt-0.5 text-base font-semibold text-text-primary dark:text-text-primary-dark">
                {formatTimezoneLabel(household?.timezone ?? "UTC")}
              </Text>
              <Text className="mt-1 text-xs text-text-secondary dark:text-text-secondary-dark">
                Only the household owner can change the timezone.
              </Text>
            </View>
          )}
          <Text className="mt-1.5 text-xs text-text-secondary dark:text-text-secondary-dark">
            Calendar months and budget periods use the household timezone so every
            member sees the same dates.
          </Text>
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
    </SafeAreaView>
  );
}
