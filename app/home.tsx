import { useAuth, useUser } from "@clerk/expo";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { Colors, Radius, Shadow } from "@/constants/theme";
import { GradientCard } from "@/components/GradientCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";

export default function Home() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const store = useMutation(api.users.store);
  const me = useQuery(api.users.getMe);
  const household = useQuery(api.households.getActive);
  const members = useQuery(
    api.households.listMembers,
    household?._id ? { householdId: household._id } : "skip",
  );
  const [synced, setSynced] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setSyncError(null);
    try {
      await store();
      setSynced(true);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Failed to sync user.");
    }
  }, [store]);

  useEffect(() => {
    void sync();
  }, [sync]);

  useEffect(() => {
    if (synced && household !== undefined && household === null) {
      router.replace("/onboarding");
    }
  }, [synced, household, router]);

  if (!synced || household === undefined) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (syncError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <Text className="mb-4 text-center text-sm text-error">{syncError}</Text>
        <Button title="Try Again" onPress={() => void sync()} />
      </SafeAreaView>
    );
  }

  if (!household) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  const email = me?.email ?? user?.primaryEmailAddress?.emailAddress ?? "there";
  const memberCount = members?.members.length ?? 1;
  const memberLabel =
    memberCount === 1 ? "1 member" : `${memberCount} members`;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="px-5 pb-10 pt-4">
        <View className="mb-5 flex-row items-center justify-between">
          <Text className="text-xl font-semibold text-text-primary">
            Hello, {email.split("@")[0]}!
          </Text>
          <Pressable
            onPress={() => void signOut()}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => [
              {
                width: 40,
                height: 40,
                borderRadius: Radius.sm,
                backgroundColor: pressed ? Colors.surface : "transparent",
              },
            ]}
            className="items-center justify-center"
          >
            <Feather name="log-out" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <GradientCard>
          <View className="items-center gap-3 py-2">
            <Text className="text-center text-[28px] font-bold text-text-primary">
              {household.name}
            </Text>
            <View
              style={[
                Shadow.card,
                {
                  borderRadius: 999,
                  backgroundColor: Colors.primaryLight,
                },
              ]}
              className="flex-row items-center gap-1.5 px-3 py-1"
            >
              <Feather name="users" size={14} color={Colors.primary} />
              <Text className="text-xs font-medium text-primary">
                {memberLabel}
              </Text>
            </View>
          </View>
        </GradientCard>

        <View className="mt-8">
          <Text className="mb-1 text-xl font-semibold text-text-primary">
            My Accounts
          </Text>
          <View style={Shadow.card} className="mt-2 rounded-[16px] bg-white">
            <EmptyState
              icon="credit-card"
              title="No accounts yet"
              description="Add your first account to start tracking"
            />
          </View>
        </View>

        <View className="mt-8">
          <Text className="mb-1 text-xl font-semibold text-text-primary">
            Recent Transactions
          </Text>
          <View style={Shadow.card} className="mt-2 rounded-[16px] bg-white">
            <EmptyState
              icon="book-open"
              title="No transactions yet"
              description="Start by recording your first transaction"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
