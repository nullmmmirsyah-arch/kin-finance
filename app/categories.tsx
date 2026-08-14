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
import { Radius, useThemeColors } from "@/constants/theme";
import { CATEGORY_TYPES, CategoryType } from "@/constants/categories";
import { Chip } from "@/components/Chip";
import { Fab } from "@/components/Fab";
import { CategoryCard } from "@/components/CategoryCard";
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
        </View>
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
        </View>
      ) : (
        <FlatList
          className="mt-4 flex-1"
          contentContainerClassName="gap-3 px-5 pb-28"
          data={visibleCategories ?? []}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) =>
            isOwner ? (
              <CategoryCard
                name={item.name}
                type={item.type}
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
              <CategoryCard
                name={item.name}
                type={item.type}
                hidden={item.hidden}
              />
            )
          }
        />
      )}

      {isOwner ? (
        <Fab
          onPress={() => router.push("/category-form")}
          accessibilityLabel="Add category"
        />
      ) : null}
    </SafeAreaView>
  );
}
