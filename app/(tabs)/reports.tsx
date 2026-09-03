import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import PagerView from "react-native-pager-view";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { MonthPicker } from "@/components/MonthPicker";
import { CategoryRankingCard } from "@/components/reports/CategoryRankingCard";
import { BillRankingCard } from "@/components/reports/BillRankingCard";
import { DeltaCard } from "@/components/charts/DeltaCard";
import { Skeleton } from "@/components/Skeleton";
import { buildPeriodWindow, formatPeriodLabel, getPeriodBounds, getPrevPeriod, getNextPeriod } from "@/utils/period";
import { resolveTimezone } from "@/constants/timezones";
import { hapticSuccess } from "@/lib/haptics";

export default function Reports() {
  const C = useThemeColors();
  const household = useQuery(api.households.getActive);
  const timezone = useMemo(() => resolveTimezone(household?.timezone), [household?.timezone]);

  const [nowTick, setNowTick] = useState(() => Date.now());
  const currentPeriodBounds = useMemo(() => getPeriodBounds(nowTick, timezone, "monthly"), [nowTick, timezone]);
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
  const pagerPeriods = useMemo(() => buildPeriodWindow(nowTick, timezone, "monthly", 12).periods, [nowTick, timezone]);

  const [selectedPeriodStart, setSelectedPeriodStart] = useState<number | null>(null);

  useEffect(() => {
    if (selectedPeriodStart === null && pagerPeriods.length > 0) {
      setSelectedPeriodStart(pagerPeriods[pagerPeriods.length - 1].periodStart);
    }
  }, [pagerPeriods, selectedPeriodStart]);

  const periodEnd = useMemo(() => {
    if (selectedPeriodStart === null) return undefined;
    return getPeriodBounds(selectedPeriodStart, timezone, "monthly").end;
  }, [selectedPeriodStart, timezone]);

  const [type, setType] = useState<"expenses" | "income">("expenses");
  const [pickerOpen, setPickerOpen] = useState(false);

  const pagerRef = useRef<PagerView>(null);

  const selectedIndex = useMemo(() => {
    if (selectedPeriodStart === null) return pagerPeriods.length - 1;
    const idx = pagerPeriods.findIndex((p) => p.periodStart === selectedPeriodStart);
    return idx >= 0 ? idx : pagerPeriods.length - 1;
  }, [pagerPeriods, selectedPeriodStart]);

  useEffect(() => {
    pagerRef.current?.setPageWithoutAnimation(selectedIndex);
  }, [selectedIndex, pagerPeriods.length]);

  const spending = useQuery(
    api.transactions.spendingByCategory,
    selectedPeriodStart !== null && periodEnd !== undefined ? { startDate: selectedPeriodStart, endDate: periodEnd } : "skip",
  );

  const incomeList = useQuery(
    api.transactions.list,
    household && type === "income" && selectedPeriodStart !== null && periodEnd !== undefined
      ? { startDate: selectedPeriodStart, endDate: periodEnd, type: "income", limit: 1000 }
      : "skip",
  );

  const balances = useQuery(
    api.periodBalances.get,
    selectedPeriodStart !== null ? { periodStart: selectedPeriodStart, periodType: "monthly", timezone } : "skip",
  );

  const prevStart = useMemo(() => {
    if (selectedPeriodStart === null) return null;
    return getPrevPeriod(selectedPeriodStart, timezone, "monthly");
  }, [selectedPeriodStart, timezone]);

  const prevBalances = useQuery(
    api.periodBalances.get,
    prevStart !== null ? { periodStart: prevStart, periodType: "monthly", timezone } : "skip",
  );

  const currentLabel = useMemo(() => {
    if (selectedPeriodStart === null) return "";
    return formatPeriodLabel(selectedPeriodStart, timezone, "monthly");
  }, [selectedPeriodStart, timezone]);

  const prevLabel = useMemo(() => {
    if (prevStart === null) return "";
    return formatPeriodLabel(prevStart, timezone, "monthly");
  }, [prevStart, timezone]);

  const isPrevDisabled = useMemo(() => {
    if (selectedPeriodStart === null) return true;
    if (pagerPeriods.length === 0) return true;
    return selectedPeriodStart <= pagerPeriods[0].periodStart;
  }, [selectedPeriodStart, pagerPeriods]);

  const isNextDisabled = useMemo(() => {
    if (selectedPeriodStart === null) return true;
    const next = getNextPeriod(selectedPeriodStart, timezone, "monthly");
    const curStart = currentPeriodBounds.start;
    return next > curStart;
  }, [selectedPeriodStart, timezone, currentPeriodBounds.start]);

  const handlePrev = useCallback(() => {
    if (selectedPeriodStart === null) return;
    if (isPrevDisabled) return;
    const prev = getPrevPeriod(selectedPeriodStart, timezone, "monthly");
    setSelectedPeriodStart(prev);
    void hapticSuccess();
    const idx = pagerPeriods.findIndex((p) => p.periodStart === prev);
    if (idx >= 0) pagerRef.current?.setPage(idx);
  }, [selectedPeriodStart, timezone, pagerPeriods, isPrevDisabled]);

  const handleNext = useCallback(() => {
    if (selectedPeriodStart === null) return;
    const next = getNextPeriod(selectedPeriodStart, timezone, "monthly");
    const curStart = currentPeriodBounds.start;
    if (next > curStart) return;
    setSelectedPeriodStart(next);
    void hapticSuccess();
    const idx = pagerPeriods.findIndex((p) => p.periodStart === next);
    if (idx >= 0) pagerRef.current?.setPage(idx);
  }, [selectedPeriodStart, timezone, pagerPeriods, currentPeriodBounds.start]);

  const [prevPressed, setPrevPressed] = useState(false);
  const [nextPressed, setNextPressed] = useState(false);
  const [headerPressed, setHeaderPressed] = useState(false);

  const toggleType = useCallback(() => {
    setType((t) => (t === "expenses" ? "income" : "expenses"));
    void hapticSuccess();
  }, []);

  const incomeAggregated = useMemo(() => {
    if (type !== "income") return null;
    if (incomeList === undefined) return undefined;
    if (incomeList === null || incomeList.transactions === null) return { segments: [], total: 0, othersAmount: 0 };
    const txs = incomeList.transactions;
    if (txs === undefined) return undefined;
    // incomeList.transactions is Tx[] | null ; handle null above
    const map = new Map<string, { name: string; amount: number }>();
    for (const tx of txs as unknown as { categoryId?: string; category?: { name: string }; amount: number }[]) {
      const key = tx.categoryId ? String(tx.categoryId) : "uncategorized";
      const name = tx.category?.name ?? "No category";
      const cur = map.get(key) ?? { name, amount: 0 };
      cur.amount += Math.abs(tx.amount);
      cur.name = name;
      map.set(key, cur);
    }
    const sorted = Array.from(map.values()).sort((a, b) => b.amount - a.amount);
    const total = sorted.reduce((s, x) => s + x.amount, 0);
    const segments = sorted.slice(0, 10);
    const othersAmount = sorted.length > 10 ? sorted.slice(10).reduce((s, x) => s + x.amount, 0) : 0;
    return { segments, total, othersAmount };
  }, [type, incomeList]);

  const expenseSegments = useMemo(() => spending?.segments ?? [], [spending]);
  const expenseTotal = useMemo(() => spending?.total ?? 0, [spending]);
  const expenseOthers = useMemo(() => spending?.othersAmount ?? 0, [spending]);

  const displaySegments = useMemo(() => {
    if (type === "expenses") return expenseSegments.map((s) => ({ name: s.name, amount: s.amount }));
    if (incomeAggregated === undefined) return [];
    if (incomeAggregated === null) return [];
    return incomeAggregated.segments;
  }, [type, expenseSegments, incomeAggregated]);

  const displayTotal = useMemo(() => {
    if (type === "expenses") return expenseTotal;
    if (incomeAggregated === undefined || incomeAggregated === null) return 0;
    return incomeAggregated.total;
  }, [type, expenseTotal, incomeAggregated]);

  const displayOthers = useMemo(() => {
    if (type === "expenses") return expenseOthers;
    if (incomeAggregated === undefined || incomeAggregated === null) return 0;
    return incomeAggregated.othersAmount;
  }, [type, expenseOthers, incomeAggregated]);

  const isLoadingSegments = useMemo(() => {
    if (type === "expenses") return spending === undefined;
    return incomeAggregated === undefined;
  }, [type, spending, incomeAggregated]);

  const currentClosing = useMemo(() => {
    if (balances && typeof balances.closingBalance === "number") return balances.closingBalance;
    if (balances) return (balances.income ?? 0) - (balances.expense ?? 0);
    return 0;
  }, [balances]);

  const prevClosing = useMemo(() => {
    if (prevBalances && typeof prevBalances.closingBalance === "number") return prevBalances.closingBalance;
    if (prevBalances) return (prevBalances.income ?? 0) - (prevBalances.expense ?? 0);
    return 0;
  }, [prevBalances]);

  if (household === undefined || selectedPeriodStart === null) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (household === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">No household</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      {/* Header with chevrons + MonthPicker + dots + Filter dummy */}
      <View className="px-5 pb-2 pt-4">
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
            style={{ flex: 1, alignItems: "center", gap: 4, opacity: headerPressed ? 0.7 : 1 }}
          >
            <View className="flex-row items-center gap-1">
              <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">{currentLabel} ▼</Text>
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
          return (
            <View key={String(p.periodStart)} collapsable={false} style={{ flex: 1 }}>
              {isSelected ? (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingBottom: 112, paddingTop: 16, gap: 16, paddingHorizontal: 20 }}
                  showsVerticalScrollIndicator={false}
                >
                  {isLoadingSegments ? (
                    <View style={[Shadow.card, { backgroundColor: C.background, borderRadius: Radius.md }]} className="p-4">
                      <Skeleton style={{ height: 20, borderRadius: Radius.sm }} />
                      <View className="mt-4">
                        <Skeleton style={{ width: 140, height: 140, borderRadius: 70, alignSelf: "center" }} />
                      </View>
                      <View className="mt-4 gap-2">
                        <Skeleton style={{ height: 16, borderRadius: Radius.sm }} />
                        <Skeleton style={{ height: 16, borderRadius: Radius.sm }} />
                        <Skeleton style={{ height: 16, borderRadius: Radius.sm }} />
                      </View>
                    </View>
                  ) : (
                    <CategoryRankingCard type={type} segments={displaySegments} total={displayTotal} othersAmount={displayOthers} onToggle={toggleType} />
                  )}

                  {isLoadingSegments ? (
                    <View style={[Shadow.card, { backgroundColor: C.background, borderRadius: Radius.md }]} className="p-4">
                      <Skeleton style={{ height: 20, borderRadius: Radius.sm }} />
                      <View className="mt-3 gap-2">
                        <Skeleton style={{ height: 14, borderRadius: Radius.sm }} />
                        <Skeleton style={{ height: 14, borderRadius: Radius.sm }} />
                      </View>
                    </View>
                  ) : (
                    <BillRankingCard type={type} segments={displaySegments} />
                  )}

                  {balances === undefined || prevBalances === undefined ? (
                    <View style={[Shadow.card, { backgroundColor: C.background, borderRadius: Radius.md }]} className="p-4">
                      <Skeleton style={{ height: 56, borderRadius: Radius.md }} />
                    </View>
                  ) : (
                    <DeltaCard
                      currentClosing={currentClosing}
                      prevClosing={prevClosing}
                      currentLabel={currentLabel}
                      prevLabel={prevLabel}
                      periodType="monthly"
                    />
                  )}
                </ScrollView>
              ) : (
                <View style={{ flex: 1 }} />
              )}
            </View>
          );
        })}
      </PagerView>
    </SafeAreaView>
  );
}
