import { Radius, Shadow, useThemeGradients } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { ReactNode } from "react";
import { View } from "react-native";

type Props = {
  children: ReactNode;
  className?: string;
};

export function GradientCard({ children, className = "" }: Props) {
  const gradients = useThemeGradients();
  return (
    <LinearGradient
      colors={gradients.card}
      style={[
        Shadow.card,
        {
          borderRadius: Radius.md,
          padding: 16,
        },
      ]}
      className={`w-full ${className}`}
    >
      <View>{children}</View>
    </LinearGradient>
  );
}
