import Feather from "@expo/vector-icons/Feather";
import { Colors, Radius, Shadow } from "@/constants/theme";
import { Text, View } from "react-native";
import { Button } from "./Button";

type Props = {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: Props) {
  return (
    <View className="items-center gap-4 px-6 py-8">
      <View
        style={[
          Shadow.card,
          {
            width: 88,
            height: 88,
            borderRadius: Radius.lg,
            backgroundColor: Colors.surface,
            borderWidth: 1,
            borderColor: Colors.primaryLight,
          },
        ]}
        className="items-center justify-center"
      >
        <Feather name={icon} size={36} color={Colors.primary} />
      </View>
      <View className="items-center gap-1.5">
        <Text className="text-center text-lg font-semibold text-text-primary">
          {title}
        </Text>
        <Text className="max-w-[280px] text-center text-sm text-text-secondary">
          {description}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <View className="w-full">
          <Button title={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
