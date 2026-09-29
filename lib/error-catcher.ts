// TEMPORARY diagnostic catcher — remove after the share redbox is diagnosed.
// Captures the full JS stack of unhandled errors and offers one-tap copy.
import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";

let installed = false;

export function installTempErrorCatcher() {
  if (installed || !__DEV__) return;
  installed = true;
  const prev = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    const stack =
      typeof error?.stack === "string" && error.stack.length > 0
        ? error.stack
        : "(no stack)";
    const full = `TEMP-CATCH ${isFatal ? "FATAL" : "non-fatal"}: ${error?.message ?? String(error)}\n${stack}`;
    // Fire-and-forget: never let the catcher itself throw.
    try {
      Alert.alert("Temp error catcher", full.slice(0, 800), [
        {
          text: "Salin",
          onPress: () => {
            void Clipboard.setStringAsync(full).catch(() => {});
          },
        },
        { text: "Tutup", style: "cancel" },
      ]);
    } catch {
      // ignore
    }
    try {
      prev(error, isFatal);
    } catch {
      // ignore
    }
  });
}
