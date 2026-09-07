import { FlatList, Pressable, Text } from "react-native";
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

export function CategoryGrid({ options, value, onSelect, isOwner, onAdd }: Props) {
  const C = useThemeColors();

  if (options.length === 0) {
    if (isOwner) {
      return (
        <Pressable onPress={onAdd} className="items-center py-4">
          <Text style={{ color: C.primary }} className="text-sm font-medium">
            Create category
          </Text>
        </Pressable>
      );
    }
    return <Text style={{ color: C.textSecondary }}>No categories</Text>;
  }

  return (
    <FlatList
      data={options}
      numColumns={4}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ gap: 10, padding: 12 }}
      columnWrapperStyle={{ gap: 10 }}
      renderItem={({ item }) => {
        const active = item.id === value;
        return (
          <Pressable
            onPress={() => onSelect(item.id)}
            style={[
              Shadow.card,
              {
                flex: 1,
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
            <Text numberOfLines={1} className="text-center text-[11px]" style={{ color: C.textPrimary }}>
              {item.label}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}
