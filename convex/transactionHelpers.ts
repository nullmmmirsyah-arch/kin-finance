import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";

/**
 * Deep module: transactionHelpers — shared seam for query + analytics.
 *
 * Vocabulary:
 * - module: cohesive helpers with narrow interface (ListFilters, normalizeSearch, matchesFilters, matchesSearch, hydrate)
 * - depth: single seam hides hidden-cache locality, pinned index selection, cursor tie logic
 * - adapter: convex-test is the local-substitutable adapter (only now:()=>Date injected elsewhere)
 * - leverage: one hydrate/cache + pinnedRangeQuery serves 6 call sites (list/summary/cashflow/spending/recent/get)
 *
 * No mutation logic here — pure + cached reads only. Importable by both queries and analytics without circular deps.
 * No expo-localization import — wall-clock delegated to utils/periodTime.
 */

// ── constants — single source for budget caps ──
export const MAX_LIST_ROWS = 1000;
export const SUMMARY_BATCH_SIZE = 10000;
export const ANALYTICS_CAP = 10000; // 10001 take cap

// ── filter types — deep queryModule interface ──
export type ListFilters = {
  accountIds?: Id<"accounts">[];
  categoryIds?: Id<"categories">[];
  type?: "income" | "expense" | "transfer";
  search?: string;
};

export type EnrichedTransaction = Doc<"transactions"> & {
  category?: Doc<"categories">;
  account?: Doc<"accounts">;
  toAccount?: Doc<"accounts">;
};

export type PageCursor = { date: number; id: Id<"transactions"> };

// ── search helpers ──
export function normalizeSearch(raw?: string): string | undefined {
  const s = raw?.trim().toLowerCase();
  if (!s || s.length < 2) return undefined;
  return s;
}

export function normalizeListFilters(args: {
  accountIds?: Id<"accounts">[];
  categoryIds?: Id<"categories">[];
  type?: "income" | "expense" | "transfer";
  search?: string;
}): ListFilters {
  const filters: ListFilters = {};
  if (args.accountIds !== undefined && args.accountIds.length > 0) filters.accountIds = args.accountIds;
  if (args.categoryIds !== undefined && args.categoryIds.length > 0) filters.categoryIds = args.categoryIds;
  if (args.type !== undefined) filters.type = args.type;
  const s = normalizeSearch(args.search);
  if (s !== undefined) filters.search = s;
  return filters;
}

export function matchesFilters(row: Doc<"transactions">, filters: ListFilters): boolean {
  if (filters.accountIds !== undefined && !filters.accountIds.includes(row.accountId)) return false;
  if (filters.categoryIds !== undefined) {
    if (row.categoryId === undefined) return false;
    if (!filters.categoryIds.includes(row.categoryId)) return false;
  }
  if (filters.type !== undefined && row.type !== filters.type) return false;
  return true;
}

export function matchesSearch(
  row: Doc<"transactions">,
  search: string,
  hydrated?: { account?: Doc<"accounts">; toAccount?: Doc<"accounts">; category?: Doc<"categories"> },
): boolean {
  const hay = (row.note ?? "").toLowerCase();
  if (hay.includes(search)) return true;
  const searchDigits = search.replace(/,/g, "");
  if (searchDigits.length > 0) {
    const absStr = String(Math.abs(row.amount));
    if (absStr.includes(searchDigits)) return true;
    if (String(row.amount).includes(searchDigits)) return true;
  }
  if (hydrated?.account && hydrated.account.name.toLowerCase().includes(search)) return true;
  if (hydrated?.toAccount && hydrated.toAccount.name.toLowerCase().includes(search)) return true;
  if (hydrated?.category && hydrated.category.name.toLowerCase().includes(search)) return true;
  return false;
}

