import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@expo/vector-icons/Feather";
import { Shadow, useThemeColors } from "@/constants/theme";
import { Bear } from "@/components/Bear";
import { CategoryIcon } from "@/components/CategoryIcon";
import { formatNumber } from "@/utils/format";

type HoneyJarProps = {
  categoryName: string;
  icon?: string;
  amount: number;
  spent?: number;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function HoneyJar({
  categoryName,
  icon,
  amount,
  spent,
  onEdit,
  onDelete,
}: HoneyJarProps) {
  const C = useThemeColors();
  const isDark = C.background === "#1C1917";
  const cardBg = isDark ? C.surface : "#FFFFFF";
  const muted = C.textSecondary;
  const over = spent !== undefined && spent > amount;
  const progress = spent === undefined ? 0 : amount > 0 ? Math.min(spent / amount, 1) : 0;
  const fillHeight = `${progress * 100}%`;
  const isRedacted = spent === undefined;

  // honey gradient #FDE68A -> #F59E0B ; cherry for over is C.error
  const honeyColors: [string, string] = ["#FDE68A", "#F59E0B"];
  const cherryColor = C.error;

  const [editPressed, setEditPressed] = useState(false);
  const [deletePressed, setDeletePressed] = useState(false);

  return (
    <View
      testID="honey-jar"
      accessibilityLabel={`honey-jar-${categoryName}`}
      style={[
        Shadow.card,
        {
          backgroundColor: cardBg,
          borderWidth: 2.5,
          borderColor: "#FFFFFF",
          borderRadius: 24,
          overflow: "hidden",
          flexDirection: "row",
          alignItems: "center",
          padding: 14,
          gap: 12,
        },
      ]}
    >
      {/* left jar-jar 64x72 with cap terra */}
      <View style={{ alignItems: "center" }}>
        {/* cap terra */}
        <View
          testID="jar-cap"
          style={{
            width: 64,
            height: 14,
            borderRadius: 6,
            backgroundColor: C.primary,
            borderWidth: 2.5,
            borderColor: "#FFFFFF",
            marginBottom: -6,
            zIndex: 2,
            // cap terra color ensures #92400E via C.primary light
          }}
        />
        {/* jar body 64x72 */}
        <View
          testID="jar-body"
          style={{
            width: 64,
            height: 72,
            borderRadius: 16,
            backgroundColor: isDark ? C.background : "#FFFBF5",
            borderWidth: 2,
            borderColor: isDark ? C.border : "#F3E6CD",
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* fill honey linear-gradient #FDE68A -> #F59E0B height = progress*100%, over -> cherry fill */}
          {isRedacted ? null : over ? (
            <View
              testID="fill"
              accessibilityLabel="fill"
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: fillHeight as any,
                backgroundColor: cherryColor,
                borderRadius: 0,
              }}
            />
          ) : (
            <LinearGradient
              testID="fill"
              colors={honeyColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: fillHeight as any,
              }}
            />
          )}
          {/* emoji 22px centered */}
          {icon ? (
            <View style={{ zIndex: 1, alignItems: "center", justifyContent: "center" }}>
              <CategoryIcon name={icon} size={22} />
            </View>
          ) : (
            <Text style={{ fontSize: 22, zIndex: 1, textAlign: "center" }}>🍯</Text>
          )}
        </View>
      </View>

      {/* meta right with name/spent/amount and 6px track */}
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 14, fontWeight: "800", color: C.textPrimary, flex: 1, marginRight: 8 }}
          >
            {categoryName}
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {onEdit ? (
              <Pressable
                onPress={onEdit}
                onPressIn={() => setEditPressed(true)}
                onPressOut={() => setEditPressed(false)}
                accessibilityRole="button"
                accessibilityLabel="Edit budget"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 999,
                  borderWidth: 2,
                  borderColor: "#F3E6CD",
                  backgroundColor: editPressed ? "#FFF8EC" : cardBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="edit-2" size={16} color={C.primary} />
              </Pressable>
            ) : null}
            {onDelete ? (
              <Pressable
                onPress={onDelete}
                onPressIn={() => setDeletePressed(true)}
                onPressOut={() => setDeletePressed(false)}
                accessibilityRole="button"
                accessibilityLabel="Delete budget"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 999,
                  borderWidth: 2,
                  borderColor: "#F3E6CD",
                  backgroundColor: deletePressed ? "#FFF8EC" : cardBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="trash-2" size={16} color={C.error} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* spent/amount line */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: over ? C.error : muted,
            }}
          >
            {isRedacted ? "—" : formatNumber(spent as number)} / {formatNumber(amount)}
          </Text>
          {over ? (
            <Text style={{ fontSize: 10, fontWeight: "700", color: C.error }}>Over</Text>
          ) : null}
        </View>

        {/* 6px track */}
        {isRedacted ? null : (
          <View
            testID="honey-track"
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: C.border,
              overflow: "hidden",
            }}
          >
            {over ? (
              <View
                testID="honey-track-fill"
                style={{
                  height: "100%",
                  width: `${progress * 100}%`,
                  backgroundColor: cherryColor,
                  borderRadius: 3,
                }}
              />
            ) : (
              <LinearGradient
                testID="honey-track-fill"
                colors={honeyColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  height: "100%",
                  width: `${progress * 100}%`,
                  borderRadius: 3,
                }}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

type HoneyHeroProps = {
  budgeted: number;
  spent: number;
  hasRedacted?: boolean;
};

export function HoneyHero({ budgeted, spent, hasRedacted }: HoneyHeroProps) {
  const C = useThemeColors();
  const isDark = C.background === "#1C1917";
  const gradientColors: [string, string] = isDark ? [C.surface, "#3A3224"] : ["#FFFFFF", "#FFF6D6"];
  const over = !hasRedacted && spent > budgeted;
  const progress = hasRedacted ? 0 : budgeted > 0 ? Math.min(spent / budgeted, 1) : 0;
  const honeyColors: [string, string] = ["#FDE68A", "#F59E0B"];

  return (
    <View
      testID="honey-hero"
      accessibilityLabel="honey-hero"
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
        {/* bear header with label "Honey Jars" */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: -6 } as any}>
            <View style={{ marginRight: -8 }}>
              <Bear size="small" />
            </View>
            <Bear size="mid" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.6, color: C.textSecondary }}>
              Honey Jars
            </Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: C.textPrimary }}>Budget overview</Text>
          </View>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: isDark ? C.background : "#FFFFFF",
              borderWidth: 2,
              borderColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="droplet" size={16} color={C.primary} />
          </View>
        </View>

        {/* stats 2 columns white cards */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View
            testID="hero-budgeted"
            style={{
              flex: 1,
              backgroundColor: isDark ? C.background : "#FFFFFF",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDark ? C.border : "#FFFFFF",
              padding: 12,
              gap: 2,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "700", color: C.textSecondary }}>Budgeted</Text>
            <Text style={{ fontSize: 16, fontWeight: "800", color: C.textPrimary }}>{formatNumber(budgeted)}</Text>
          </View>
          <View
            testID="hero-spent"
            style={{
              flex: 1,
              backgroundColor: isDark ? C.background : "#FFFFFF",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDark ? C.border : "#FFFFFF",
              padding: 12,
              gap: 2,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "700", color: C.textSecondary }}>Spent</Text>
            {hasRedacted ? (
              <Text style={{ fontSize: 16, fontWeight: "800", color: C.textSecondary }}>—</Text>
            ) : (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "800",
                  color: over ? C.error : C.textPrimary,
                }}
              >
                {formatNumber(spent)}
              </Text>
            )}
          </View>
        </View>

        {/* progress 10px track with honey gradient */}
        {hasRedacted ? null : (
          <View
            testID="hero-track"
            style={{
              height: 10,
              borderRadius: 5,
              backgroundColor: isDark ? C.border : "#F3E6CD",
              overflow: "hidden",
            }}
          >
            <LinearGradient
              testID="hero-fill"
              colors={over ? [C.error, C.error] : honeyColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                height: "100%",
                width: `${Math.min(progress, 1) * 100}%`,
                borderRadius: 5,
              }}
            />
          </View>
        )}
      </LinearGradient>
    </View>
  );
}
