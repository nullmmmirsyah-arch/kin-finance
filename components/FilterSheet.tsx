import Feather from "@expo/vector-icons/Feather";
import { Shadow, useThemeColors } from "@/constants/theme";
import { useMemo, useState } from "react";
import { Keyboard, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { Doc, Id } from "@/convex/_generated/dataModel";

export type TransactionType = "income" | "expense" | "transfer";
export type TypeFilter = "all" | TransactionType;

const TYPE_OPTIONS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "income", label: "Income" },
  { id: "expense", label: "Expense" },
  { id: "transfer", label: "Transfer" },
];

const SEARCH_THRESHOLD = 8;

type Props = {
  visible: boolean;
  typeFilter: TypeFilter;
  accountFilter: Id<"accounts"> | null;
  categoryFilter: Id<"categories"> | null;
  accounts: Doc<"accounts">[];
  categories: Doc<"categories">[];
  onTypeFilterChange: (type: TypeFilter) => void;
  onAccountFilterChange: (id: Id<"accounts"> | null) => void;
  onCategoryFilterChange: (id: Id<"categories"> | null) => void;
  onReset: () => void;
  onClose: () => void;
};

function OptionList({
  title,
  options,
  selectedId,
  onSelect,
  disabled,
}: {
  title: string;
  options: { _id: string; name: string }[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const C = useThemeColors();
  const showSearch = options.length > SEARCH_THRESHOLD;

  const filtered = useMemo(() => {
    if (!showSearch || search.trim() === "") return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, showSearch, search]);

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
        {title}
      </Text>
      {showSearch ? (
        <TextInput
          placeholder="Search…"
          placeholderTextColor={C.textSecondary}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
        />
      ) : null}
      <View className="max-h-52 overflow-hidden rounded-xl border border-border dark:border-border-dark">
        <ScrollView keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              onSelect(null);
            }}
            disabled={disabled}
            accessibilityRole="button"
            className="min-h-12 flex-row items-center justify-between px-4 py-3"
          >
            <Text
              className={`text-base ${
                selectedId === null
                  ? "text-primary dark:text-primary-dark"
                  : "text-text-primary dark:text-text-primary-dark"
              }`}
            >
              All {title.toLowerCase() === "account" ? "accounts" : "categories"}
            </Text>
            {selectedId === null ? <Feather name="check" size={18} color={C.primary} /> : null}
          </Pressable>
          {filtered.map((option) => (
            <Pressable
              key={option._id}
              onPress={() => {
                Keyboard.dismiss();
                onSelect(option._id);
              }}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: option._id === selectedId }}
              className="min-h-12 flex-row items-center justify-between px-4 py-3"
            >
              <Text
                className={`text-base ${
                  option._id === selectedId
                    ? "text-primary dark:text-primary-dark"
                    : "text-text-primary dark:text-text-primary-dark"
                }`}
              >
                {option.name}
              </Text>
              {option._id === selectedId ? <Feather name="check" size={18} color={C.primary} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

export function FilterSheet({
  visible,
  typeFilter,
  accountFilter,
  categoryFilter,
  accounts,
  categories,
  onTypeFilterChange,
  onAccountFilterChange,
  onCategoryFilterChange,
  onReset,
  onClose,
}: Props) {
  const categoryOptions = useMemo(() => {
    if (typeFilter === "transfer") return [];
    if (typeFilter === "all") return categories;
    return categories.filter((c) => c.type === typeFilter);
  }, [categories, typeFilter]);

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
            <OptionList
              title="Account"
              options={accounts}
              selectedId={accountFilter}
              onSelect={(id) => onAccountFilterChange(id as Id<"accounts"> | null)}
            />
          </View>

          <View className="mt-4">
            <OptionList
              title="Category"
              options={categoryOptions}
              selectedId={categoryFilter}
              onSelect={(id) => onCategoryFilterChange(id as Id<"categories"> | null)}
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