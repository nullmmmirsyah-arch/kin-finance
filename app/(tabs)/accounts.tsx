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
import Feather from "@expo/vector-icons/Feather";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { ACCOUNT_TYPES, AccountType } from "@/constants/accounts";
import { Chip } from "@/components/Chip";
import { Fab } from "@/components/Fab";
import { AccountCard } from "@/components/AccountCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { useSnackbar } from "@/components/Snackbar";
import { ConnectivityBanner } from "@/components/ConnectivityBanner";
import { getConvexErrorMessage } from "@/lib/errors";
import { useConnectivity } from "@/hooks/useConnectivity";
import { hapticError, hapticSuccess } from "@/lib/haptics";

type Filter = "all" | AccountType;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  ...ACCOUNT_TYPES.map((t) => ({ id: t.id as Filter, label: t.label })),
];

export default function Accounts() {
  const router = useRouter();
  const result = useQuery(api.accounts.list);
  const verifyResult = useQuery(api.accounts.verify);
  const reconcile = useMutation(api.accounts.reconcile);
  const removeAccount = useMutation(api.accounts.remove);
  const { show } = useSnackbar();
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const isConnected = useConnectivity();
  const [refreshKey, setRefreshKey] = useState(0);
  const C = useThemeColors();

  const handleReconcile = useCallback(() => {
    if (isReconciling) return;
    const count = verifyResult?.discrepancies?.length ?? 0;
    Alert.alert(
      "Recalculate Balances?",
      count > 0
        ? `${count} account(s) out of sync. Recalculate from transaction history? This will correct stored balances.`
        : "Recalculate all account balances from transaction history?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Recalculate",
          style: "default",
          onPress: async () => {
            setIsReconciling(true);
            try {
              const res = await reconcile({});
              void hapticSuccess();
              show(res.fixed > 0 ? `Fixed ${res.fixed} account(s)` : "Balances already in sync");
            } catch (e: unknown) {
              void hapticError();
              show(getConvexErrorMessage(e, "Failed to recalculate balances."));
            } finally {
              setIsReconciling(false);
            }
          },
        },
      ],
    );
  }, [isReconciling, reconcile, show, verifyResult]);

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
                  show(`"${account.name}" deleted`);
                })
                .catch((e: unknown) => {
                  const message = getConvexErrorMessage(
                    e,
                    "Failed to delete account.",
                  );
                  show(message);
                });
            },
          },
        ],
      );
    },
    [removeAccount, show],
  );

  if (result === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        <View className="px-5 pt-4">
          <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">Accounts</Text>
        </View>
        {stale && (
          <View className="pt-2">
            <ConnectivityBanner visible={stale} onRetry={() => { setStale(false); setRefreshKey(k=>k+1); show("Retrying…"); void hapticSuccess(); }} />
          </View>
        )}
        <View className="mt-4 flex-row flex-wrap gap-2 px-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ width: 72, height: 40, borderRadius: 999 }} />
          ))}
        </View>
        <View className="mt-4 gap-3 px-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ height: 72, borderRadius: Radius.md }} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (accounts === null) {
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
        <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">Accounts</Text>
      </View>

      {stale && (
        <View className="pt-2">
          <ConnectivityBanner visible={stale} onRetry={() => { setStale(false); setRefreshKey(k=>k+1); show("Retrying…"); void hapticSuccess(); }} />
        </View>
      )}

      {isOwner && verifyResult && verifyResult.discrepancies.length > 0 ? (
        <View className="mt-4 px-5">
          <View
            style={[Shadow.card, { borderRadius: Radius.md, backgroundColor: C.surface, borderWidth: 1, borderColor: C.chartAmber }]}
            className="gap-2 px-4 py-3"
          >
            <View className="flex-row items-center gap-2">
              <Feather name="alert-triangle" size={18} color={C.chartAmber} />
              <Text className="flex-1 text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                {verifyResult.discrepancies.length} account(s) out of sync
              </Text>
            </View>
            <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
              Stored balances don&apos;t match transaction history. Tap to recalculate.
            </Text>
            <Pressable
              onPress={handleReconcile}
              disabled={isReconciling}
              accessibilityRole="button"
              accessibilityLabel="Recalculate balances"
              style={{ backgroundColor: C.primary, borderRadius: Radius.sm, opacity: isReconciling ? 0.6 : 1 }}
              className="mt-1 items-center justify-center py-2.5"
            >
              <Text className="text-sm font-semibold" style={{ color: C.background }}>
                {isReconciling ? "Recalculating…" : "Recalculate"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

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
        <FlatList
          className="mt-6 flex-1"
          contentContainerClassName="gap-3 px-5 pb-28"
          removeClippedSubviews
          windowSize={5}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setRefreshKey(k=>k+1);
                void hapticSuccess();
                setTimeout(() => setRefreshing(false), 600);
              }}
              tintColor={C.primary}
            />
          }
          data={[]}
          keyExtractor={() => "empty"}
          renderItem={() => null}
          ListEmptyComponent={
            <View
              style={{ backgroundColor: C.background }}
              className="rounded-[16px]"
            >
              <EmptyState
                icon="credit-card"
                title="No accounts yet"
                description={
                  isOwner
                    ? "Add your first account to start tracking your money."
                    : "Only the Owner can add accounts. Contact your household Owner to set up your first account."
                }
                actionLabel={isOwner ? "Add Account" : undefined}
                onAction={
                  isOwner ? () => router.push("/account-form") : undefined
                }
              />
            </View>
          }
        />
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
                setRefreshKey(k=>k+1);
                void hapticSuccess();
                setTimeout(() => setRefreshing(false), 600);
              }}
              tintColor={C.primary}
            />
          }
          data={visibleAccounts ?? []}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) =>
            isOwner ? (
              <AccountCard
                name={item.name}
                type={item.type}
                balance={item.balance}
                hidden={item.hidden}
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
                hidden={item.hidden}
              />
            )
          }
        />
      )}

      {isOwner ? (
        <Fab
          label="Add Account"
          onPress={() => router.push("/account-form")}
          accessibilityLabel="Add account"
        />
      ) : null}
    </SafeAreaView>
  );
}
