import * as SecureStore from "expo-secure-store";

export const DISMISSED_NOTES_KEY = "kin.dismissedNotes.v1";
export const DISMISSED_NOTES_CAP = 50;

export type DismissedNotesStore = Record<string, string[]>;

export function buildDismissedKey(householdId: string, categoryId: string): string {
  return `${householdId}:${categoryId}`;
}

export function isDismissed(dismissed: string[], note: string): boolean {
  const q = note.toLowerCase();
  return dismissed.some((d) => d.toLowerCase() === q);
}

export function applyDismissed(suggestions: string[], dismissed: string[]): string[] {
  if (dismissed.length === 0) return suggestions;
  return suggestions.filter((s) => !isDismissed(dismissed, s));
}

export function trimDismissed(list: string[], cap: number = DISMISSED_NOTES_CAP): string[] {
  if (list.length <= cap) return list;
  return list.slice(list.length - cap);
}

export function addDismissedNote(
  store: DismissedNotesStore,
  householdId: string,
  categoryId: string,
  note: string,
): DismissedNotesStore {
  const key = buildDismissedKey(householdId, categoryId);
  const current = store[key] ?? [];
  if (isDismissed(current, note)) return store;
  return { ...store, [key]: trimDismissed([...current, note]) };
}

export async function loadDismissedNotes(): Promise<DismissedNotesStore> {
  try {
    const raw = await SecureStore.getItemAsync(DISMISSED_NOTES_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const clean: DismissedNotesStore = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) clean[k] = v.filter((e): e is string => typeof e === "string");
    }
    return clean;
  } catch {
    return {};
  }
}

export async function saveDismissedNotes(store: DismissedNotesStore): Promise<void> {
  try {
    await SecureStore.setItemAsync(DISMISSED_NOTES_KEY, JSON.stringify(store));
  } catch {
    // Best-effort; dismissal persistence must never block the form.
  }
}
