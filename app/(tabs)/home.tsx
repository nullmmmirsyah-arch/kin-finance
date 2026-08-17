import { useUser } from "@clerk/expo";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { ACCOUNT_TYPES, type AccountType } from "@/constants/accounts";
import type { Id } from "@/convex/_generated/dataModel";
import { GradientCard } from "@/components/GradientCard";
import { TransactionCard } from "@/components/TransactionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { Fab } from "@/components/Fab";
import { Skeleton } from "@/components/Skeleton";
import { formatNumber } from "@/utils/format";
import { formatDateHeaderTz, getMonthBounds } from "@/utils/date";
import { resolveTimezone } from "@/constants/timezones";
import { getConvexErrorMessage } from "@/lib/errors";

const ACCOUNT_TYPE_THEME_KEY: Record<AccountType, keyof ReturnType<typeof useThemeColors>> = {
  cash: "accountCash",
  bank: "accountBank",
  ewallet: "accountEwallet",
  credit_card: "accountCreditCard",
};

function BudgetPill({
  pill,
  onPress,
}: {
  pill: { id: string; name: string; budgeted: number; spent?: number; progress?: number };
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const C = useThemeColors();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={`${pill.name}: ${pill.spent !== undefined ? `${formatNumber(pill.spent)} of ${formatNumber(pill.budgeted)}` : "details unavailable"}`}
      style={[
        Shadow.card,
        {
          backgroundColor: pressed ? C.surface : C.background,
          borderRadius: Radius.md,
        },
      ]}
      className="flex-row items-center gap-3 px-4 py-3"
    >
      <View className="flex-1">
        <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
          {pill.name}
        </Text>
        <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
          {pill.spent !== undefined
            ? `${formatNumber(pill.spent)} of ${formatNumber(pill.budgeted)}`
            : "Details unavailable"}
        </Text>
      </View>
      {pill.progress !== undefined && (
        <View className="h-2 w-16 overflow-hidden rounded-full bg-border dark:bg-border-dark">
          <View
            style={{
              width: `${Math.min(pill.progress * 100, 100)}%`,
              backgroundColor:
                pill.progress > 1 ? C.error : pill.progress > 0.8 ? "#D97706" : C.success,
            }}
            className="h-full rounded-full"
          />
        </View>
      )}
    </Pressable>
  );
}

