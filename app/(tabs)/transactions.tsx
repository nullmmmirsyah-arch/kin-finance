import { ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import Feather from "@expo/vector-icons/Feather";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { Fab } from "@/components/Fab";
import { TransactionCard } from "@/components/TransactionCard";
import { EmptyState } from "@/components/EmptyState";
import { DateField } from "@/components/DateField";
import { GradientCard } from "@/components/GradientCard";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/Button";
import { FilterSheet, TypeFilter } from "@/components/FilterSheet";
import { ConnectivityBanner } from "@/components/ConnectivityBanner";
import { useSnackbar } from "@/components/Snackbar";
import { formatNumber, sumNetExcludingTransfers } from "@/utils/format";
import { useConnectivity } from "@/hooks/useConnectivity";
import { hapticSuccess } from "@/lib/haptics";
import {
  formatDateHeaderTz,
  formatDateShortTz,
  getDayBounds,
  getMonthBounds,
  startOfDay,
} from "@/utils/date";
import { filterBadgeCount, getSelectionState, normalizeSelection } from "@/utils/filters";
import { resolveTimezone } from "@/constants/timezones";

type DateFilter = "thisMonth" | "lastMonth" | "custom";

const DATE_OPTIONS: { id: DateFilter; label: string }[] = [
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "custom", label: "Custom Range" },
];

const PAGE_SIZE = 30;

function HeaderPill({
  icon,
  label,
  active,
  onPress,
}: {
  icon: ComponentProps<typeof Feather>["name"];
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const C = useThemeColors();
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      className={`min-h-12 flex-row items-center gap-2 rounded-full border px-4 ${
        active
          ? "border-primary dark:border-primary-dark"
          : "border-border bg-background dark:border-border-dark dark:bg-background-dark"
      }`}
      style={pressed ? { opacity: 0.85 } : undefined}
    >
      <Feather name={icon} size={16} color={active ? C.primary : C.textSecondary} />
      <Text
        className={`text-sm font-medium ${
          active
            ? "text-primary dark:text-primary-dark"
            : "text-text-primary dark:text-text-primary-dark"
        }`}
      >
        {label}
      </Text>
      <Feather name="chevron-down" size={16} color={active ? C.primary : C.textSecondary} />
    </Pressable>
  );
}

