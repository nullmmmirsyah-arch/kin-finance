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
          <Text className="text-[28px] font-semibold tracking-tight text-text-primary dark:text-text-primary-dark">Budgets</Text>
          <Text className="text-sm font-normal text-text-secondary dark:text-text-secondary-dark">Bear family honey pantry</Text>
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
        <Text className="text-center text-sm text-text-secondary dark:text-text-secondary-dark">You are not a member of a household.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      {/* Quiet header */}
      <View className="px-5 pt-5">
        <View className="flex-row items-center justify-between">
          <View className="gap-1">
            <Text className="text-[26px] font-semibold tracking-tight text-text-primary dark:text-text-primary-dark">
              Budgets
            </Text>
            <Text className="text-sm font-normal text-text-secondary dark:text-text-secondary-dark">
              Honey pantry • {budgets.length > 0 ? `${budgets.length} jars` : "bear family"}
            </Text>
          </View>
          <View style={{ opacity: 0.85 }}>
            <BearFamilyRow size={20} />
          </View>
        </View>

        {/* Quiet month switcher */}
        <View className="mt-5 flex-row items-center justify-between gap-3">
          <Pressable
            onPress={handlePrevMonth}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={{ width: 40, height: 40, borderRadius: Radius.md, backgroundColor: C.background, borderWidth: 1, borderColor: C.border }}
            className="items-center justify-center"
          >
            <Feather name="chevron-left" size={18} color={C.textSecondary} />
          </Pressable>

          <View
            style={{
              flex: 1,
              backgroundColor: C.background,
              borderColor: C.border,
              borderWidth: 1,
              borderRadius: Radius.md,
              paddingHorizontal: 14,
              paddingVertical: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: C.surface,
                borderWidth: 1,
                borderColor: C.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="calendar" size={14} color={C.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text className="text-[10px] font-semibold tracking-wide text-text-secondary dark:text-text-secondary-dark">
                PERIOD
              </Text>
              <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                {formatMonthLabel(periodStart, timezone)}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleNextMonth}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={{ width: 40, height: 40, borderRadius: Radius.md, backgroundColor: C.background, borderWidth: 1, borderColor: C.border }}
            className="items-center justify-center"
          >
            <Feather name="chevron-right" size={18} color={C.textSecondary} />
          </Pressable>
        </View>
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

      {budgets.length > 0 ? (
        <View className="mt-5 px-5">
          {/* Quiet pantry summary — flat, tonal, no heavy wood */}
          <View
            style={[
              Shadow.card,
              {
                borderRadius: Radius.md,
                backgroundColor: C.surface,
                borderWidth: 1,
                borderColor: C.border,
                overflow: "hidden",
              },
            ]}
          >
            <View style={{ height: 3, backgroundColor: C.pantryWood, opacity: 0.5 }} />
            <View style={{ padding: 16, gap: 12 }}>
              <View className="flex-row items-center justify-between">
                <Text className="text-[11px] font-medium tracking-wide text-text-secondary dark:text-text-secondary-dark">
                  TOTAL • {budgets.length} JARS
                </Text>
                <Text
                  style={{ color: summary.hasRedacted ? C.textSecondary : overallProgress > 1 ? C.error : overallProgress > 0.8 ? C.primary : C.textSecondary }}
                  className="text-[11px] font-semibold tracking-wide"
                >
                  {summary.hasRedacted ? "SOME PRIVATE" : overallProgress > 1 ? "OVER" : overallProgress > 0.8 ? "ALMOST EMPTY" : "ON TRACK"}
                </Text>
              </View>

              <View className="flex-row gap-4">
                <View className="flex-1 gap-1">
                  <Text className="text-[11px] font-medium tracking-wide text-text-secondary dark:text-text-secondary-dark">
                    BUDGETED
                  </Text>
                  <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
                    {formatNumber(summary.budgeted)}
                  </Text>
                  <Text className="text-xs font-normal text-text-secondary dark:text-text-secondary-dark">Jar capacity</Text>
                </View>
                <View style={{ width: 1, backgroundColor: C.border, opacity: 0.6 }} />
                <View className="flex-1 gap-1">
                  <Text className="text-[11px] font-medium tracking-wide text-text-secondary dark:text-text-secondary-dark">
                    SPENT
                  </Text>
                  {summary.hasRedacted ? (
                    <Text className="text-base font-semibold text-text-secondary dark:text-text-secondary-dark">—</Text>
                  ) : (
                    <Text
                      style={{ color: overallProgress > 1 ? C.error : undefined }}
                      className={`text-base font-semibold ${overallProgress > 1 ? "text-error dark:text-error-dark" : "text-text-primary dark:text-text-primary-dark"}`}
                    >
                      {formatNumber(summary.spent)}
                    </Text>
                  )}
                  <Text className="text-xs font-normal text-text-secondary dark:text-text-secondary-dark">
                    {summary.hasRedacted ? "Frosted" : remainingOverall >= 0 ? `${formatNumber(remainingOverall)} left` : `${formatNumber(Math.abs(remainingOverall))} over`}
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
                    <Text className="text-xs font-normal text-text-secondary dark:text-text-secondary-dark">
                      {overallProgress > 1 ? "Empty • overflow" : `${Math.round(overallHoneyLevel * 100)}% honey left`}
                    </Text>
                    <Text className="text-xs font-normal text-text-secondary dark:text-text-secondary-dark">
                      {budgets.length} categories
                    </Text>
                  </View>
                </View>
              )}
            </View>
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
              <Text className="text-center text-sm font-normal text-text-secondary dark:text-text-secondary-dark">Pantry is empty</Text>
              <EmptyState
                icon="archive"
                title="No budgets yet"
                description="Set a budget for each category to track your spending."
                actionLabel="Set Budget"
                onAction={() =>
                  router.push({
                    pathname: "/budget-form",
                    params: { periodStart: periodStart.toString() },
                  })
                }
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

      <Fab label="Set Budget" onPress={() => router.push({ pathname: "/budget-form", params: { periodStart: periodStart.toString() } })} accessibilityLabel="Set budget" />
    </SafeAreaView>
  );
}
