import { FlatList, Pressable, Text, View, useWindowDimensions } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";

type CategoryOption = {
  id: string;
  label: string;
  icon?: string;
};

type Props = {
  options: CategoryOption[];
  value: string | null;
  onSelect: (id: string) => void;
  isOwner: boolean;
  onAdd: () => void;
};

const COLS = 4;
const GAP = 10;
const PAD = 12;

type GridItem = { kind: "category"; option: CategoryOption } | { kind: "add" };

export function CategoryGrid({ options, value, onSelect, isOwner, onAdd }: Props) {
  const C = useThemeColors();
  const { width } = useWindowDimensions();
  // Fixed-size cells: identical boxes no matter how full the last row is —
  // a lone category must not stretch to fill the container.
  const cell = (width - PAD * 2 - GAP * (COLS - 1)) / COLS;
  const data: GridItem[] = [
    ...options.map((option) => ({ kind: "category" as const, option })),
    ...(isOwner ? [{ kind: "add" as const }] : []),
  ];

  if (data.length === 0) {
    return <Text style={{ color: C.textSecondary }}>No categories</Text>;
  }

  return (
    <FlatList
      data={data}
      numColumns={COLS}
      keyExtractor={(item) => (item.kind === "add" ? "add-tile" : item.option.id)}
      scrollEnabled={false}
      extraData={value}
      contentContainerStyle={{ gap: GAP, padding: PAD }}
      columnWrapperStyle={{ gap: GAP }}
      renderItem={({ item }) => {
        if (item.kind === "add") {
          return (
            <View style={{ width: cell, alignItems: "center", gap: 6 }}>
              <Pressable
                onPress={onAdd}
                accessibilityRole="button"
                accessibilityLabel="Add category"
                style={[
                  Shadow.card,
                  {
                    width: cell,
                    aspectRatio: 1,
                    borderRadius: Radius.md,
                    backgroundColor: C.background,
                    borderWidth: 1,
                    borderColor: C.border,
                    borderStyle: "dashed",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  },
                ]}
              >
                <Feather name="plus" size={28} color={C.primary} />
                <Text className="text-[11px] font-medium" style={{ color: C.primary }}>
                  Add
                </Text>
              </Pressable>
            </View>
          );
        }
        const active = item.option.id === value;
        return (
          <View style={{ width: cell, alignItems: "center", gap: 6 }}>
            <Pressable
              onPress={() => onSelect(item.option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.option.label}
              style={[
                Shadow.card,
                {
                  width: "100%",
                  aspectRatio: 1,
                  borderRadius: Radius.md,
                  backgroundColor: C.background,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? C.primary : C.border,
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
            >
              <CategoryIcon name={item.option.icon ?? "other"} size={32} />
            </Pressable>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              className="text-center text-xs"
              style={{ color: C.textPrimary, maxWidth: "100%" }}
            >
              {item.option.label}
            </Text>
          </View>
        );
      }}
    />
  );
}
