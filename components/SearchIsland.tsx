import { useState, useMemo } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { Shadow, useThemeColors } from "@/constants/theme";
import { Bear } from "@/components/Bear";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { TypeFilter } from "@/components/FilterSheet";

type Props = {
  searchDraft: string;
  onSearchDraft: (text: string) => void;
  onCommit: () => void;
  onClear: () => void;
  typeFilter: TypeFilter;
  onTypeChange: (type: TypeFilter) => void;
  accountIds: Id<"accounts">[];
  categoryIds: Id<"categories">[];
  onAccountToggle: (id: Id<"accounts">) => void;
  onCategoryToggle: (id: Id<"categories">) => void;
  activeCount: number;
  accounts: Doc<"accounts">[];
  categories: Doc<"categories">[];
  onReset?: () => void;
};

const TYPE_PILLS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "expense", label: "Expense" },
  { id: "income", label: "Income" },
  { id: "transfer", label: "Transfer" },
];

export function SearchIsland({
  searchDraft,
  onSearchDraft,
  onCommit,
  onClear,
  typeFilter,
  onTypeChange,
  accountIds,
  categoryIds,
  onAccountToggle,
  onCategoryToggle,
  activeCount,
  accounts,
  categories,
  onReset,
}: Props) {
  const C = useThemeColors();
  const [isFocused, setIsFocused] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchPressed, setSearchPressed] = useState(false);
  const [resetPressed, setResetPressed] = useState(false);
  const [applyPressed, setApplyPressed] = useState(false);

  const visibleCategories = useMemo(() => {
    if (typeFilter === "transfer") return [];
    if (typeFilter === "all") return categories;
    return categories.filter((c) => c.type === typeFilter);
  }, [categories, typeFilter]);

  const handleTypePress = (type: TypeFilter) => {
    onTypeChange(type);
    // if switching to transfer, parent should clear categories; optimistic clear handled via visibleCategories
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    } else {
      onTypeChange("all");
      // clear via toggling each selected — parent will receive onReset if provided,
      // otherwise we call toggles for each selected to clear
      accountIds.forEach((id) => onAccountToggle(id));
      categoryIds.forEach((id) => onCategoryToggle(id));
    }
    setDrawerOpen(false);
  };

  const handleApply = () => {
    setDrawerOpen(false);
  };

  return (
    <View
      testID="search-island"
      accessibilityLabel="search-island"
      style={[
        Shadow.card,
        {
          backgroundColor: C.background === "#FFFBF5" ? "#FFFFFF" : C.background,
          borderWidth: 2.5,
          borderColor: "#FFFFFF",
          borderRadius: 26,
          padding: 10,
          overflow: "visible",
        },
      ]}
    >
      {/* Bear ears — absolute top -10 left 18/38 */}
      <View
        testID="bear-ear-left"
        style={{
          position: "absolute",
          top: -10,
          left: 18,
          width: 18,
          height: 18,
          borderRadius: 999,
          backgroundColor: "#FFFFFF",
          borderWidth: 2.5,
          borderColor: C.border,
        }}
      />
      <View
        testID="bear-ear-right"
        style={{
          position: "absolute",
          top: -10,
          left: 38,
          width: 18,
          height: 18,
          borderRadius: 999,
          backgroundColor: "#FFFFFF",
          borderWidth: 2.5,
          borderColor: C.border,
        }}
      />

      {/* Search top: bear peek + field + button */}
      <View className="flex-row items-center gap-2" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {/* Bear peek 34px */}
        <View
          testID="bear-peek"
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            backgroundColor: "#FFE9C9",
            borderWidth: 2.5,
            borderColor: "#FFFFFF",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          {/* ears on peek */}
          <View
            style={{
              position: "absolute",
              top: -6,
              left: 4,
              width: 8,
              height: 8,
              borderRadius: 999,
              backgroundColor: "#D9A679",
              borderWidth: 2,
              borderColor: "#FFFFFF",
            }}
          />
          <View
            style={{
              position: "absolute",
              top: -6,
              right: 4,
              width: 8,
              height: 8,
              borderRadius: 999,
              backgroundColor: "#D9A679",
              borderWidth: 2,
              borderColor: "#FFFFFF",
            }}
          />
          <Text style={{ fontSize: 14 }}>🐻</Text>
        </View>

        {/* Field 46px cream bg */}
        <View
          style={{
            flex: 1,
            height: 46,
            backgroundColor: isFocused ? "#FFFFFF" : "#FFF8EC",
            borderWidth: 2.5,
            borderColor: isFocused ? C.primary : "#F3E6CD",
            borderRadius: 999,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingLeft: 12,
            paddingRight: 8,
          }}
        >
          <Feather name="search" size={16} color={C.textSecondary} />
          <TextInput
            value={searchDraft}
            onChangeText={onSearchDraft}
            placeholder="Cari catatan, nominal, akun…"
            placeholderTextColor={C.textSecondary}
            className="flex-1 text-sm text-text-primary dark:text-text-primary-dark"
            style={{ flex: 1, fontSize: 14, fontWeight: "700", color: C.textPrimary } as any}
            accessibilityLabel="Search notes, amounts, accounts and categories"
            returnKeyType="search"
            onSubmitEditing={onCommit}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
          {searchDraft.length > 0 && (
            <Pressable
              onPress={onClear}
              accessibilityLabel="Clear search"
              className="h-6 w-6 items-center justify-center rounded-full"
              style={{
                width: 26,
                height: 26,
                borderRadius: 999,
                backgroundColor: "#F3E6CD",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="x" size={12} color={C.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Search button terra 36px */}
        <Pressable
          onPress={onCommit}
          onPressIn={() => setSearchPressed(true)}
          onPressOut={() => setSearchPressed(false)}
          accessibilityRole="button"
          accessibilityLabel="Search"
          style={{
            height: 48,
            minHeight: 48,
            paddingHorizontal: 16,
            borderRadius: 999,
            backgroundColor: searchPressed ? "#7A3410" : C.primary,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Feather name="search" size={14} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Cari</Text>
        </Pressable>
      </View>

      {/* Quick filters horizontal */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingTop: 10 }}
        style={{ marginTop: 2 }}
      >
        {TYPE_PILLS.map((pill) => {
          const active = typeFilter === pill.id;
          return (
            <Pressable
              key={pill.id}
              onPress={() => handleTypePress(pill.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={pill.label}
              style={{
                borderWidth: 2.5,
                borderColor: active ? C.primary : C.border,
                backgroundColor: active ? C.primary : "#FFFFFF",
                borderRadius: 999,
                height: 48,
                minHeight: 48,
                paddingHorizontal: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 1,
              }}
            >
              {pill.id === "expense" && (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: active ? "#FFFFFF" : "#991B1B",
                  }}
                />
              )}
              {pill.id === "income" && (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: active ? "#FFFFFF" : "#065F46",
                  }}
                />
              )}
              {pill.id === "transfer" && (
                <Feather name="repeat" size={14} color={active ? "#FFFFFF" : C.textSecondary} />
              )}
              {pill.id === "all" && (
                <Feather name="grid" size={14} color={active ? "#FFFFFF" : C.textSecondary} />
              )}
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "800",
                  color: active ? "#FFFFFF" : C.textSecondary,
                }}
              >
                {pill.label}
              </Text>
            </Pressable>
          );
        })}

        {/* Filter badge pill */}
        <Pressable
          onPress={() => setDrawerOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="Filter"
          accessibilityState={{ expanded: drawerOpen }}
          style={{
            borderWidth: 2.5,
            borderColor: activeCount > 0 ? C.primary : C.border,
            backgroundColor: activeCount > 0 ? `${C.primary}14` : "#FFFFFF",
            borderRadius: 999,
            height: 48,
            minHeight: 48,
            paddingHorizontal: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 1,
          }}
        >
          <Feather
            name="filter"
            size={14}
            color={activeCount > 0 ? C.primary : C.textSecondary}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "800",
              color: activeCount > 0 ? C.primary : C.textSecondary,
            }}
          >
            Filter
          </Text>
          {activeCount > 0 && (
            <View
              testID="filter-badge"
              style={{
                backgroundColor: C.primary,
                borderRadius: 999,
                paddingHorizontal: 6,
                paddingVertical: 2,
                minWidth: 18,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "800" }}>{activeCount}</Text>
            </View>
          )}
          <Feather
            name={drawerOpen ? "chevron-up" : "chevron-down"}
            size={14}
            color={activeCount > 0 ? C.primary : C.textSecondary}
          />
        </Pressable>
      </ScrollView>

      {/* Drawer — inner cream 2.5 border radius 20 */}
      {drawerOpen && (
        <View
          testID="filter-drawer"
          style={{
            marginTop: 10,
            backgroundColor: "#FFF8EC",
            borderWidth: 2.5,
            borderColor: "#F3E6CD",
            borderRadius: 20,
            padding: 12,
            gap: 10,
          }}
        >
          {/* Account chips */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontSize: 11,
                letterSpacing: 0.6,
                fontWeight: "800",
                color: C.textSecondary,
              }}
            >
              ACCOUNT
            </Text>
            <Text style={{ fontSize: 11, color: C.textSecondary, fontWeight: "700" }}>
              {accountIds.length} selected
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 7 }}
          >
            {accounts.length === 0 ? (
              <Text style={{ fontSize: 12, color: C.textSecondary, fontWeight: "600" }}>
                No accounts
              </Text>
            ) : (
              accounts.map((a) => {
                const active = accountIds.includes(a._id);
                return (
                  <Pressable
                    key={a._id}
                    onPress={() => onAccountToggle(a._id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Account ${a.name}`}
                    style={{
                      borderWidth: 2.5,
                      borderColor: active ? C.primary : C.border,
                      backgroundColor: active ? C.primary : "#FFFFFF",
                      borderRadius: 999,
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.04,
                      shadowRadius: 8,
                      elevation: 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color: active ? "#FFFFFF" : C.textSecondary,
                      }}
                    >
                      {a.name}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {/* Category chips */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 2,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                letterSpacing: 0.6,
                fontWeight: "800",
                color: C.textSecondary,
              }}
            >
              CATEGORY
            </Text>
            <Text style={{ fontSize: 11, color: C.textSecondary, fontWeight: "700" }}>
              {categoryIds.length} selected
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 7 }}
          >
            {visibleCategories.length === 0 ? (
              <Text
                style={{ fontSize: 12, color: C.textSecondary, fontWeight: "600" }}
                testID="category-empty"
              >
                {typeFilter === "transfer" ? "No categories for transfer" : "No categories"}
              </Text>
            ) : (
              visibleCategories.map((c) => {
                const active = categoryIds.includes(c._id);
                return (
                  <Pressable
                    key={c._id}
                    onPress={() => onCategoryToggle(c._id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Category ${c.name}`}
                    style={{
                      borderWidth: 2.5,
                      borderColor: active ? C.primary : C.border,
                      backgroundColor: active ? C.primary : "#FFFFFF",
                      borderRadius: 999,
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.04,
                      shadowRadius: 8,
                      elevation: 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color: active ? "#FFFFFF" : C.textSecondary,
                      }}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {/* Reset / Terapkan */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            <Pressable
              onPress={handleReset}
              onPressIn={() => setResetPressed(true)}
              onPressOut={() => setResetPressed(false)}
              accessibilityRole="button"
              accessibilityLabel="Reset filter"
              style={{
                flex: 1,
                height: 48,
                minHeight: 48,
                borderRadius: 999,
                borderWidth: 2.5,
                borderColor: C.border,
                backgroundColor: resetPressed ? "#FFF8EC" : "#FFFFFF",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 1,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "800", color: C.textSecondary }}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={handleApply}
              onPressIn={() => setApplyPressed(true)}
              onPressOut={() => setApplyPressed(false)}
              accessibilityRole="button"
              accessibilityLabel="Terapkan"
              style={{
                flex: 1,
                height: 48,
                minHeight: 48,
                borderRadius: 999,
                borderWidth: 2.5,
                borderColor: applyPressed ? "#7A3410" : C.primary,
                backgroundColor: applyPressed ? "#7A3410" : C.primary,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 6,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
                elevation: 1,
              }}
            >
              <Feather name="check" size={14} color="#FFFFFF" />
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#FFFFFF" }}>Terapkan</Text>
            </Pressable>
          </View>

          {/* Bear small footer */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              marginTop: 6,
            }}
          >
            <Bear size="small" />
            <Text style={{ fontSize: 11, color: C.textSecondary, fontWeight: "700" }}>
              Bear family bantu pilah transaksi
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