// ── hydrate — single cache seam hides account/category fetches ──
export async function hydrate(
  ctx: QueryCtx,
  row: Doc<"transactions">,
  cache?: Map<string, Doc<"accounts"> | Doc<"categories"> | undefined>,
) {
  const getEntity = async <T>(key: string, id: Id<"accounts"> | Id<"categories">): Promise<T | undefined> => {
    if (cache?.has(key)) return cache.get(key) as T | undefined;
    const doc = (await ctx.db.get(id)) as T | null;
    const value = doc ?? undefined;
    cache?.set(key, value as Doc<"accounts"> | Doc<"categories"> | undefined);
    return value;
  };

  const category =
    row.categoryId === undefined
      ? undefined
      : await getEntity<Doc<"categories">>(`category:${row.categoryId}`, row.categoryId);
  const account = await getEntity<Doc<"accounts">>(`account:${row.accountId}`, row.accountId);
  const toAccount =
    row.toAccountId === undefined
      ? undefined
      : await getEntity<Doc<"accounts">>(`account:${row.toAccountId}`, row.toAccountId);

  return { category, account, toAccount };
}

// ── pinned index selection — locality: one seam hides index choice + cursor tie ──
export function pickPinnedDim(filters: ListFilters): "account" | "category" | "type" | "none" {
  if (filters.accountIds !== undefined && filters.accountIds.length === 1) return "account";
  if (filters.categoryIds !== undefined && filters.categoryIds.length === 1) return "category";
  if (filters.type !== undefined) return "type";
  return "none";
}

export function pinnedRangeQuery(
  ctx: QueryCtx,
  householdId: Id<"households">,
  filters: ListFilters,
  pinnedDim: "account" | "category" | "type" | "none",
  startDate: number,
  endDate: number,
  cursorDate: number | undefined,
  atBoundary: boolean,
) {
  const base = ctx.db.query("transactions");
  let builder: ReturnType<typeof base.withIndex>;
  if (pinnedDim === "account") {
    builder = base.withIndex("by_household_account_date", (q) => {
      const lower = q.eq("householdId", householdId).eq("accountId", filters.accountIds![0]).gte("date", startDate);
      if (cursorDate === undefined) return lower.lt("date", endDate);
      return atBoundary ? lower.lt("date", cursorDate) : lower.lte("date", cursorDate);
    });
  } else if (pinnedDim === "category") {
    builder = base.withIndex("by_household_category_date", (q) => {
      const lower = q.eq("householdId", householdId).eq("categoryId", filters.categoryIds![0]).gte("date", startDate);
      if (cursorDate === undefined) return lower.lt("date", endDate);
      return atBoundary ? lower.lt("date", cursorDate) : lower.lte("date", cursorDate);
    });
  } else if (pinnedDim === "type") {
    builder = base.withIndex("by_household_type_date", (q) => {
      const lower = q.eq("householdId", householdId).eq("type", filters.type!).gte("date", startDate);
      if (cursorDate === undefined) return lower.lt("date", endDate);
      return atBoundary ? lower.lt("date", cursorDate) : lower.lte("date", cursorDate);
    });
  } else {
    builder = base.withIndex("by_household_date", (q) => {
      const lower = q.eq("householdId", householdId).gte("date", startDate);
      if (cursorDate === undefined) return lower.lt("date", endDate);
      return atBoundary ? lower.lt("date", cursorDate) : lower.lte("date", cursorDate);
    });
  }
  return builder;
}

// ── hidden visibility — single source, local cache ──
export async function isCategoryHidden(
  ctx: QueryCtx,
  categoryId: Id<"categories">,
  cache: Map<string, boolean>,
): Promise<boolean> {
  const key = categoryId as unknown as string;
  let hidden = cache.get(key);
  if (hidden !== undefined) return hidden;
  const cat = await ctx.db.get(categoryId);
  hidden = cat?.hidden ?? false;
  cache.set(key, hidden);
  return hidden;
}

export async function isAccountHidden(
  ctx: QueryCtx,
  accountId: Id<"accounts">,
  cache: Map<string, boolean>,
): Promise<boolean> {
  const key = accountId as unknown as string;
  let hidden = cache.get(key);
  if (hidden !== undefined) return hidden;
  const acc = await ctx.db.get(accountId);
  hidden = acc?.hidden ?? false;
  cache.set(key, hidden);
  return hidden;
}
