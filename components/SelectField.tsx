import Feather from "@expo/vector-icons/Feather";
import { Shadow, useThemeColors } from "@/constants/theme";
import { useMemo, useState } from "react";
import { Keyboard, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Icon } from "@/modules/icon-registry";

export type SelectOption = { id: string; label: string; icon?: string };

type Props = {
  label?: string;
  placeholder: string;
  value: string | null;
  options: SelectOption[];
  onSelect: (id: string) => void;
  error?: string | null;
};

const SEARCH_THRESHOLD = 8;

export function SelectField({
  label,
  placeholder,
  value,
  options,
  onSelect,
  error,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const C = useThemeColors();

  const overflowing = contentHeight > viewportHeight;
  const showSearch = options.length > SEARCH_THRESHOLD;
  const selectedOption = options.find((o) => o.id === value);
  const selectedLabel = selectedOption?.label ?? placeholder;

  const filteredOptions = useMemo(() => {
    if (!showSearch || search.trim() === "") return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, showSearch, search]);

  return (
    <View className="w-full gap-1.5">
      {label ? (
        <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={() => {
          Keyboard.dismiss();
          setSearch("");
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={selectedLabel}
        className={`h-12 flex-row items-center justify-between rounded-xl border bg-background px-4 dark:bg-background-dark ${error ? "border-error dark:border-error-dark" : "border-border dark:border-border-dark"}`}
      >
        <View className="flex-row items-center gap-2">
          {selectedOption?.icon ? <Icon ref={selectedOption.icon} size={24} /> : null}
          <Text
            className={`text-base ${value ? "text-text-primary dark:text-text-primary-dark" : "text-text-secondary dark:text-text-secondary-dark"}`}
          >
            {selectedLabel}
          </Text>
        </View>
        <Feather name="chevron-down" size={20} color={C.textSecondary} />
      </Pressable>
      {error ? (
        <Text className="text-sm text-error dark:text-error-dark">{error}</Text>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        accessibilityLabel={`Select ${label ?? "option"}`}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40 px-5 pb-8"
          onPress={() => setOpen(false)}
        >
          <Pressable
            className="max-h-[60%] overflow-hidden rounded-2xl bg-background dark:bg-background-dark"
            style={Shadow.card}
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="px-4 pb-2 pt-4 text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
              Select {label ?? "option"}
            </Text>
            {showSearch ? (
              <View className="px-4 pb-2">
                <TextInput
                  placeholder="Search…"
                  placeholderTextColor={C.textSecondary}
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
                />
              </View>
            ) : null}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
              onContentSizeChange={(_w, h) => setContentHeight(h)}
            >
              {filteredOptions.length === 0 ? (
                <Text className="px-4 py-6 text-center text-sm text-text-secondary dark:text-text-secondary-dark">
                  No results found
                </Text>
              ) : (
                filteredOptions.map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      onSelect(option.id);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: option.id === value }}
                    className="min-h-12 flex-row items-center justify-between px-4 py-3"
                  >
                    <View className="flex-row items-center gap-2">
                      {option.icon ? <Icon ref={option.icon} size={24} /> : null}
                      <Text className="text-base text-text-primary dark:text-text-primary-dark">
                        {option.label}
                      </Text>
                    </View>
                    {option.id === value ? (
                      <Feather name="check" size={18} color={C.primary} />
                    ) : null}
                  </Pressable>
                ))
              )}
            </ScrollView>
            {overflowing ? (
              <View className="items-center border-t border-border py-2 dark:border-border-dark">
                <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
                  Scroll for more options
                </Text>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
