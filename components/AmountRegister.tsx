import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { Bear } from "@/components/Bear";
import { Shadow, useThemeColors } from "@/constants/theme";
import { formatAmountInput, formatNumber } from "@/utils/format";
import type { TransactionType } from "@/constants/transactions";

type AmountRegisterProps = {
  amountText: string;
  onAmountTextChange: (text: string) => void;
  type: TransactionType;
  amountError?: string | null;
  onBlur?: () => void;
  /** optional external handlers — if not provided, component handles internally */
  onPressDigit?: (digit: string) => void;
  onBackspace?: () => void;
  onClear?: () => void;
  onAddPreset?: (value: number) => void;
};

const PRESETS: { label: string; value: number }[] = [
  { label: "+50k", value: 50000 },
  { label: "+100k", value: 100000 },
  { label: "+500k", value: 500000 },
  { label: "+1jt", value: 1000000 },
];



function NumpadButton({
  label,
  isBackspace,
  onPress,
  testID,
}: {
  label: string;
  isBackspace?: boolean;
  onPress: () => void;
  testID: string;
}) {
  const [pressed, setPressed] = useState(false);
  const C = useThemeColors();
  const isDark = C.background === "#1C1917";
  const cardBg = isDark ? C.surface : "#FFFFFF";
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={pressed ? { opacity: 0.85 } : undefined}
      className="items-center justify-center rounded-2xl border bg-white dark:bg-surface-dark"
    >
      <View
        className="w-full items-center justify-center rounded-2xl"
        style={{
          borderWidth: 2,
          borderColor: C.border,
          backgroundColor: isBackspace ? C.surface : cardBg,
          height: 52,
        }}
      >
        {isBackspace ? (
          <Feather name="delete" size={20} color={C.textPrimary} />
        ) : (
          <Text className="text-[20px] font-extrabold text-text-primary dark:text-text-primary-dark">
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function PresetPill({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const [pressed, setPressed] = useState(false);
  const C = useThemeColors();
  const isDark = C.background === "#1C1917";
  const cardBg = isDark ? C.surface : "#FFFFFF";
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Add ${label}`}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={pressed ? { opacity: 0.85 } : undefined}
      className="flex-1 items-center justify-center rounded-full border px-2 py-2"
    >
      <View
        className="w-full items-center justify-center rounded-full px-2"
        style={{
          borderWidth: 2,
          borderColor: C.border,
          backgroundColor: cardBg,
          height: 48,
          minHeight: 48,
        }}
      >
        <Text className="text-xs font-bold text-text-primary dark:text-text-primary-dark">
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export function AmountRegister({
  amountText,
  onAmountTextChange,
  type,
  amountError,
  onBlur,
  onPressDigit,
  onBackspace,
  onClear,
  onAddPreset,
}: AmountRegisterProps) {
  const C = useThemeColors();
  const isDark = C.background === "#1C1917";
  const cardBg = isDark ? C.surface : "#FFFFFF";

  const badgeConfig = (() => {
    switch (type) {
      case "expense":
        return { label: "Expense −", bg: "#FEE2E2", color: "#991B1B", sign: "−" };
      case "income":
        return { label: "Income +", bg: "#DCFCE7", color: "#065F46", sign: "+" };
      case "transfer":
        return { label: "Transfer ⇄", bg: "#FEF3C7", color: "#92400E", sign: "⇄" };
    }
  })();

  const handleChangeText = (text: string) => {
    const formatted = formatAmountInput(text);
    onAmountTextChange(formatted);
  };

  const internalPressDigit = (digit: string) => {
    if (onPressDigit) {
      onPressDigit(digit);
      return;
    }
    const raw = amountText.replace(/,/g, "");
    // handle 000: if raw empty and digit starts with 0, keep single 0
    let nextRaw: string;
    if (raw === "" && digit === "0") {
      nextRaw = "0";
    } else if (raw === "" && digit === "000") {
      nextRaw = "0";
    } else {
      nextRaw = `${raw}${digit}`;
    }
    const formatted = formatAmountInput(nextRaw);
    onAmountTextChange(formatted);
  };

  const internalBackspace = () => {
    if (onBackspace) {
      onBackspace();
      return;
    }
    const raw = amountText.replace(/,/g, "");
    if (raw.length === 0) return;
    const nextRaw = raw.slice(0, -1);
    const formatted = formatAmountInput(nextRaw);
    onAmountTextChange(formatted);
  };

  const internalAddPreset = (value: number) => {
    if (onAddPreset) {
      onAddPreset(value);
      return;
    }
    const current = Number(amountText.replace(/,/g, "") || "0");
    const next = current + value;
    // clamp to safe integer
    const safeNext = Math.min(next, Number.MAX_SAFE_INTEGER);
    onAmountTextChange(formatNumber(safeNext));
  };

  const internalClear = () => {
    if (onClear) {
      onClear();
      return;
    }
    onAmountTextChange("");
  };

  const showClear = amountText !== "";

  return (
    <View className="gap-3" testID="amount-register">
      {/* reg-top: 2 small bears + badge */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-end gap-2">
          <Bear size="small" variant="mama" testID="bear-reg-1" />
          <Bear size="small" variant="cub" testID="bear-reg-2" />
        </View>
        <View
          className="rounded-full px-3 py-1.5"
          style={{ backgroundColor: badgeConfig.bg, borderWidth: 2, borderColor: "#FFFFFF" }}
          testID="type-badge"
        >
          <Text className="text-xs font-bold" style={{ color: badgeConfig.color }}>
            {badgeConfig.label}
          </Text>
        </View>
      </View>

      {/* reg-display: white 2.5px border radius 20px with sign pill + large amount + sub Rp */}
      <View
        className="flex-row items-center gap-3 px-3 py-3"
        style={[
          Shadow.card,
          {
            backgroundColor: cardBg,
            borderWidth: 2.5,
            borderColor: isDark ? C.border : "#FFFFFF",
            borderRadius: 20,
          },
        ]}
      >
        {/* sign pill 46x52 */}
        <View
          className="items-center justify-center"
          style={{
            width: 46,
            height: 52,
            borderRadius: 14,
            backgroundColor: badgeConfig.bg,
            borderWidth: 2,
            borderColor: "#FFFFFF",
          }}
          testID="sign-pill"
        >
          <Text className="text-[22px] font-extrabold" style={{ color: badgeConfig.color }}>
            {badgeConfig.sign}
          </Text>
        </View>

        {/* amount display: visible TextInput for physical keyboard + formatting */}
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            {showClear ? (
              <Pressable
                testID="clear-amount"
                accessibilityRole="button"
                accessibilityLabel="Clear amount"
                onPress={internalClear}
                className="h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: C.surface }}
              >
                <Feather name="x" size={14} color={C.textSecondary} />
              </Pressable>
            ) : null}
            <TextInput
              testID="amount-input"
              accessibilityLabel="Amount"
              placeholder="0"
              placeholderTextColor={C.textSecondary}
              value={amountText}
              onChangeText={handleChangeText}
              onBlur={onBlur}
              keyboardType="number-pad"
              returnKeyType="done"
              autoCorrect={false}
              spellCheck={false}
              style={{
                flex: 1,
                fontSize: 34,
                fontWeight: "800",
                color: C.textPrimary,
                paddingVertical: 2,
              }}
            />
          </View>
          <View className="flex-row items-center gap-1.5">
            <Text className="text-xs font-bold text-text-secondary dark:text-text-secondary-dark">Rp</Text>
            <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">• Whole number ≥1</Text>
          </View>
        </View>
      </View>

      {/* preset row +50k etc */}
      <View className="flex-row gap-2">
        {PRESETS.map((p) => (
          <PresetPill
            key={p.label}
            label={p.label}
            testID={`preset-${p.value}`}
            onPress={() => internalAddPreset(p.value)}
          />
        ))}
      </View>

      {/* numpad 3x4 grid */}
      <View className="gap-2">
        <View className="flex-row gap-2">
          <View className="flex-1">
            <NumpadButton
              label="1"
              testID="numpad-1"
              onPress={() => internalPressDigit("1")}
            />
          </View>
          <View className="flex-1">
            <NumpadButton label="2" testID="numpad-2" onPress={() => internalPressDigit("2")} />
          </View>
          <View className="flex-1">
            <NumpadButton label="3" testID="numpad-3" onPress={() => internalPressDigit("3")} />
          </View>
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <NumpadButton label="4" testID="numpad-4" onPress={() => internalPressDigit("4")} />
          </View>
          <View className="flex-1">
            <NumpadButton label="5" testID="numpad-5" onPress={() => internalPressDigit("5")} />
          </View>
          <View className="flex-1">
            <NumpadButton label="6" testID="numpad-6" onPress={() => internalPressDigit("6")} />
          </View>
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <NumpadButton label="7" testID="numpad-7" onPress={() => internalPressDigit("7")} />
          </View>
          <View className="flex-1">
            <NumpadButton label="8" testID="numpad-8" onPress={() => internalPressDigit("8")} />
          </View>
          <View className="flex-1">
            <NumpadButton label="9" testID="numpad-9" onPress={() => internalPressDigit("9")} />
          </View>
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <NumpadButton label="000" testID="numpad-000" onPress={() => internalPressDigit("000")} />
          </View>
          <View className="flex-1">
            <NumpadButton label="0" testID="numpad-0" onPress={() => internalPressDigit("0")} />
          </View>
          <View className="flex-1">
            <NumpadButton label="⌫" isBackspace testID="numpad-backspace" onPress={internalBackspace} />
          </View>
        </View>
      </View>

      {/* hint / error */}
      {amountError ? (
        <Text testID="amount-error" className="text-sm text-error dark:text-error-dark">
          {amountError}
        </Text>
      ) : (
        <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">Whole number ≥1</Text>
      )}
    </View>
  );
}
