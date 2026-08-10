import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";

type SnackbarContextValue = {
  show: (message: string) => void;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (context === null) {
    throw new Error("useSnackbar must be used within SnackbarProvider");
  }
  return context;
}

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const C = useThemeColors();
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);

  const show = useCallback(
    (text: string) => {
      const current = ++generation.current;
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      opacity.stopAnimation();
      translateY.stopAnimation();
      setMessage(text);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      hideTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 20,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished && generation.current === current) {
            setMessage(null);
          }
        });
      }, 2500);
    },
    [opacity, translateY],
  );

  useEffect(() => {
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, [opacity, translateY]);

  return (
    <SnackbarContext.Provider value={{ show }}>
      {children}
      {message ? (
        <View pointerEvents="none" className="absolute bottom-24 left-5 right-5">
          <Animated.View
            style={[
              Shadow.elevated,
              {
                opacity,
                transform: [{ translateY }],
                backgroundColor: C.textPrimary,
                borderRadius: Radius.sm,
                paddingHorizontal: 16,
                paddingVertical: 12,
              },
            ]}
          >
            <Text className="text-center text-base font-medium text-background dark:text-background-dark">
              {message}
            </Text>
          </Animated.View>
        </View>
      ) : null}
    </SnackbarContext.Provider>
  );
}
