import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/convex/_generated/api";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useSnackbar } from "@/components/Snackbar";

export default function Settings() {
  const router = useRouter();
  const C = useThemeColors();
  const { show } = useSnackbar();

  const household = useQuery(api.households.getActive);
  const me = useQuery(api.users.getMe);
  const members = useQuery(
    api.households.listMembers,
    household?._id ? { householdId: household._id } : "skip",
  );
  const updateHousehold = useMutation(api.households.update);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isOwner =
    members?.members.some(
      (m) => m.userId === me?._id && m.role === "owner",
    ) ?? false;

  const memberCount = members?.members.length ?? 1;

  const handleStartRename = () => {
    setRenameValue(household?.name ?? "");
    setRenameError(null);
    setIsRenaming(true);
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
    setRenameError(null);
  };

  const handleSaveRename = async () => {
    setRenameError(null);
    const trimmed = renameValue.trim();
    if (trimmed.length < 3) {
      setRenameError("Household name must be at least 3 characters.");
      return;
    }
    if (trimmed.length > 50) {
      setRenameError("Household name must be at most 50 characters.");
      return;
    }
    if (!household?._id) return;

    setIsSaving(true);
    try {
      await updateHousehold({ householdId: household._id, name: trimmed });
      setIsRenaming(false);
      show("Household renamed");
    } catch (e: any) {
      setRenameError(e?.message ?? "Failed to rename household.");
    } finally {
      setIsSaving(false);
    }
  };

  if (household === undefined) {
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
          {isRenaming ? (
            <>
              <Input
                value={renameValue}
                onChangeText={setRenameValue}
                placeholder="Household name"
                maxLength={50}
                error={renameError}
              />
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button
                    title="Save"
                    onPress={handleSaveRename}
                    loading={isSaving}
                  />
                </View>
                <View className="flex-1">
                  <Button
                    title="Cancel"
                    variant="secondary"
                    onPress={handleCancelRename}
                    disabled={isSaving}
                  />
                </View>
              </View>
            </>
          ) : (
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
                  {household?.name ?? "Household"}
                </Text>
              </View>
              {isOwner ? (
                <Pressable
                  onPress={handleStartRename}
                  accessibilityRole="button"
                  accessibilityLabel="Rename household"
                  style={{ width: 48, height: 48 }}
                  className="items-center justify-center"
                >
                  <Feather name="edit-2" size={18} color={C.primary} />
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </View>

      <View className="mt-6 px-5">
        <Text className="mb-2 text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
          Household Members
        </Text>

        <Pressable
          onPress={() => router.push("/members")}
          accessibilityRole="button"
          accessibilityLabel="Members"
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
                Members
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
      </View>

      <View className="mt-6 px-5">
        <Text className="mb-2 text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
          Categories
        </Text>

        <Pressable
          onPress={() => router.push("/categories")}
          accessibilityRole="button"
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
