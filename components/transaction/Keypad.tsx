import { Pressable, Text, View } from "react-native";
import { Radius, useThemeColors } from "@/constants/theme";
import { useState } from "react";

// No Today key (date pill beside account covers it), no ✓ (Save bar submits).
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

function SplitKey({ labels, onKey }: { labels: [string, string]; onKey: (k: string) => void }) {
  const C = useThemeColors();
  const [pressed, setPressed] = useState<string | null>(null);
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
      {labels.map((label) => (
        <Pressable
          key={label}
          onPress={() => onKey(label)}
          onPressIn={() => setPressed(label)}
          onPressOut={() => setPressed(null)}
          accessibilityRole="button"
          accessibilityLabel={KEY_LABELS[label] ?? label}
          style={{
            flex: 1,
            height: 52,
            borderRadius: Radius.md,
            backgroundColor: pressed === label ? C.surface : C.background,
            borderWidth: 1,
            borderColor: C.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: C.primary, fontWeight: "700", fontSize: 16 }}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
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
      <View className="flex-row gap-1.5">
        {["1", "2", "3"].map((k) => (
          <KeyButton key={k} label={k} onKey={onKey} />
        ))}
        <View style={{ width: 8 }} />
        <KeyButton label="⌫" onKey={onKey} />
      </View>
      <View className="flex-row gap-1.5">
        {["4", "5", "6"].map((k) => (
          <KeyButton key={k} label={k} onKey={onKey} />
        ))}
        <View style={{ width: 8 }} />
        <SplitKey labels={["+", "×"]} onKey={onKey} />
      </View>
      <View className="flex-row gap-1.5">
        {["7", "8", "9"].map((k) => (
          <KeyButton key={k} label={k} onKey={onKey} />
        ))}
        <View style={{ width: 8 }} />
        <SplitKey labels={["-", "÷"]} onKey={onKey} />
      </View>
      <View className="flex-row gap-1.5">
        <KeyButton label="." onKey={onKey} />
        <View style={{ flex: 2, flexDirection: "row" }}>
          <KeyButton label="0" onKey={onKey} />
        </View>
        <View style={{ width: 8 }} />
        <View style={{ flex: 1 }} />
      </View>
    </View>
  );
}
