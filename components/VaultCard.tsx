import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@expo/vector-icons/Feather";
import { Shadow, useThemeColors } from "@/constants/theme";
import { AccountType } from "@/constants/accounts";
import { AccountIcon } from "@/components/AccountIcon";
import { Bear } from "@/components/Bear";
import { formatNumber } from "@/utils/format";

type VaultCardProps = {
  name: string;
  type: AccountType;
  balance: number;
  hidden?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
};

function topBarColor(type: AccountType, C: ReturnType<typeof useThemeColors>): string {
  // palette: cash #10B981, bank #92400E terra, ewallet #3B82F6, credit #991B1B
  switch (type) {
    case "cash":
      return "#10B981";
    case "bank":
      return C.primary; // #92400E
    case "ewallet":
      return "#3B82F6";
    case "credit_card":
      return C.error;
    default:
      return C.primary;
  }
}

function typeLabel(type: AccountType): string {
  switch (type) {
    case "cash":
      return "Cash";
    case "bank":
      return "Bank";
    case "ewallet":
      return "E-Wallet";
    case "credit_card":
      return "Credit";
    default:
      return type;
  }
}

export function VaultCard({ name, type, balance, hidden, onEdit, onDelete }: VaultCardProps) {
  const C = useThemeColors();
  const barColor = topBarColor(type, C);
  const [editPressed, setEditPressed] = useState(false);
  const [deletePressed, setDeletePressed] = useState(false);
  const isDark = C.background === "#1C1917";
  const cardBg = isDark ? C.surface : "#FFFFFF";
  const creamBorder = "#F3E6CD";
  const muted = C.textSecondary;

  return (
    <View
      testID="vault-card"
      accessibilityLabel={`vault-card-${name}`}
      style={[
        Shadow.card,
        {
          flex: 1,
          backgroundColor: cardBg,
          borderWidth: 2.5,
          borderColor: "#FFFFFF",
          borderRadius: 24,
          overflow: "hidden",
        },
      ]}
    >
      {/* top 8px bar color per type — testIDs: top-bar-cash top-bar-bank top-bar-ewallet top-bar-credit_card */}
      <View
        testID={`top-bar-${type}`}
        accessibilityLabel={`top-bar-${type}`}
        style={{
          height: 8,
          backgroundColor: barColor,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
      />

      <View style={{ padding: 12, gap: 8, alignItems: "center" }}>
        {/* icon 54px */}
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: 16,
            backgroundColor: isDark ? C.background : "#FFF8EC",
            borderWidth: 1,
            borderColor: isDark ? C.border : creamBorder,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AccountIcon type={type} size={30} />
        </View>

        {/* name 14px 800 */}
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: "800", color: C.textPrimary, textAlign: "center" }}
        >
          {name}
        </Text>
        {/* type label 11px muted */}
        <Text style={{ fontSize: 11, fontWeight: "700", color: muted, textAlign: "center" }}>
          {typeLabel(type)}
        </Text>

        {/* hidden pill */}
        {hidden ? (
          <View
            testID="vault-hidden"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: isDark ? C.background : "#FFF8EC",
              borderWidth: 1,
              borderColor: isDark ? C.border : creamBorder,
            }}
          >
            <Feather name="eye-off" size={10} color={muted} />
            <Text style={{ fontSize: 10, fontWeight: "700", color: muted }}>Hidden</Text>
          </View>
        ) : null}

        {/* balance 17px 800 */}
        <Text style={{ fontSize: 17, fontWeight: "800", color: C.textPrimary, textAlign: "center" }}>
          {formatNumber(balance)}
        </Text>

        {/* mini-btns 2px border cream — >=48 touch handled via minHeight */}
        {onEdit !== undefined || onDelete !== undefined ? (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
            {onEdit !== undefined ? (
              <Pressable
                onPress={onEdit}
                onPressIn={() => setEditPressed(true)}
                onPressOut={() => setEditPressed(false)}
                accessibilityRole="button"
                accessibilityLabel="Edit account"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  borderWidth: 2,
                  borderColor: creamBorder,
                  backgroundColor: editPressed ? "#FFF8EC" : cardBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="edit-2" size={16} color={C.primary} />
              </Pressable>
            ) : null}
            {onDelete !== undefined ? (
              <Pressable
                onPress={onDelete}
                onPressIn={() => setDeletePressed(true)}
                onPressOut={() => setDeletePressed(false)}
                accessibilityRole="button"
                accessibilityLabel="Delete account"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  borderWidth: 2,
                  borderColor: creamBorder,
                  backgroundColor: deletePressed ? "#FFF8EC" : cardBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="trash-2" size={16} color={C.error} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function VaultHero({ total, count }: { total: number; count: number }) {
  const C = useThemeColors();
  const isDark = C.background === "#1C1917";
  // gradient white->#FFF6D6 ; dark fallback via theme surface
  const gradientColors: [string, string] = isDark ? [C.surface, "#3A3224"] : ["#FFFFFF", "#FFF6D6"];

  return (
    <View
      testID="vault-hero"
      accessibilityLabel="vault-hero"
      style={[
        Shadow.card,
        {
          borderWidth: 2.5,
          borderColor: "#FFFFFF",
          borderRadius: 26,
          overflow: "hidden",
        },
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 12 }}
      >
        {/* bear stack mid+normal */}
        <View
          testID="vault-hero-bears"
          style={{ flexDirection: "row", alignItems: "flex-end", gap: -6 } as any}
        >
          <View style={{ marginRight: -8 }}>
            <Bear size="mid" />
          </View>
          <Bear size="normal" />
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.6, color: C.textSecondary }}>
            BEAR VAULT
          </Text>
          {/* total 26px Baloo (800) */}
          <Text
            testID="vault-hero-total"
            style={{ fontSize: 26, fontWeight: "800", color: C.textPrimary, lineHeight: 30 }}
          >
            {formatNumber(total)}
          </Text>
          {/* count muted */}
          <Text testID="vault-hero-count" style={{ fontSize: 12, fontWeight: "600", color: C.textSecondary }}>
            {count} {count === 1 ? "vault" : "vaults"} • Total balance
          </Text>
        </View>

        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            backgroundColor: isDark ? C.background : "#FFFFFF",
            borderWidth: 2,
            borderColor: "#FFFFFF",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="archive" size={18} color={C.primary} />
        </View>
      </LinearGradient>
    </View>
  );
}

export function VaultAdd({ onPress }: { onPress: () => void }) {
  const C = useThemeColors();
  const isDark = C.background === "#1C1917";
  const cardBg = isDark ? C.surface : "#FFFFFF";
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      testID="vault-add"
      accessibilityRole="button"
      accessibilityLabel="Add vault"
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        flex: 1,
        minHeight: 168,
        borderRadius: 24,
        borderWidth: 2.5,
        borderColor: C.border,
        borderStyle: "dashed",
        backgroundColor: pressed ? (isDark ? C.background : "#FFF8EC") : cardBg,
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        gap: 8,
        opacity: pressed ? 0.9 : 1,
      }}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 16,
          backgroundColor: isDark ? C.background : "#FFF8EC",
          borderWidth: 2,
          borderColor: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather name="plus" size={22} color={C.primary} />
      </View>
      <Text style={{ fontSize: 14, fontWeight: "800", color: C.textPrimary }}>Add Vault</Text>
      <Text style={{ fontSize: 11, fontWeight: "600", color: C.textSecondary, textAlign: "center" }}>
        Create new account
      </Text>
      <Bear size="small" />
    </Pressable>
  );
}
