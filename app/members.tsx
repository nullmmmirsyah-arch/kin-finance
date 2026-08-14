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
import { getConvexErrorMessage } from "@/lib/errors";
import { Id } from "@/convex/_generated/dataModel";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { Button } from "@/components/Button";
import { Fab } from "@/components/Fab";
import { Input } from "@/components/Input";
import { MemberCard } from "@/components/MemberCard";
import { InviteCodeDisplay } from "@/components/InviteCodeDisplay";
import { EmptyState } from "@/components/EmptyState";
import { PendingInviteCard } from "@/components/PendingInviteCard";
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
  const revokeInvite = useMutation(api.invitations.revoke);
  const invites = useQuery(
    api.invitations.listActive,
    household?._id ? { householdId: household._id } : "skip",
  );
  const updateHousehold = useMutation(api.households.update);

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isOwner =
    members?.members.some(
      (m) => m.userId === me?._id && m.role === "owner",
    ) ?? false;

  const pendingInvites =
    isOwner && Array.isArray(invites) && invites.length > 0 ? invites : null;

  const pendingInvitesSection =
    pendingInvites === null ? null : (
      <View className="gap-3">
        <Text className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
          Pending Invites
        </Text>
        {pendingInvites.map((inv) => (
          <PendingInviteCard
            key={inv._id}
            createdAt={inv.createdAt}
            expiresAt={inv.expiresAt}
            onRevoke={() => handleRevoke(inv._id)}
          />
        ))}
      </View>
    );

  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateCode = useCallback(async () => {
    if (isGenerating) return;
    setError(null);
    setIsGenerating(true);
    try {
      const result = await createInvite();
      setInviteCode(result.code);
      setScreen("invite");
    } catch (e: any) {
      setError(getConvexErrorMessage(e, "Failed to generate invite code."));
    } finally {
      setIsGenerating(false);
    }
  }, [createInvite, isGenerating]);

  const handleRevoke = useCallback(
    (invitationId: Id<"invitations">) => {
      Alert.alert(
        "Revoke Invite",
        "Revoke this invite code? Anyone with this code will no longer be able to join.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Revoke",
            style: "destructive",
            onPress: async () => {
              try {
                await revokeInvite({ invitationId });
                show("Invite revoked");
              } catch (e: any) {
                setError(getConvexErrorMessage(e, "Failed to revoke invite."));
              }
            },
          },
        ],
      );
    },
    [revokeInvite, show],
  );

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
                setError(getConvexErrorMessage(e, "Failed to remove member."));
              }
            },
          },
        ],
      );
    },
    [household, removeMember, show],
  );

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
      setRenameError(getConvexErrorMessage(e, "Failed to rename household."));
    } finally {
      setIsSaving(false);
    }
  };

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
    household === undefined ||
    me === undefined
  ) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color={C.primary} />
      </SafeAreaView>
    );
  }

  if (household === null) {
    router.replace("/onboarding");
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

      <View className="mt-4 px-5">
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
                <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
                  Household name
                </Text>
                <Text className="mt-0.5 text-base font-semibold text-text-primary dark:text-text-primary-dark">
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

      {members.members.length === 1 ? (
        <View className="mt-6 flex-1 px-5">
          {pendingInvitesSection ? (
            <View className="mb-4">{pendingInvitesSection}</View>
          ) : null}
          <View
            style={{ backgroundColor: C.background }}
            className="flex-1 rounded-[16px]"
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
          ListHeaderComponent={pendingInvitesSection ?? undefined}
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

      {isOwner && (
        <Fab
          label="Generate Invite"
          onPress={handleGenerateCode}
          accessibilityLabel="Generate invite code"
        />
      )}
    </SafeAreaView>
  );
}
