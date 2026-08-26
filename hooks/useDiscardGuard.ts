import { useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";

type Options = {
  isDirty: boolean;
};

const DISCARD_TITLE = "Discard unsaved changes?";
const DISCARD_MESSAGE = "You have unsaved changes that will be lost.";

function confirmDiscard(onDiscard: () => void) {
  Alert.alert(DISCARD_TITLE, DISCARD_MESSAGE, [
    { text: "Keep editing", style: "cancel" },
    { text: "Discard", style: "destructive", onPress: onDiscard },
  ]);
}

export function useDiscardGuard({ isDirty }: Options) {
  const router = useRouter();
  const navigation = useNavigation();
  const intentionalLeave = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (intentionalLeave.current) {
        intentionalLeave.current = false;
        return;
      }
      if (!isDirty) return;
      e.preventDefault();
      confirmDiscard(() => navigation.dispatch(e.data.action));
    });
    return unsubscribe;
  }, [isDirty, navigation]);

  const markIntentional = useCallback(() => {
    intentionalLeave.current = true;
  }, []);

  const handleBack = useCallback(() => {
    if (!isDirty || intentionalLeave.current) {
      intentionalLeave.current = false;
      router.back();
      return;
    }
    confirmDiscard(() => {
      intentionalLeave.current = true;
      router.back();
    });
  }, [isDirty, router]);

  return { handleBack, markIntentional };
}
