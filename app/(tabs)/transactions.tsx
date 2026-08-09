import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  SectionList,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Colors, Shadow } from "@/constants/theme";
import { Chip } from "@/components/Chip";
import { Fab } from "@/components/Fab";
import { TransactionCard } from "@/components/TransactionCard";
import { EmptyState } from "@/components/EmptyState";
import { DateField } from "@/components/DateField";
import { GradientCard } from "@/components/GradientCard";
import { formatNumber } from "@/utils/format";
import {
  addMonths,
  formatDateHeader,
  startOfDay,
  startOfMonth,
} from "@/utils/date";

type DateFilter = "thisMonth" | "lastMonth" | "custom";

const FILTERS: { id: DateFilter; label: string }[] = [
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "custom", label: "Custom Range" },
];

export default function Transactions() {
  const router = useRouter();
  const [filter, setFilter] = useState<DateFilter>("thisMonth");
  const [customFrom, setCustomFrom] = useState(() => startOfDay(new Date()));
  const [customTo, setCustomTo] = useState(() => startOfDay(new Date()));

  const range = useMemo(() => {
    const now = new Date();
    if (filter === "thisMonth") {
      return {
        startDate: startOfMonth(now).getTime(),
        endDate: addMonths(now, 1).getTime(),
      };
    }
    if (filter === "lastMonth") {
      return {
        startDate: addMonths(now, -1).getTime(),
        endDate: startOfMonth(now).getTime(),
      };
    }
    return {
      startDate: startOfDay(customFrom).getTime(),
      endDate: startOfDay(customTo).getTime() + 24 * 60 * 60 * 1000,
    };
  }, [filter, customFrom, customTo]);

  const result = useQuery(api.transactions.list, range);

  const sections = useMemo(() => {
    const transactions = result?.transactions ?? null;
    if (transactions === null) return null;
    const groups = new Map<string, typeof transactions>();
    for (const tx of transactions) {
      const key = formatDateHeader(tx.date);
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
    }));
  }, [result]);

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

  if (result === undefined) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (result.transactions === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-sm text-text-secondary">
          You are not a member of a household.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-5 pt-4">
        <Text className="text-[28px] font-bold text-text-primary">
          Transactions
        </Text>
      </View>

      <View className="mt-4 flex-row flex-wrap gap-2 px-5">
        {FILTERS.map((f) => (
          <Chip
            key={f.id}
            label={f.label}
            active={filter === f.id}
            onPress={() => setFilter(f.id)}
          />
        ))}
      </View>

      {filter === "custom" ? (
        <View className="mt-4 flex-row gap-3 px-5">
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
              onChange={setCustomTo}
            />
          </View>
        </View>
      ) : null}

      <View className="mt-4 px-5">
        <GradientCard>
          <View className="flex-row items-center justify-between px-2 py-1">
            <View>
              <Text className="text-xs text-text-secondary">Income</Text>
              <Text className="text-base font-semibold text-success">
                +{formatNumber(summary.income)}
              </Text>
            </View>
            <View>
              <Text className="text-xs text-text-secondary">Expense</Text>
              <Text className="text-base font-semibold text-error">
                -{formatNumber(summary.expense)}
              </Text>
            </View>
            <View>
              <Text className="text-xs text-text-secondary">Net</Text>
              <Text className="text-base font-semibold text-text-primary">
                {formatNumber(summary.net)}
              </Text>
            </View>
          </View>
        </GradientCard>
      </View>

      {sections !== null && sections.length === 0 ? (
        <View className="mt-6 flex-1 px-5">
          <View style={Shadow.card} className="rounded-[16px] bg-background">
            <EmptyState
              icon="book-open"
              title="No transactions yet"
              description="Start by recording your first transaction."
              actionLabel="Add Transaction"
              onAction={() => router.push("/transaction-form")}
            />
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
            <View className="bg-background px-5 pb-1 pt-4">
              <Text className="text-sm font-semibold text-text-primary">
                {section.title}
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
    </SafeAreaView>
  );
}
