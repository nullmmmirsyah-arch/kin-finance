import { useCallback, useEffect, useState } from "react";
import {
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
import { validateHouseholdName, HOUSEHOLD_NAME_MAX } from "@/constants/validation";
import { DEVICE_TIMEZONE_ID, timezonePickerOptions, timezonePickerValue, resolveTimezone, formatTimezoneLabel } from "@/constants/timezones";
import { Button } from "@/components/Button";
import { Fab } from "@/components/Fab";
import { Input } from "@/components/Input";
import { SelectField } from "@/components/SelectField";
import { InviteCodeDisplay } from "@/components/InviteCodeDisplay";
import { EmptyState } from "@/components/EmptyState";
import { PendingInviteCard } from "@/components/PendingInviteCard";
import { Skeleton } from "@/components/Skeleton";
import { useSnackbar } from "@/components/Snackbar";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { HouseholdHero, HouseholdInviteCard, HouseholdMemberRow, HouseholdBalanceMode } from "@/components/HouseholdHero";

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
  const deleteHousehold = useMutation(api.households.deleteHousehold);
  const leaveHousehold = useMutation(api.households.leaveHousehold);
  const transferOwnership = useMutation(api.households.transferOwnership);
  const invites = useQuery(
    api.invitations.listActive,
    household?._id ? { householdId: household._id } : "skip",
  );
  const updateHousehold = useMutation(api.households.update);
  const updateTimezone = useMutation(api.households.updateTimezone);
  const updateBalanceMode = useMutation(api.households.updateBalanceMode);
  const [isUpdatingBalanceMode, setIsUpdatingBalanceMode] = useState(false);
  const balanceMode = ((household as unknown as { balanceMode?: "fresh" | "carryOver" })?.balanceMode ?? "fresh") as
    | "fresh"
    | "carryOver";

  const handleBalanceModeChange = useCallback(
    async (mode: "fresh" | "carryOver") => {
      if (!household?._id || mode === balanceMode || isUpdatingBalanceMode) return;
      setIsUpdatingBalanceMode(true);
      try {
        await updateBalanceMode({ householdId: household._id, balanceMode: mode });
        void hapticSuccess();
        show(`Balance mode: ${mode === "fresh" ? "Fresh" : "Carry Over"}`);
      } catch (e: any) {
        show(getConvexErrorMessage(e, "Failed to update balance mode."));
      } finally {
        setIsUpdatingBalanceMode(false);
      }
    },
    [household, updateBalanceMode, balanceMode, isUpdatingBalanceMode, show],
  );

  const handleTimezoneSelect = useCallback(
    async (id: string) => {
      if (!household?._id) return;
      try {
        const timezone = id === DEVICE_TIMEZONE_ID ? undefined : id;
        await updateTimezone({ householdId: household._id, timezone });
        show(
          id === DEVICE_TIMEZONE_ID
            ? "Timezone set to match device"
            : `Timezone set to ${formatTimezoneLabel(timezone)}`,
        );
        void hapticSuccess();
      } catch (e: any) {
        show(getConvexErrorMessage(e, "Failed to update timezone."));
      }
    },
    [household, updateTimezone, show],
  );

  useEffect(() => {
    if (household === null) {
      router.replace("/onboarding");
    }
  }, [household, router]);

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingHousehold, setIsDeletingHousehold] = useState(false);

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

  const handleTransferOwnership = useCallback(
    (newOwner: { userId: string; name?: string }) => {
      if (!household?._id) return;
      Alert.alert("Transfer Ownership?", `Make ${newOwner.name ?? "this member"} the new owner? You will become a member.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Transfer",
          onPress: async () => {
            try {
              await transferOwnership({
                householdId: household._id,
                newOwnerUserId: newOwner.userId as Id<"users">,
              });
              void hapticSuccess();
              show(`Ownership transferred to ${newOwner.name ?? "member"}`);
            } catch (e: any) {
              void hapticError();
              show(getConvexErrorMessage(e, "Failed to transfer ownership."));
            }
          },
        },
      ]);
    },
    [household, transferOwnership, show],
  );

  const handleDeleteOrLeave = useCallback(() => {
    if (!household?._id || isDeletingHousehold) return;
    if (isOwner) {
      const memberOptions = members?.members.filter((m) => m.role !== "owner") ?? [];
      if (memberOptions.length > 0) {
        Alert.alert("Delete Household?", "Permanently delete all data for everyone, or transfer ownership to keep the household.", [
          { text: "Cancel", style: "cancel" },
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
                    } catch (e: any) {
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
          {
            text: "Transfer",
            onPress: () => {
              const buttons: any[] = [{ text: "Cancel", style: "cancel" }];
              for (const m of memberOptions) {
                buttons.push({
                  text: m.name ?? m.email ?? "Member",
                  onPress: () => handleTransferOwnership({ userId: m.userId, name: m.name }),
                });
              }
              Alert.alert("Transfer to...", "Choose new owner", buttons);
            },
          },
        ]);
      } else {
        Alert.alert("Delete Household?", "This will permanently delete all household data. This cannot be undone.", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              Alert.alert("Confirm Delete", "Are you absolutely sure?", [
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
                    } catch (e: any) {
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
        ]);
      }
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
            } catch (e: any) {
              void hapticError();
              show(getConvexErrorMessage(e, "Failed to leave household."));
            } finally {
              setIsDeletingHousehold(false);
            }
          },
        },
      ]);
    }
  }, [household, members, isOwner, isDeletingHousehold, deleteHousehold, leaveHousehold, handleTransferOwnership, router, show]);

  const handleGenerateCode = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const result = await createInvite();
      setInviteCode(result.code);
      setScreen("invite");
    } catch (e: any) {
      show(getConvexErrorMessage(e, "Failed to generate invite code."));
    } finally {
      setIsGenerating(false);
    }
  }, [createInvite, isGenerating, show]);

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
                show(getConvexErrorMessage(e, "Failed to revoke invite."));
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
                show(getConvexErrorMessage(e, "Failed to remove member."));
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
    const err = validateHouseholdName(trimmed);
    if (err) {
      setRenameError(err);
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
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        <View className="px-5 pt-4">
          <View className="flex-row items-center gap-2">
            <View style={{ width: 48, height: 48 }} />
            <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
              Household Members
            </Text>
          </View>
        </View>
        <View className="mt-4 gap-3 px-5">
          <Skeleton style={{ height: 88, borderRadius: Radius.md }} />
          <Skeleton style={{ height: 72, borderRadius: Radius.md }} />
          <Skeleton style={{ height: 72, borderRadius: Radius.md }} />
        </View>
      </SafeAreaView>
    );
  }

  if (household === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <Skeleton style={{ width: 120, height: 120, borderRadius: 999 }} />
      </SafeAreaView>
    );
  }

  const subtitle = `Created ${new Date(household.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })} • ${formatTimezoneLabel(resolveTimezone(household.timezone))}`;
  const memberCount = members.members.length;

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
            Household
          </Text>
          <View
            style={{
              marginLeft: "auto",
              backgroundColor: C.surface,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderWidth: 2,
              borderColor: "#FFFFFF",
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "800", color: C.primary }}>{memberCount} bears</Text>
          </View>
        </View>
      </View>

      <FlatList
        className="mt-4 flex-1"
        contentContainerClassName="gap-3 px-5 pb-28"
        data={members.members}
        keyExtractor={(item) => item.userId}
        ListHeaderComponent={
          <View className="gap-3">
            {/* Hero */}
            <HouseholdHero
              name={household.name ?? "Household"}
              subtitle={subtitle}
              memberCount={memberCount}
              onEdit={isOwner ? handleStartRename : undefined}
            />

            {/* Rename inline when editing */}
            {isRenaming ? (
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
                <Input
                  value={renameValue}
                  onChangeText={setRenameValue}
                  placeholder="Household name"
                  maxLength={HOUSEHOLD_NAME_MAX}
                  error={renameError}
                />
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Button title="Save" onPress={handleSaveRename} loading={isSaving} />
                  </View>
                  <View className="flex-1">
                    <Button title="Cancel" variant="secondary" onPress={handleCancelRename} disabled={isSaving} />
                  </View>
                </View>
              </View>
            ) : null}

            {/* Invite card dashed with code KIN-8A2F style */}
            {isOwner ? (
              <HouseholdInviteCard
                code={inviteCode ?? "KIN-8A2F"}
                onCopy={() => {
                  if (inviteCode) {
                    // already have code, copy is handled inside card
                  } else {
                    void handleGenerateCode();
                  }
                }}
                onRevoke={
                  pendingInvites && pendingInvites.length > 0
                    ? () => handleRevoke(pendingInvites[0]._id as Id<"invitations">)
                    : undefined
                }
              />
            ) : null}

            {/* Pending invites list if not using invite card revocation */}
            {pendingInvitesSection ? <View className="gap-3">{pendingInvitesSection}</View> : null}

            {/* Balance mode segment Fresh/Carry Owner only */}
            <View className="mt-1">
              <HouseholdBalanceMode
                mode={balanceMode}
                isOwner={isOwner}
                onChange={handleBalanceModeChange}
                isUpdating={isUpdatingBalanceMode}
              />
            </View>

            {/* Timezone */}
            <View className="mt-1">
              {isOwner ? (
                <SelectField
                  label="Timezone"
                  placeholder="Select a timezone"
                  value={timezonePickerValue(household?.timezone)}
                  options={timezonePickerOptions()}
                  onSelect={handleTimezoneSelect}
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
                  <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">Timezone</Text>
                  <Text className="mt-0.5 text-base font-semibold text-text-primary dark:text-text-primary-dark">
                    {formatTimezoneLabel(resolveTimezone(household?.timezone))}
                  </Text>
                  <Text className="mt-1 text-xs text-text-secondary dark:text-text-secondary-dark">
                    Only the household owner can change the timezone.
                  </Text>
                </View>
              )}
              <Text className="mt-1.5 text-xs text-text-secondary dark:text-text-secondary-dark">
                Calendar months and budget periods use the household timezone so every member sees the same dates. Match device follows the device timezone.
              </Text>
            </View>

            {/* Members header */}
            <View className="mt-2 flex-row items-center justify-between">
              <Text className="text-xs font-bold tracking-widest text-text-secondary dark:text-text-secondary-dark">MEMBERS</Text>
              <Text className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark">{memberCount} members</Text>
            </View>

            {/* Danger zone kept but compact */}
            <View className="mt-1">
              <Text className="mb-2 text-sm font-medium text-text-secondary dark:text-text-secondary-dark">Danger Zone</Text>
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
                    ? "Permanently delete all household data for everyone. Or transfer ownership to keep the household."
                    : "You will lose access to all household data. Your transactions will remain in the household."}
                </Text>
                <Button
                  title={isOwner ? "Delete Household" : "Leave Household"}
                  variant="danger"
                  onPress={handleDeleteOrLeave}
                  loading={isDeletingHousehold}
                  disabled={isDeletingHousehold}
                />
              </View>
            </View>

            {/* Empty state handling inside list */}
            {members.members.length === 1 && !pendingInvites ? (
              <View style={{ backgroundColor: C.background }} className="rounded-[16px]">
                <EmptyState
                  icon="users"
                  title="You're the only member"
                  description="Invite family members to manage finances together."
                  actionLabel={isOwner ? "Invite Member" : undefined}
                  onAction={isOwner ? handleGenerateCode : undefined}
                />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) =>
          members.members.length === 1 ? null : (
            <HouseholdMemberRow
              name={item.name ?? "User"}
              email={item.email ?? "No email"}
              role={item.role}
              onRemove={
                isOwner && item.role !== "owner"
                  ? () => handleRemoveMember({ userId: item.userId, name: item.name })
                  : undefined
              }
            />
          )
        }
        ListEmptyComponent={
          members.members.length > 1 ? null : undefined
        }
      />

      {isOwner && (
        <Fab label="Generate Invite" onPress={handleGenerateCode} accessibilityLabel="Generate invite code" />
      )}
    </SafeAreaView>
  );
}
