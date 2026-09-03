import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { TransactionCard } from "@/components/TransactionCard";
import { FilterSheet, TypeFilter } from "@/components/FilterSheet";
import { DateField } from "@/components/DateField";
import { getDayBounds, formatDateShortTz } from "@/utils/date";
import { resolveTimezone } from "@/constants/timezones";
import { formatNumber } from "@/utils/format";
import { normalizeSelection } from "@/utils/filters";
import { Id } from "@/convex/_generated/dataModel";
import { EmptyState } from "@/components/EmptyState";

const PAGE_SIZE = 30;

export default function Search() {
  const router = useRouter();
  const C = useThemeColors();
  const household = useQuery(api.households.getActive);
  const accountData = useQuery(api.accounts.list);
  const categoriesResult = useQuery(api.categories.list);
  const tz = useMemo(() => resolveTimezone(household?.timezone), [household?.timezone]);

  // Default 14d window: today inclusive
  const today = useMemo(() => new Date(), []);
  const defaultEnd = useMemo(() => getDayBounds(today, tz).end, [today, tz]);
  const defaultStart = useMemo(
    () => getDayBounds(new Date(today.getTime() - 14 * 86400000), tz).start,
    [today, tz],
  );

  const [startDate, setStartDate] = useState<number>(defaultStart);
  const [endDate, setEndDate] = useState<number>(defaultEnd);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [accountIds, setAccountIds] = useState<Id<"accounts">[]>([]);
  const [categoryIds, setCategoryIds] = useState<Id<"categories">[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<Date>(new Date(defaultStart));
  const [draftTo, setDraftTo] = useState<Date>(new Date(defaultEnd - 1));

  // Keep draft dates in sync when sheet opens or window changes externally
  useEffect(() => {
    if (dateSheetOpen) {
      setDraftFrom(new Date(startDate));
      setDraftTo(new Date(endDate - 1));
    }
  }, [dateSheetOpen, startDate, endDate]);

  // Re-anchor defaults when tz resolves (only if not yet customized)
  // We keep user-chosen window; only initialize once on mount
  useEffect(() => {
    // if still defaults, recompute when tz changes before user customizes
    // Compare to initial defaults derived from first render: if user hasn't opened filter/date, keep updated
    // Simplify: if search/filter untouched and start==defaultStart, update
    // Skip to avoid overwriting user selection — only sync if close to default
    // Use a ref to track whether user modified dates
    // For MVP: no auto-resync after mount
  }, [tz, defaultStart, defaultEnd]);

  const dateLabel = useMemo(
    () => `${formatDateShortTz(startDate, tz)} – ${formatDateShortTz(endDate - 1, tz)}`,
    [startDate, endDate, tz],
  );

  const accountOptions = useMemo(() => accountData?.accounts ?? [], [accountData]);
  const categoryOptions = useMemo(() => categoriesResult?.categories ?? [], [categoriesResult]);

  const queryArgs = useMemo(() => {
    const normalizedAccounts = normalizeSelection(
      accountIds,
      accountOptions.map((a) => a._id),
    );
    const normalizedCategories = normalizeSelection(
      categoryIds,
      categoryOptions.map((c) => c._id),
    );
    return {
      startDate,
      endDate,
      ...(search.trim().length >= 2 ? { search: search.trim() } : {}),
      ...(typeFilter !== "all" ? { type: typeFilter } : {}),
      ...(normalizedAccounts !== undefined ? { accountIds: normalizedAccounts } : {}),
      ...(normalizedCategories !== undefined ? { categoryIds: normalizedCategories } : {}),
    } as {
      startDate: number;
      endDate: number;
      search?: string;
      type?: "income" | "expense" | "transfer";
      accountIds?: Id<"accounts">[];
      categoryIds?: Id<"categories">[];
    };
  }, [startDate, endDate, search, typeFilter, accountIds, categoryIds, accountOptions, categoryOptions]);

  const summary = useQuery(api.transactions.summary, queryArgs);

  const [activeCursor, setActiveCursor] = useState<{ date: number; id: Id<"transactions"> } | undefined>(undefined);
  const result = useQuery(api.transactions.list, {
    ...queryArgs,
    limit: PAGE_SIZE,
    ...(activeCursor !== undefined ? { cursor: activeCursor } : {}),
  });

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
    if (result === undefined) return;
    if (result.transactions === null) {
      setPagedTransactions(null);
      setHasMore(false);
      setNextCursor(undefined);
      setIsLoadingMore(false);
      pagesMapRef.current.clear();
      return;
    }
    const key = activeCursorRef.current === undefined ? "__first__" : JSON.stringify(activeCursorRef.current);
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

  const commitSearch = useCallback(() => {
    Keyboard.dismiss();
    setSearch(searchDraft.trim());
  }, [searchDraft]);

  const clearSearch = useCallback(() => {
    setSearchDraft("");
    setSearch("");
  }, []);

  const [backPressed, setBackPressed] = useState(false);
  const [dateChipPressed, setDateChipPressed] = useState(false);

  const handleApplyDates = useCallback(() => {
    const newStart = getDayBounds(draftFrom, tz).start;
    const newEnd = getDayBounds(draftTo, tz).end;
    // enforce future disabled: end cannot be after today
    const todayEnd = getDayBounds(new Date(), tz).end;
    const clampedEnd = Math.min(newEnd, todayEnd);
    // ensure start <= end-1
    if (newStart >= clampedEnd) {
      // if invalid, keep as is and just close (or swap)
      setDateSheetOpen(false);
      return;
    }
    setStartDate(newStart);
    setEndDate(clampedEnd);
    setDateSheetOpen(false);
  }, [draftFrom, draftTo, tz]);

  const billTypeLabel = useMemo(() => {
    if (typeFilter === "all") return "Bill type ▼";
    return `${typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1)} ▼`;
  }, [typeFilter]);

  const recordsCount = pagedTransactions?.length ?? 0;
  const summaryIncome = summary?.income ?? 0;
  const summaryExpense = summary?.expense ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      {/* Top bar: back + search input */}
      <View className="flex-row items-center gap-2 px-5 pb-2 pt-4">
        <Pressable
          onPress={() => router.back()}
          onPressIn={() => setBackPressed(true)}
          onPressOut={() => setBackPressed(false)}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: backPressed ? C.surface : C.background,
            borderWidth: 1,
            borderColor: C.border,
          }}
        >
          <Feather name="chevron-left" size={20} color={C.textPrimary} />
        </Pressable>
        <View className="flex-1 flex-row items-center gap-2 rounded-full border border-border bg-background px-4 dark:border-border-dark dark:bg-background-dark">
          <Feather name="search" size={16} color={C.textSecondary} />
          <TextInput
            value={searchDraft}
            onChangeText={setSearchDraft}
            placeholder="Categories, amount, tags, etc., separated by ','"
            placeholderTextColor={C.textSecondary}
            className="flex-1 py-3 text-base text-text-primary dark:text-text-primary-dark"
            accessibilityLabel="Search global"
            returnKeyType="search"
            onSubmitEditing={commitSearch}
          />
          {searchDraft.length > 0 ? (
            <Pressable onPress={clearSearch} accessibilityLabel="Clear search" className="h-10 w-10 items-center justify-center">
              <Feather name="x" size={16} color={C.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Chips row: Date first */}
      <View className="px-5">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {/* Date chip — first and functional */}
          <Pressable
            onPress={() => setDateSheetOpen(true)}
            onPressIn={() => setDateChipPressed(true)}
            onPressOut={() => setDateChipPressed(false)}
            accessibilityRole="button"
            accessibilityLabel="Date filter"
            style={[
              Shadow.card,
              {
                backgroundColor: dateChipPressed ? C.surface : C.primary,
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 8,
              },
            ]}
          >
            <Text className="text-sm font-medium" style={{ color: C.background }}>
              {dateLabel} ▼
            </Text>
          </Pressable>

          {/* Bill type chip */}
          <Pressable
            onPress={() => setFilterOpen(true)}
            accessibilityRole="button"
            style={{
              borderWidth: 1,
              borderColor: typeFilter !== "all" ? C.primary : C.border,
              backgroundColor: typeFilter !== "all" ? `${C.primary}14` : C.background,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text className="text-sm font-medium" style={{ color: typeFilter !== "all" ? C.primary : C.textSecondary }}>
              {billTypeLabel}
            </Text>
          </Pressable>

          {/* Category chip */}
          <Pressable
            onPress={() => setFilterOpen(true)}
            accessibilityRole="button"
            style={{
              borderWidth: 1,
              borderColor: categoryIds.length > 0 ? C.primary : C.border,
              backgroundColor: categoryIds.length > 0 ? `${C.primary}14` : C.background,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text className="text-sm font-medium" style={{ color: categoryIds.length > 0 ? C.primary : C.textSecondary }}>
              Category ▼
            </Text>
          </Pressable>

          {/* Ledger dummy */}
          <View
            style={{
              borderWidth: 1,
              borderColor: C.border,
              backgroundColor: C.background,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
              opacity: 0.4,
            }}
          >
            <Text className="text-sm font-medium" style={{ color: C.textSecondary }}>
              Ledger ▼
            </Text>
          </View>

          {/* Account chip */}
          <Pressable
            onPress={() => setFilterOpen(true)}
            accessibilityRole="button"
            style={{
              borderWidth: 1,
              borderColor: accountIds.length > 0 ? C.primary : C.border,
              backgroundColor: accountIds.length > 0 ? `${C.primary}14` : C.background,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text className="text-sm font-medium" style={{ color: accountIds.length > 0 ? C.primary : C.textSecondary }}>
              Account ▼
            </Text>
          </Pressable>

          {/* Tags dummy */}
          <View
            style={{
              borderWidth: 1,
              borderColor: C.border,
              backgroundColor: C.background,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
              opacity: 0.4,
            }}
          >
            <Text className="text-sm font-medium" style={{ color: C.textSecondary }}>
              Tags ▼
            </Text>
          </View>

          {/* Amount dummy */}
          <View
            style={{
              borderWidth: 1,
              borderColor: C.border,
              backgroundColor: C.background,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
              opacity: 0.4,
            }}
          >
            <Text className="text-sm font-medium" style={{ color: C.textSecondary }}>
              Amount ▼
            </Text>
          </View>
        </ScrollView>

        {/* Hint */}
        <Text className="mt-2 text-xs text-text-secondary dark:text-text-secondary-dark">Showing {dateLabel} • tap Date to change</Text>

        {/* Summary card Records N ↑ ↓ */}
        <View
          style={[Shadow.card, { backgroundColor: C.background, borderRadius: Radius.md }]}
          className="mt-3 flex-row items-center justify-between px-4 py-3"
        >
          <Text className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">Records {summary === undefined ? "–" : recordsCount}</Text>
          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-1">
              <Feather name="trending-up" size={14} color={C.success} />
              <Text className="text-sm font-medium" style={{ color: C.success }}>
                {formatNumber(summaryIncome)}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Feather name="trending-down" size={14} color={C.error} />
              <Text className="text-sm font-medium" style={{ color: C.error }}>
                {formatNumber(summaryExpense)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* FlatList 30/page cross-period without grouping */}
      <FlatList
        data={pagedTransactions ?? []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 8, paddingBottom: 32 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          result === undefined || pagedTransactions === null ? (
            <View className="items-center py-10">
              <ActivityIndicator color={C.primary} />
            </View>
          ) : (
            <View className="px-2 pt-4">
              <EmptyState icon="search" title="No results" description="Try adjusting your date or filters" />
            </View>
          )
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View className="items-center py-4">
              <ActivityIndicator color={C.primary} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View className="px-2">
            <TransactionCard
              categoryName={item.category?.name ?? null}
              isTransfer={item.type === "transfer"}
              toAccountName={item.toAccount?.name}
              accountName={item.account?.name}
              note={item.note ?? null}
              amount={item.amount}
              type={item.type as "income" | "expense" | "transfer"}
              date={item.date}
              timezone={tz}
              onPress={() => router.push({ pathname: "/transaction-form", params: { id: item._id } })}
            />
          </View>
        )}
      />

      {/* Date sheet modal with two DateField future disabled */}
      <Modal visible={dateSheetOpen} transparent animationType="fade" onRequestClose={() => setDateSheetOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40 px-5 pb-8" onPress={() => setDateSheetOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={Shadow.card} className="rounded-2xl bg-background p-5 dark:bg-background-dark">
            <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">Select date range</Text>
            <Text className="mt-1 text-xs text-text-secondary dark:text-text-secondary-dark">Future dates are disabled</Text>
            <View className="mt-4 gap-4">
              <DateField label="From" value={draftFrom} onChange={setDraftFrom} maximumDate={new Date()} />
              <DateField label="To" value={draftTo} onChange={setDraftTo} maximumDate={new Date()} />
            </View>
            <View className="mt-5 flex-row gap-3">
              <Pressable
                onPress={() => setDateSheetOpen(false)}
                accessibilityRole="button"
                className="h-12 flex-1 items-center justify-center rounded-xl border border-border dark:border-border-dark"
              >
                <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleApplyDates}
                accessibilityRole="button"
                style={{ backgroundColor: C.primary, borderRadius: Radius.md }}
                className="h-12 flex-1 items-center justify-center"
              >
                <Text className="text-sm font-semibold" style={{ color: C.background }}>
                  Apply
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
    </SafeAreaView>
  );
}
