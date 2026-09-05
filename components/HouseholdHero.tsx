import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@expo/vector-icons/Feather";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { BearRow } from "@/components/Bear";
import { Shadow, useThemeColors } from "@/constants/theme";
import { useSnackbar } from "@/components/Snackbar";

type HouseholdHeroProps = {
  name: string;
  subtitle?: string;
  memberCount?: number;
  onEdit?: () => void;
};

export function HouseholdHero({ name, subtitle, memberCount, onEdit }: HouseholdHeroProps) {
  const C = useThemeColors();
  const isDark = C.background === "#1C1917";
  const gradientColors: [string, string] = isDark ? [C.surface, "#3A3224"] : ["#FFFFFF", "#FFF6D6"];

  return (
    <View
      testID="household-hero"
      accessibilityLabel="household-hero"
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
        style={{ padding: 16, gap: 12 }}
      >
        {/* top row: house icon 56px + name 16px 800 + edit */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            testID="house-icon"
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              backgroundColor: isDark ? C.background : "#FFE9C9",
              borderWidth: 2.5,
              borderColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="home" size={26} color={C.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              testID="household-name"
              numberOfLines={1}
              style={{ fontSize: 16, fontWeight: "800", color: C.textPrimary }}
            >
              {name}
            </Text>
            {subtitle ? (
              <Text style={{ fontSize: 12, fontWeight: "600", color: C.textSecondary }}>{subtitle}</Text>
            ) : null}
            {memberCount !== undefined ? (
              <Text style={{ fontSize: 11, fontWeight: "700", color: C.textSecondary }}>
                {memberCount} {memberCount === 1 ? "bear" : "bears"} • Household
              </Text>
            ) : null}
          </View>
          {onEdit ? (
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit household"
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: isDark ? C.background : "#FFFFFF",
                borderWidth: 2,
                borderColor: "#FFFFFF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="edit-2" size={16} color={C.primary} />
            </Pressable>
          ) : null}
        </View>

        {/* bears row 5 bears */}
        <View testID="household-bears" style={{ alignItems: "center", gap: 6 }}>
          <BearRow
            bears={[
              { size: "normal", variant: "papa" },
              { size: "mid", variant: "mama" },
              { size: "small", variant: "cub" },
              { size: "small", variant: "cub" },
              { size: "small", variant: "cub" },
            ]}
            gap={6}
          />
          <Text style={{ fontSize: 11, fontWeight: "700", color: C.textSecondary, textAlign: "center" }}>
            Faceless bear family — Papa, Mama & 3 cubs
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

// Invite code example: KIN-8A2F — dashed card displays Baloo 18px code with Copy/Revoke
type InviteCardProps = {
  code: string;
  onCopy?: () => void;
  onRevoke?: () => void;
  onRevokeNew?: () => void;
};

export function HouseholdInviteCard({ code, onCopy, onRevoke }: InviteCardProps) {
  const C = useThemeColors();
  const isDark = C.background === "#1C1917";
  const cardBg = isDark ? C.surface : "#FFFFFF";
  const { show } = useSnackbar();
  const [copyPressed, setCopyPressed] = useState(false);
  const [revokePressed, setRevokePressed] = useState(false);

  const handleCopy = async () => {
    if (onCopy) {
      onCopy();
      return;
    }
    await Clipboard.setStringAsync(code);
    show("Copied!");
  };

  return (
    <View
      testID="invite-card"
      style={[
        Shadow.card,
        {
          backgroundColor: cardBg,
          borderWidth: 2.5,
          borderColor: C.border,
          borderStyle: "dashed",
          borderRadius: 20,
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: C.textPrimary }}>Invite code</Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: C.textSecondary }}>7-day expiry • single-use • auto-revoke</Text>
        <View
          testID="invite-code"
          style={{
            marginTop: 6,
            alignSelf: "flex-start",
            backgroundColor: isDark ? C.background : "#FFFBF5",
            borderWidth: 2,
            borderColor: isDark ? C.border : "#F3E6CD",
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Text
            accessibilityLabel={`invite code ${code}`}
            style={{
              fontSize: 18,
              fontWeight: "800",
              letterSpacing: 1.5,
              color: C.textPrimary,
              // Baloo style — use system bold as fallback
              fontFamily: "Baloo_800ExtraBold" as any,
            }}
          >
            {code}
          </Text>
        </View>
      </View>
      <View style={{ gap: 6, minWidth: 110 }}>
        <Pressable
          onPress={handleCopy}
          onPressIn={() => setCopyPressed(true)}
          onPressOut={() => setCopyPressed(false)}
          accessibilityRole="button"
          accessibilityLabel="Copy invite code"
          style={{
            backgroundColor: copyPressed ? "#B45309" : C.primary,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            borderWidth: 2,
            borderColor: "#FFFFFF",
          }}
        >
          <Feather name="copy" size={14} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Copy</Text>
        </Pressable>
        {onRevoke ? (
          <Pressable
            onPress={onRevoke}
            onPressIn={() => setRevokePressed(true)}
            onPressOut={() => setRevokePressed(false)}
            accessibilityRole="button"
            accessibilityLabel="Revoke invite"
            style={{
              backgroundColor: revokePressed ? "#FFE9C9" : cardBg,
              borderWidth: 2.5,
              borderColor: C.border,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: C.textPrimary, fontSize: 12, fontWeight: "800" }}>Revoke</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

type MemberRowProps = {
  name: string;
  email?: string;
  role: "owner" | "member";
  imageUrl?: string;
  onRemove?: () => void;
  onTransfer?: () => void;
};

export function HouseholdMemberRow({ name, email, role, onRemove }: MemberRowProps) {
  const C = useThemeColors();
  const isDark = C.background === "#1C1917";
  const cardBg = isDark ? C.surface : "#FFFFFF";

  // role pill owner terra / member butter
  const pillBg = role === "owner" ? C.primary : "#FDE68A";
  const pillTextColor = role === "owner" ? "#FFFFFF" : C.primary;

  return (
    <View
      testID="household-member"
      style={[
        Shadow.card,
        {
          backgroundColor: cardBg,
          borderWidth: 2.5,
          borderColor: "#FFFFFF",
          borderRadius: 20,
          padding: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },
      ]}
    >
      <View
        testID="member-avatar"
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: isDark ? C.background : "#FFE9C9",
          borderWidth: 2.5,
          borderColor: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather name={role === "owner" ? "shield" : "user"} size={20} color={C.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 13, fontWeight: "800", color: C.textPrimary }}
        >
          {name}
        </Text>
        {email ? (
          <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: "600", color: C.textSecondary }}>
            {email}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          testID="role-pill"
          style={{
            borderRadius: 999,
            backgroundColor: pillBg,
            borderWidth: 2,
            borderColor: "#FFFFFF",
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "800", color: pillTextColor }}>
            {role === "owner" ? "Owner" : "Member"}
          </Text>
        </View>
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel="Remove member"
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              backgroundColor: isDark ? C.background : "#FFF5F5",
              borderWidth: 2,
              borderColor: "#FECACA",
            }}
          >
            <Feather name="x-circle" size={18} color={C.error} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

type BalanceModeProps = {
  mode: "fresh" | "carryOver";
  isOwner?: boolean;
  onChange?: (mode: "fresh" | "carryOver") => void;
  isUpdating?: boolean;
};

export function HouseholdBalanceMode({ mode, isOwner, onChange, isUpdating }: BalanceModeProps) {
  const C = useThemeColors();
  const isDark = C.background === "#1C1917";
  if (isOwner === false) {
    // Read-only for member with Owner only label
    return (
      <View
        testID="balance-mode-readonly"
        style={{
          backgroundColor: isDark ? C.surface : "#FFFFFF",
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 16,
          padding: 12,
          gap: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.6, color: C.textSecondary }}>
            BALANCE MODE
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Feather name="info" size={12} color={C.textSecondary} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: C.textSecondary }}>Owner only</Text>
          </View>
        </View>
        <Text style={{ fontSize: 13, fontWeight: "800", color: C.textPrimary }}>
          {mode === "fresh" ? "Fresh" : "Carry Over"}
        </Text>
        <Text style={{ fontSize: 11, fontWeight: "600", color: C.textSecondary }}>
          {mode === "fresh" ? "Each period starts fresh" : "Closing balance carries to next period"}
        </Text>
      </View>
    );
  }

  return (
    <View testID="balance-mode" style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.6, color: C.textSecondary }}>
          BALANCE MODE — Owner only
        </Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          borderWidth: 2.5,
          borderColor: C.border,
          borderRadius: 999,
          overflow: "hidden",
          backgroundColor: isDark ? C.surface : "#FFFFFF",
        }}
      >
        {(["fresh", "carryOver"] as const).map((id) => {
          const selected = mode === id;
          const label = id === "fresh" ? "Fresh" : "Carry Over";
          return (
            <Pressable
              key={id}
              onPress={() => onChange?.(id)}
              disabled={isUpdating}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`Balance mode ${label}`}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: selected ? C.primary : "transparent",
                opacity: isUpdating && !selected ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: selected ? "#FFFFFF" : C.textSecondary,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ fontSize: 11, fontWeight: "600", color: C.textSecondary }}>
        {mode === "fresh" ? "Each period starts fresh" : "Closing balance carries to next period"}
      </Text>
    </View>
  );
}
