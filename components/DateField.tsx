import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import Feather from "@expo/vector-icons/Feather";
import { Colors, Radius, Shadow } from "@/constants/theme";
import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { formatDateShort } from "@/utils/date";
import { Button } from "./Button";

type Props = {
  label?: string;
  value: Date;
  onChange: (date: Date) => void;
  maximumDate?: Date;
  error?: string | null;
};

export function DateField({
  label,
  value,
  onChange,
  maximumDate,
  error,
}: Props) {
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState<Date | null>(null);
  const [pressed, setPressed] = useState(false);

  return (
    <View className="w-full gap-1.5">
      {label ? (
        <Text className="text-sm font-medium text-text-primary">{label}</Text>
      ) : null}
      <Pressable
        onPress={() => {
          setDraft(value);
          setShow(true);
        }}
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
        <Text className="text-base text-text-primary">
          {formatDateShort(value.getTime())}
        </Text>
        <Feather name="calendar" size={18} color={Colors.textSecondary} />
      </Pressable>
      {error ? <Text className="text-sm text-error">{error}</Text> : null}

      {show ? (
        Platform.OS === "ios" ? (
          <Modal
            visible={show}
            transparent
            animationType="fade"
            onRequestClose={() => setShow(false)}
          >
            <Pressable
              className="flex-1 items-center justify-center px-6"
              style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
              onPress={() => setShow(false)}
            >
              <Pressable
                style={[
                  Shadow.card,
                  { borderRadius: Radius.md, backgroundColor: Colors.background, padding: 16 },
                ]}
                className="gap-2"
                onPress={(e) => e.stopPropagation()}
              >
                <DateTimePicker
                  value={draft ?? value}
                  mode="date"
                  display="spinner"
                  maximumDate={maximumDate}
                  onChange={(event: DateTimePickerEvent, date?: Date) => {
                    if (event.type === "set" && date) setDraft(date);
                  }}
                />
                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => setShow(false)}
                />
                <Button
                  title="Done"
                  variant="secondary"
                  onPress={() => {
                    if (draft) onChange(draft);
                    setShow(false);
                  }}
                />
              </Pressable>
            </Pressable>
          </Modal>
        ) : (
          <DateTimePicker
            value={value}
            mode="date"
            display="default"
            maximumDate={maximumDate}
            onChange={(event: DateTimePickerEvent, date?: Date) => {
              if (event.type === "set" && date) onChange(date);
              setShow(false);
            }}
          />
        )
      ) : null}
    </View>
  );
}
