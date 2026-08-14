import { useAuth, useUser } from "@clerk/expo";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useThemeColors } from "@/constants/theme";
import type { Id } from "@/convex/_generated/dataModel";
import { GradientCard } from "@/components/GradientCard";
import { TransactionCard } from "@/components/TransactionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { Fab } from "@/components/Fab";
import { formatNumber } from "@/utils/format";
import { formatDateHeader } from "@/utils/date";
import { getConvexErrorMessage } from "@/lib/errors";

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
  const accountData = useQuery(api.accounts.list);
  const [recentCursor, setRecentCursor] = useState<
    { date: number; id: Id<"transactions"> } | undefined
  >(undefined);
  const recent = useQuery(api.transactions.recent, {
    limit: 5,
    cursor: recentCursor,
  });
  type RecentTransaction = NonNullable<
    NonNullable<typeof recent>["transactions"]
  >[number];
  const [recentTransactions, setRecentTransactions] = useState<
    RecentTransaction[] | null
  >(null);
  const [followingRecent, setFollowingRecent] = useState(false);
  const recentCursorRef = useRef(recentCursor);
  recentCursorRef.current = recentCursor;
  const recentTransactionsRef = useRef(recentTransactions);
  recentTransactionsRef.current = recentTransactions;

  useEffect(() => {
    if (recent === undefined) return;
    if (recent.transactions === null) {
      setRecentTransactions(null);
      setRecentCursor(undefined);
      setFollowingRecent(false);
      return;
    }
    const firstPage = recentCursorRef.current === undefined;
    const next = firstPage
      ? recent.transactions
      : [...(recentTransactionsRef.current ?? []), ...recent.transactions];
    setRecentTransactions(next);
    if (recent.cursor && next.length < 5) {
      setRecentCursor(recent.cursor);
      setFollowingRecent(true);
    } else {
      setFollowingRecent(false);
    }
  }, [recent]);

  const recentGroups = useMemo(() => {
    const transactions = recentTransactions;
    if (transactions === null) return null;
    const groups = new Map<string, typeof transactions>();
    for (const tx of transactions) {
      const key = formatDateHeader(tx.date);
      const list = groups.get(key);
      if (list) {
        list.push(tx);
      } else {
        groups.set(key, [tx]);
      }
    }
    return Array.from(groups.entries()).map(([title, data]) => ({
      title,
      data,
      total: data.reduce((sum, tx) => sum + tx.amount, 0),
    }));
  }, [recentTransactions]);

  const [synced, setSynced] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [signOutPressed, setSignOutPressed] = useState(false);
  const C = useThemeColors();

  const sync = useCallback(async () => {
    setSyncError(null);
    try {
      await store();
      setSynced(true);
    } catch (e) {
      setSyncError(getConvexErrorMessage(e, "Failed to sync user."));
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

  if (syncError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6 dark:bg-background-dark">
        <Text className="mb-4 text-center text-sm text-error dark:text-error-dark">{syncError}</Text>
        <Button title="Try Again" onPress={() => void sync()} />
      </SafeAreaView>
    );
  }

  if (!synced || household === undefined) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color={C.primary} />
      </SafeAreaView>
    );
  }

  if (!household) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color={C.primary} />
      </SafeAreaView>
    );
  }

  const email = me?.email ?? user?.primaryEmailAddress?.emailAddress ?? "there";
  const memberCount = members?.members.length ?? 1;
  const memberLabel =
    memberCount === 1 ? "1 member" : `${memberCount} members`;

  const totalBalance =
    accountData?.accounts?.reduce((sum, account) => sum + account.balance, 0) ??
    undefined;

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView contentContainerClassName="px-5 pb-10 pt-4">
        <View className="mb-5 flex-row items-center justify-between">
          <Text className="text-xl font-semibold text-text-primary dark:text-text-primary-dark">
            Hello, {email.split("@")[0]}!
          </Text>
          <Pressable
            onPress={() => void signOut()}
            onPressIn={() => setSignOutPressed(true)}
            onPressOut={() => setSignOutPressed(false)}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            className="h-12 w-12 items-center justify-center rounded-xl"
            style={signOutPressed ? { backgroundColor: C.surface } : undefined}
          >
            <Feather name="log-out" size={20} color={C.textSecondary} />
          </Pressable>
        </View>

        <View className="mb-4 items-center gap-1.5">
          <Text className="text-xl font-semibold text-text-primary dark:text-text-primary-dark">
            {household.name}
          </Text>
          <View
            style={[
              {
                borderRadius: 999,
                backgroundColor: C.primaryLight,
              },
            ]}
            className="flex-row items-center gap-1.5 px-3 py-1"
          >
            <Feather name="users" size={14} color={C.primary} />
            <Text className="text-xs font-medium text-primary dark:text-primary-dark">
              {memberLabel}
            </Text>
          </View>
        </View>

        <GradientCard>
          <View className="items-center gap-1 py-2">
            <Text className="text-center text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
              Total Balance
            </Text>
            {totalBalance === undefined ? (
              <View className="py-2">
                <ActivityIndicator size="small" color={C.primary} />
              </View>
            ) : (
              <Text className="text-center text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
                {formatNumber(totalBalance)}
              </Text>
            )}
          </View>
        </GradientCard>

        <View className="mt-8">
          <View className="flex-row items-center justify-between">
            <Text className="mb-1 text-xl font-semibold text-text-primary dark:text-text-primary-dark">
              My Accounts
            </Text>
            <Pressable
              onPress={() => router.push("/accounts")}
              accessibilityRole="button"
              className="min-h-12 items-center justify-center"
            >
              <Text className="text-sm font-medium text-primary dark:text-primary-dark">Manage</Text>
            </Pressable>
          </View>
          <View
            style={{ backgroundColor: C.background }}
            className="mt-2 rounded-[16px]"
          >
            {accountData === undefined || accountData.accounts === null ? (
              <View className="items-center px-4 py-4">
                <ActivityIndicator size="small" color={C.primary} />
              </View>
            ) : accountData.accounts.length === 0 ? (
              <EmptyState
                icon="credit-card"
                title="No accounts yet"
                description="Add your first account to start tracking"
                actionLabel={
                  accountData.isOwner ? "Add Account" : undefined
                }
                onAction={
                  accountData.isOwner
                    ? () => router.push("/account-form")
                    : undefined
                }
              />
            ) : (
              <View className="gap-2 px-4 py-4">
                <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
                  {accountData.accounts.length}{" "}
                  {accountData.accounts.length === 1 ? "account" : "accounts"}
                </Text>
                <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
                  Total balance:{" "}
                  {formatNumber(
                    accountData.accounts.reduce(
                      (sum, account) => sum + account.balance,
                      0,
                    ),
                  )}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View className="mt-8">
          <View className="flex-row items-center justify-between">
            <Text className="mb-1 text-xl font-semibold text-text-primary dark:text-text-primary-dark">
              Recent Transactions
            </Text>
            <Pressable
              onPress={() => router.push("/transactions")}
              accessibilityRole="button"
              className="min-h-12 items-center justify-center"
            >
              <Text className="text-sm font-medium text-primary dark:text-primary-dark">See All</Text>
            </Pressable>
          </View>
          <View
            style={{ backgroundColor: C.background }}
            className="mt-2 rounded-[16px]"
          >
            {recent === undefined && recentTransactions === null ? (
              <View className="items-center px-4 py-4">
                <ActivityIndicator size="small" color={C.primary} />
              </View>
            ) : recentGroups === null || recentGroups.length === 0 ? (
              followingRecent ? (
                <View className="items-center px-4 py-4">
                  <ActivityIndicator size="small" color={C.primary} />
                </View>
              ) : (
                <EmptyState
                  icon="book-open"
                  title="No transactions yet"
                  description="Start by recording your first transaction"
                />
              )
            ) : (
              recentGroups.map((group) => (
                <View key={group.title} className="py-1">
                  <View className="flex-row items-center justify-between px-4 pb-1 pt-2">
                    <Text className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                      {group.title}
                    </Text>
                    <Text
                      className="text-sm font-semibold"
                      style={{
                        color:
                          group.total > 0
                            ? C.success
                            : group.total < 0
                              ? C.error
                              : C.textSecondary,
                      }}
                    >
                      {group.total > 0 ? "+" : ""}
                      {formatNumber(group.total)}
                    </Text>
                  </View>
                  {group.data.map((tx) => (
                    <TransactionCard
                      key={tx._id}
                      categoryName={tx.category?.name ?? null}
                      isTransfer={tx.type === "transfer"}
                      toAccountName={tx.toAccount?.name}
                      note={tx.note ?? null}
                      amount={tx.amount}
                      type={tx.type}
                      date={tx.date}
                      onPress={() =>
                        router.push({
                          pathname: "/transaction-form",
                          params: { id: tx._id },
                        })
                      }
                    />
                  ))}
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
      <Fab
        label="Add Transaction"
        onPress={() => router.push("/transaction-form")}
        accessibilityLabel="Add transaction"
      />
    </SafeAreaView>
  );
}
