import { ComponentProps } from "react";
import Feather from "@expo/vector-icons/Feather";

export type AccountType = "cash" | "bank" | "ewallet" | "credit_card";

export const ACCOUNT_TYPES: {
  id: AccountType;
  label: string;
  icon: ComponentProps<typeof Feather>["name"];
}[] = [
  { id: "cash", label: "Cash", icon: "dollar-sign" },
  { id: "bank", label: "Bank", icon: "briefcase" },
  { id: "ewallet", label: "E-Wallet", icon: "smartphone" },
  { id: "credit_card", label: "Credit Card", icon: "credit-card" },
];
