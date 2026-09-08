import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMemo } from "react";

export function filterNoteSuggestions(notes: string[], draft: string, limit = 5): string[] {
  if (!draft.trim()) return [];
  const q = draft.toLowerCase();
  const uniq = Array.from(new Set(notes.filter((n) => n && n.toLowerCase().includes(q))));
  return uniq.slice(0, limit);
}

export function useNoteSuggestions(categoryId: string | null, draft: string) {
  const endDate = useMemo(() => Date.now(), [categoryId]);
  const res = useQuery(
    api.transactions.list,
    categoryId
      ? ({
          startDate: 0,
          endDate,
          limit: 20,
          categoryIds: [categoryId as Id<"categories">] as any,
        } as any)
      : ("skip" as any),
  );
  const notes = useMemo(
    () => (res?.transactions ?? []).map((t) => t.note).filter(Boolean) as string[],
    [res],
  );
  return useMemo(() => filterNoteSuggestions(notes, draft, 5), [notes, draft]);
}
