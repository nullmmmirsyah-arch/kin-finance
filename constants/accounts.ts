import { ComponentProps } from "react";
import Feather from "@expo/vector-icons/Feather";

export type AccountType = "asset" | "debt";

export const ACCOUNT_TYPES: {
  id: AccountType;
  label: string;
  icon: ComponentProps<typeof Feather>["name"];
}[] = [
  { id: "asset", label: "Wallet", icon: "dollar-sign" },
  { id: "debt", label: "Debt", icon: "credit-card" },
];
