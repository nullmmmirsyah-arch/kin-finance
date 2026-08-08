import { ReactNode } from "react";
import { View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

type Props = {
  children: ReactNode;
  rightActions?: ReactNode;
};

export function SwipeableRow({ children, rightActions }: Props) {
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={
        rightActions ? () => <View className="flex-row">{rightActions}</View> : undefined
      }
    >
      {children}
    </ReanimatedSwipeable>
  );
}
