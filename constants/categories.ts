export type CategoryType = "income" | "expense";

export const CATEGORY_TYPES: { id: CategoryType; label: string }[] = [
  { id: "income", label: "Income" },
  { id: "expense", label: "Expense" },
];

export const RESERVED_CATEGORY_NAME = "Initial Balance";

export {
  DEFAULT_CATEGORY_ICON,
  ALL_CATEGORY_ICONS,
  CATEGORY_ICON_MAP,
  isValidCategoryIcon,
  getCategoryIconSource,
} from "./categoryIcons";
export type { CategoryIconName } from "./categoryIcons";
