import { useEffect, useRef, useState } from "react";
import * as Updates from "expo-updates";
import { UpdateBanner } from "@/components/UpdateBanner";
import { hapticSuccess } from "@/lib/haptics";
const CHECK_DELAY_MS = 5000;
export function OtaUpdater() {
  const [state, setState] = useState<"idle" | "downloading" | "ready" | "blocking">("idle");
  const [progress, setProgress] = useState(0);
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
        setState("downloading");
        setProgress(30);
        await Updates.fetchUpdateAsync();
        if (cancelled) return;
        setProgress(100);
        setState("ready");
        void hapticSuccess();
      } catch {
        setState("idle");
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
  }, []);
  if (state === "idle") return null;
  if (state === "downloading") return <UpdateBanner state="downloading" progress={progress} />;
  if (state === "ready")
    return <UpdateBanner state="ready" onRestart={() => void Updates.reloadAsync()} onDismiss={() => setState("idle")} />;
  return <UpdateBanner state="blocking" downloadUrl="https://expo.dev/artifacts/..." />;
}
