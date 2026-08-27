import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Radius, useThemeColors } from "@/constants/theme";
import { Fab } from "@/components/Fab";
import { BudgetCard } from "@/components/BudgetCard";
import { EmptyState } from "@/components/EmptyState";
import { GradientCard } from "@/components/GradientCard";
import { Skeleton } from "@/components/Skeleton";
import { useSnackbar } from "@/components/Snackbar";
import { ConnectivityBanner } from "@/components/ConnectivityBanner";
import { formatNumber } from "@/utils/format";
import { formatMonthLabel, getMonthBounds } from "@/utils/date";
import { resolveTimezone } from "@/constants/timezones";
import { getConvexErrorMessage } from "@/lib/errors";

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

  const monthStart =
    selectedMonthStart ?? getMonthBounds(Date.now(), timezone).start;
  const periodStart = monthStart;
  const periodEnd = getMonthBounds(monthStart, timezone).end;

  const result = useQuery(api.budgets.list, { periodStart, periodEnd });

  useEffect(() => {
    if (result !== undefined) {
      setStale(false);
      return;
    }
    const t = setTimeout(() => setStale(true), 3000);
    return () => clearTimeout(t);
  }, [result]);

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

  const overallProgress =
    summary.hasRedacted ? 0 : summary.budgeted > 0 ? summary.spent / summary.budgeted : 0;

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
                  show(
                    getConvexErrorMessage(e, "Failed to delete budget."),
                  );
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
          <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
            Budgets
          </Text>
        </View>
        <View className="mt-4 items-center justify-center gap-4 px-5">
          <Skeleton style={{ width: 200, height: 40, borderRadius: 999 }} />
        </View>
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
          Budgets
        </Text>
      </View>

      {stale && (
        <View className="pt-2">
          <ConnectivityBanner visible={stale} onRetry={() => { setStale(false); show("Retrying…"); }} />
        </View>
      )}

      <View className="mt-4 flex-row items-center justify-center gap-4 px-5">
        <Pressable
          onPress={handlePrevMonth}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          className="h-10 w-10 items-center justify-center rounded-full bg-surface dark:bg-surface-dark"
        >
          <Text className="text-lg text-primary dark:text-primary-dark">{"<"}</Text>
        </Pressable>
        <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
          {formatMonthLabel(periodStart, timezone)}
        </Text>
        <Pressable
          onPress={handleNextMonth}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          className="h-10 w-10 items-center justify-center rounded-full bg-surface dark:bg-surface-dark"
        >
          <Text className="text-lg text-primary dark:text-primary-dark">{">"}</Text>
        </Pressable>
      </View>

      {budgets.length > 0 ? (
        <View className="mt-4 px-5">
          <GradientCard>
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
                    Budgeted
                  </Text>
                  <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
                    {formatNumber(summary.budgeted)}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
                    Spent
                  </Text>
                  {summary.hasRedacted ? (
                    <Text className="text-base font-semibold text-text-secondary dark:text-text-secondary-dark">
                      —
                    </Text>
                  ) : (
                    <Text
                      className={`text-base font-semibold ${
                        summary.spent > summary.budgeted
                          ? "text-error dark:text-error-dark"
                          : "text-text-primary dark:text-text-primary-dark"
                      }`}
                    >
                      {formatNumber(summary.spent)}
                    </Text>
                  )}
                </View>
              </View>
              {summary.hasRedacted ? null : (
                <View
                  style={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: C.border,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: "100%",
                      width: `${Math.min(overallProgress, 1) * 100}%`,
                      backgroundColor: summary.spent > summary.budgeted ? C.error : C.primary,
                      borderRadius: 4,
                    }}
                  />
                </View>
              )}
            </View>
          </GradientCard>
        </View>
      ) : null}

      {budgets.length === 0 ? (
        <View className="mt-6 flex-1 px-5">
          <View
            style={{ backgroundColor: C.background }}
            className="rounded-[16px]"
          >
            <EmptyState
              icon="pie-chart"
              title="No budgets yet"
              description="Set budgets to control your spending."
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
      ) : (
        <FlatList
          className="mt-4 flex-1"
          contentContainerClassName="gap-3 px-5 pb-28"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
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
