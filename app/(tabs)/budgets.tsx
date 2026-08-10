import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useThemeColors } from "@/constants/theme";
import { Fab } from "@/components/Fab";
import { BudgetCard } from "@/components/BudgetCard";
import { EmptyState } from "@/components/EmptyState";
import { GradientCard } from "@/components/GradientCard";
import { useSnackbar } from "@/components/Snackbar";
import { formatNumber } from "@/utils/format";
import { addMonths, startOfMonth } from "@/utils/date";

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

export default function Budgets() {
  const router = useRouter();
  const C = useThemeColors();
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const { show } = useSnackbar();
  const removeBudget = useMutation(api.budgets.remove);

  const periodStart = selectedMonth.getTime();
  const periodEnd = addMonths(selectedMonth, 1).getTime();

  const result = useQuery(api.budgets.list, { periodStart, periodEnd });

  const budgets = result?.budgets ?? null;
  const isOwner = result?.isOwner ?? false;

  const summary = useMemo(() => {
    if (budgets === null || budgets.length === 0) {
      return { budgeted: 0, spent: 0 };
    }
    let budgeted = 0;
    let spent = 0;
    for (const b of budgets) {
      budgeted += b.amount;
      spent += b.spent;
    }
    return { budgeted, spent };
  }, [budgets]);

  const overallProgress = summary.budgeted > 0 ? summary.spent / summary.budgeted : 0;

  const handlePrevMonth = useCallback(() => {
    setSelectedMonth((prev) => addMonths(prev, -1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setSelectedMonth((prev) => addMonths(prev, 1));
  }, []);

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
                  const message = e instanceof Error ? e.message : "Failed to delete budget.";
                  Alert.alert("Error", message);
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
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color={C.primary} />
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
          {monthFormatter.format(selectedMonth)}
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
                  <Text
                    className={`text-base font-semibold ${
                      summary.spent > summary.budgeted
                        ? "text-error dark:text-error-dark"
                        : "text-text-primary dark:text-text-primary-dark"
                    }`}
                  >
                    {formatNumber(summary.spent)}
                  </Text>
                </View>
              </View>
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
              actionLabel={isOwner ? "Set Budget" : undefined}
              onAction={
                isOwner
                  ? () =>
                      router.push({
                        pathname: "/budget-form",
                        params: { periodStart: periodStart.toString() },
                      })
                  : undefined
              }
            />
          </View>
        </View>
      ) : (
        <FlatList
          className="mt-4 flex-1"
          contentContainerClassName="gap-3 px-5 pb-28"
          data={budgets}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) =>
            isOwner ? (
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
            ) : (
              <BudgetCard
                categoryName={item.category?.name ?? "Unknown"}
                categoryHidden={item.category?.hidden ?? false}
                budgetAmount={item.amount}
                spent={item.spent}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            )
          }
        />
      )}

      {isOwner ? (
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
      ) : null}
    </SafeAreaView>
  );
}