export default function Home() {
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
    const timezone = resolveTimezone(household?.timezone);
    const groups = new Map<string, typeof transactions>();
    for (const tx of transactions) {
      const key = formatDateHeaderTz(tx.date, timezone);
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
  }, [recentTransactions, household]);

  const { start: monthStart, end: monthEnd } = getMonthBounds(
    Date.now(),
    resolveTimezone(household?.timezone),
  );

  const monthTransactions = useQuery(api.transactions.list, {
    startDate: monthStart,
    endDate: monthEnd,
  });

  const monthBudgets = useQuery(api.budgets.list, {
    periodStart: monthStart,
    periodEnd: monthEnd,
  });

  const monthlySummary = useMemo(() => {
    const txs = monthTransactions?.transactions;
    if (!txs) return null;
    let income = 0;
    let expense = 0;
    for (const tx of txs) {
      if (tx.type === "income") {
        income += tx.amount;
      } else if (tx.type === "expense") {
        expense += Math.abs(tx.amount);
      }
    }
    return { income, expense, net: income - expense };
  }, [monthTransactions]);

  const budgetPills = useMemo(() => {
    const budgets = monthBudgets?.budgets;
    if (!budgets || budgets.length === 0) return [];
    return budgets.slice(0, 3).map((b) => ({
      id: b._id,
      name: b.category?.name ?? "Budget",
      budgeted: b.amount,
      spent: b.spent,
      progress: b.progress,
    }));
  }, [monthBudgets]);

  const [synced, setSynced] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
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
  const firstName =
    user?.firstName ?? me?.name?.split(" ")[0] ?? email.split("@")[0].replace(/\./g, " ");
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
            Hello, {firstName}!
          </Text>
        </View>

        <View className="mb-4 items-center gap-1.5">
          <Text className="text-xl font-semibold text-text-primary dark:text-text-primary-dark">
            {household.name}
          </Text>
          <View
            style={{
              borderRadius: 999,
              backgroundColor: C.surface,
            }}
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
              <View className="w-full items-center py-1">
                <Skeleton style={{ width: 160, height: 32 }} />
              </View>
            ) : (
              <Text className="text-center text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
                {formatNumber(totalBalance)}
              </Text>
            )}
            {monthlySummary ? (
              <Text
                className="text-center text-sm font-medium"
                style={{
                  color: monthlySummary.net >= 0 ? C.success : C.error,
                }}
              >
                {monthlySummary.net >= 0 ? "+" : ""}
                {formatNumber(monthlySummary.net)} this month
              </Text>
            ) : (
              <Skeleton style={{ width: 120, height: 14 }} />
            )}
          </View>
        </GradientCard>

        {monthBudgets !== undefined && (
          <View className="mt-6">
            <View className="flex-row items-center justify-between">
              <Text className="mb-1 text-xl font-semibold text-text-primary dark:text-text-primary-dark">
                Budgets
              </Text>
              {budgetPills.length > 0 && (
                <Pressable
                  onPress={() => router.push("/budgets")}
                  accessibilityRole="button"
                  className="min-h-12 items-center justify-center"
                >
                  <Text className="text-sm font-medium text-primary dark:text-primary-dark">See All</Text>
                </Pressable>
              )}
            </View>
            {budgetPills.length > 0 ? (
              <View className="mt-2 gap-3">
                {budgetPills.map((pill) => (
                  <BudgetPill key={pill.id} pill={pill} onPress={() => router.push("/budgets")} />
                ))}
              </View>
            ) : (
              <EmptyState
                icon="pie-chart"
                title="No budgets yet"
                description="Set a budget for each category to track your spending"
                actionLabel={monthBudgets.isOwner ? "Create Budget" : undefined}
                onAction={
                  monthBudgets.isOwner
                    ? () => router.push("/budget-form")
                    : undefined
                }
              />
            )}
          </View>
        )}

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

          {accountData === undefined || accountData.accounts === null ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-2"
              contentContainerClassName="gap-3 pr-5"
              data={[0, 1]}
              keyExtractor={(item) => String(item)}
              renderItem={() => (
                <Skeleton
                  style={{
                    width: 160,
                    height: 96,
                    borderRadius: Radius.md,
                  }}
                />
              )}
            />
          ) : accountData.accounts.length === 0 ? (
            <EmptyState
              icon="credit-card"
              title="No accounts yet"
              description="Add your first account to start tracking"
              actionLabel={accountData.isOwner ? "Add Account" : undefined}
              onAction={
                accountData.isOwner
                  ? () => router.push("/account-form")
                  : undefined
              }
            />
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-2"
              contentContainerClassName="gap-3 pr-5"
              data={accountData.accounts}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => {
                const meta =
                  ACCOUNT_TYPES.find((t) => t.id === item.type) ??
                  ACCOUNT_TYPES[0];
                const tintKey = ACCOUNT_TYPE_THEME_KEY[item.type] ?? "primary";
                const tint = C[tintKey] ?? C.primary;
                return (
                  <Pressable
                    onPress={() =>
                      accountData.isOwner
                        ? router.push({
                            pathname: "/account-form",
                            params: { id: item._id },
                          })
                        : router.push("/accounts")
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, balance ${formatNumber(item.balance)}`}
                    style={[
                      Shadow.card,
                      {
                        width: 160,
                        borderRadius: Radius.md,
                        backgroundColor: C.background,
                        borderWidth: 1,
                        borderColor: C.border,
                      },
                    ]}
                    className="p-4"
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: Radius.sm,
                        backgroundColor: `${tint}15`,
                      }}
                      className="items-center justify-center"
                    >
                      <Feather name={meta.icon} size={18} color={tint} />
                    </View>
                    <Text
                      numberOfLines={1}
                      className="mt-3 text-base font-semibold text-text-primary dark:text-text-primary-dark"
                    >
                      {item.name}
                    </Text>
                    <Text className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                      {formatNumber(item.balance)}
                    </Text>
                  </Pressable>
                );
              }}
              ListFooterComponent={
                accountData.isOwner ? (
                  <Pressable
                    onPress={() => router.push("/account-form")}
                    accessibilityRole="button"
                    accessibilityLabel="Add account"
                    style={[
                      Shadow.card,
                      {
                        width: 160,
                        borderRadius: Radius.md,
                        backgroundColor: C.surface,
                        borderWidth: 1,
                        borderColor: C.border,
                      },
                    ]}
                    className="items-center justify-center p-4"
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-primary dark:bg-primary-dark">
                      <Feather name="plus" size={18} color={C.background} />
                    </View>
                    <Text className="mt-2 text-sm font-medium text-primary dark:text-primary-dark">
                      Add Account
                    </Text>
                  </Pressable>
                ) : null
              }
            />
          )}
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
              <View className="gap-3 px-4 py-4">
                {[0, 1, 2, 3, 4].map((i) => (
                  <View key={i} className="flex-row items-center gap-3">
                    <Skeleton style={{ width: 40, height: 40, borderRadius: Radius.sm }} />
                    <View className="flex-1 gap-2">
                      <Skeleton style={{ width: "70%", height: 14 }} />
                      <Skeleton style={{ width: "40%", height: 12 }} />
                    </View>
                    <Skeleton style={{ width: 64, height: 14 }} />
                  </View>
                ))}
              </View>
            ) : recentGroups === null || recentGroups.length === 0 ? (
              followingRecent ? (
                <View className="px-4 py-4">
                  <Skeleton style={{ width: "100%", height: 16 }} />
                </View>
              ) : (
                <EmptyState
                  icon="book-open"
                  title="No transactions yet"
                  description="Start by recording your first transaction"
                  actionLabel="Add Transaction"
                  onAction={() => router.push("/transaction-form")}
                />
              )
            ) : (
              <>
                {recentGroups.map((group) => (
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
                        timezone={resolveTimezone(household?.timezone)}
                        onPress={() =>
                          router.push({
                            pathname: "/transaction-form",
                            params: { id: tx._id },
                          })
                        }
                      />
                    ))}
                  </View>
                ))}
                {followingRecent ? (
                  <View className="px-4 py-4">
                    <Skeleton style={{ width: "100%", height: 16 }} />
                  </View>
                ) : null}
              </>
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
