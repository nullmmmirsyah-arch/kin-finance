import * as SecureStore from "expo-secure-store";
import type { TransactionType } from "@/constants/transactions";

const STORAGE_KEY = "last-transaction";

export type LastTransaction = {
  type: TransactionType;
  amount: number;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
};

export async function getLastTransaction(): Promise<LastTransaction | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastTransaction;
    if (
      parsed &&
      typeof parsed.type === "string" &&
      typeof parsed.amount === "number" &&
      typeof parsed.accountId === "string"
    ) {
      return parsed;
    }
  } catch {
    // Corrupt or unreadable — treat as missing.
  }
  return null;
}

export async function setLastTransaction(value: LastTransaction): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Non-blocking; last-transaction persistence is best-effort.
  }
}
