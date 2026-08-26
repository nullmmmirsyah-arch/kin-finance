import { useSnackbar } from "@/components/Snackbar";
import * as Updates from "expo-updates";
import { useEffect, useRef } from "react";

const CHECK_DELAY_MS = 5000;

export function OtaUpdater() {
  const { show } = useSnackbar();
  const isChecking = useRef(false);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    let cancelled = false;

    const checkAndApply = async () => {
      if (isChecking.current) return;
      isChecking.current = true;
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable || cancelled) return;
        await Updates.fetchUpdateAsync();
        if (cancelled) return;
        show("A new update is ready. Restart the app to apply it.", {
          label: "Restart",
          onPress: () => {
            void Updates.reloadAsync();
          },
        });
      } catch {
      } finally {
        isChecking.current = false;
      }
    };

    const timer = setTimeout(() => {
      void checkAndApply();
    }, CHECK_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [show]);

  return null;
}
