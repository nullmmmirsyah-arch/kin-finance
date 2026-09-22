import { FlatList, Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useThemeColors } from "@/constants/theme";

export const NOTE_CHIP_MAX_WIDTH = 220;

type Props = {
  suggestions: string[];
  onSelect: (note: string) => void;
  onDismiss: (note: string) => void;
};

export function NoteSuggestChips({ suggestions, onSelect, onDismiss }: Props) {
  const C = useThemeColors();
  if (suggestions.length === 0) return null;
  return (
    <FlatList
      data={suggestions}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(s) => s}
      contentContainerStyle={{ paddingRight: 16 }}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item: s }) => (
        <View
          style={{
            flexShrink: 0,
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: C.border,
            backgroundColor: C.surface,
            borderRadius: 999,
            paddingLeft: 12,
            paddingRight: 8,
            paddingVertical: 6,
            maxWidth: NOTE_CHIP_MAX_WIDTH,
            marginRight: 8,
          }}
        >
          <Pressable
            onPress={() => onSelect(s)}
            accessibilityRole="button"
            accessibilityLabel={`Use note ${s}`}
            style={{ flexGrow: 0, flexShrink: 1, minWidth: 0 }}
          >
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              className="text-xs"
              style={{ color: C.textPrimary }}
            >
              {s}
            </Text>
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onDismiss(s);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Dismiss suggestion ${s}`}
            hitSlop={8}
            style={{
              width: 28,
              height: 28,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="x" size={14} color={C.textSecondary} />
          </Pressable>
        </View>
      )}
    />
  );
}
