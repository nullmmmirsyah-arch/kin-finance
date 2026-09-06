import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { Fab } from "@/components/Fab";
import { BudgetCard } from "@/components/BudgetCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { useSnackbar } from "@/components/Snackbar";
import { ConnectivityBanner } from "@/components/ConnectivityBanner";
import { formatNumber } from "@/utils/format";
import { formatMonthLabel, getMonthBounds } from "@/utils/date";
import { resolveTimezone } from "@/constants/timezones";
import { getConvexErrorMessage } from "@/lib/errors";
import { useConnectivity } from "@/hooks/useConnectivity";
import { hapticSuccess } from "@/lib/haptics";
import { LinearGradient } from "expo-linear-gradient";
import { BearFamilyRow } from "@/components/BearFaceless";
import Feather from "@expo/vector-icons/Feather";

export default function Budgets() {
  const router = useRouter();
  const C = useThemeColors();
  const { show } = useSnackbar();
  const removeBudget = useMutation(api.budgets.remove);
  const household = useQuery(api.households.getActive);

  const timezone = resolveTimezone(household?.timezone);

  const [selectedMonthStart, setSelectedMonthStart] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const isConnected = useConnectivity();
  const [refreshKey, setRefreshKey] = useState(0);

  const monthStart = selectedMonthStart ?? getMonthBounds(Date.now(), timezone).start;
  const periodStart = monthStart;
  const periodEnd = getMonthBounds(monthStart, timezone).end;

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

  const handlePrevMonth = useCallback(() => {
    setSelectedMonthStart((prev) => {
      const current = prev ?? getMonthBounds(Date.now(), timezone).start;
      return getMonthBounds(current - 1, timezone).start;
    });
  }, [timezone]);

  const handleNextMonth = useCallback(() => {
    setSelectedMonthStart((prev) => {
      const current = prev ?? getMonthBounds(Date.now(), timezone).start;
      return getMonthBounds(current, timezone).end;
    });
  }, [timezone]);

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

  if (result === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        <View className="px-5 pt-4">
          <Text className="text-[28px] font-bold tracking-tight text-text-primary dark:text-text-primary-dark">Pantry</Text>
          <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">Bear Family • Honey Jars</Text>
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
        <View className="mt-4 items-center justify-center gap-4 px-5">
          <Skeleton style={{ width: 200, height: 40, borderRadius: 999 }} />
        </View>
        <View className="mt-4 gap-3 px-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ height: 140, borderRadius: 20 }} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (budgets === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6 dark:bg-background-dark">
        <Text className="text-center text-sm text-text-secondary dark:text-text-secondary-dark">You are not a member of a household.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      {/* Header - Bear Pantry */}
      <View className="px-5 pt-4">
        <View className="flex-row items-start justify-between">
          <View>
            <View className="flex-row items-center gap-2">
              <Text className="text-[28px] font-bold tracking-tight text-text-primary dark:text-text-primary-dark">Pantry</Text>
              <View
                style={{
                  backgroundColor: C.primaryLight,
                  borderWidth: 1,
                  borderColor: `${C.primary}18`,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                }}
              >
                <Text className="text-[10px] font-bold tracking-[0.14em] text-primary">BUDGETS</Text>
              </View>
            </View>
            <Text className="mt-1 text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
              Bear family honey pantry
            </Text>
          </View>
          <BearFamilyRow size={26} />
        </View>

        {/* Wooden month tag */}
        <View className="mt-4 flex-row items-center justify-between">
          <Pressable
            onPress={handlePrevMonth}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={{ width: 44, height: 44, borderRadius: Radius.md, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }}
            className="items-center justify-center"
          >
            <Feather name="chevron-left" size={18} color={C.primary} />
          </Pressable>

          <View
            style={[
              Shadow.card,
              {
                backgroundColor: C.background,
                borderColor: C.border,
                borderWidth: 1,
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              },
            ]}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: C.background,
                borderWidth: 1,
                borderColor: C.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="calendar" size={16} color={C.primary} />
            </View>
            <View>
              <Text className="text-[10px] font-bold tracking-[0.14em] text-text-secondary dark:text-text-secondary-dark">PERIOD</Text>
              <Text className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                {formatMonthLabel(periodStart, timezone)}
              </Text>
            </View>
            <View
              style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: C.pantryWood, opacity: 0.35 }}
            />
          </View>

          <Pressable
            onPress={handleNextMonth}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={{ width: 44, height: 44, borderRadius: Radius.md, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }}
            className="items-center justify-center"
          >
            <Feather name="chevron-right" size={18} color={C.primary} />
          </Pressable>
        </View>
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

      {budgets.length > 0 ? (
        <View className="mt-4 px-5">
          {/* Pantry Shelf Hero */}
          <View
            style={[
              Shadow.card,
              {
                borderRadius: 20,
                backgroundColor: C.background,
                borderWidth: 1,
                borderColor: C.border,
                overflow: "hidden",
              },
            ]}
          >
            {/* top wood plank */}
            <View style={{ height: 14, backgroundColor: C.pantryWood, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <View style={{ width: 40, height: 3, borderRadius: 999, backgroundColor: C.pantryWoodDark, opacity: 0.7 }} />
              <View style={{ width: 18, height: 3, borderRadius: 999, backgroundColor: C.pantryWoodDark, opacity: 0.4 }} />
            </View>
            <View style={{ height: 2, backgroundColor: C.pantryWoodDeep, opacity: 0.2 }} />

            <LinearGradient
              colors={[C.background, C.surface]}
              style={{ padding: 16, gap: 14 }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: C.primary }} />
                  <Text className="text-[11px] font-bold tracking-[0.14em] text-text-secondary dark:text-text-secondary-dark">
                    TOTAL PANTRY • {budgets.length} JARS
                  </Text>
                </View>
                <View style={{ backgroundColor: summary.hasRedacted ? C.surface : overallProgress > 1 ? C.deltaNegativeBg : overallProgress > 0.8 ? C.primaryLight : C.deltaPositiveBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: summary.hasRedacted ? C.border : overallProgress > 1 ? C.deltaNegativeBorder : overallProgress > 0.8 ? C.primaryLight : C.deltaPositiveBorder }}>
                  <Text
                    style={{ color: summary.hasRedacted ? C.textSecondary : overallProgress > 1 ? C.error : overallProgress > 0.8 ? C.primary : C.success }}
                    className="text-[11px] font-bold tracking-widest"
                  >
                    {summary.hasRedacted ? "SOME PRIVATE" : overallProgress > 1 ? "OVERFLOW" : overallProgress > 0.8 ? "ALMOST EMPTY" : "ON TRACK"}
                  </Text>
                </View>
              </View>

              <View className="flex-row gap-3">
                <View style={{ flex: 1, backgroundColor: C.background, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 12, gap: 6 }}>
                  <View className="flex-row items-center gap-1.5">
                    <Feather name="archive" size={12} color={C.textSecondary} />
                    <Text className="text-[10px] font-bold tracking-[0.12em] text-text-secondary dark:text-text-secondary-dark">BUDGETED</Text>
                  </View>
                  <Text className="text-lg font-bold tracking-tight text-text-primary dark:text-text-primary-dark">
                    {formatNumber(summary.budgeted)}
                  </Text>
                  <Text className="text-[11px] text-text-secondary dark:text-text-secondary-dark">Jar capacity</Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: summary.hasRedacted ? C.surface : C.background,
                    borderWidth: 1,
                    borderColor: C.border,
                    borderRadius: 16,
                    padding: 12,
                    gap: 6,
                    opacity: summary.hasRedacted ? 0.7 : 1,
                  }}
                >
                  <View className="flex-row items-center gap-1.5">
                    <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: summary.hasRedacted ? C.textSecondary : overallProgress > 1 ? C.error : C.primary }} />
                    <Text className="text-[10px] font-bold tracking-[0.12em] text-text-secondary dark:text-text-secondary-dark">SPENT</Text>
                  </View>
                  {summary.hasRedacted ? (
                    <Text className="text-lg font-bold text-text-secondary dark:text-text-secondary-dark">—</Text>
                  ) : (
                    <Text
                      style={{ color: overallProgress > 1 ? C.error : undefined }}
                      className={`text-lg font-bold tracking-tight ${overallProgress > 1 ? "text-error dark:text-error-dark" : "text-text-primary dark:text-text-primary-dark"}`}
                    >
                      {formatNumber(summary.spent)}
                    </Text>
                  )}
                  <Text className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                    {summary.hasRedacted ? "Frosted jars hidden" : remainingOverall >= 0 ? `${formatNumber(remainingOverall)} left` : `${formatNumber(Math.abs(remainingOverall))} over`}
                  </Text>
                </View>
              </View>

              {summary.hasRedacted ? (
                <View
                  style={{
                    height: 12,
                    borderRadius: 999,
                    backgroundColor: C.surface,
                    borderWidth: 1,
                    borderColor: C.border,
                    borderStyle: "dashed",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text className="text-[9px] font-bold tracking-[0.12em] text-text-secondary dark:text-text-secondary-dark">SOME JARS ARE FROSTED • PRIVATE</Text>
                </View>
              ) : (
                <View style={{ gap: 6 }}>
                  <View
                    style={{
                      height: 14,
                      borderRadius: 999,
                      backgroundColor: C.background,
                      borderWidth: 1,
                      borderColor: C.border,
                      overflow: "hidden",
                      padding: 3,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        borderRadius: 999,
                        overflow: "hidden",
                        backgroundColor: C.border,
                      }}
                    >
                      <LinearGradient
                        colors={overallProgress > 1 ? [C.error, C.error] : [C.primaryLight, C.primary]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={{ width: `${overallHoneyLevel * 100}%`, flex: 1, borderRadius: 999 }}
                      />
                    </View>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-xs font-medium text-text-secondary dark:text-text-secondary-dark">
                      {overallProgress > 1 ? "Empty • overflow" : `${Math.round(overallHoneyLevel * 100)}% honey left`}
                    </Text>
                    <Text className="text-xs font-medium text-text-secondary dark:text-text-secondary-dark">
                      {budgets.length} categories • {formatMonthLabel(periodStart, timezone)}
                    </Text>
                  </View>
                </View>
              )}
            </LinearGradient>

            {/* bottom wood plank */}
            <View style={{ height: 10, backgroundColor: C.pantryWood }} />
            <View style={{ height: 6, backgroundColor: C.pantryWoodDark, opacity: 0.25 }} />
          </View>
        </View>
      ) : null}

      {budgets.length === 0 ? (
        <View className="mt-6 flex-1 px-5">
          <View
            style={[
              Shadow.card,
              {
                backgroundColor: C.background,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: C.border,
                overflow: "hidden",
              },
            ]}
          >
            {/* empty pantry shelf top */}
            <View style={{ height: 14, backgroundColor: C.pantryWood }} />
            <View className="items-center gap-4 px-6 py-10">
              <View className="items-center gap-3">
                <BearFamilyRow size={32} />
                <View style={{ height: 6, width: 120, borderRadius: 999, backgroundColor: C.pantryWood, opacity: 0.1 }} />
                <Text className="text-center text-sm text-text-secondary dark:text-text-secondary-dark">zZ • pantry is empty</Text>
              </View>
              <EmptyState
                icon="archive"
                title="Pantry is empty"
                description="Fill your first honey pantry — set a budget for each expense category."
                actionLabel="Fill First Jar"
                onAction={() =>
                  router.push({
                    pathname: "/budget-form",
                    params: { periodStart: periodStart.toString() },
                  })
                }
              />
              <View className="flex-row gap-2">
                <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", opacity: 0.7 }}>
                  <Feather name="plus" size={18} color={C.textSecondary} />
                </View>
                <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
                  <Feather name="plus" size={18} color={C.textSecondary} />
                </View>
                <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", opacity: 0.35 }}>
                  <Feather name="plus" size={18} color={C.textSecondary} />
                </View>
              </View>
            </View>
            <View style={{ height: 10, backgroundColor: C.pantryWood }} />
          </View>
        </View>
      ) : (
        <FlatList
          className="mt-4 flex-1"
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
              tintColor={C.primary}
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
              onEdit={() =>
                router.push({
                  pathname: "/budget-form",
                  params: { id: item._id },
                })
              }
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      <Fab
        label="Set Budget"
        onPress={() =>
          router.push({
            pathname: "/budget-form",
            params: { periodStart: periodStart.toString() },
          })
        }
        accessibilityLabel="Set budget"
      />
    </SafeAreaView>
  );
}
