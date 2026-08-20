import { Shadow } from "@/constants/theme";
import { useMemo } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { MultiSelectField } from "@/components/MultiSelectField";

export type TransactionType = "income" | "expense" | "transfer";
export type TypeFilter = "all" | TransactionType;

const TYPE_OPTIONS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "income", label: "Income" },
  { id: "expense", label: "Expense" },
  { id: "transfer", label: "Transfer" },
];

type Props = {
  visible: boolean;
  typeFilter: TypeFilter;
  accountIds: Id<"accounts">[];
  categoryIds: Id<"categories">[];
  accounts: Doc<"accounts">[];
  categories: Doc<"categories">[];
  onTypeFilterChange: (type: TypeFilter) => void;
  onAccountToggle: (id: Id<"accounts">) => void;
  onAccountIdsChange: (ids: Id<"accounts">[]) => void;
  onCategoryToggle: (id: Id<"categories">) => void;
  onCategoryIdsChange: (ids: Id<"categories">[]) => void;
  onReset: () => void;
  onClose: () => void;
};

export function FilterSheet({
  visible,
  typeFilter,
  accountIds,
  categoryIds,
  accounts,
  categories,
  onTypeFilterChange,
  onAccountToggle,
  onAccountIdsChange,
  onCategoryToggle,
  onCategoryIdsChange,
  onReset,
  onClose,
}: Props) {
  const categoryOptions = useMemo(() => {
    if (typeFilter === "transfer") return [];
    if (typeFilter === "all") return categories;
    return categories.filter((c) => c.type === typeFilter);
  }, [categories, typeFilter]);

  const accountOptionItems = useMemo(
    () => accounts.map((a) => ({ _id: a._id, name: a.name })),
    [accounts],
  );
  const categoryOptionItems = useMemo(
    () => categoryOptions.map((c) => ({ _id: c._id, name: c.name })),
    [categoryOptions],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityLabel="Filter transactions"
    >
      <Pressable className="flex-1 justify-end bg-black/40 px-5 pb-8" onPress={onClose}>
        <Pressable
          className="max-h-[80%] overflow-hidden rounded-2xl bg-background p-5 dark:bg-background-dark"
          style={Shadow.card}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView keyboardShouldPersistTaps="handled" className="flex-grow">
            <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
              Filter
            </Text>

          <View className="mt-4">
            <Text className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
              Type
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => onTypeFilterChange(opt.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: typeFilter === opt.id }}
                  className={`min-h-12 items-center justify-center rounded-full border px-4 ${
                    typeFilter === opt.id
                      ? "border-primary bg-primary dark:border-primary-dark dark:bg-primary-dark"
                      : "border-border bg-background dark:border-border-dark dark:bg-background-dark"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      typeFilter === opt.id
                        ? "text-background dark:text-background-dark"
                        : "text-text-secondary dark:text-text-secondary-dark"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mt-4">
            <MultiSelectField
              title="Account"
              options={accountOptionItems}
              selectedIds={accountIds}
              onToggle={(id) => onAccountToggle(id as Id<"accounts">)}
              onToggleAll={(selectAll) =>
                onAccountIdsChange(selectAll ? accounts.map((a) => a._id) : [])
              }
            />
          </View>

          <View className="mt-4">
            <MultiSelectField
              title="Category"
              options={categoryOptionItems}
              selectedIds={categoryIds}
              onToggle={(id) => onCategoryToggle(id as Id<"categories">)}
              onToggleAll={(selectAll) =>
                onCategoryIdsChange(
                  selectAll ? categoryOptions.map((c) => c._id) : [],
                )
              }
              disabled={typeFilter === "transfer"}
            />
          </View>

          <View className="mt-5 flex-row gap-3">
            <Pressable
              onPress={onReset}
              accessibilityRole="button"
              className="h-12 flex-1 items-center justify-center rounded-xl border border-error"
            >
              <Text className="text-sm font-medium text-error">Reset</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              className="h-12 flex-1 items-center justify-center rounded-xl border border-border bg-background dark:border-border-dark dark:bg-background-dark"
            >
              <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                Done
              </Text>
            </Pressable>
          </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}