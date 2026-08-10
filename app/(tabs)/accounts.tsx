import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useThemeColors } from "@/constants/theme";
import { ACCOUNT_TYPES, AccountType } from "@/constants/accounts";
import { Chip } from "@/components/Chip";
import { Fab } from "@/components/Fab";
import { AccountCard } from "@/components/AccountCard";
import { EmptyState } from "@/components/EmptyState";
import { useSnackbar } from "@/components/Snackbar";

type Filter = "all" | AccountType;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  ...ACCOUNT_TYPES.map((t) => ({ id: t.id as Filter, label: t.label })),
];

export default function Accounts() {
  const router = useRouter();
  const result = useQuery(api.accounts.list);
  const removeAccount = useMutation(api.accounts.remove);
  const { show } = useSnackbar();
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);
  const C = useThemeColors();

  const accounts = result?.accounts ?? null;
  const isOwner = result?.isOwner ?? false;

  const visibleAccounts = useMemo(() => {
    if (accounts === null) return null;
    return filter === "all"
      ? accounts
      : accounts.filter((a) => a.type === filter);
  }, [accounts, filter]);

  const handleDelete = useCallback(
    (account: { _id: Id<"accounts">; name: string }) => {
      setError(null);
      Alert.alert(
        "Delete Account",
        `Delete "${account.name}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              removeAccount({ accountId: account._id })
                .then(() => {
                  setError(null);
                  show(`"${account.name}" deleted`);
                })
                .catch((e: unknown) => {
                  const message =
                    e instanceof Error ? e.message : "Failed to delete account.";
                  setError(message);
                });
            },
          },
        ],
      );
    },
    [removeAccount],
  );

  if (accounts === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color={C.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">Accounts</Text>
        {error ? (
          <Text className="mt-2 text-sm text-error dark:text-error-dark">{error}</Text>
        ) : null}
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

      {visibleAccounts !== null && visibleAccounts.length === 0 ? (
        <View className="mt-6 flex-1 px-5">
          <View
            style={{ backgroundColor: C.background }}
            className="rounded-[16px]"
          >
            <EmptyState
              icon="credit-card"
              title="No accounts yet"
              description="Add your first account to start tracking your money."
              actionLabel={isOwner ? "Add Account" : undefined}
              onAction={
                isOwner ? () => router.push("/account-form") : undefined
              }
            />
          </View>
        </View>
      ) : (
        <FlatList
          className="mt-4 flex-1"
          contentContainerClassName="gap-3 px-5 pb-28"
          data={visibleAccounts ?? []}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) =>
            isOwner ? (
              <AccountCard
                name={item.name}
                type={item.type}
                balance={item.balance}
                onEdit={() =>
                  router.push({
                    pathname: "/account-form",
                    params: { id: item._id },
                  })
                }
                onDelete={() => handleDelete(item)}
              />
            ) : (
              <AccountCard
                name={item.name}
                type={item.type}
                balance={item.balance}
              />
            )
          }
        />
      )}

      {isOwner ? (
        <Fab
          onPress={() => router.push("/account-form")}
          accessibilityLabel="Add account"
        />
      ) : null}
    </SafeAreaView>
  );
}
