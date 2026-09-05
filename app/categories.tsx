import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
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
import { CATEGORY_TYPES, CategoryType } from "@/constants/categories";
import { Chip } from "@/components/Chip";
import { PlushCategoryCard } from "@/components/CategoryCard";
import { Bear } from "@/components/Bear";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { useSnackbar } from "@/components/Snackbar";
import { getConvexErrorMessage } from "@/lib/errors";

type Filter = "all" | CategoryType;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  ...CATEGORY_TYPES.map((t) => ({ id: t.id as Filter, label: t.label })),
];

export default function Categories() {
  const router = useRouter();
  const result = useQuery(api.categories.list);
  const updateCategory = useMutation(api.categories.update);
  const removeCategory = useMutation(api.categories.remove);
  const { show } = useSnackbar();
  const [filter, setFilter] = useState<Filter>("all");
  const [addPressed, setAddPressed] = useState(false);
  const C = useThemeColors();

  const categories = result?.categories ?? null;
  const isOwner = result?.isOwner ?? false;

  const visibleCategories = useMemo(() => {
    if (categories === null) return null;
    return filter === "all"
      ? categories
      : categories.filter((c) => c.type === filter);
  }, [categories, filter]);

  const handleToggleVisibility = useCallback(
    (category: { _id: Id<"categories">; hidden: boolean }) => {
      updateCategory({ categoryId: category._id, hidden: !category.hidden })
        .then(() => {
          show(category.hidden ? "Category visible to members" : "Category hidden from members");
        })
        .catch((e: unknown) => {
          show(getConvexErrorMessage(e, "Failed to update category."));
        });
    },
    [updateCategory, show],
  );

  const handleDelete = useCallback(
    (category: { _id: Id<"categories">; name: string }) => {
      Alert.alert(
        "Delete Category",
        `Delete "${category.name}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              removeCategory({ categoryId: category._id })
                .then(() => {
                  show(`"${category.name}" deleted`);
                })
                .catch((e: unknown) => {
                  show(
                    getConvexErrorMessage(e, "Failed to delete category."),
                  );
                });
            },
          },
        ],
      );
    },
    [removeCategory, show],
  );

  if (result === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        <View className="px-5 pt-4">
          <View className="flex-row items-center gap-2">
            <View style={{ width: 48, height: 48 }} />
            <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
              Categories
            </Text>
          </View>
        </View>
        <View className="mt-4 flex-row flex-wrap gap-2 px-5">
          {[0, 1, 2].map((i) => (
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

  if (categories === null) {
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
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 48, height: 48 }}
            className="items-center justify-center"
          >
            <Feather name="arrow-left" size={22} color={C.textPrimary} />
          </Pressable>
          <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
            Categories
          </Text>
          <View
            style={{
              marginLeft: 8,
              backgroundColor: "#FDE68A",
              borderWidth: 2,
              borderColor: "#FFFFFF",
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "800", color: C.primary }}>56 icons</Text>
          </View>
        </View>
      </View>

      {/* Filter chips: All/Income/Expense + Add button terra */}
      <View className="mt-4 flex-row items-center gap-2 px-5">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1 }}>
          {FILTERS.map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              active={filter === f.id}
              onPress={() => setFilter(f.id)}
            />
          ))}
        </View>
        {isOwner ? (
          <Pressable
            onPress={() => router.push("/category-form")}
            onPressIn={() => setAddPressed(true)}
            onPressOut={() => setAddPressed(false)}
            accessibilityRole="button"
            accessibilityLabel="Add category"
            style={{
              backgroundColor: addPressed ? "#B45309" : C.primary,
              borderRadius: 999,
              paddingHorizontal: 14,
              height: 40,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderWidth: 2,
              borderColor: "#FFFFFF",
            }}
          >
            <Feather name="plus" size={14} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Add</Text>
          </Pressable>
        ) : null}
      </View>

      {visibleCategories !== null && visibleCategories.length === 0 ? (
        <View className="mt-6 flex-1 px-5">
          <View
            style={{ backgroundColor: C.background }}
            className="rounded-[16px]"
          >
            <EmptyState
              icon="tag"
              title="No categories yet"
              description="Create categories to organize your transactions."
              actionLabel={isOwner ? "Add Category" : undefined}
              onAction={
                isOwner ? () => router.push("/category-form") : undefined
              }
            />
          </View>
          {/* reserved footer even when empty */}
          <View
            testID="reserved-footer"
            style={[
              Shadow.card,
              {
                marginTop: 12,
                backgroundColor: "#FFE9C9",
                borderWidth: 2.5,
                borderColor: "#FFFFFF",
                borderRadius: 18,
                padding: 12,
                flexDirection: "row",
                gap: 10,
                alignItems: "center",
              },
            ]}
          >
            <Bear size="small" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: C.textPrimary }}>
                2 reserved “Initial Balance”
              </Text>
              <Text style={{ fontSize: 11, fontWeight: "700", color: C.textSecondary }}>
                Tidak bisa dihapus — dipakai untuk opening balance
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <FlatList
          className="mt-4 flex-1"
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 28 }}
          columnWrapperStyle={{ gap: 8 }}
          numColumns={2}
          data={visibleCategories ?? []}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) =>
            isOwner ? (
              <PlushCategoryCard
                name={item.name}
                type={item.type}
                icon={item.icon}
                hidden={item.hidden}
                onToggleVisibility={() => handleToggleVisibility(item)}
                onEdit={() =>
                  router.push({
                    pathname: "/category-form",
                    params: { id: item._id },
                  })
                }
                onDelete={() => handleDelete(item)}
              />
            ) : (
              <PlushCategoryCard
                name={item.name}
                type={item.type}
                icon={item.icon}
                hidden={item.hidden}
              />
            )
          }
          ListFooterComponent={
            <View
              testID="reserved-footer"
              style={[
                Shadow.card,
                {
                  marginTop: 12,
                  backgroundColor: "#FFE9C9",
                  borderWidth: 2.5,
                  borderColor: "#FFFFFF",
                  borderRadius: 18,
                  padding: 12,
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "center",
                },
              ]}
            >
              <Bear size="small" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: C.textPrimary }}>
                  2 reserved “Initial Balance”
                </Text>
                <Text style={{ fontSize: 11, fontWeight: "700", color: C.textSecondary }}>
                  Tidak bisa dihapus — dipakai untuk opening balance
                </Text>
              </View>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
