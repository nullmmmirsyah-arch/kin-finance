import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import Feather from "@expo/vector-icons/Feather";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Shadow, useThemeColors } from "@/constants/theme";
import { ACCOUNT_TYPES, AccountType } from "@/constants/accounts";
import { Chip } from "@/components/Chip";
import { Fab } from "@/components/Fab";
import { VaultCard, VaultHero, VaultAdd } from "@/components/VaultCard";
import { Bear } from "@/components/Bear";
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
  const [reconcilePressed, setReconcilePressed] = useState(false);
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

  const vaultTotal = useMemo(() => {
    if (!accounts) return 0;
    return accounts.reduce((sum, a) => sum + a.balance, 0);
  }, [accounts]);

  type GridItem = NonNullable<typeof accounts>[number];
  const gridData: GridItem[] = useMemo(() => {
    return (visibleAccounts ?? []) as GridItem[];
  }, [visibleAccounts]);

  const isEmptyFiltered = visibleAccounts !== null && visibleAccounts.length === 0;

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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    void hapticSuccess();
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  if (result === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        <View className="px-5 pt-4">
          <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">Bear Vault</Text>
          <Text className="mt-0.5 text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
            Your accounts, guarded by bears
          </Text>
        </View>
        {stale && (
          <View className="pt-3">
            <ConnectivityBanner visible={stale} onRetry={() => { setStale(false); setRefreshKey(k=>k+1); show("Retrying…"); void hapticSuccess(); }} />
          </View>
        )}
        <View className="mt-4 flex-row gap-2 px-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ width: 72, height: 40, borderRadius: 999 }} />
          ))}
        </View>
        <View className="mt-4 flex-row flex-wrap gap-2.5 px-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ flex: 1, minWidth: 150, height: 198, borderRadius: 24 }} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (accounts === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6 dark:bg-background-dark">
        <View className="items-center gap-3">
          <View className="flex-row items-end gap-2">
            <Bear size="mid" />
            <Bear size="normal" />
          </View>
          <Text className="text-center text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
            You are not a member of a household.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <Text className="text-[28px] font-bold leading-8 text-text-primary dark:text-text-primary-dark">Bear Vault</Text>
        <Text className="mt-1 text-[13px] font-medium leading-4 text-text-secondary dark:text-text-secondary-dark">
          Your accounts, guarded by bears
        </Text>
      </View>

      {stale && (
        <View className="pt-3">
          <ConnectivityBanner visible={stale} onRetry={() => { setStale(false); setRefreshKey(k=>k+1); show("Retrying…"); void hapticSuccess(); }} />
        </View>
      )}

      {isOwner && verifyResult && verifyResult.discrepancies.length > 0 ? (
        <View className="mt-4 px-5">
          <View
            testID="reconcile-banner"
            style={[
              Shadow.card,
              {
                borderRadius: 20,
                backgroundColor: C.card,
                borderWidth: 2.5,
                borderColor: C.cardBorder,
                overflow: "hidden",
              },
            ]}
          >
            <View className="gap-3 p-4">
              <View className="flex-row items-start gap-3">
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: C.plushSurfaceAlt,
                    borderWidth: 1.5,
                    borderColor: C.plushCreamBorder,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Feather name="alert-triangle" size={16} color={C.chartAmber} />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-[14px] font-extrabold leading-5 text-text-primary dark:text-text-primary-dark">
                    {verifyResult.discrepancies.length} account{verifyResult.discrepancies.length === 1 ? "" : "s"} out of sync
                  </Text>
                  <Text className="text-[12px] font-medium leading-4 text-text-secondary dark:text-text-secondary-dark">
                    Stored balances don&apos;t match transaction history. Recalculate to fix.
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={handleReconcile}
                onPressIn={() => setReconcilePressed(true)}
                onPressOut={() => setReconcilePressed(false)}
                disabled={isReconciling}
                accessibilityRole="button"
                accessibilityLabel="Recalculate balances"
                style={{
                  height: 44,
                  borderRadius: 999,
                  backgroundColor: C.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isReconciling ? 0.6 : reconcilePressed ? 0.85 : 1,
                }}
              >
                <Text className="text-[13px] font-extrabold" style={{ color: C.background }}>
                  {isReconciling ? "Recalculating…" : "Recalculate"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {/* VaultHero */}
      <View className="mt-4 px-5">
        <VaultHero total={vaultTotal} count={accounts.length} />
      </View>

      {/* Filter chips — horizontal scroll, Operate scanability */}
      <View className="mt-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {FILTERS.map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              active={filter === f.id}
              onPress={() => setFilter(f.id)}
            />
          ))}
        </ScrollView>
      </View>

      {isEmptyFiltered ? (
        <ScrollView
          className="mt-4 flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 112, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
          }
        >
          {isOwner ? (
            <View style={{ marginBottom: 4 }}>
              <VaultAdd onPress={() => router.push("/account-form")} />
            </View>
          ) : null}
          <View style={{ alignItems: "center", gap: 10, paddingTop: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, justifyContent: "center" }}>
              <Bear size="mid" />
              <Bear size="normal" />
            </View>
            <View
              style={{
                backgroundColor: C.card,
                borderRadius: 20,
                borderWidth: 2.5,
                borderColor: C.cardBorder,
                overflow: "hidden",
                width: "100%",
              }}
            >
              <EmptyState
                icon="credit-card"
                title={filter === "all" ? "No vaults yet" : `No ${filter} vaults`}
                description={
                  filter === "all"
                    ? isOwner
                      ? "Add your first vault to start tracking your money."
                      : "Only the Owner can add vaults. Contact your household Owner."
                    : `No accounts match "${filter}". Try another filter.`
                }
                actionLabel={isOwner && filter === "all" ? "Add Vault" : undefined}
                onAction={
                  isOwner && filter === "all" ? () => router.push("/account-form") : undefined
                }
              />
            </View>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          className="mt-4 flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 112, gap: 10, paddingTop: 4 }}
          columnWrapperStyle={gridData.length > 1 ? ({ gap: 10 } as unknown as object) : undefined}
          numColumns={2}
          removeClippedSubviews
          windowSize={7}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
          }
          data={gridData}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item }) => {
            const acc = item as typeof accounts[number];
            return isOwner ? (
              <VaultCard
                name={acc.name}
                type={acc.type}
                balance={acc.balance}
                hidden={acc.hidden}
                onEdit={() =>
                  router.push({
                    pathname: "/account-form",
                    params: { id: acc._id },
                  })
                }
                onDelete={() => handleDelete(acc)}
              />
            ) : (
              <VaultCard
                name={acc.name}
                type={acc.type}
                balance={acc.balance}
                hidden={acc.hidden}
              />
            );
          }}
          ListFooterComponent={
            isOwner ? (
              <View style={{ paddingTop: 10 }}>
                <VaultAdd onPress={() => router.push("/account-form")} />
              </View>
            ) : null
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
