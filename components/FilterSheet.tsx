import { Shadow } from "@/constants/theme";
import { useEffect, useMemo, useState } from "react";
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
  onApply: (
    type: TypeFilter,
    accountIds: Id<"accounts">[],
    categoryIds: Id<"categories">[],
  ) => void;
  onClose: () => void;
};

export function FilterSheet({
  visible,
  typeFilter,
  accountIds,
  categoryIds,
  accounts,
  categories,
  onApply,
  onClose,
}: Props) {
  const [draftType, setDraftType] = useState<TypeFilter>(typeFilter);
  const [draftAccountIds, setDraftAccountIds] = useState<Id<"accounts">[]>(accountIds);
  const [draftCategoryIds, setDraftCategoryIds] = useState<Id<"categories">[]>(categoryIds);

  useEffect(() => {
    if (!visible) return;
    setDraftType(typeFilter);
    setDraftAccountIds(accountIds);
    setDraftCategoryIds(categoryIds);
  }, [visible, typeFilter, accountIds, categoryIds]);

  const categoryOptions = useMemo(() => {
    if (draftType === "transfer") return [];
    if (draftType === "all") return categories;
    return categories.filter((c) => c.type === draftType);
  }, [categories, draftType]);

  const accountOptionItems = useMemo(
    () => accounts.map((a) => ({ _id: a._id, name: a.name })),
    [accounts],
  );
  const categoryOptionItems = useMemo(
    () => categoryOptions.map((c) => ({ _id: c._id, name: c.name })),
    [categoryOptions],
  );

  const handleTypeChange = (type: TypeFilter) => {
    setDraftType(type);
    setDraftCategoryIds((current) => {
      if (current.length === 0 || type === "all") return current;
      if (type === "transfer") return [];
      return current.filter((id) => {
        const cat = categories.find((c) => c._id === id);
        return cat !== undefined && cat.type === type;
      });
    });
  };

  const toggleAccount = (id: Id<"accounts">) =>
    setDraftAccountIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  const toggleCategory = (id: Id<"categories">) =>
    setDraftCategoryIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  const handleReset = () => {
    setDraftType("all");
    setDraftAccountIds([]);
    setDraftCategoryIds([]);
  };

  const handleDone = () => {
    onApply(draftType, draftAccountIds, draftCategoryIds);
    onClose();
  };

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
                    onPress={() => handleTypeChange(opt.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: draftType === opt.id }}
                    className={`min-h-12 items-center justify-center rounded-full border px-4 ${
                      draftType === opt.id
                        ? "border-primary bg-primary dark:border-primary-dark dark:bg-primary-dark"
                        : "border-border bg-background dark:border-border-dark dark:bg-background-dark"
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        draftType === opt.id
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
                selectedIds={draftAccountIds}
                onToggle={(id) => toggleAccount(id as Id<"accounts">)}
                onToggleAll={(selectAll) =>
                  setDraftAccountIds(selectAll ? accounts.map((a) => a._id) : [])
                }
              />
            </View>

            <View className="mt-4">
              <MultiSelectField
                title="Category"
                options={categoryOptionItems}
                selectedIds={draftCategoryIds}
                onToggle={(id) => toggleCategory(id as Id<"categories">)}
                onToggleAll={(selectAll) =>
                  setDraftCategoryIds(
                    selectAll ? categoryOptions.map((c) => c._id) : [],
                  )
                }
                disabled={draftType === "transfer"}
              />
            </View>

            <View className="mt-5 flex-row gap-3">
              <Pressable
                onPress={handleReset}
                accessibilityRole="button"
                className="h-12 flex-1 items-center justify-center rounded-xl border border-error"
              >
                <Text className="text-sm font-medium text-error">Reset</Text>
              </Pressable>
              <Pressable
                onPress={handleDone}
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
