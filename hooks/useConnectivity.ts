import { useEffect, useState } from "react";

export function useConnectivity(): boolean | null {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    try {
      const NetInfo = require("@react-native-community/netinfo").default;
      sub = NetInfo.addEventListener((state: { isConnected: boolean | null }) => {
        setIsConnected(state.isConnected ?? true);
      });
    } catch {
      setIsConnected(null);
    }
    return () => sub?.remove();
  }, []);
  return isConnected;
}
