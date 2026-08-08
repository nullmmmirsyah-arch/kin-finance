import { Gradients, Radius, Shadow } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { ReactNode } from "react";
import { View } from "react-native";

type Props = {
  children: ReactNode;
  className?: string;
};

export function GradientCard({ children, className = "" }: Props) {
  return (
    <LinearGradient
      colors={Gradients.card}
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
