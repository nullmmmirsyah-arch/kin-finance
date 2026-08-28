import { useEffect, useState } from "react";

export function useConnectivity(): boolean | null {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const NetInfo = require("@react-native-community/netinfo").default;
      unsubscribe = NetInfo.addEventListener((state: { isConnected: boolean | null }) => {
        setIsConnected(state.isConnected);
      });
    } catch {
      setIsConnected(null);
    }
    return () => unsubscribe?.();
  }, []);
  return isConnected;
}
