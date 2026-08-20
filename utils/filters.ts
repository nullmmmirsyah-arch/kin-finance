export type SelectionState = "empty" | "partial" | "all";

export function getSelectionState(total: number, selected: number): SelectionState {
  if (selected <= 0) return "empty";
  if (selected >= total) return "all";
  return "partial";
}

export function normalizeSelection(
  selectedIds: string[],
  optionIds: string[],
): string[] | undefined {
  if (optionIds.length === 0) return undefined;
  const selected = selectedIds.filter((id) => optionIds.includes(id));
  if (selected.length === 0) return undefined;
  if (selected.length >= optionIds.length) return undefined;
  return selected;
}

export function filterBadgeCount(
  typeActive: boolean,
  accountState: SelectionState,
  accountSelected: number,
  categoryState: SelectionState,
  categorySelected: number,
): number {
  return (
    (typeActive ? 1 : 0) +
    (accountState === "partial" ? accountSelected : 0) +
    (categoryState === "partial" ? categorySelected : 0)
  );
}

const PLURALS: Record<string, string> = {
  Account: "accounts",
  Category: "categories",
};

export function pluralLabel(title: string): string {
  return PLURALS[title] ?? `${title.toLowerCase()}s`;
}