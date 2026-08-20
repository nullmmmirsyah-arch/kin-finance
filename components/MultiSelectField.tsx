import Feather from "@expo/vector-icons/Feather";
import { useThemeColors } from "@/constants/theme";
import { getSelectionState, pluralLabel } from "@/utils/filters";
import { useMemo, useState } from "react";
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from "react-native";

const SEARCH_THRESHOLD = 8;

type Props = {
  title: string;
  options: { _id: string; name: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onToggleAll: (selectAll: boolean) => void;
  disabled?: boolean;
};

export function MultiSelectField({
  title,
  options,
  selectedIds,
  onToggle,
  onToggleAll,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const C = useThemeColors();

  const total = options.length;
  const selectedCount = options.filter((o) => selectedIds.includes(o._id)).length;
  const state = getSelectionState(total, selectedCount);
  const isDisabled = disabled || total === 0;
  const showSearch = total > SEARCH_THRESHOLD;
  const plural = pluralLabel(title);

  const filtered = useMemo(() => {
    if (!showSearch || search.trim() === "") return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, showSearch, search]);

  const label =
    state === "partial"
      ? `${selectedCount} of ${total} ${plural}`
      : `All ${plural}`;

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
        {title}
      </Text>
      <Pressable
        onPress={() => {
          Keyboard.dismiss();
          if (open) {
            setOpen(false);
          } else {
            setSearch("");
            setOpen(true);
          }
        }}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, expanded: open }}
        className={`h-12 flex-row items-center justify-between rounded-xl border border-border bg-background px-4 dark:border-border-dark dark:bg-background-dark ${isDisabled ? "opacity-50" : ""}`}
      >
        <View className="flex-row items-center gap-2">
          <Feather
            name={
              state === "all"
                ? "check-square"
                : state === "partial"
                  ? "minus-square"
                  : "square"
            }
            size={18}
            color={state === "empty" ? C.textSecondary : C.primary}
          />
          <Text
            className={`text-base ${
              isDisabled
                ? "text-text-secondary dark:text-text-secondary-dark"
                : "text-text-primary dark:text-text-primary-dark"
            }`}
          >
            {isDisabled ? `All ${plural}` : label}
          </Text>
        </View>
        <Feather name="chevron-down" size={20} color={C.textSecondary} />
      </Pressable>

      {open && !isDisabled ? (
        <View className="overflow-hidden rounded-xl border border-border dark:border-border-dark">
          <Pressable
            onPress={() => onToggleAll(state !== "all")}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: state !== "empty" }}
            className="min-h-11 flex-row items-center justify-between border-b border-border px-4 py-2.5 dark:border-border-dark"
          >
            <Text className="text-sm font-medium text-primary dark:text-primary-dark">
              {state === "all" ? "Unselect all" : "Select all"}
            </Text>
            <Feather
              name={
                state === "all"
                  ? "check-square"
                  : state === "partial"
                    ? "minus-square"
                    : "square"
              }
              size={18}
              color={C.primary}
            />
          </Pressable>
          {showSearch ? (
            <View className="border-b border-border px-4 py-2 dark:border-border-dark">
              <TextInput
                placeholder="Search…"
                placeholderTextColor={C.textSecondary}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
              />
            </View>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" className="max-h-52">
            {filtered.length === 0 ? (
              <Text className="px-4 py-6 text-center text-sm text-text-secondary dark:text-text-secondary-dark">
                No results found
              </Text>
            ) : (
              filtered.map((option) => {
                const selected = selectedIds.includes(option._id);
                return (
                  <Pressable
                    key={option._id}
                    onPress={() => {
                      onToggle(option._id);
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    className="min-h-12 flex-row items-center justify-between px-4 py-3"
                  >
                    <Text className="text-base text-text-primary dark:text-text-primary-dark">
                      {option.name}
                    </Text>
                    <Feather
                      name={selected ? "check-square" : "square"}
                      size={20}
                      color={selected ? C.primary : C.textSecondary}
                    />
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
