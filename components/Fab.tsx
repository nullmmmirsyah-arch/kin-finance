import Feather from "@expo/vector-icons/Feather";
import { Shadow, useThemeColors } from "@/constants/theme";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Pressable, Text } from "react-native";

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  label?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Fab({ onPress, accessibilityLabel, label }: Props) {
  const scale = useSharedValue(1);
  const C = useThemeColors();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  if (label !== undefined) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        className="absolute bottom-6 right-6 flex-row items-center gap-2 rounded-full bg-primary px-5 dark:bg-primary-dark"
        style={[Shadow.elevated, { height: 56 }, animatedStyle]}
      >
        <Feather name="plus" size={24} color={C.background} />
        <Text className="text-base font-semibold text-background dark:text-background-dark">
          {label}
        </Text>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="absolute bottom-6 right-6 h-[56px] w-[56px] items-center justify-center rounded-full bg-primary dark:bg-primary-dark"
      style={[Shadow.elevated, animatedStyle]}
    >
      <Feather name="plus" size={26} color={C.background} />
    </AnimatedPressable>
  );
}