export default function Transactions() {
  const router = useRouter();
  const C = useThemeColors();
  const { show: showSnackbar } = useSnackbar();
  const [dateFilter, setDateFilter] = useState<DateFilter>("thisMonth");
  const [customFrom, setCustomFrom] = useState(() => startOfDay(new Date()));
  const [customTo, setCustomTo] = useState(() => startOfDay(new Date()));
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [accountIds, setAccountIds] = useState<Id<"accounts">[]>([]);
  const [categoryIds, setCategoryIds] = useState<Id<"categories">[]>([]);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchCommitted, setSearchCommitted] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const isConnected = useConnectivity();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const household = useQuery(api.households.getActive);

  const handleRetry = useCallback(() => {
    if (isRetrying) return;
    setIsRetrying(true);
    setStale(false);
    setRefreshKey((k) => k + 1);
    showSnackbar("Retrying…");
    void hapticSuccess();
    setTimeout(() => setIsRetrying(false), 600);
  }, [isRetrying, showSnackbar]);

  const timezone = resolveTimezone(household?.timezone);

  const commitSearch = useCallback(() => {
    Keyboard.dismiss();
    setSearchCommitted(searchDraft.trim());
    void hapticSuccess();
  }, [searchDraft]);

  const clearSearch = useCallback(() => {
    setSearchDraft("");
    setSearchCommitted("");
  }, []);

  const invalidCustomRange =
    dateFilter === "custom" &&
    startOfDay(customFrom).getTime() > startOfDay(customTo).getTime();

  const range = useMemo(() => {
    const now = Date.now();
    if (dateFilter === "thisMonth") {
      const bounds = getMonthBounds(now, timezone);
      return { startDate: bounds.start, endDate: bounds.end };
    }
    if (dateFilter === "lastMonth") {
      const current = getMonthBounds(now, timezone);
      const previous = getMonthBounds(current.start - 1, timezone);
      return { startDate: previous.start, endDate: current.start };
    }
    if (invalidCustomRange) {
      return { startDate: 0, endDate: 0 };
    }
    return {
      startDate: getDayBounds(customFrom, timezone).start,
      endDate: getDayBounds(customTo, timezone).end,
    };
  }, [dateFilter, customFrom, customTo, invalidCustomRange, timezone]);

  const accountsResult = useQuery(api.accounts.list);
  const categoriesResult = useQuery(api.categories.list);

  const accountOptions = useMemo(() => accountsResult?.accounts ?? [], [accountsResult]);
  const categoryOptions = useMemo(
    () => categoriesResult?.categories ?? [],
    [categoriesResult],
  );
  const contextualCategoryOptions = useMemo(() => {
    if (typeFilter === "transfer") return [];
    if (typeFilter === "all") return categoryOptions;
    return categoryOptions.filter((c) => c.type === typeFilter);
  }, [typeFilter, categoryOptions]);
  const accountSelected = accountOptions.filter((a) => accountIds.includes(a._id)).length;
  const categorySelected = contextualCategoryOptions.filter((c) => categoryIds.includes(c._id)).length;
  const accountState = getSelectionState(accountOptions.length, accountSelected);
  const categoryState = getSelectionState(contextualCategoryOptions.length, categorySelected);

  const queryArgs = useMemo(() => {
    const normalizedAccounts = normalizeSelection(
      accountIds,
      accountOptions.map((a) => a._id),
    );
    const normalizedCategories = normalizeSelection(
      categoryIds,
      contextualCategoryOptions.map((c) => c._id),
    );
    return {
      ...range,
      ...(typeFilter !== "all" ? { type: typeFilter } : {}),
      ...(normalizedAccounts !== undefined ? { accountIds: normalizedAccounts } : {}),
      ...(normalizedCategories !== undefined ? { categoryIds: normalizedCategories } : {}),
      ...(searchCommitted.length >= 2 ? { search: searchCommitted } : {}),
    };
  }, [range, typeFilter, accountIds, categoryIds, accountOptions, contextualCategoryOptions, searchCommitted]);

  const [activeCursor, setActiveCursor] = useState<
    { date: number; id: Id<"transactions"> } | undefined
  >(undefined);

  const result = useQuery(api.transactions.list, {
    ...queryArgs,
    limit: PAGE_SIZE,
    ...(activeCursor !== undefined ? { cursor: activeCursor } : {}),
  });
  const summaryResult = useQuery(api.transactions.summary, queryArgs);

  type Tx = NonNullable<NonNullable<typeof result>["transactions"]>[number];

  const [nextCursor, setNextCursor] = useState<
    { date: number; id: Id<"transactions"> } | undefined
  >(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pagedTransactions, setPagedTransactions] = useState<Tx[] | null>(null);

  const activeCursorRef = useRef(activeCursor);
  activeCursorRef.current = activeCursor;
  const isLoadingMoreRef = useRef(isLoadingMore);
  isLoadingMoreRef.current = isLoadingMore;
  const pagesMapRef = useRef<Map<string, Tx[]>>(new Map());

  const queryArgsKey = useMemo(() => JSON.stringify(queryArgs), [queryArgs]);

  useEffect(() => {
    setActiveCursor(undefined);
    setNextCursor(undefined);
    setHasMore(false);
    setIsLoadingMore(false);
    setPagedTransactions(null);
    pagesMapRef.current.clear();
  }, [queryArgsKey]);

  useEffect(() => {
    if (isConnected === false) {
      setStale(true);
      return;
    }
    if (result !== undefined) {
      setStale(false);
      return;
    }
    const t = setTimeout(() => setStale(true), 3000);
    return () => clearTimeout(t);
  }, [result, isConnected, refreshKey]);

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
      activeCursorRef.current === undefined
        ? "__first__"
        : JSON.stringify(activeCursorRef.current);
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
    const deduped = Array.from(byId.values()).sort(
      (a, b) => b.date - a.date || (a._id < b._id ? 1 : -1),
    );
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
      total: sumNetExcludingTransfers(data),
    }));
    return entries.map((entry, index) => ({
      ...entry,
      completeDay: index < entries.length - 1 || !hasMore,
    }));
  }, [pagedTransactions, timezone, hasMore]);

  const summary = summaryResult ?? { income: 0, expense: 0, net: 0 };

  const activeFilterCount = filterBadgeCount(
    typeFilter !== "all",
    accountState,
    accountSelected,
    categoryState,
    categorySelected,
  );
  const dateActive =
    dateFilter === "lastMonth" ||
    (dateFilter === "custom" && !invalidCustomRange);
  const filtersActive = activeFilterCount > 0 || dateActive;

  const dateLabel = useMemo(() => {
    if (dateFilter === "thisMonth") return "This Month";
    if (dateFilter === "lastMonth") return "Last Month";
    return `${formatDateShortTz(startOfDay(customFrom).getTime(), timezone)} – ${formatDateShortTz(startOfDay(customTo).getTime(), timezone)}`;
  }, [dateFilter, customFrom, customTo, timezone]);

  const clearFilters = () => {
    setDateFilter("thisMonth");
    setTypeFilter("all");
    setAccountIds([]);
    setCategoryIds([]);
    clearSearch();
  };

  if (result !== undefined && result.transactions === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6 dark:bg-background-dark">
        <Text className="text-center text-sm text-text-secondary dark:text-text-secondary-dark">
          You are not a member of a household.
        </Text>
      </SafeAreaView>
    );
  }

  if (pagedTransactions === null) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        <View className="px-5 pt-4">
          <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
            Transactions
          </Text>
        </View>
        {(stale || isRetrying) && (
          <View className="pt-2">
            <ConnectivityBanner visible={stale || isRetrying} onRetry={handleRetry} isRetrying={isRetrying} />
          </View>
        )}
        <View className="mt-4 flex-row gap-2 px-5">
          {[0, 1].map((i) => (
            <Skeleton key={i} style={{ width: 120, height: 40, borderRadius: 999 }} />
          ))}
        </View>
        <View className="mt-4 px-5">
          <Skeleton style={{ height: 88, borderRadius: Radius.md }} />
        </View>
        <View className="mt-4 gap-3 px-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: 64, borderRadius: Radius.md }} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
          Transactions
        </Text>
      </View>

      <View className="mt-4 px-5">
        <View className="flex-row gap-2">
          <View className="flex-1 flex-row items-center gap-2 rounded-full border border-border bg-background px-4 dark:border-border-dark dark:bg-background-dark">
            <Feather name="search" size={16} color={C.textSecondary} />
            <TextInput
              value={searchDraft}
              onChangeText={setSearchDraft}
              placeholder="Search notes, amounts, accounts, categories…"
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
            <Text className="text-sm font-semibold" style={{ color: C.background }}>Search</Text>
          </Pressable>
        </View>
      </View>

      <View className="mt-4 flex-row gap-2 px-5">
        <HeaderPill
          icon="calendar"
          label={dateLabel}
          active={dateFilter !== "thisMonth"}
          onPress={() => setDateSheetOpen(true)}
        />
        <HeaderPill
          icon="filter"
          label={activeFilterCount > 0 ? `Filter · ${activeFilterCount}` : "Filter"}
          active={activeFilterCount > 0}
          onPress={() => setFilterSheetOpen(true)}
        />
      </View>

      <View className="mt-4 px-5">
        <GradientCard>
          <View className="flex-row items-center justify-between px-2 py-1">
            <View>
              <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">Income</Text>
              <Text className="text-base font-semibold text-success">
                +{formatNumber(summary.income)}
              </Text>
            </View>
            <View>
              <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">Expense</Text>
              <Text className="text-base font-semibold text-error">
                -{formatNumber(summary.expense)}
              </Text>
            </View>
            <View>
              <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">Net</Text>
              <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
                {formatNumber(summary.net)}
              </Text>
            </View>
          </View>
        </GradientCard>
      </View>

      {(stale || isRetrying) && (
        <View className="mt-3">
          <ConnectivityBanner visible={stale || isRetrying} onRetry={handleRetry} isRetrying={isRetrying} />
        </View>
      )}

      {sections !== null && sections.length === 0 ? (
        <SectionList
          className="mt-6 flex-1"
          contentContainerClassName="pb-28 px-5"
          sections={[]}
          keyExtractor={() => "empty"}
          removeClippedSubviews
          windowSize={7}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          renderItem={() => null}
          ListEmptyComponent={
            <View
              style={{ backgroundColor: C.background }}
              className="rounded-[16px]"
            >
              {invalidCustomRange ? (
                <EmptyState
                  icon="calendar"
                  title="Invalid date range"
                  description="Set a From date that is on or before the To date."
                  actionLabel="Adjust date range"
                  onAction={() => setDateSheetOpen(true)}
                />
              ) : searchCommitted.length >= 2 ? (
                <EmptyState
                  icon="search"
                  title={`No results for "${searchCommitted}"`}
                  description="Try a different keyword or clear search."
                  actionLabel="Clear search"
                  onAction={clearSearch}
                />
              ) : filtersActive ? (
                <EmptyState
                  icon="filter"
                  title="No transactions match your filters"
                  description="Try adjusting or clearing your filters."
                  actionLabel="Clear filters"
                  onAction={clearFilters}
                />
              ) : (
                <EmptyState
                  icon="book-open"
                  title="No transactions yet"
                  description="Start by recording your first transaction."
                  actionLabel="Add Transaction"
                  onAction={() => router.push("/transaction-form")}
                />
              )}
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setRefreshKey(k=>k+1);
                void hapticSuccess();
                setTimeout(() => setRefreshing(false), 600);
              }}
              tintColor={C.primary}
            />
          }
        />
      ) : (
        <SectionList
          className="mt-4 flex-1"
          contentContainerClassName="pb-28"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setRefreshKey(k=>k+1);
                void hapticSuccess();
                setTimeout(() => setRefreshing(false), 600);
              }}
              tintColor={C.primary}
            />
          }
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
          ListFooterComponent={
            isLoadingMore ? (
              <View className="items-center py-4">
                <ActivityIndicator color={C.primary} />
              </View>
            ) : null
          }
          renderSectionHeader={({ section }) => (
            <View className="flex-row items-center justify-between bg-background px-5 pb-1 pt-4 dark:bg-background-dark">
              <Text className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                {section.title}
              </Text>
              {section.completeDay ? (
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
              ) : null}
            </View>
          )}
          renderItem={({ item }) => (
            <View className="px-2">
              <TransactionCard
                categoryName={item.category?.name ?? null}
                isTransfer={item.type === "transfer"}
                toAccountName={item.toAccount?.name}
                note={item.note ?? null}
                amount={item.amount}
                type={item.type}
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
        />
      )}

      <Fab
        label="Add Transaction"
        onPress={() => router.push("/transaction-form")}
        accessibilityLabel="Add transaction"
      />

      <Modal
        visible={dateSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDateSheetOpen(false)}
        accessibilityLabel="Select date range"
      >
        <Pressable
          className="flex-1 justify-end bg-black/40 px-5 pb-8"
          onPress={() => setDateSheetOpen(false)}
        >
          <Pressable
            className="max-h-[70%] overflow-hidden rounded-2xl bg-background p-5 dark:bg-background-dark"
            style={Shadow.card}
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
              Date Range
            </Text>
            <View className="mt-3">
              {DATE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    setDateFilter(opt.id);
                    if (opt.id !== "custom") setDateSheetOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: dateFilter === opt.id }}
                  className="min-h-12 flex-row items-center justify-between"
                >
                  <Text className="text-base text-text-primary dark:text-text-primary-dark">
                    {opt.label}
                  </Text>
                  {dateFilter === opt.id ? (
                    <Feather name="check" size={18} color={C.primary} />
                  ) : null}
                </Pressable>
              ))}
            </View>
            {dateFilter === "custom" ? (
              <View className="mt-2 flex-row gap-3">
                <View className="flex-1">
                  <DateField
                    label="From"
                    value={customFrom}
                    maximumDate={new Date()}
                    onChange={setCustomFrom}
                  />
                </View>
                <View className="flex-1">
                  <DateField
                    label="To"
                    value={customTo}
                    maximumDate={new Date()}
                    error={
                      invalidCustomRange
                        ? "To date must be on or after the From date."
                        : null
                    }
                    onChange={setCustomTo}
                  />
                </View>
              </View>
            ) : null}
            <View className="mt-5">
              <Button title="Done" onPress={() => setDateSheetOpen(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <FilterSheet
        visible={filterSheetOpen}
        typeFilter={typeFilter}
        accountIds={accountIds}
        categoryIds={categoryIds}
        accounts={accountsResult?.accounts ?? []}
        categories={categoriesResult?.categories ?? []}
        onApply={(type, accountIds, categoryIds) => {
          setTypeFilter(type);
          setAccountIds(accountIds);
          setCategoryIds(categoryIds);
        }}
        onClose={() => setFilterSheetOpen(false)}
      />
    </SafeAreaView>
  );
}
