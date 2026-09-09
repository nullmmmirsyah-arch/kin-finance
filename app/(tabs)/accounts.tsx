import { useCallback, useEffect, useMemo, useState, useRef } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@expo/vector-icons/Feather";
import Animated, {
  FadeIn,
  FadeInUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Radius,
  Shadow,
  useThemeColors,
  useThemeGradients,
} from "@/constants/theme";
import { ACCOUNT_TYPES, AccountType } from "@/constants/accounts";
import { Fab } from "@/components/Fab";
import { AccountIcon } from "@/components/AccountIcon";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { useSnackbar } from "@/components/Snackbar";
import { ConnectivityBanner } from "@/components/ConnectivityBanner";
import { getConvexErrorMessage } from "@/lib/errors";
import { useConnectivity } from "@/hooks/useConnectivity";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import * as Haptics from "expo-haptics";
import { formatNumber } from "@/utils/format";
import { ScreenHeader } from "@/components/ScreenHeader";

type Filter = "all" | AccountType;

const FILTERS: { id: Filter; label: string; icon: string }[] = [
  { id: "all", label: "All", icon: "layers" },
  ...ACCOUNT_TYPES.map((t) => ({
    id: t.id as Filter,
    label: t.label,
    icon: t.icon as string,
  })),
];

function getAccountAccent(
  type: AccountType,
  C: ReturnType<typeof useThemeColors>,
): string {
  switch (type) {
    case "asset":
      return C.accountCash;
    case "debt":
      return C.accountCreditCard;
  }
}

// ── tiny animated ticker for balances ──────────────────────────────
function Ticker({ value }: { value: number }) {
  const C = useThemeColors();
  const prev = useRef(value);
  const sv = useSharedValue(0);

  useEffect(() => {
    if (prev.current !== value) {
      sv.value = 0;
      sv.value = withTiming(1, {
        duration: 420,
        easing: Easing.out(Easing.cubic),
      });
      prev.current = value;
    }
  }, [value, sv]);

  const aStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + sv.value * 0.4,
    transform: [{ translateY: (1 - sv.value) * 4 }],
  }));

  return (
    <Animated.Text
      style={[{ color: C.textPrimary }, aStyle]}
      className="text-base font-semibold tabular-nums text-text-primary dark:text-text-primary-dark"
    >
      {formatNumber(value)}
    </Animated.Text>
  );
}

function FilterRail({
  active,
  onChange,
}: {
  active: Filter;
  onChange: (f: Filter) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {FILTERS.map((f) => {
        const isActive = active === f.id;
        return (
          <FilterChip
            key={f.id}
            label={f.label}
            icon={f.icon}
            active={isActive}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => {});
              onChange(f.id);
            }}
          />
        );
      })}
    </View>
  );
}

function FilterChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);
  const C = useThemeColors();

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={aStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          setPressed(true);
          scale.value = withSpring(0.96, { damping: 14, stiffness: 380 });
        }}
        onPressOut={() => {
          setPressed(false);
          scale.value = withSpring(1, { damping: 14, stiffness: 380 });
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        className={`min-h-12 flex-row items-center justify-center gap-1.5 rounded-full border px-4 ${
          active
            ? "border-primary bg-primary dark:border-primary-dark dark:bg-primary-dark"
            : "border-border bg-background dark:border-border-dark dark:bg-background-dark"
        }`}
        style={pressed && !active ? { opacity: 0.82 } : undefined}
      >
        <Feather
          name={icon as any}
          size={14}
          color={active ? C.background : C.textSecondary}
        />
        <Text
          className={`text-sm font-semibold ${
            active
              ? "text-background dark:text-background-dark"
              : "text-text-secondary dark:text-text-secondary-dark"
          }`}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function VaultCard({
  item,
  index,
  isOwner,
  onEdit,
  onDelete,
}: {
  item: { _id: Id<"accounts">; name: string; type: AccountType; balance: number; hidden?: boolean };
  index: number;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const C = useThemeColors();
  const meta = ACCOUNT_TYPES.find((t) => t.id === item.type) ?? ACCOUNT_TYPES[0];
  const accentColor = getAccountAccent(item.type, C);
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);

  const pulse = useSharedValue(1);

  // cute subtle idle breath for first card
  useEffect(() => {
    if (index === 0) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.015, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
    }
  }, [index, pulse]);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressed ? 0.985 : scale.value * pulse.value }],
  }));

  const handlePressIn = () => {
    setPressed(true);
    scale.value = withSpring(0.98, { damping: 16, stiffness: 420 });
  };
  const handlePressOut = () => {
    setPressed(false);
    scale.value = withSpring(1, { damping: 16, stiffness: 420 });
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 42).duration(420).springify().damping(16).stiffness(220)}
      layout={LinearTransition.springify().damping(16).stiffness(220)}
      style={pressStyle}
    >
      <Pressable
        onPress={isOwner ? onEdit : undefined}
        onPressIn={isOwner ? handlePressIn : undefined}
        onPressOut={isOwner ? handlePressOut : undefined}
        disabled={!isOwner}
        accessibilityRole={isOwner ? "button" : undefined}
        accessibilityLabel={`${item.name} ${meta.label} ${formatNumber(item.balance)}`}
        style={[
          Shadow.card,
          {
            borderRadius: 20,
            backgroundColor: C.background,
            borderWidth: 1.2,
            borderColor: pressed ? accentColor + "33" : C.border,
            overflow: "hidden",
          },
        ]}
        className="flex-row items-center gap-3 px-3 py-3.5"
      >
        {/* type accent top stripe — thin geometric, not border-left costume */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: accentColor,
            opacity: 0.9,
          }}
        />

        {/* icon tile — chunky, cute */}
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: C.surface,
            borderWidth: 1,
            borderColor: C.border,
            overflow: "hidden",
          }}
          className="items-center justify-center"
        >
          <AccountIcon type={item.type} size={32} />
          {/* little type dot */}
          <View
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 8,
              height: 8,
              borderRadius: 999,
              backgroundColor: accentColor,
              borderWidth: 1.5,
              borderColor: C.background,
            }}
          />
        </View>

        <View className="flex-1 gap-0.5 pr-2">
          <View className="flex-row items-center gap-2">
            <Text
              numberOfLines={1}
              className="flex-1 text-[16px] font-semibold leading-5 text-text-primary dark:text-text-primary-dark"
            >
              {item.name}
            </Text>
            {isOwner ? (
              <Feather name="chevron-right" size={14} color={C.textSecondary} style={{ opacity: 0.55 }} />
            ) : null}
          </View>
          <Text className="text-xs font-medium tracking-wide text-text-secondary dark:text-text-secondary-dark">
            {meta.label.toUpperCase()}
          </Text>
          {item.hidden ? (
            <View className="mt-1 self-start flex-row items-center gap-1 rounded-full border border-border bg-background px-2 py-1 dark:border-border-dark">
              <Feather name="eye-off" size={11} color={C.textSecondary} />
              <Text className="text-[11px] font-semibold tracking-wide text-text-secondary dark:text-text-secondary-dark">
                HIDDEN
              </Text>
            </View>
          ) : null}
        </View>

        {/* precision balance column */}
        <View className="items-end gap-1.5 pl-1">
          <Ticker value={item.balance} />
          {isOwner ? (
            <View className="flex-row items-center gap-1.5">
              <Pressable
                onPress={onEdit}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${item.name}`}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  backgroundColor: C.surface,
                  borderWidth: 1,
                  borderColor: C.border,
                }}
                className="items-center justify-center"
              >
                <Feather name="edit-2" size={15} color={C.primary} />
              </Pressable>
              <Pressable
                onPress={onDelete}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${item.name}`}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  backgroundColor: C.background,
                  borderWidth: 1,
                  borderColor: C.border,
                }}
                className="items-center justify-center"
              >
                <Feather name="trash-2" size={15} color={C.error} />
              </Pressable>
            </View>
          ) : (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: C.surface,
                borderWidth: 1,
                borderColor: C.border,
              }}
            >
              <Text className="text-[11px] font-semibold tracking-widest text-text-secondary dark:text-text-secondary-dark">
                VIEW ONLY
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function HeroVault({
  accounts,
  filter,
}: {
  accounts: { type: AccountType; balance: number }[] | null;
  filter: Filter;
}) {
  const C = useThemeColors();
  const G = useThemeGradients();
  const totals = useMemo(() => {
    if (!accounts || accounts.length === 0) return null;
    const total = accounts.reduce((s, a) => s + a.balance, 0);
    const byType: Record<string, number> = {};
    for (const a of accounts) byType[a.type] = (byType[a.type] ?? 0) + a.balance;
    const visible =
      filter === "all" ? accounts : accounts.filter((a) => a.type === filter);
    const filteredTotal = visible.reduce((s, a) => s + a.balance, 0);
    return { total, byType, filteredTotal, count: accounts.length, visibleCount: visible.length };
  }, [accounts, filter]);

  if (!totals) return null;

  const typeDots: { type: AccountType; label: string }[] = [
    { type: "asset", label: "Wallet" },
    { type: "debt", label: "Debt" },
  ];

  return (
    <Animated.View
      entering={FadeIn.duration(420)}
      layout={LinearTransition.springify().damping(18).stiffness(220)}
    >
      <LinearGradient
        colors={G.card as unknown as readonly [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
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
        <View className="px-5 pb-4 pt-5">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-1">
              <View className="flex-row items-center gap-2">
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    backgroundColor: C.primary + "14",
                    borderWidth: 1,
                    borderColor: C.primary + "22",
                  }}
                  className="items-center justify-center"
                >
                  <Feather name="layers" size={14} color={C.primary} />
                </View>
                <Text className="text-xs font-semibold tracking-[0.14em] text-text-secondary dark:text-text-secondary-dark">
                  {filter === "all" ? "VAULT TOTAL" : `${filter.toUpperCase()} VAULT`}
                </Text>
                <View
                  style={{
                    backgroundColor: C.surface,
                    borderWidth: 1,
                    borderColor: C.border,
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <Text className="text-[11px] font-bold tracking-wide text-text-secondary dark:text-text-secondary-dark">
                    {totals.visibleCount} {totals.visibleCount === 1 ? "ACCT" : "ACCTS"}
                  </Text>
                </View>
              </View>
              <Text className="mt-1 text-[28px] font-bold leading-8 tracking-tight text-text-primary dark:text-text-primary-dark">
                {formatNumber(filter === "all" ? totals.total : totals.filteredTotal)}
              </Text>
              <Text className="text-[13px] leading-4 tracking-wide text-text-secondary dark:text-text-secondary-dark">
                {filter === "all"
                  ? `${totals.count} accounts • Tap a card to manage`
                  : `Filtered • ${totals.visibleCount} of ${totals.count} shown`}
              </Text>
            </View>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                backgroundColor: C.background,
                borderWidth: 1,
                borderColor: C.border,
              }}
              className="items-center justify-center"
            >
              <Feather name="shield" size={22} color={C.primary} />
            </View>
          </View>

          {/* cute type ledger — precise tiny bars */}
          <View className="mt-4 flex-row gap-2">
            {typeDots.map(({ type }) => {
              const val = totals.byType[type] ?? 0;
              const col = getAccountAccent(type, C);
              const has = (totals.byType[type] ?? 0) !== 0 || filter === type || filter === "all";
              return (
                <View
                  key={type}
                  style={{
                    flex: 1,
                    backgroundColor: C.background,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: C.border,
                    opacity: has ? 1 : 0.45,
                    paddingHorizontal: 10,
                    paddingVertical: 10,
                  }}
                >
                  <View className="flex-row items-center gap-1.5">
                    <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: col }} />
                    <Text className="text-[11px] font-bold tracking-[0.08em] text-text-secondary dark:text-text-secondary-dark">
                      {type.toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    className="mt-1 text-[13px] font-semibold leading-4 tracking-[-0.01em] tabular-nums text-text-primary dark:text-text-primary-dark"
                  >
                    {formatNumber(val)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

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

  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + shimmer.value * 0.45,
  }));

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
    return filter === "all" ? accounts : accounts.filter((a) => a.type === filter);
  }, [accounts, filter]);

  const handleDelete = useCallback(
    (account: { _id: Id<"accounts">; name: string }) => {
      Alert.alert("Delete Account", `Delete "${account.name}"? This cannot be undone.`, [
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
                const message = getConvexErrorMessage(e, "Failed to delete account.");
                show(message);
              });
          },
        },
      ]);
    },
    [removeAccount, show],
  );

  if (result === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        <View className="px-5 pt-4">
          <ScreenHeader title="Accounts" kicker="Household vault" icon="credit-card" />
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
        <View className="mt-4 flex-row flex-wrap gap-2 px-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ width: 84, height: 40, borderRadius: 999 }} />
          ))}
        </View>
        <View className="mt-4 gap-3 px-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ height: 88, borderRadius: 20 }} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (accounts === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6 dark:bg-background-dark">
        <Text className="text-center text-[15px] leading-5 text-text-secondary dark:text-text-secondary-dark">
          You are not a member of a household.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <ScreenHeader
          title="Accounts"
          kicker={`Household vault • ${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}`}
          icon="credit-card"
        />
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

      {isOwner && verifyResult && verifyResult.discrepancies.length > 0 ? (
        <Animated.View
          entering={FadeIn.duration(360)}
          className="mt-4 px-5"
        >
          <View
            style={[
              Shadow.card,
              {
                borderRadius: 20,
                backgroundColor: C.surface,
                borderWidth: 1.2,
                borderColor: C.chartAmber,
                overflow: "hidden",
              },
            ]}
            className="gap-2 px-4 py-3.5"
          >
            <Animated.View
              style={[
                {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  backgroundColor: C.chartAmber,
                },
                shimmerStyle,
              ]}
            />
            <View className="flex-row items-center gap-2.5">
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  backgroundColor: C.primary + "14",
                  borderWidth: 1,
                  borderColor: C.chartAmber + "33",
                }}
                className="items-center justify-center"
              >
                <Feather name="alert-triangle" size={16} color={C.chartAmber} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-text-primary dark:text-text-primary-dark">
                  {verifyResult.discrepancies.length} out of sync
                </Text>
                <Text className="text-xs font-medium leading-4 text-text-secondary dark:text-text-secondary-dark">
                  These totals look off compared to your transactions. One tap fixes it.
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleReconcile}
              disabled={isReconciling}
              accessibilityRole="button"
              accessibilityLabel="Recalculate balances"
              style={{
                backgroundColor: C.primary,
                borderRadius: Radius.sm,
                opacity: isReconciling ? 0.6 : 1,
                height: 44,
              }}
              className="mt-1 items-center justify-center"
            >
              <Text className="text-sm font-semibold" style={{ color: C.background }}>
                {isReconciling ? "Recalculating…" : "Recalculate vault"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

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
        data={visibleAccounts ?? []}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <HeroVault accounts={accounts} filter={filter} />
            <View className="pt-1">
              <FilterRail active={filter} onChange={setFilter} />
            </View>
            {visibleAccounts !== null && visibleAccounts.length === 0 ? null : (
              <View className="flex-row items-center justify-between pt-1">
                <Text className="text-[13px] font-semibold tracking-wide text-text-secondary dark:text-text-secondary-dark">
                  {filter === "all"
                    ? `${visibleAccounts?.length ?? 0} IN VAULT`
                    : `${visibleAccounts?.length ?? 0} • ${filter.toUpperCase()}`}
                </Text>
                <View className="flex-row items-center gap-1">
                  <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: C.primary }} />
                  <Text className="text-[13px] leading-4 tracking-wide text-text-secondary dark:text-text-secondary-dark">
                    Tap card to edit
                  </Text>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View className="pt-2">
            <View
              style={{
                backgroundColor: C.background,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: C.border,
              }}
            >
              <EmptyState
                icon="credit-card"
                title="Vault is empty"
                description={
                  isOwner
                    ? "Add your first account — a little home for your money. Wallet or debt."
                    : "Only the Owner can add accounts. Ask your household Owner to open the vault."
                }
                actionLabel={isOwner ? "Add Account" : undefined}
                onAction={isOwner ? () => router.push("/account-form") : undefined}
              />
            </View>
            {isOwner ? (
              <View className="mt-3 flex-row gap-2">
                {ACCOUNT_TYPES.map((t) => (
                  <View
                    key={t.id}
                    style={{
                      flex: 1,
                      backgroundColor: C.surface,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: C.border,
                      paddingVertical: 12,
                    }}
                    className="items-center gap-1.5"
                  >
                    <Feather name={t.icon as any} size={16} color={C.textSecondary} />
                    <Text className="text-[11px] font-semibold tracking-wide text-text-secondary dark:text-text-secondary-dark">
                      {t.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <VaultCard
            item={item as any}
            index={index}
            isOwner={isOwner}
            onEdit={() =>
              router.push({
                pathname: "/account-form",
                params: { id: item._id },
              })
            }
            onDelete={() => handleDelete(item as any)}
          />
        )}
      />

      {isOwner ? (
        <Fab label="Add Account" onPress={() => router.push("/account-form")} accessibilityLabel="Add account" />
      ) : null}
    </SafeAreaView>
  );
}
