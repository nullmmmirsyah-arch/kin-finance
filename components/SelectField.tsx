import Feather from "@expo/vector-icons/Feather";
import { Colors, Radius, Shadow } from "@/constants/theme";
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

  return (
    <View className="w-full gap-1.5">
      {label ? (
        <Text className="text-sm font-medium text-text-primary">{label}</Text>
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
            borderColor: error ? Colors.error : Colors.border,
            backgroundColor: Colors.background,
            height: 48,
            paddingHorizontal: 16,
          },
          pressed ? { opacity: 0.9 } : undefined,
        ]}
        className="flex-row items-center justify-between"
      >
        <Text
          className={`text-base ${value ? "text-text-primary" : "text-text-secondary"}`}
        >
          {value ?? placeholder}
        </Text>
        <Feather name="chevron-down" size={20} color={Colors.textSecondary} />
      </Pressable>
      {error ? <Text className="text-sm text-error">{error}</Text> : null}

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
              { borderRadius: Radius.md, backgroundColor: Colors.background },
            ]}
            className="max-h-[60%] overflow-hidden"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="px-4 pb-2 pt-4 text-sm font-medium text-text-secondary">
              Select {label ?? "option"}
            </Text>
            <ScrollView>
              {options.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    onSelect(option.id);
                    setOpen(false);
                  }}
                  className="flex-row items-center justify-between px-4 py-3"
                >
                  <Text className="text-base text-text-primary">
                    {option.label}
                  </Text>
                  {option.label === value ? (
                    <Feather name="check" size={18} color={Colors.primary} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
