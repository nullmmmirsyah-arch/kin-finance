import { useUser } from "@clerk/expo";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import PagerView from "react-native-pager-view";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { ACCOUNT_TYPES, type AccountType } from "@/constants/accounts";
import { GradientCard } from "@/components/GradientCard";
import { TransactionCard } from "@/components/TransactionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { Fab } from "@/components/Fab";
import { Skeleton } from "@/components/Skeleton";
import { ConnectivityBanner } from "@/components/ConnectivityBanner";
import { useSnackbar } from "@/components/Snackbar";
import { formatNumber, sumNetExcludingTransfers } from "@/utils/format";
import { formatDateHeaderTz } from "@/utils/date";
import {
  getPeriodBounds,
  formatPeriodLabel,
  buildPeriodWindow,
  getPrevPeriod,
  getNextPeriod,
} from "@/utils/period";
import { resolveTimezone } from "@/constants/timezones";
import { DeltaCard, SpendingDonut } from "@/components/charts";
import { getConvexErrorMessage } from "@/lib/errors";
import { useConnectivity } from "@/hooks/useConnectivity";
import { hapticSuccess } from "@/lib/haptics";

const ACCOUNT_TYPE_THEME_KEY: Record<AccountType, keyof ReturnType<typeof useThemeColors>> = {
  cash: "accountCash",
  bank: "accountBank",
  ewallet: "accountEwallet",
  credit_card: "accountCreditCard",
};

const RECENT_TRANSACTIONS_LIMIT = 5;

