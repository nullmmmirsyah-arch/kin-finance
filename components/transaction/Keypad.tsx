import { Pressable, Text, View } from "react-native";
import { Radius, useThemeColors } from "@/constants/theme";
import { useState } from "react";

const KEYS: string[][] = [
  ["1", "2", "3", "⌫"],
  ["4", "5", "6", "+"],
  ["7", "8", "9", "-"],
  [".", "0", "×", "÷"],
  ["Today", "✓", "", ""],
];

type KeyButtonProps = {
  label: string;
  onKey: (k: string) => void;
};

const KEY_LABELS: Record<string, string> = {
  "⌫": "Backspace",
  "✓": "Confirm",
  "×": "Multiply",
  "÷": "Divide",
  Today: "Today",
};

function KeyButton({ label, onKey }: KeyButtonProps) {
  const C = useThemeColors();
  const [pressed, setPressed] = useState(false);
  const isConfirm = label === "✓";

  return (
    <Pressable
      onPress={() => onKey(label)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={KEY_LABELS[label] ?? label}
      style={{
        flex: 1,
        height: 52,
        borderRadius: Radius.md,
        backgroundColor: isConfirm ? C.primary : pressed ? C.surface : C.background,
        borderWidth: 1,
        borderColor: isConfirm ? C.primary : C.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: isConfirm ? C.background : C.textPrimary, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

type KeypadProps = {
  onKey: (k: string) => void;
};

export function Keypad({ onKey }: KeypadProps) {
  const C = useThemeColors();
  return (
    <View
      className="gap-1.5 p-3"
      style={{ borderTopWidth: 1, borderColor: C.border, backgroundColor: C.background }}
    >
      {KEYS.map((row, i) => (
        <View key={i} className="flex-row gap-1.5">
          {row.map((k, j) => {
            if (k === "") return <View key={`empty-${i}-${j}`} style={{ flex: 1, height: 52 }} />;
            return <KeyButton key={k} label={k} onKey={onKey} />;
          })}
        </View>
      ))}
    </View>
  );
}
