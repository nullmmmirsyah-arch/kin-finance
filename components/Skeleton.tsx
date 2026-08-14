import { Radius, useThemeColors } from "@/constants/theme";
import { useEffect, useRef } from "react";
import { Animated, ViewStyle } from "react-native";

type Props = {
  className?: string;
  style?: ViewStyle;
};

export function Skeleton({ className = "", style }: Props) {
  const C = useThemeColors();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      className={className}
      style={[
        { backgroundColor: C.border, borderRadius: Radius.sm, opacity },
        style,
      ]}
    />
  );
}