const BudgetPill = memo(function BudgetPill({
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
                pill.progress > 1 ? C.error : pill.progress > 0.8 ? C.chartAmber : C.success,
            }}
            className="h-full rounded-full"
          />
        </View>
      )}
    </Pressable>
  );
});

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

  const [synced, setSynced] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const isConnected = useConnectivity();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const { show } = useSnackbar();
  const C = useThemeColors();

  const handleRetry = useCallback(() => {
    if (isRetrying) return;
    setIsRetrying(true);
    setStale(false);
    setRefreshKey((k) => k + 1);
    show("Retrying…");
    void hapticSuccess();
    setTimeout(() => setIsRetrying(false), 600);
  }, [isRetrying, show]);

  const periodType = useMemo(
    () => ((household?.periodType ?? "monthly") as "monthly" | "weekly" | "yearly"),
    [household?.periodType],
  );
  const timezone = useMemo(() => resolveTimezone(household?.timezone), [household?.timezone]);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const currentPeriodBounds = useMemo(
    () => getPeriodBounds(nowTick, timezone, periodType),
    [nowTick, timezone, periodType],
  );

  useEffect(() => {
    const delay = currentPeriodBounds.end - Date.now();
    if (delay <= 0) {
      setNowTick(Date.now());
      return;
    }
    const t = setTimeout(() => setNowTick(Date.now()), delay + 1000);
    return () => clearTimeout(t);
  }, [currentPeriodBounds.end]);

  const [selectedPeriodStart, setSelectedPeriodStart] = useState<number | null>(null);

  useEffect(() => {
    if (selectedPeriodStart === null) {
      setSelectedPeriodStart(getPeriodBounds(Date.now(), timezone, periodType).start);
    }
  }, [timezone, periodType, selectedPeriodStart]);

  useEffect(() => {
    // When periodType or timezone changes, re-anchor selected to current period
    if (household !== undefined && selectedPeriodStart !== null) {
      const cur = getPeriodBounds(Date.now(), timezone, periodType).start;
      const expected = getPeriodBounds(selectedPeriodStart, timezone, periodType).start;
      if (expected !== selectedPeriodStart) {
        // misalignment due to tz/type change — reset to cur
        setSelectedPeriodStart(cur);
      }
    }
  }, [household, timezone, periodType, selectedPeriodStart]);

  const periodEnd = useMemo(() => {
    if (selectedPeriodStart === null) return undefined;
    return getPeriodBounds(selectedPeriodStart, timezone, periodType).end;
  }, [selectedPeriodStart, timezone, periodType]);

  const prevPeriodStart = useMemo(() => {
    if (selectedPeriodStart === null) return undefined;
    return getPrevPeriod(selectedPeriodStart, timezone, periodType);
  }, [selectedPeriodStart, timezone, periodType]);

  const pagerPeriods = useMemo(
    () => buildPeriodWindow(nowTick, timezone, periodType, 12).periods,
    [nowTick, timezone, periodType],
  );

  const pagerRef = useRef<PagerView>(null);
  const selectedIndex = useMemo(() => {
    if (selectedPeriodStart === null) return pagerPeriods.length - 1;
    const idx = pagerPeriods.findIndex((p) => p.periodStart === selectedPeriodStart);
    return idx >= 0 ? idx : pagerPeriods.length - 1;
  }, [pagerPeriods, selectedPeriodStart]);

  const balances = useQuery(
    api.periodBalances.get,
    selectedPeriodStart !== null ? { periodStart: selectedPeriodStart, periodType, timezone } : "skip",
  );
  const prevBalances = useQuery(
    api.periodBalances.get,
    prevPeriodStart !== undefined ? { periodStart: prevPeriodStart, periodType, timezone } : "skip",
  );

  const monthBudgets = useQuery(
    api.budgets.list,
    selectedPeriodStart !== null && periodEnd !== undefined
      ? { periodStart: selectedPeriodStart, periodEnd }
      : "skip",
  );

  const spendingRes = useQuery(
    api.transactions.spendingByCategory,
    household && selectedPeriodStart !== null && periodEnd !== undefined
      ? { startDate: selectedPeriodStart, endDate: periodEnd }
      : "skip",
  );

  const recent = useQuery(
    api.transactions.list,
    selectedPeriodStart !== null && periodEnd !== undefined
      ? { startDate: selectedPeriodStart, endDate: periodEnd, limit: RECENT_TRANSACTIONS_LIMIT }
      : "skip",
  );

  const recentTransactions = useMemo(() => {
    if (recent === undefined) return undefined;
    if (recent === null) return null;
    // recent from list returns {transactions, ...}
    const txs = (recent as { transactions: unknown }).transactions as
      | {
          _id: string;
          accountId: string;
          categoryId?: string;
          toAccountId?: string;
          amount: number;
          type: "income" | "expense" | "transfer";
          note?: string;
          date: number;
          category?: { name: string | null } | null;
          toAccount?: { name: string } | null;
        }[]
      | null;
    return (txs as unknown) as typeof recent extends { transactions: infer T } ? T : never;
  }, [recent]);

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

  const handleBudgetPillPress = useCallback(() => {
    router.push("/budgets");
  }, [router]);

  const recentGroups = useMemo(() => {
    const transactions = recentTransactions as
      | { _id: string; date: number; amount: number; type: string; note?: string | null; category?: { name: string | null } | null; toAccount?: { name: string } | null }[]
      | null
      | undefined;
    if (transactions === undefined || transactions === null) return transactions ?? null;
    if (transactions.length === 0) return [];
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
      total: sumNetExcludingTransfers(data as unknown as { amount: number; type: string }[]),
    }));
  }, [recentTransactions, timezone]);

  const currentNet = useMemo(() => {
    if (balances) return balances.income - balances.expense;
    return 0;
  }, [balances]);
  const prevNet = useMemo(() => {
    if (prevBalances) return prevBalances.income - prevBalances.expense;
    return 0;
  }, [prevBalances]);
  const currentClosing = useMemo(() => {
    if (balances && typeof balances.closingBalance === "number") return balances.closingBalance;
    return currentNet;
  }, [balances, currentNet]);
  const prevClosing = useMemo(() => {
    if (prevBalances && typeof prevBalances.closingBalance === "number") return prevBalances.closingBalance;
    return prevNet;
  }, [prevBalances, prevNet]);

  const currentLabel = useMemo(() => {
    if (selectedPeriodStart === null) return "";
    return formatPeriodLabel(selectedPeriodStart, timezone, periodType);
  }, [selectedPeriodStart, timezone, periodType]);
  const prevLabel = useMemo(() => {
    if (prevPeriodStart === undefined) return "";
    return formatPeriodLabel(prevPeriodStart, timezone, periodType);
  }, [prevPeriodStart, timezone, periodType]);

  useEffect(() => {
    if (isConnected === false) {
      setStale(true);
      return;
    }
    const isLoadingAnalytics = spendingRes === undefined;
    const isLoading =
      household === undefined ||
      accountData === undefined ||
      balances === undefined ||
      monthBudgets === undefined ||
      recent === undefined ||
      isLoadingAnalytics;
    if (!isLoading) {
      setStale(false);
      return;
    }
    const t = setTimeout(() => setStale(true), 3000);
    return () => clearTimeout(t);
  }, [household, accountData, balances, monthBudgets, recent, spendingRes, isConnected, refreshKey]);

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

  const handlePrev = useCallback(() => {
    if (selectedPeriodStart === null) return;
    const prev = getPrevPeriod(selectedPeriodStart, timezone, periodType);
    setSelectedPeriodStart(prev);
    void hapticSuccess();
    const idx = pagerPeriods.findIndex((p) => p.periodStart === prev);
    if (idx >= 0) pagerRef.current?.setPage(idx);
  }, [selectedPeriodStart, timezone, periodType, pagerPeriods]);

  const handleNext = useCallback(() => {
    if (selectedPeriodStart === null) return;
    const next = getNextPeriod(selectedPeriodStart, timezone, periodType);
    const curStart = getPeriodBounds(Date.now(), timezone, periodType).start;
    if (next > curStart) return;
    setSelectedPeriodStart(next);
    void hapticSuccess();
    const idx = pagerPeriods.findIndex((p) => p.periodStart === next);
    if (idx >= 0) pagerRef.current?.setPage(idx);
  }, [selectedPeriodStart, timezone, periodType, pagerPeriods]);

  const isNextDisabled = useMemo(() => {
    if (selectedPeriodStart === null) return true;
    const next = getNextPeriod(selectedPeriodStart, timezone, periodType);
    const curStart = getPeriodBounds(Date.now(), timezone, periodType).start;
    return next > curStart;
  }, [selectedPeriodStart, timezone, periodType]);

  const [prevPressed, setPrevPressed] = useState(false);
  const [nextPressed, setNextPressed] = useState(false);

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
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        {(stale || isRetrying) && (
          <View className="pt-2">
            <ConnectivityBanner visible={stale || isRetrying} onRetry={handleRetry} isRetrying={isRetrying} />
          </View>
        )}
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={C.primary} />
        </View>
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
  const memberLabel = memberCount === 1 ? "1 member" : `${memberCount} members`;

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      {(stale || isRetrying) && (
        <View className="pt-2">
          <ConnectivityBanner visible={stale || isRetrying} onRetry={handleRetry} isRetrying={isRetrying} />
        </View>
      )}

      <View className="px-5 pb-2 pt-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-xl font-semibold text-text-primary dark:text-text-primary-dark">
            Hello, {firstName}!
          </Text>
        </View>

        <View className="mb-3 items-center gap-1.5">
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
            <Text className="text-xs font-medium text-primary dark:text-primary-dark">{memberLabel}</Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={handlePrev}
            onPressIn={() => setPrevPressed(true)}
            onPressOut={() => setPrevPressed(false)}
            accessibilityRole="button"
            accessibilityLabel="Previous period"
            style={{
              width: 44,
              height: 44,
              borderRadius: Radius.md,
              backgroundColor: prevPressed ? C.surface : C.background,
              borderWidth: 1,
              borderColor: C.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="chevron-left" size={20} color={C.textPrimary} />
          </Pressable>

          <View className="flex-1 items-center gap-1">
            <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
              {selectedPeriodStart !== null ? currentLabel : ""}
            </Text>
            <View className="flex-row items-center gap-1.5">
              {pagerPeriods.map((p, idx) => (
                <View
                  key={p.periodStart}
                  style={{
                    width: idx === selectedIndex ? 16 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: idx === selectedIndex ? C.primary : C.border,
                  }}
                />
              ))}
            </View>
          </View>

          <Pressable
            onPress={handleNext}
            onPressIn={() => setNextPressed(true)}
            onPressOut={() => setNextPressed(false)}
            disabled={isNextDisabled}
            accessibilityRole="button"
            accessibilityLabel="Next period"
            style={{
              width: 44,
              height: 44,
              borderRadius: Radius.md,
              backgroundColor: nextPressed ? C.surface : C.background,
              borderWidth: 1,
              borderColor: C.border,
              alignItems: "center",
              justifyContent: "center",
              opacity: isNextDisabled ? 0.4 : 1,
            }}
          >
            <Feather name="chevron-right" size={20} color={C.textPrimary} />
          </Pressable>
        </View>
      </View>

      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={selectedIndex}
        onPageSelected={(e) => {
          const pos = e.nativeEvent.position;
          const p = pagerPeriods[pos];
          if (p && p.periodStart !== selectedPeriodStart) {
            setSelectedPeriodStart(p.periodStart);
            void hapticSuccess();
          }
        }}
      >
        {pagerPeriods.map((p) => (
          <View key={String(p.periodStart)}>
            <ScrollView
              contentContainerClassName="px-5 pb-10 pt-4"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    setRefreshKey((k) => k + 1);
                    void hapticSuccess();
                    setTimeout(() => setRefreshing(false), 600);
                  }}
                  tintColor={C.primary}
                />
              }
            >
              <GradientCard>
                <View className="gap-4 py-1">
                  <View className="items-center gap-1">
                    <View
                      style={{ backgroundColor: `${C.primary}10`, borderRadius: 999 }}
                      className="px-3 py-1"
                    >
                      <Text className="text-center text-[11px] font-semibold tracking-widest text-primary dark:text-primary-dark">
                        PERIOD BALANCE
                      </Text>
                    </View>
                    {balances === undefined ? (
                      <Skeleton style={{ width: 160, height: 32 }} />
                    ) : (
                      <Text className="text-center text-[28px] font-bold tracking-tight text-text-primary dark:text-text-primary-dark">
                        {formatNumber(balances === null ? 0 : currentClosing)}
                      </Text>
                    )}
                    <Text className="text-center text-xs text-text-secondary dark:text-text-secondary-dark">
                      {currentLabel}
                      {balances !== null && balances !== undefined
                        ? ` • Opening ${formatNumber(balances.openingBalance)}`
                        : ""}
                    </Text>
                  </View>

                  <View style={{ height: 1, backgroundColor: `${C.border}66` }} />

                  {balances === undefined ? (
                    <View className="flex-row gap-3">
                      <Skeleton style={{ flex: 1, height: 56, borderRadius: Radius.md }} />
                      <Skeleton style={{ flex: 1, height: 56, borderRadius: Radius.md }} />
                    </View>
                  ) : (
                    <View className="flex-row items-center">
                      <View className="flex-1 flex-row items-center gap-3">
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 999,
                            backgroundColor: `${C.success}14`,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Feather name="trending-up" size={16} color={C.success} />
                        </View>
                        <View className="flex-1">
                          <Text className="text-[11px] font-semibold tracking-widest text-text-secondary dark:text-text-secondary-dark">
                            INCOME
                          </Text>
                          <Text className="text-base font-semibold" style={{ color: C.success }}>
                            +{formatNumber(balances === null ? 0 : balances.income)}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={{
                          width: 1,
                          height: 36,
                          backgroundColor: C.border,
                          opacity: 0.6,
                        }}
                      />

                      <View className="flex-1 flex-row items-center gap-3 pl-4">
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 999,
                            backgroundColor: `${C.error}14`,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Feather name="trending-down" size={16} color={C.error} />
                        </View>
                        <View className="flex-1">
                          <Text className="text-[11px] font-semibold tracking-widest text-text-secondary dark:text-text-secondary-dark">
                            EXPENSE
                          </Text>
                          <Text className="text-base font-semibold" style={{ color: C.error }}>
                            -{formatNumber(balances === null ? 0 : balances.expense)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              </GradientCard>

              {monthBudgets === undefined ? (
                <View className="mt-6 gap-3">
                  <Skeleton style={{ height: 24, borderRadius: Radius.md }} />
                  <Skeleton style={{ height: 56, borderRadius: Radius.md }} />
                </View>
              ) : (
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
                        <BudgetPill key={pill.id} pill={pill} onPress={handleBudgetPillPress} />
                      ))}
                    </View>
                  ) : (
                    <EmptyState
                      icon="pie-chart"
                      title="No budgets yet"
                      description="Set a budget for each category to track your spending"
                      actionLabel="Create Budget"
                      onAction={() => router.push("/budget-form")}
                    />
                  )}
                </View>
              )}

              {spendingRes === undefined ? (
                <View className="mt-6 gap-3">
                  <Skeleton style={{ height: 80, borderRadius: Radius.md }} />
                  <Skeleton style={{ height: 140, borderRadius: Radius.md }} />
                </View>
              ) : spendingRes && spendingRes.segments ? (
                <View className="mt-6 gap-3">
                  <DeltaCard
                    currentClosing={currentClosing}
                    prevClosing={prevClosing}
                    currentLabel={currentLabel}
                    prevLabel={prevLabel}
                  />
                  <SpendingDonut
                    segments={spendingRes.segments.map((s: { name: string; amount: number }) => ({
                      name: s.name,
                      amount: s.amount,
                    }))}
                    total={spendingRes.total}
                    othersAmount={spendingRes.othersAmount}
                  />
                </View>
              ) : null}

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
                    removeClippedSubviews
                    windowSize={5}
                    initialNumToRender={2}
                    maxToRenderPerBatch={2}
                  />
                ) : accountData.accounts.length === 0 ? (
                  <EmptyState
                    icon="credit-card"
                    title="No accounts yet"
                    description="Add your first account to start tracking"
                    actionLabel={accountData.isOwner ? "Add Account" : undefined}
                    onAction={accountData.isOwner ? () => router.push("/account-form") : undefined}
                  />
                ) : (
                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mt-2"
                    contentContainerClassName="gap-3 pr-5"
                    data={accountData.accounts}
                    keyExtractor={(item) => item._id}
                    removeClippedSubviews
                    windowSize={5}
                    initialNumToRender={4}
                    maxToRenderPerBatch={4}
                    updateCellsBatchingPeriod={50}
                    getItemLayout={(_, index) => ({
                      length: 160,
                      offset: 172 * index,
                      index,
                    })}
                    renderItem={({ item }) => {
                      const meta = ACCOUNT_TYPES.find((t) => t.id === item.type) ?? ACCOUNT_TYPES[0];
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
                <View style={{ backgroundColor: C.background }} className="mt-2 rounded-[16px]">
                  {recent === undefined ? (
                    <View className="gap-3 px-4 py-4">
                      {Array.from({ length: RECENT_TRANSACTIONS_LIMIT }).map((_, i) => (
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
                    <EmptyState
                      icon="book-open"
                      title="No transactions yet"
                      description="Start by recording your first transaction"
                      actionLabel="Add Transaction"
                      onAction={() => router.push("/transaction-form")}
                    />
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
                              categoryName={(tx.category as { name?: string } | null)?.name ?? null}
                              isTransfer={tx.type === "transfer"}
                              toAccountName={(tx.toAccount as { name?: string } | null)?.name}
                              note={(tx.note as string | null) ?? null}
                              amount={tx.amount}
                              type={tx.type as "income" | "expense" | "transfer"}
                              date={tx.date}
                              timezone={timezone}
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
                    </>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        ))}
      </PagerView>
      <Fab
        label="Add Transaction"
        onPress={() => router.push("/transaction-form")}
        accessibilityLabel="Add transaction"
      />
    </SafeAreaView>
  );
}

