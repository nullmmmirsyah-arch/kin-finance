import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";

export type SnackbarAction = {
  label: string;
  onPress: () => void;
};

type SnackbarContextValue = {
  show: (message: string, action?: SnackbarAction) => void;
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
  const [action, setAction] = useState<SnackbarAction | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);

  const hide = useCallback(() => {
    opacity.stopAnimation();
    translateY.stopAnimation();
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
      if (finished) {
        setMessage(null);
        setAction(null);
      }
    });
  }, [opacity, translateY]);

  const show = useCallback(
    (text: string, action?: SnackbarAction) => {
      const current = ++generation.current;
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      opacity.stopAnimation();
      translateY.stopAnimation();
      setMessage(text);
      setAction(action ?? null);
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
        if (generation.current === current) {
          hide();
        }
      }, action ? 6000 : 2500);
    },
    [hide, opacity, translateY],
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
  }, [hide, opacity, translateY]);

  return (
    <SnackbarContext.Provider value={{ show }}>
      {children}
      {message ? (
        <View pointerEvents="box-none" className="absolute bottom-24 left-5 right-5">
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
            <View className="flex-row items-center gap-4">
              <Text className="flex-1 text-base font-medium text-background dark:text-background-dark">
                {message}
              </Text>
              {action ? (
                <Pressable
                  onPress={action.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  className="min-h-12 items-center justify-center"
                >
                  <Text className="text-base font-bold text-primary-light dark:text-primary">
                    {action.label}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Animated.View>
        </View>
      ) : null}
    </SnackbarContext.Provider>
  );
}
