import Feather from "@expo/vector-icons/Feather";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

export type SelectOption = { id: string; label: string };

type Props = {
  label?: string;
  placeholder: string;
  value: string | null;
  options: SelectOption[];
  onSelect: (id: string) => void;
  error?: string | null;
};

export function SelectField({
  label,
  placeholder,
  value,
  options,
  onSelect,
  error,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const C = useThemeColors();

  const overflowing = contentHeight > viewportHeight;
  const selectedLabel =
    options.find((o) => o.id === value)?.label ?? placeholder;

  return (
    <View className="w-full gap-1.5">
      {label ? (
        <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        style={[
          {
            borderRadius: Radius.sm,
            borderWidth: 1,
            borderColor: error ? C.error : C.border,
            backgroundColor: C.background,
            height: 48,
            paddingHorizontal: 16,
          },
          pressed ? { opacity: 0.9 } : undefined,
        ]}
        className="flex-row items-center justify-between"
      >
        <Text
          className={`text-base ${value ? "text-text-primary dark:text-text-primary-dark" : "text-text-secondary dark:text-text-secondary-dark"}`}
        >
          {selectedLabel}
        </Text>
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
      >
        <Pressable
          className="flex-1 justify-end px-5 pb-8"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={[
              Shadow.card,
              { borderRadius: Radius.md, backgroundColor: C.background },
            ]}
            className="max-h-[60%] overflow-hidden"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="px-4 pb-2 pt-4 text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
              Select {label ?? "option"}
            </Text>
            <ScrollView
              onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
              onContentSizeChange={(_w, h) => setContentHeight(h)}
            >
              {options.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    onSelect(option.id);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: option.id === value }}
                  className="flex-row items-center justify-between px-4 py-3"
                >
                  <Text className="text-base text-text-primary dark:text-text-primary-dark">
                    {option.label}
                  </Text>
                  {option.id === value ? (
                    <Feather name="check" size={18} color={C.primary} />
                  ) : null}
                </Pressable>
              ))}
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
