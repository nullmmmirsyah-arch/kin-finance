import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import Feather from "@expo/vector-icons/Feather";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useThemeColors } from "@/constants/theme";
import { Button } from "@/components/Button";
import { MemberCard } from "@/components/MemberCard";
import { InviteCodeDisplay } from "@/components/InviteCodeDisplay";
import { EmptyState } from "@/components/EmptyState";
import { useSnackbar } from "@/components/Snackbar";

type Screen = "list" | "invite";

export default function Members() {
  const router = useRouter();
  const C = useThemeColors();
  const { show } = useSnackbar();
  const [screen, setScreen] = useState<Screen>("list");

  const household = useQuery(api.households.getActive);
  const me = useQuery(api.users.getMe);
  const members = useQuery(
    api.households.listMembers,
    household?._id ? { householdId: household._id } : "skip",
  );
  const removeMember = useMutation(api.households.removeMember);
  const createInvite = useMutation(api.invitations.create);

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner =
    members?.members.some(
      (m) => m.userId === me?._id && m.role === "owner",
    ) ?? false;

  const handleGenerateCode = useCallback(async () => {
    setError(null);
    setIsGenerating(true);
    try {
      const result = await createInvite();
      setInviteCode(result.code);
      setScreen("invite");
    } catch (e: any) {
      setError(e?.message ?? "Failed to generate invite code.");
    } finally {
      setIsGenerating(false);
    }
  }, [createInvite]);

  const handleRemoveMember = useCallback(
    (member: { userId: string; name?: string }) => {
      if (!household?._id) return;
      Alert.alert(
        "Remove Member",
        `Remove ${member.name ?? "this member"} from household? They will lose access to all household data.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await removeMember({
                  householdId: household._id,
                  userId: member.userId as Id<"users">,
                });
                show(`${member.name ?? "Member"} removed`);
              } catch (e: any) {
                setError(e?.message ?? "Failed to remove member.");
              }
            },
          },
        ],
      );
    },
    [household, removeMember, show],
  );

  if (screen === "invite" && inviteCode) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        <View className="flex-row items-center gap-2 px-5 pt-4">
          <Pressable
            onPress={() => {
              setScreen("list");
              setInviteCode(null);
            }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 48, height: 48 }}
            className="items-center justify-center"
          >
            <Feather name="arrow-left" size={22} color={C.textPrimary} />
          </Pressable>
          <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
            Invite Code
          </Text>
        </View>

        <View className="flex-1 justify-center px-6">
          <InviteCodeDisplay
            code={inviteCode}
            onDone={() => {
              setScreen("list");
              setInviteCode(null);
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (
    members === undefined ||
    members === null ||
    household === undefined
  ) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color={C.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 48, height: 48 }}
            className="items-center justify-center"
          >
            <Feather name="arrow-left" size={22} color={C.textPrimary} />
          </Pressable>
          <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
            Household Members
          </Text>
        </View>
        {error ? (
          <Text className="mt-2 text-sm text-error dark:text-error-dark">
            {error}
          </Text>
        ) : null}
      </View>

      {isOwner && (
        <View className="mt-4 px-5">
          <Button
            title={isGenerating ? "Generating..." : "Generate Invite Code"}
            onPress={handleGenerateCode}
            loading={isGenerating}
            disabled={isGenerating}
          />
        </View>
      )}

      {members.members.length === 1 ? (
        <View className="mt-6 flex-1 px-5">
          <View
            style={{ backgroundColor: C.background }}
            className="rounded-[16px]"
          >
            <EmptyState
              icon="users"
              title="You're the only member"
              description="Invite family members to manage finances together."
              actionLabel={isOwner ? "Invite Member" : undefined}
              onAction={isOwner ? handleGenerateCode : undefined}
            />
          </View>
        </View>
      ) : (
        <FlatList
          className="mt-4 flex-1"
          contentContainerClassName="gap-3 px-5 pb-28"
          data={members.members}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => (
            <MemberCard
              name={item.name ?? "User"}
              email={item.email ?? "No email"}
              role={item.role}
              onRemove={
                isOwner && item.role !== "owner"
                  ? () =>
                      handleRemoveMember({
                        userId: item.userId,
                        name: item.name,
                      })
                  : undefined
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
