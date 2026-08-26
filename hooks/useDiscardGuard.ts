import { useNavigation, useRouter } from "expo-router";
import { usePreventRemove } from "@react-navigation/native";
import { useCallback, useRef } from "react";
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

  // The prevented action carries the visited-route set internally, so
  // re-dispatching it below does not re-trigger this callback.
  usePreventRemove(isDirty, ({ data }) => {
    if (intentionalLeave.current) {
      intentionalLeave.current = false;
      navigation.dispatch(data.action);
      return;
    }
    confirmDiscard(() => {
      intentionalLeave.current = true;
      navigation.dispatch(data.action);
    });
  });

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
