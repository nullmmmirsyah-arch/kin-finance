export type TransactionType = "income" | "expense" | "transfer";

export const TRANSACTION_TYPES: { id: TransactionType; label: string }[] = [
  { id: "income", label: "Income" },
  { id: "expense", label: "Expense" },
  { id: "transfer", label: "Transfer" },
];
