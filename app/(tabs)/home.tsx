import { useUser } from "@clerk/expo";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import PagerView from "react-native-pager-view";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { AccountIcon } from "@/components/AccountIcon";
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
import { getConvexErrorMessage } from "@/lib/errors";
import { useConnectivity } from "@/hooks/useConnectivity";
import { hapticSuccess } from "@/lib/haptics";
import { MonthPicker } from "@/components/MonthPicker";
import { FilterSheet, TypeFilter } from "@/components/FilterSheet";
import { Id } from "@/convex/_generated/dataModel";
import { filterBadgeCount, getSelectionState, normalizeSelection } from "@/utils/filters";

const PAGE_SIZE = 30;

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
    const MAX_TIMEOUT = 2147483647 - 1000;
    const capped = Math.min(delay + 1000, MAX_TIMEOUT);
    const t = setTimeout(() => setNowTick(Date.now()), capped);
    return () => clearTimeout(t);
  }, [currentPeriodBounds.end, nowTick]);

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

  useEffect(() => {
    pagerRef.current?.setPageWithoutAnimation(selectedIndex);
  }, [selectedIndex, pagerPeriods]);

  const balances = useQuery(
    api.periodBalances.get,
    selectedPeriodStart !== null ? { periodStart: selectedPeriodStart, periodType, timezone } : "skip",
  );

  const monthBudgets = useQuery(
    api.budgets.list,
    selectedPeriodStart !== null && periodEnd !== undefined
      ? { periodStart: selectedPeriodStart, periodEnd }
      : "skip",
  );

  const categoriesResult = useQuery(api.categories.list);

  // Search + Filter states (period-bound)
  const [searchDraft, setSearchDraft] = useState("");
  const [searchCommitted, setSearchCommitted] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [accountIds, setAccountIds] = useState<Id<"accounts">[]>([]);
  const [categoryIds, setCategoryIds] = useState<Id<"categories">[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const commitSearch = useCallback(() => {
    Keyboard.dismiss();
    setSearchCommitted(searchDraft.trim());
    void hapticSuccess();
  }, [searchDraft]);

  const clearSearch = useCallback(() => {
    setSearchDraft("");
    setSearchCommitted("");
  }, []);

  const accountOptions = useMemo(() => accountData?.accounts ?? [], [accountData]);
  const categoryOptions = useMemo(() => categoriesResult?.categories ?? [], [categoriesResult]);

  const contextualCategoryOptions = useMemo(() => {
    if (typeFilter === "transfer") return [];
    if (typeFilter === "all") return categoryOptions;
    return categoryOptions.filter((c) => c.type === typeFilter);
  }, [typeFilter, categoryOptions]);

  const accountSelected = useMemo(
    () => accountOptions.filter((a) => accountIds.includes(a._id)).length,
    [accountOptions, accountIds],
  );
  const categorySelected = useMemo(
    () => contextualCategoryOptions.filter((c) => categoryIds.includes(c._id)).length,
    [contextualCategoryOptions, categoryIds],
  );
  const accountState = getSelectionState(accountOptions.length, accountSelected);
  const categoryState = getSelectionState(contextualCategoryOptions.length, categorySelected);
  const activeFilterCount = filterBadgeCount(
    typeFilter !== "all",
    accountState,
    accountSelected,
    categoryState,
    categorySelected,
  );

  const queryArgs = useMemo(() => {
    if (selectedPeriodStart === null || periodEnd === undefined) return null;
    const normalizedAccounts = normalizeSelection(
      accountIds,
      accountOptions.map((a) => a._id),
    );
    const normalizedCategories = normalizeSelection(
      categoryIds,
      contextualCategoryOptions.map((c) => c._id),
    );
    return {
      startDate: selectedPeriodStart,
      endDate: periodEnd,
      ...(typeFilter !== "all" ? { type: typeFilter } : {}),
      ...(normalizedAccounts !== undefined ? { accountIds: normalizedAccounts } : {}),
      ...(normalizedCategories !== undefined ? { categoryIds: normalizedCategories } : {}),
      ...(searchCommitted.length >= 2 ? { search: searchCommitted } : {}),
    } as {
      startDate: number;
      endDate: number;
      type?: "income" | "expense" | "transfer";
      accountIds?: Id<"accounts">[];
      categoryIds?: Id<"categories">[];
      search?: string;
    };
  }, [selectedPeriodStart, periodEnd, typeFilter, accountIds, categoryIds, accountOptions, contextualCategoryOptions, searchCommitted]);

  const [activeCursor, setActiveCursor] = useState<{ date: number; id: Id<"transactions"> } | undefined>(undefined);

  const result = useQuery(
    api.transactions.list,
    queryArgs !== null
      ? {
          ...queryArgs,
          limit: PAGE_SIZE,
          ...(activeCursor !== undefined ? { cursor: activeCursor } : {}),
        }
      : "skip",
  );



  type Tx = NonNullable<NonNullable<typeof result>["transactions"]>[number];

  const [nextCursor, setNextCursor] = useState<{ date: number; id: Id<"transactions"> } | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pagedTransactions, setPagedTransactions] = useState<Tx[] | null>(null);

  const activeCursorRef = useRef(activeCursor);
  activeCursorRef.current = activeCursor;
  const isLoadingMoreRef = useRef(isLoadingMore);
  isLoadingMoreRef.current = isLoadingMore;
  const pagesMapRef = useRef<Map<string, Tx[]>>(new Map());

  const queryArgsKey = useMemo(() => (queryArgs ? JSON.stringify(queryArgs) : "__skip__"), [queryArgs]);

  useEffect(() => {
    setActiveCursor(undefined);
    setNextCursor(undefined);
    setHasMore(false);
    setIsLoadingMore(false);
    setPagedTransactions(null);
    pagesMapRef.current.clear();
  }, [queryArgsKey]);

  useEffect(() => {
    if (result === undefined) return;
    if (result.transactions === null) {
      setPagedTransactions(null);
      setHasMore(false);
      setNextCursor(undefined);
      setIsLoadingMore(false);
      pagesMapRef.current.clear();
      return;
    }
    const key =
      activeCursorRef.current === undefined ? "__first__" : JSON.stringify(activeCursorRef.current);
    pagesMapRef.current.set(key, [...result.transactions]);
    const flat = Array.from(pagesMapRef.current.values()).flat();
    const byId = new Map<string, Tx>();
    for (const tx of flat) {
      const existing = byId.get(tx._id);
      if (
        !existing ||
        (tx.updatedAt ?? 0) > (existing.updatedAt ?? 0) ||
        ((tx.updatedAt ?? 0) === (existing.updatedAt ?? 0) && tx.date > existing.date)
      ) {
        byId.set(tx._id, tx);
      }
    }
    const deduped = Array.from(byId.values()).sort((a, b) => b.date - a.date || (a._id < b._id ? 1 : -1));
    setPagedTransactions(deduped);
    setNextCursor(result.cursor ?? undefined);
    setHasMore(result.hasMore);
    setIsLoadingMore(false);
  }, [result]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMoreRef.current || nextCursor === undefined) return;
    if (pagedTransactions === null) return;
    setIsLoadingMore(true);
    setActiveCursor(nextCursor);
  }, [hasMore, nextCursor, pagedTransactions]);

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

  const sections = useMemo(() => {
    const transactions = pagedTransactions;
    if (transactions === null) return null;
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
    const entries = Array.from(groups.entries()).map(([title, data]) => ({
      title,
      data,
      total: sumNetExcludingTransfers(data as unknown as { amount: number; type: string }[]),
    }));
    return entries;
  }, [pagedTransactions, timezone]);

  const currentClosing = useMemo(() => {
    if (balances && typeof balances.closingBalance === "number") return balances.closingBalance;
    if (balances) return balances.income - balances.expense;
    return 0;
  }, [balances]);

  const currentLabel = useMemo(() => {
    if (selectedPeriodStart === null) return "";
    return formatPeriodLabel(selectedPeriodStart, timezone, periodType);
  }, [selectedPeriodStart, timezone, periodType]);

  useEffect(() => {
    if (isConnected === false) {
      setStale(true);
      return;
    }
    const isLoading =
      household === undefined ||
      accountData === undefined ||
      balances === undefined ||
      monthBudgets === undefined ||
      result === undefined;
    if (!isLoading) {
      setStale(false);
      return;
    }
    const t = setTimeout(() => setStale(true), 3000);
    return () => clearTimeout(t);
  }, [household, accountData, balances, monthBudgets, result, isConnected, refreshKey]);

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

  const isPrevDisabled = useMemo(() => {
    if (selectedPeriodStart === null) return true;
    if (pagerPeriods.length === 0) return true;
    return selectedPeriodStart <= pagerPeriods[0].periodStart;
  }, [selectedPeriodStart, pagerPeriods]);

  const handlePrev = useCallback(() => {
    if (selectedPeriodStart === null) return;
    if (isPrevDisabled) return;
    const prev = getPrevPeriod(selectedPeriodStart, timezone, periodType);
    setSelectedPeriodStart(prev);
    void hapticSuccess();
    const idx = pagerPeriods.findIndex((p) => p.periodStart === prev);
    if (idx >= 0) pagerRef.current?.setPage(idx);
  }, [selectedPeriodStart, timezone, periodType, pagerPeriods, isPrevDisabled]);

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
  const [headerPressed, setHeaderPressed] = useState(false);

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
            Hi, {firstName}!
          </Text>
        </View>

        <View className="mb-3 items-center gap-1.5">
          <Text className="text-xl font-semibold text-text-primary dark:text-text-primary-dark">
            {household.name} Household
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={handlePrev}
            onPressIn={() => setPrevPressed(true)}
            onPressOut={() => setPrevPressed(false)}
            disabled={isPrevDisabled}
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
              opacity: isPrevDisabled ? 0.4 : 1,
            }}
          >
            <Feather name="chevron-left" size={20} color={C.textPrimary} />
          </Pressable>

          <Pressable
            onPress={() => setPickerOpen(true)}
            onPressIn={() => setHeaderPressed(true)}
            onPressOut={() => setHeaderPressed(false)}
            accessibilityRole="button"
            accessibilityLabel="Open month picker"
            style={{
              flex: 1,
              alignItems: "center",
              gap: 4,
              opacity: headerPressed ? 0.7 : 1,
            }}
          >
            <View className="flex-row items-center gap-1">
              <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
                {selectedPeriodStart !== null ? currentLabel : ""} {selectedPeriodStart !== null ? "▼" : ""}
              </Text>
            </View>
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
          </Pressable>

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
        offscreenPageLimit={1}
        onPageSelected={(e) => {
          const pos = e.nativeEvent.position;
          const p = pagerPeriods[pos];
          if (p && p.periodStart !== selectedPeriodStart) {
            setSelectedPeriodStart(p.periodStart);
            void hapticSuccess();
          }
        }}
      >
        {pagerPeriods.map((p) => {
          const isSelected = p.periodStart === selectedPeriodStart;
          const todayMs = Date.now();
          const todayInPeriod =
            selectedPeriodStart !== null && periodEnd !== undefined && todayMs >= selectedPeriodStart && todayMs < periodEnd;
          return (
            <View key={String(p.periodStart)} collapsable={false} style={{ flex: 1 }}>
              {isSelected ? (
                <SectionList
                  contentContainerStyle={{ paddingBottom: 112, paddingTop: 16 }}
                  style={{ flex: 1 }}
                  sections={sections ?? []}
                  keyExtractor={(item) => item._id}
                  stickySectionHeadersEnabled={false}
                  onEndReached={loadMore}
                  onEndReachedThreshold={0.5}
                  removeClippedSubviews
                  windowSize={7}
                  initialNumToRender={12}
                  maxToRenderPerBatch={10}
                  updateCellsBatchingPeriod={50}
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
                  ListHeaderComponent={
                    <View className="px-5 pb-4">
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
                            ) : balances === null ? (
                              <Text className="text-center text-sm text-text-secondary dark:text-text-secondary-dark">
                                No data for this period
                              </Text>
                            ) : (
                              <Text className="text-center text-[28px] font-bold tracking-tight text-text-primary dark:text-text-primary-dark">
                                {formatNumber(currentClosing)}
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

                      <View className="mt-4 flex-row gap-2">
                        <View className="flex-1 flex-row items-center gap-2 rounded-full border border-border bg-background px-4 dark:border-border-dark dark:bg-background-dark">
                          <Feather name="search" size={16} color={C.textSecondary} />
                          <TextInput
                            value={searchDraft}
                            onChangeText={setSearchDraft}
                            placeholder="Search notes, amounts, accounts…"
                            placeholderTextColor={C.textSecondary}
                            className="flex-1 py-3 text-base text-text-primary dark:text-text-primary-dark"
                            accessibilityLabel="Search notes, amounts, accounts and categories"
                            returnKeyType="search"
                            onSubmitEditing={commitSearch}
                          />
                          {searchDraft.length > 0 && (
                            <Pressable
                              onPress={clearSearch}
                              accessibilityLabel="Clear search"
                              className="h-10 w-10 items-center justify-center"
                            >
                              <Feather name="x" size={16} color={C.textSecondary} />
                            </Pressable>
                          )}
                        </View>
                        <Pressable
                          onPress={commitSearch}
                          accessibilityRole="button"
                          accessibilityLabel="Search"
                          style={{ backgroundColor: C.primary, borderRadius: 999 }}
                          className="min-h-12 items-center justify-center px-5"
                        >
                          <Text className="text-sm font-semibold" style={{ color: C.background }}>
                            Search
                          </Text>
                        </Pressable>
                      </View>

                      <View className="mt-2 flex-row">
                        <Pressable
                          onPress={() => setFilterOpen(true)}
                          accessibilityRole="button"
                          accessibilityLabel="Filter"
                          style={{
                            borderWidth: 1,
                            borderColor: activeFilterCount > 0 ? C.primary : C.border,
                            backgroundColor: activeFilterCount > 0 ? `${C.primary}14` : C.background,
                            borderRadius: 999,
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Feather
                            name="filter"
                            size={14}
                            color={activeFilterCount > 0 ? C.primary : C.textSecondary}
                          />
                          <Text
                            className="text-sm font-medium"
                            style={{ color: activeFilterCount > 0 ? C.primary : C.textSecondary }}
                          >
                            {activeFilterCount > 0 ? `Filter · ${activeFilterCount}` : "Filter"}
                          </Text>
                          <Feather
                            name="chevron-down"
                            size={14}
                            color={activeFilterCount > 0 ? C.primary : C.textSecondary}
                          />
                        </Pressable>
                      </View>

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
                                <Text className="text-sm font-medium text-primary dark:text-primary-dark">
                                  See All
                                </Text>
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
                            <Text className="text-sm font-medium text-primary dark:text-primary-dark">
                              Manage
                            </Text>
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
                                      backgroundColor: C.surface,
                                    }}
                                    className="items-center justify-center"
                                  >
                                    <AccountIcon type={item.type} size={28} />
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

                      <View className="mt-6">
                        <Text className="mb-1 text-xl font-semibold text-text-primary dark:text-text-primary-dark">
                          Transactions
                        </Text>
                      </View>
                    </View>
                  }
                  ListEmptyComponent={
                    result === undefined || pagedTransactions === null ? (
                      <View className="gap-3 px-5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <View key={i} className="flex-row items-center gap-3 px-2 py-2">
                            <Skeleton style={{ width: 40, height: 40, borderRadius: Radius.sm }} />
                            <View className="flex-1 gap-2">
                              <Skeleton style={{ width: "70%", height: 14 }} />
                              <Skeleton style={{ width: "40%", height: 12 }} />
                            </View>
                            <Skeleton style={{ width: 64, height: 14 }} />
                          </View>
                        ))}
                      </View>
                    ) : todayInPeriod && pagedTransactions.length === 0 && activeFilterCount === 0 && searchCommitted.length < 2 ? (
                      <View className="px-5">
                        <View
                          style={[Shadow.card, { backgroundColor: C.background, borderRadius: 16 }]}
                          className="flex-row items-center justify-between p-4"
                        >
                          <View className="flex-1">
                            <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
                              No record for today
                            </Text>
                            <Text className="mt-1 text-xs text-text-secondary dark:text-text-secondary-dark">
                              Start tracking your spending
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-3">
                            <View
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: 6,
                                backgroundColor: C.primaryLight,
                              }}
                            />
                            <Pressable
                              onPress={() => router.push("/transaction-form")}
                              accessibilityRole="button"
                              accessibilityLabel="Add transaction"
                              style={{ backgroundColor: C.primaryLight, borderRadius: 999 }}
                              className="h-10 w-10 items-center justify-center"
                            >
                              <Feather name="plus" size={18} color={C.textPrimary} />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View className="px-5">
                        <View style={{ backgroundColor: C.background }} className="rounded-[16px]">
                          <EmptyState
                            icon="book-open"
                            title="No transactions yet"
                            description="Start by recording your first transaction"
                            actionLabel="Add Transaction"
                            onAction={() => router.push("/transaction-form")}
                          />
                        </View>
                      </View>
                    )
                  }
                  renderSectionHeader={({ section }) => (
                    <View className="flex-row items-center justify-between bg-background px-5 pb-1 pt-4 dark:bg-background-dark">
                      <Text className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                        {section.title}
                      </Text>
                      <Text
                        className="text-sm font-semibold"
                        style={{
                          color:
                            section.total > 0
                              ? C.success
                              : section.total < 0
                                ? C.error
                                : C.textSecondary,
                        }}
                      >
                        {section.total > 0 ? "+" : ""}
                        {formatNumber(section.total)}
                      </Text>
                    </View>
                  )}
                  renderItem={({ item }) => (
                    <View className="px-2">
                      <TransactionCard
                        categoryName={item.category?.name ?? null}
                        categoryIcon={item.category?.icon ?? null}
                        isTransfer={item.type === "transfer"}
                        toAccountName={item.toAccount?.name}
                        accountName={item.account?.name}
                        note={item.note ?? null}
                        amount={item.amount}
                        type={item.type as "income" | "expense" | "transfer"}
                        date={item.date}
                        timezone={timezone}
                        onPress={() =>
                          router.push({
                            pathname: "/transaction-form",
                            params: { id: item._id },
                          })
                        }
                      />
                    </View>
                  )}
                  ListFooterComponent={
                    isLoadingMore ? (
                      <View className="items-center py-4">
                        <ActivityIndicator color={C.primary} />
                      </View>
                    ) : null
                  }
                />
              ) : (
                <View style={{ flex: 1, backgroundColor: C.background }} />
              )}
            </View>
          );
        })}

      </PagerView>
      {selectedPeriodStart !== null && (
        <MonthPicker
          visible={pickerOpen}
          selectedPeriodStart={selectedPeriodStart}
          tz={timezone}
          onSelect={(ps) => {
            setSelectedPeriodStart(ps);
            const idx = pagerPeriods.findIndex((p) => p.periodStart === ps);
            if (idx >= 0) pagerRef.current?.setPage(idx);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <FilterSheet
        visible={filterOpen}
        typeFilter={typeFilter}
        accountIds={accountIds}
        categoryIds={categoryIds}
        accounts={accountData?.accounts ?? []}
        categories={categoriesResult?.categories ?? []}
        onApply={(type, aIds, cIds) => {
          setTypeFilter(type);
          setAccountIds(aIds);
          setCategoryIds(cIds);
        }}
        onClose={() => setFilterOpen(false)}
      />


      <Fab
        label="Add Transaction"
        onPress={() => router.push("/transaction-form")}
        accessibilityLabel="Add transaction"
      />
    </SafeAreaView>
  );
}

