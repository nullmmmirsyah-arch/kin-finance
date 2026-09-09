import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import PagerView from "react-native-pager-view";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Radius, Shadow, useThemeColors, useThemeGradients } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fab } from "@/components/Fab";
import { BudgetCard } from "@/components/BudgetCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { useSnackbar } from "@/components/Snackbar";
import { ConnectivityBanner } from "@/components/ConnectivityBanner";
import { formatNumber } from "@/utils/format";
import { formatMonthLabel } from "@/utils/date";
import { resolveTimezone } from "@/constants/timezones";
import { getConvexErrorMessage } from "@/lib/errors";
import { useConnectivity } from "@/hooks/useConnectivity";
import { hapticSuccess } from "@/lib/haptics";
import { BearFamilyRow } from "@/components/BearFaceless";
import { buildPeriodWindow, formatPeriodShortLabel, getPeriodBounds } from "@/utils/period";
import { PeriodHeader } from "@/components/PeriodHeader";
import { MonthPicker } from "@/components/MonthPicker";

export default function Budgets() {
  const router = useRouter();
  const C = useThemeColors();
  const G = useThemeGradients();
  const { show } = useSnackbar();
  const removeBudget = useMutation(api.budgets.remove);
  const household = useQuery(api.households.getActive);

  const timezone = resolveTimezone(household?.timezone);
  const periodType = "monthly" as const;

  const [selectedMonthStart, setSelectedMonthStart] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const isConnected = useConnectivity();
  const [refreshKey, setRefreshKey] = useState(0);

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

  useEffect(() => {
    if (selectedMonthStart === null) {
      setSelectedMonthStart(getPeriodBounds(Date.now(), timezone, periodType).start);
    }
  }, [timezone, periodType, selectedMonthStart]);

  useEffect(() => {
    if (household !== undefined && selectedMonthStart !== null) {
      const cur = getPeriodBounds(Date.now(), timezone, periodType).start;
      const expected = getPeriodBounds(selectedMonthStart, timezone, periodType).start;
      if (expected !== selectedMonthStart) {
        setSelectedMonthStart(cur);
      }
    }
  }, [household, timezone, periodType, selectedMonthStart]);

  const monthStart = selectedMonthStart ?? getPeriodBounds(Date.now(), timezone, periodType).start;
  const periodStart = monthStart;
  const periodEnd = getPeriodBounds(monthStart, timezone, periodType).end;

  const pagerPeriods = useMemo(
    () => buildPeriodWindow(nowTick, timezone, periodType, 12).periods,
    [nowTick, timezone, periodType],
  );
  const pagerRef = useRef<PagerView>(null);
  const selectedIndex = useMemo(() => {
    if (selectedMonthStart === null) return pagerPeriods.length - 1;
    const idx = pagerPeriods.findIndex((p) => p.periodStart === selectedMonthStart);
    return idx >= 0 ? idx : pagerPeriods.length - 1;
  }, [pagerPeriods, selectedMonthStart]);

  useEffect(() => {
    pagerRef.current?.setPageWithoutAnimation(selectedIndex);
  }, [selectedIndex, pagerPeriods]);

  const result = useQuery(api.budgets.list, { periodStart, periodEnd });

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

  const budgets = result?.budgets ?? null;

  const summary = useMemo(() => {
    if (budgets === null || budgets.length === 0) {
      return { budgeted: 0, spent: 0, hasRedacted: false };
    }
    let budgeted = 0;
    let spent = 0;
    let hasRedacted = false;
    for (const b of budgets) {
      budgeted += b.amount;
      if (b.spent === undefined) {
        hasRedacted = true;
      } else {
        spent += b.spent;
      }
    }
    return { budgeted, spent, hasRedacted };
  }, [budgets]);

  const overallProgress = summary.hasRedacted
    ? 0
    : summary.budgeted > 0
      ? summary.spent / summary.budgeted
      : 0;
  const overallHoneyLevel = summary.hasRedacted ? 0 : Math.max(1 - overallProgress, 0);
  const remainingOverall = summary.budgeted - summary.spent;

  const isPrevDisabled = useMemo(() => {
    if (selectedMonthStart === null) return true;
    if (pagerPeriods.length === 0) return true;
    return selectedMonthStart <= pagerPeriods[0].periodStart;
  }, [selectedMonthStart, pagerPeriods]);

  const isNextDisabled = useMemo(() => {
    if (selectedMonthStart === null) return true;
    const next = getPeriodBounds(selectedMonthStart, timezone, periodType).end;
    const curStart = getPeriodBounds(Date.now(), timezone, periodType).start;
    return next > curStart;
  }, [selectedMonthStart, timezone, periodType]);

  const handlePrevMonth = useCallback(() => {
    if (selectedMonthStart === null) return;
    if (isPrevDisabled) return;
    const prev = getPeriodBounds(selectedMonthStart - 1, timezone, periodType).start;
    setSelectedMonthStart(prev);
    void hapticSuccess();
    const idx = pagerPeriods.findIndex((p) => p.periodStart === prev);
    if (idx >= 0) pagerRef.current?.setPage(idx);
  }, [selectedMonthStart, timezone, periodType, pagerPeriods, isPrevDisabled]);

  const handleNextMonth = useCallback(() => {
    if (selectedMonthStart === null) return;
    if (isNextDisabled) return;
    const next = getPeriodBounds(selectedMonthStart, timezone, periodType).end;
    setSelectedMonthStart(next);
    void hapticSuccess();
    const idx = pagerPeriods.findIndex((p) => p.periodStart === next);
    if (idx >= 0) pagerRef.current?.setPage(idx);
  }, [selectedMonthStart, timezone, periodType, pagerPeriods, isNextDisabled]);

  const handleDelete = useCallback(
    (budget: { _id: Id<"budgets">; category: { name: string } | undefined }) => {
      Alert.alert(
        "Delete Budget",
        `Delete budget for "${budget.category?.name ?? "Unknown"}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              removeBudget({ budgetId: budget._id })
                .then(() => {
                  show(`Budget for "${budget.category?.name ?? "Unknown"}" deleted`);
                })
                .catch((e: unknown) => {
                  show(getConvexErrorMessage(e, "Failed to delete budget."));
                });
            },
          },
        ],
      );
    },
    [removeBudget, show],
  );

  const shortLabel = formatPeriodShortLabel(periodStart, timezone, "monthly");
  const fullLabel = formatMonthLabel(periodStart, timezone);

  if (result === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        <View className="px-5 pt-4">
          <ScreenHeader title="Budgets" kicker="Honey pantry" icon="archive" />
        </View>
        {stale && (
          <View className="pt-2">
            <ConnectivityBanner
              visible={stale}
              onRetry={() => {
                setStale(false);
                setRefreshKey((k) => k + 1);
                show("Retrying…");
                void hapticSuccess();
              }}
            />
          </View>
        )}
        <View className="mt-4 gap-3 px-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ height: 96, borderRadius: Radius.md }} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (budgets === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6 dark:bg-background-dark">
        <Text className="text-center text-[15px] leading-5 text-text-secondary dark:text-text-secondary-dark">You are not a member of a household.</Text>
      </SafeAreaView>
    );
  }

  const jarKicker =
    budgets.length > 0
      ? `Honey pantry • ${budgets.length} ${budgets.length === 1 ? "jar" : "jars"}`
      : "Honey pantry";

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <ScreenHeader
          title="Budgets"
          kicker={jarKicker}
          icon="archive"
          accessory={
            <View style={{ opacity: 0.85 }}>
              <BearFamilyRow size={20} />
            </View>
          }
        />

        {/* Period header — shared PeriodHeader */}
        <PeriodHeader
          label={shortLabel}
          a11yLabel={fullLabel}
          onPrev={handlePrevMonth}
          onNext={handleNextMonth}
          isPrevDisabled={isPrevDisabled}
          isNextDisabled={isNextDisabled}
          onOpenPicker={() => setPickerOpen(true)}
        />

        <MonthPicker
          visible={pickerOpen}
          selectedPeriodStart={selectedMonthStart ?? periodStart}
          tz={timezone}
          onSelect={(ps) => {
            setSelectedMonthStart(ps);
            const idx = pagerPeriods.findIndex((p) => p.periodStart === ps);
            if (idx >= 0) pagerRef.current?.setPage(idx);
          }}
          onClose={() => setPickerOpen(false)}
        />
      </View>

      {stale && (
        <View className="pt-3">
          <ConnectivityBanner
            visible={stale}
            onRetry={() => {
              setStale(false);
              setRefreshKey((k) => k + 1);
              show("Retrying…");
              void hapticSuccess();
            }}
          />
        </View>
      )}

      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={selectedIndex}
        offscreenPageLimit={1}
        onPageSelected={(e) => {
          const pos = e.nativeEvent.position;
          const p = pagerPeriods[pos];
          if (p && p.periodStart !== selectedMonthStart) {
            setSelectedMonthStart(p.periodStart);
            void hapticSuccess();
          }
        }}
      >
        {pagerPeriods.map((p) => {
          const isSelected = p.periodStart === selectedMonthStart;
          return (
            <View key={String(p.periodStart)} collapsable={false} style={{ flex: 1 }}>
              {isSelected ? (
                <View style={{ flex: 1 }}>
                  {budgets.length > 0 ? (
                    <View className="mt-5 px-5">
                      <View
                        style={[
                          Shadow.card,
                          {
                            borderRadius: Radius.lg,
                            borderWidth: 1,
                            borderColor: C.border,
                            overflow: "hidden",
                          },
                        ]}
                      >
                        <LinearGradient
                          colors={G.card as unknown as [string, string]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{ padding: 20, gap: 12 }}
                        >
                          <View className="flex-row items-center justify-between">
                            <Text className="text-[11px] font-semibold uppercase leading-3 tracking-[0.08em] text-text-secondary dark:text-text-secondary-dark">
                              Total • {budgets.length} {budgets.length === 1 ? "jar" : "jars"}
                            </Text>
                            <Text
                              style={{ color: summary.hasRedacted ? C.textSecondary : overallProgress > 1 ? C.error : overallProgress > 0.8 ? C.primary : C.textSecondary }}
                              className="text-[11px] font-semibold tracking-[0.08em] leading-3"
                            >
                              {summary.hasRedacted ? "SOME PRIVATE" : overallProgress > 1 ? "OVER" : overallProgress > 0.8 ? "ALMOST EMPTY" : "ON TRACK"}
                            </Text>
                          </View>

                          <View className="flex-row gap-4">
                            <View className="flex-1 gap-1">
                              <Text className="text-[11px] font-semibold tracking-[0.08em] leading-3 text-text-secondary dark:text-text-secondary-dark">BUDGETED</Text>
                              <Text className="text-[28px] font-bold leading-7 tracking-[-0.02em] tabular-nums text-text-primary dark:text-text-primary-dark">{formatNumber(summary.budgeted)}</Text>
                              <Text className="text-[13px] leading-4 tracking-wide text-text-secondary dark:text-text-secondary-dark">Jar capacity</Text>
                            </View>
                            <View style={{ width: 1, backgroundColor: C.border, opacity: 0.6 }} />
                            <View className="flex-1 gap-1">
                              <Text className="text-[11px] font-semibold tracking-[0.08em] leading-3 text-text-secondary dark:text-text-secondary-dark">SPENT</Text>
                              {summary.hasRedacted ? (
                                <Text className="text-[28px] font-bold leading-7 tracking-[-0.02em] tabular-nums text-text-secondary dark:text-text-secondary-dark">—</Text>
                              ) : (
                                <Text
                                  style={{ color: overallProgress > 1 ? C.error : undefined }}
                                  className={`text-[28px] font-bold leading-7 tracking-[-0.02em] tabular-nums ${overallProgress > 1 ? "text-error dark:text-error-dark" : "text-text-primary dark:text-text-primary-dark"}`}
                                >
                                  {formatNumber(summary.spent)}
                                </Text>
                              )}
                              <Text className="text-[13px] leading-4 tracking-wide text-text-secondary dark:text-text-secondary-dark">
                                {summary.hasRedacted ? "— left • some jars private" : remainingOverall >= 0 ? `${formatNumber(remainingOverall)} left` : `${formatNumber(Math.abs(remainingOverall))} over`}
                              </Text>
                            </View>
                          </View>

                          {summary.hasRedacted ? (
                            <View
                              style={{
                                height: 6,
                                borderRadius: 999,
                                backgroundColor: C.background,
                                borderWidth: 1,
                                borderColor: C.border,
                                borderStyle: "dashed",
                              }}
                            />
                          ) : (
                            <View style={{ gap: 6 }}>
                              <View
                                style={{
                                  height: 6,
                                  borderRadius: 999,
                                  backgroundColor: C.background,
                                  borderWidth: 1,
                                  borderColor: C.border,
                                  overflow: "hidden",
                                }}
                              >
                                <View
                                  style={{
                                    width: `${overallHoneyLevel * 100}%`,
                                    height: "100%",
                                    borderRadius: 999,
                                    backgroundColor: overallProgress > 1 ? C.error : C.primary,
                                    opacity: 0.7,
                                  }}
                                />
                              </View>
                              <View className="flex-row justify-between">
                                <Text className="text-[13px] leading-4 tracking-wide text-text-secondary dark:text-text-secondary-dark">
                                  {overallProgress > 1 ? "Empty • overflow" : `${Math.round(overallHoneyLevel * 100)}% honey left`}
                                </Text>
                                <Text className="text-[13px] leading-4 tracking-wide text-text-secondary dark:text-text-secondary-dark">{budgets.length} categories</Text>
                              </View>
                            </View>
                          )}
                        </LinearGradient>
                      </View>
                    </View>
                  ) : null}

                  {budgets.length === 0 ? (
                    <View className="mt-8 flex-1 px-5">
                      <View
                        style={{
                          backgroundColor: C.background,
                          borderRadius: Radius.md,
                          borderWidth: 1,
                          borderColor: C.border,
                          overflow: "hidden",
                        }}
                      >
                        <View style={{ height: 3, backgroundColor: C.pantryWood, opacity: 0.4 }} />
                        <View className="items-center gap-3 px-6 py-10">
                          <View style={{ opacity: 0.9 }}>
                            <BearFamilyRow size={24} />
                          </View>
                          <EmptyState
                            icon="archive"
                            title="No budgets yet"
                            description="Set a monthly budget per category. Members can manage budgets; hidden categories stay frosted without spending detail."
                            actionLabel="Set Budget"
                            onAction={() => router.push({ pathname: "/budget-form", params: { periodStart: periodStart.toString() } })}
                          />
                        </View>
                      </View>
                    </View>
                  ) : (
                    <FlatList
                      className="mt-5 flex-1"
                      contentContainerClassName="gap-3 px-5 pb-28"
                      removeClippedSubviews
                      windowSize={7}
                      initialNumToRender={10}
                      maxToRenderPerBatch={8}
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
                          tintColor={C.textSecondary}
                        />
                      }
                      data={budgets}
                      keyExtractor={(item) => item._id}
                      renderItem={({ item }) => (
                        <BudgetCard
                          categoryName={item.category?.name ?? "Unknown"}
                          categoryIcon={item.category?.icon}
                          categoryHidden={item.category?.hidden ?? false}
                          budgetAmount={item.amount}
                          spent={item.spent}
                          onEdit={() => router.push({ pathname: "/budget-form", params: { id: item._id } })}
                          onDelete={() => handleDelete(item)}
                        />
                      )}
                    />
                  )}
                </View>
              ) : (
                <View style={{ flex: 1, backgroundColor: C.background }} />
              )}
            </View>
          );
        })}
      </PagerView>

      <Fab label="Set Budget" onPress={() => router.push({ pathname: "/budget-form", params: { periodStart: periodStart.toString() } })} accessibilityLabel="Set budget" />
    </SafeAreaView>
  );
}
