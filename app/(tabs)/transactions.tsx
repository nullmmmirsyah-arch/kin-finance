import { ComponentProps, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  SectionList,
  Text,
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
import { formatNumber, sumNetExcludingTransfers } from "@/utils/format";
import {
  formatDateHeaderTz,
  formatDateShortTz,
  getDayBounds,
  getMonthBounds,
  startOfDay,
} from "@/utils/date";
import { resolveTimezone } from "@/constants/timezones";

type DateFilter = "thisMonth" | "lastMonth" | "custom";

const DATE_OPTIONS: { id: DateFilter; label: string }[] = [
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "custom", label: "Custom Range" },
];

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
  const [dateFilter, setDateFilter] = useState<DateFilter>("thisMonth");
  const [customFrom, setCustomFrom] = useState(() => startOfDay(new Date()));
  const [customTo, setCustomTo] = useState(() => startOfDay(new Date()));
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [accountFilter, setAccountFilter] = useState<Id<"accounts"> | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<Id<"categories"> | null>(null);
  const household = useQuery(api.households.getActive);

  const timezone = resolveTimezone(household?.timezone);

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

  const queryArgs = useMemo(
    () => ({
      ...range,
      ...(typeFilter !== "all" ? { type: typeFilter } : {}),
      ...(accountFilter !== null ? { accountId: accountFilter } : {}),
      ...(categoryFilter !== null ? { categoryId: categoryFilter } : {}),
    }),
    [range, typeFilter, accountFilter, categoryFilter],
  );

  const result = useQuery(api.transactions.list, queryArgs);

  const sections = useMemo(() => {
    const transactions = result?.transactions ?? null;
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
    return Array.from(groups.entries()).map(([title, data]) => ({
      title,
      data,
      total: sumNetExcludingTransfers(data),
    }));
  }, [result, timezone]);

  const summary = useMemo(() => {
    const transactions = result?.transactions ?? [];
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      if (tx.type === "income") income += tx.amount;
      else if (tx.type === "expense") expense += Math.abs(tx.amount);
    }
    return { income, expense, net: income - expense };
  }, [result]);

  const filtersActive =
    typeFilter !== "all" || accountFilter !== null || categoryFilter !== null;
  const activeFilterCount =
    (typeFilter !== "all" ? 1 : 0) +
    (accountFilter !== null ? 1 : 0) +
    (categoryFilter !== null ? 1 : 0);

  const dateLabel = useMemo(() => {
    if (dateFilter === "thisMonth") return "This Month";
    if (dateFilter === "lastMonth") return "Last Month";
    return `${formatDateShortTz(startOfDay(customFrom).getTime(), timezone)} – ${formatDateShortTz(startOfDay(customTo).getTime(), timezone)}`;
  }, [dateFilter, customFrom, customTo, timezone]);

  const clearFilters = () => {
    setTypeFilter("all");
    setAccountFilter(null);
    setCategoryFilter(null);
  };

  if (result === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        <View className="px-5 pt-4">
          <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
            Transactions
          </Text>
        </View>
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

  if (result.transactions === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6 dark:bg-background-dark">
        <Text className="text-center text-sm text-text-secondary dark:text-text-secondary-dark">
          You are not a member of a household.
        </Text>
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

      <View className="mt-4 flex-row gap-2 px-5">
        <HeaderPill
          icon="calendar"
          label={dateLabel}
          active={false}
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

      {sections !== null && sections.length === 0 ? (
        <View className="mt-6 flex-1 px-5">
          <View
            style={{ backgroundColor: C.background }}
            className="rounded-[16px]"
          >
            {filtersActive ? (
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
        </View>
      ) : (
        <SectionList
          className="mt-4 flex-1"
          contentContainerClassName="pb-28"
          sections={sections ?? []}
          keyExtractor={(item) => item._id}
          stickySectionHeadersEnabled={false}
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
        accountFilter={accountFilter}
        categoryFilter={categoryFilter}
        accounts={accountsResult?.accounts ?? []}
        categories={categoriesResult?.categories ?? []}
        onTypeFilterChange={(type) => {
          setTypeFilter(type);
          setCategoryFilter((current) => {
            if (current === null || type === "all") return current;
            if (type === "transfer") return null;
            const cat = categoriesResult?.categories?.find((c) => c._id === current);
            if (cat && cat.type !== type) return null;
            return current;
          });
        }}
        onAccountFilterChange={setAccountFilter}
        onCategoryFilterChange={setCategoryFilter}
        onReset={clearFilters}
        onClose={() => setFilterSheetOpen(false)}
      />
    </SafeAreaView>
  );
}
