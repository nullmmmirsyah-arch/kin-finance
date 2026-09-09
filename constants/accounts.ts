import { ComponentProps } from "react";
import Feather from "@expo/vector-icons/Feather";

export type AccountType = "asset" | "debt";
export type AccountSubType = "cash" | "bank" | "ewallet" | "credit_card" | "other";

export const ACCOUNT_TYPES: {
  id: AccountType;
  label: string;
  icon: ComponentProps<typeof Feather>["name"];
}[] = [
  { id: "asset", label: "Asset", icon: "dollar-sign" },
  { id: "debt", label: "Debt", icon: "credit-card" },
];

export function subTypesFor(type: AccountType): AccountSubType[] {
  return type === "asset"
    ? ["cash", "bank", "ewallet", "other"]
    : ["credit_card", "other"];
}

export const SUB_TYPE_LABELS: Record<AccountSubType, string> = {
  cash: "Cash",
  bank: "Bank",
  ewallet: "E-Wallet",
  credit_card: "Credit Card",
  other: "Other",
};
