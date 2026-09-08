import { FlatList, Pressable, Text, useWindowDimensions } from "react-native";
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
const ADD_ID = "__add_category__";

export function CategoryGrid({ options, value, onSelect, isOwner, onAdd }: Props) {
  const C = useThemeColors();
  const { width } = useWindowDimensions();
  // Fixed-size cells: identical boxes no matter how full the last row is —
  // a lone category must not stretch to fill the container.
  const cell = (width - PAD * 2 - GAP * (COLS - 1)) / COLS;
  const data: CategoryOption[] = isOwner
    ? [...options, { id: ADD_ID, label: "Add" }]
    : options;

  if (data.length === 0) {
    return <Text style={{ color: C.textSecondary }}>No categories</Text>;
  }

  return (
    <FlatList
      data={data}
      numColumns={COLS}
      keyExtractor={(o) => o.id}
      scrollEnabled={false}
      extraData={value}
      contentContainerStyle={{ gap: GAP, padding: PAD }}
      columnWrapperStyle={{ gap: GAP }}
      renderItem={({ item }) => {
        if (item.id === ADD_ID) {
          return (
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
          );
        }
        const active = item.id === value;
        return (
          <Pressable
            onPress={() => onSelect(item.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            style={[
              Shadow.card,
              {
                width: cell,
                aspectRatio: 1,
                borderRadius: Radius.md,
                backgroundColor: C.background,
                borderWidth: active ? 2 : 1,
                borderColor: active ? C.primary : C.border,
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              },
            ]}
            className="p-2"
          >
            <CategoryIcon name={item.icon ?? "other"} size={32} />
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              className="text-center text-[11px]"
              style={{ color: C.textPrimary, maxWidth: "100%" }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}
