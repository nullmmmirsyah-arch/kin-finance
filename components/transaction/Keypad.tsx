import { Pressable, Text, View } from "react-native";
import { Radius, useThemeColors } from "@/constants/theme";
import { useState } from "react";

// 4 rows × 4 cols, fully filled: digits left, operators separated right.
// No Today key (date pill beside account covers it), no ✓ (Save bar submits).
const KEYS: string[][] = [
  ["1", "2", "3", "⌫"],
  ["4", "5", "6", "+"],
  ["7", "8", "9", "-"],
  [".", "0", "×", "÷"],
];

const OP_KEYS = ["+", "-", "×", "÷"];

const KEY_LABELS: Record<string, string> = {
  "⌫": "Backspace",
  "×": "Multiply",
  "÷": "Divide",
};

type KeyButtonProps = {
  label: string;
  onKey: (k: string) => void;
};

function KeyButton({ label, onKey }: KeyButtonProps) {
  const C = useThemeColors();
  const [pressed, setPressed] = useState(false);
  const isOp = OP_KEYS.includes(label);

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
        backgroundColor: pressed || isOp ? C.surface : C.background,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: isOp ? C.primary : C.textPrimary,
          fontWeight: "700",
          fontSize: 16,
        }}
      >
        {label}
      </Text>
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
          {row.slice(0, 3).map((k) => (
            <KeyButton key={k} label={k} onKey={onKey} />
          ))}
          {/* Visual separation between digits and operators */}
          <View style={{ width: 8 }} />
          <KeyButton label={row[3]} onKey={onKey} />
        </View>
      ))}
    </View>
  );
}
