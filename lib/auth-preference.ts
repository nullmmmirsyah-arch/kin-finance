import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "last-auth-method";

export async function getLastAuthMethod(): Promise<"google" | "email" | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (raw === "google" || raw === "email") {
      return raw;
    }
  } catch {
    // SecureStore read failure falls back to null (default layout).
  }
  return null;
}

export async function setLastAuthMethod(
  method: "google" | "email",
): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, method);
  } catch {
    // Non-blocking persistence failure; session still completes.
  }
}
