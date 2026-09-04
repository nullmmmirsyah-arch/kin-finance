import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import { findUserAndMembership } from "./helpers";
import {
  MAX_LIST_ROWS,
  SUMMARY_BATCH_SIZE,
  ListFilters,
  EnrichedTransaction,
  normalizeListFilters,
  matchesFilters,
  matchesSearch,
  hydrate,
  pickPinnedDim,
  pinnedRangeQuery,
} from "./transactionHelpers";

/**
 * Deep module: transactionQueries — query seam hides list/summary/recent/get.
 *
 * - interface: (ctx, args) => result — local-substitutable, convex-test is adapter
 * - depth: single seam hides pinned index, cursor date+_id tie, hidden caches, hydrate
 * - locality: all pagination + hidden visibility lives here, not in facade
 * - leverage: shared helpers (normalizeListFilters, pinnedRangeQuery, hydrate) serve 4 queries
 */

// ── list ──
export async function handleList(
  ctx: QueryCtx,
  args: {
    startDate: number;
    endDate: number;
    limit?: number;
    accountIds?: Id<"accounts">[];
    categoryIds?: Id<"categories">[];
    type?: "income" | "expense" | "transfer";
    search?: string;
    cursor?: { date: number; id: Id<"transactions"> };
  },
) {
  const result = await findUserAndMembership(ctx);
  if (result === null) {
    return { transactions: null, isOwner: false, cursor: undefined, hasMore: false };
  }
  const { membership } = result;
  const isOwner = membership.role === "owner";

  const limit = Math.min(Math.max(Math.floor(args.limit ?? MAX_LIST_ROWS), 1), MAX_LIST_ROWS);
  const SCAN_BUDGET = limit * 10;
  const filters = normalizeListFilters(args);
  const pinnedDim = pickPinnedDim(filters);
  const entityCache = new Map<string, Doc<"accounts"> | Doc<"categories"> | undefined>();

  let cursorDate = args.cursor?.date;
  let cursorId = args.cursor?.id;
  let atBoundary = false;
  let scanned = 0;
  let rangeExhausted = false;
  const collected: EnrichedTransaction[] = [];
  let lastCollected: Doc<"transactions"> | undefined;
  let lastScanned: Doc<"transactions"> | undefined;

  while (collected.length < limit && scanned < SCAN_BUDGET) {
    const batchSize = SCAN_BUDGET - scanned;
    const fetched: Doc<"transactions">[] = await pinnedRangeQuery(
      ctx,
      membership.householdId,
      filters,
      pinnedDim,
      args.startDate,
      args.endDate,
      cursorDate,
      atBoundary,
    )
      .order("desc")
      .take(batchSize + 1);
    const hasExtra = fetched.length > batchSize;
    const rows: Doc<"transactions">[] = hasExtra ? fetched.slice(0, batchSize) : fetched;
    const extra = hasExtra ? fetched[batchSize] : undefined;

    scanned += rows.length;

    let pastCursor = cursorDate === undefined || atBoundary;

    for (const row of rows) {
      lastScanned = row;
      if (!pastCursor) {
        if (row.date === cursorDate && row._id === cursorId) {
          pastCursor = true;
        }
        continue;
      }
      if (!matchesFilters(row, filters)) continue;
      const { category, account, toAccount } = await hydrate(ctx, row, entityCache);
      if (!isOwner && category !== undefined && category.hidden) continue;
      if (filters.search !== undefined && !matchesSearch(row, filters.search, { category, account, toAccount })) continue;
      const enriched = { ...row, category, account, toAccount };
      collected.push(enriched);
      lastCollected = row;
      if (collected.length >= limit) break;
    }

    if (rows.length < batchSize && (collected.length < limit || lastScanned === rows[rows.length - 1])) rangeExhausted = true;
    if (collected.length >= limit) break;
    if (rows.length < batchSize) break;
    if (!pastCursor) {
      atBoundary = true;
      continue;
    }

    const lastRow = rows[rows.length - 1];
    const tieContinues = extra !== undefined && extra.date === lastRow.date;
    atBoundary = !tieContinues;
    cursorDate = lastRow.date;
    cursorId = lastRow._id;
  }

  const pageFilled = collected.length >= limit;
  const resumeRow = pageFilled ? lastCollected : lastScanned;
  const hasMore = !rangeExhausted && resumeRow !== undefined;
  return {
    transactions: collected,
    isOwner,
    cursor: hasMore && resumeRow ? { date: resumeRow.date, id: resumeRow._id } : undefined,
    hasMore,
  };
}

// ── summary ──
export async function handleSummary(
  ctx: QueryCtx,
  args: {
    startDate: number;
    endDate: number;
    accountIds?: Id<"accounts">[];
    categoryIds?: Id<"categories">[];
    type?: "income" | "expense" | "transfer";
    search?: string;
  },
) {
  const result = await findUserAndMembership(ctx);
  if (result === null) return null;
  const { membership } = result;
  const isOwner = membership.role === "owner";

  const filters = normalizeListFilters(args);
  const pinnedDim = pickPinnedDim(filters);

  let income = 0;
  let expense = 0;
  const hiddenCategoryCache = new Map<Id<"categories">, boolean>();
  const accountNameCache = new Map<string, Doc<"accounts"> | undefined>();
  const categoryNameCache = new Map<string, Doc<"categories"> | undefined>();
  const toAccountNameCache = new Map<string, Doc<"accounts"> | undefined>();

  let cursorDate: number | undefined;
  let cursorId: Id<"transactions"> | undefined;
  let atBoundary = false;

  for (;;) {
    const fetched: Doc<"transactions">[] = await pinnedRangeQuery(
      ctx,
      membership.householdId,
      filters,
      pinnedDim,
      args.startDate,
      args.endDate,
      cursorDate,
      atBoundary,
    )
      .order("desc")
      .take(SUMMARY_BATCH_SIZE + 1);
    const hasExtra = fetched.length > SUMMARY_BATCH_SIZE;
    const rows: Doc<"transactions">[] = hasExtra ? fetched.slice(0, SUMMARY_BATCH_SIZE) : fetched;
    const extra = hasExtra ? fetched[SUMMARY_BATCH_SIZE] : undefined;

    if (rows.length === 0) break;

    let pastCursor = cursorDate === undefined || atBoundary;

    for (const row of rows) {
      if (!pastCursor) {
        if (row.date === cursorDate && row._id === cursorId) {
          pastCursor = true;
        }
        continue;
      }
      if (!isOwner && row.categoryId !== undefined) {
        let hidden = hiddenCategoryCache.get(row.categoryId);
        if (hidden === undefined) {
          const category = await ctx.db.get(row.categoryId);
          hidden = category?.hidden ?? false;
          hiddenCategoryCache.set(row.categoryId, hidden);
          if (category) categoryNameCache.set(row.categoryId as unknown as string, category as Doc<"categories">);
        }
        if (hidden) continue;
      }
      if (!matchesFilters(row, filters)) continue;
      if (filters.search !== undefined) {
        let hydrated: { account?: Doc<"accounts">; toAccount?: Doc<"accounts">; category?: Doc<"categories"> } | undefined;
        const getCached = async <T>(cache: Map<string, any>, id: string) => {
          if (cache.has(id)) return cache.get(id) as T | undefined;
          const doc = (await ctx.db.get(id as any)) as T | null;
          const val = doc ?? undefined;
          cache.set(id, val);
          return val;
        };
        const account = await getCached<Doc<"accounts">>(accountNameCache, row.accountId);
        const toAccount = row.toAccountId ? await getCached<Doc<"accounts">>(toAccountNameCache, row.toAccountId) : undefined;
        let category: Doc<"categories"> | undefined;
        if (row.categoryId) {
          category = categoryNameCache.get(row.categoryId as unknown as string) ?? (await getCached<Doc<"categories">>(categoryNameCache, row.categoryId));
        }
        hydrated = { account, toAccount, category };
        if (!matchesSearch(row, filters.search, hydrated)) continue;
      }
      if (row.type === "income") {
        income += row.amount;
      } else if (row.type === "expense") {
        expense += Math.abs(row.amount);
      }
    }

    if (rows.length < SUMMARY_BATCH_SIZE) break;

    const lastRow = rows[rows.length - 1];
    const tieContinues = extra !== undefined && extra.date === lastRow.date;
    atBoundary = tieContinues ? false : true;
    cursorDate = lastRow.date;
    cursorId = lastRow._id;
  }

  return { income, expense, net: income - expense };
}

// ── recent — owner/member fork with unified hasMore truth (fix convex/transactions.ts:889 bug) ──
export async function handleRecent(
  ctx: QueryCtx,
  args: { limit?: number; cursor?: { date: number; id: Id<"transactions"> } },
) {
  const result = await findUserAndMembership(ctx);
  if (result === null) {
    return { transactions: null, isOwner: false, cursor: undefined, hasMore: false };
  }
  const { membership } = result;

  const isOwner = membership.role === "owner";
  const limit = Math.min(Math.max(Math.floor(args.limit ?? 5), 1), 20);
  const SCAN_BUDGET = limit * 10;

  if (isOwner) {
    let scanned = 0;
    let cursorDate = args.cursor?.date;
    let cursorId = args.cursor?.id;
    let atBoundary = false;
    const collected: EnrichedTransaction[] = [];
    const entityCache = new Map<string, Doc<"accounts"> | Doc<"categories"> | undefined>();
    let lastCollected: Doc<"transactions"> | undefined;
    let lastScanned: Doc<"transactions"> | undefined;
    let rangeExhausted = false;

    while (collected.length < limit && scanned < SCAN_BUDGET) {
      const batchSize = Math.min(SCAN_BUDGET - scanned, limit * 4);
      const fetched: Doc<"transactions">[] = await ctx.db
        .query("transactions")
        .withIndex("by_household_date", (q) => {
          const base = q.eq("householdId", membership.householdId);
          if (cursorDate === undefined) return base;
          return atBoundary ? base.lt("date", cursorDate) : base.lte("date", cursorDate);
        })
        .order("desc")
        .take(batchSize + 1);
      const hasExtra = fetched.length > batchSize;
      const rows: Doc<"transactions">[] = hasExtra ? fetched.slice(0, batchSize) : fetched;
      const extra = hasExtra ? fetched[batchSize] : undefined;

      if (rows.length === 0) {
        rangeExhausted = true;
        break;
      }
      scanned += rows.length;
      let pastCursor = cursorDate === undefined || atBoundary;
      let cursorFound = pastCursor;
      for (const row of rows) {
        lastScanned = row;
        if (!pastCursor) {
          if (row.date === cursorDate && row._id === cursorId) {
            pastCursor = true;
            cursorFound = true;
          }
          continue;
        }
        const { category, account, toAccount } = await hydrate(ctx, row, entityCache);
        collected.push({ ...row, category, account, toAccount });
        lastCollected = row;
        if (collected.length >= limit) break;
      }
      if (rows.length < batchSize) rangeExhausted = true;
      if (collected.length >= limit) break;
      if (rows.length < batchSize) break;
      if (!cursorFound) {
        atBoundary = true;
        continue;
      }
      const lastRow = rows[rows.length - 1];
      const tieContinues = extra !== undefined && extra.date === lastRow.date;
      atBoundary = !tieContinues;
      cursorDate = lastRow.date;
      cursorId = lastRow._id;
    }
    const pageFilled = collected.length >= limit;
    const resumeRow = pageFilled ? lastCollected : lastScanned;
    const hasMore = !rangeExhausted && resumeRow !== undefined;
    return {
      transactions: collected,
      isOwner,
      cursor: hasMore && resumeRow ? { date: resumeRow.date, id: resumeRow._id } : undefined,
      hasMore,
    };
  }

  // member path — preserve original pagination seam (without tie extra) but fix hasMore to truthful !rangeExhausted
  let scanned = 0;
  let cursorDate = args.cursor?.date;
  let cursorId = args.cursor?.id;
  let atBoundary = false;
  const collected: EnrichedTransaction[] = [];
  const entityCache = new Map<string, Doc<"accounts"> | Doc<"categories"> | undefined>();
  let lastCollected: Doc<"transactions"> | undefined;
  let lastScanned: Doc<"transactions"> | undefined;
  let rangeExhausted = false;

  while (collected.length < limit && scanned < SCAN_BUDGET) {
    const batchSize = Math.min(SCAN_BUDGET - scanned, limit * 4);
    const rows: Doc<"transactions">[] = await ctx.db
      .query("transactions")
      .withIndex("by_household_date", (q) => {
        const base = q.eq("householdId", membership.householdId);
        if (cursorDate === undefined) return base;
        return atBoundary ? base.lt("date", cursorDate) : base.lte("date", cursorDate);
      })
      .order("desc")
      .take(batchSize);

    if (rows.length === 0) {
      rangeExhausted = true;
      break;
    }
    scanned += rows.length;
    let pastCursor = cursorDate === undefined || atBoundary;
    let cursorFound = pastCursor;

    for (const row of rows) {
      lastScanned = row;
      if (!pastCursor) {
        if (row.date === cursorDate && row._id === cursorId) {
          pastCursor = true;
          cursorFound = true;
        }
        continue;
      }

      const { category, account, toAccount } = await hydrate(ctx, row, entityCache);
      if (category !== undefined && category.hidden) {
        continue;
      }
      collected.push({ ...row, category, account, toAccount });
      lastCollected = row;

      if (collected.length >= limit) break;
    }

    if (rows.length < batchSize) rangeExhausted = true;
    if (collected.length >= limit) break;
    if (rows.length < batchSize) break;
    if (!cursorFound) {
      atBoundary = true;
      continue;
    }

    const lastRow = rows[rows.length - 1];
    atBoundary = lastRow.date === cursorDate;
    cursorDate = lastRow.date;
    cursorId = lastRow._id;
  }

  const pageFilled = collected.length >= limit;
  const resumeRow = pageFilled ? lastCollected : lastScanned;
  // fix: was `collected.length < limit && scanned >= SCAN_BUDGET` (inverted) — now truthful
  const hasMore = !rangeExhausted && resumeRow !== undefined;
  // Keep original cursor encoding (date+id) for member continuation compatibility
  return {
    transactions: collected,
    isOwner,
    cursor: hasMore && resumeRow ? { date: resumeRow.date, id: resumeRow._id } : undefined,
    hasMore,
  };
}

// ── get ──
export async function handleGet(ctx: QueryCtx, args: { transactionId: Id<"transactions"> }) {
  const result = await findUserAndMembership(ctx);
  if (result === null) {
    return null;
  }
  const { membership } = result;

  const tx = await ctx.db.get(args.transactionId);
  if (tx === null || tx.householdId !== membership.householdId) {
    return null;
  }

  if (membership.role !== "owner" && tx.categoryId !== undefined) {
    const category = await ctx.db.get(tx.categoryId);
    if (category !== null && category.hidden) {
      return null;
    }
  }

  const { category, account, toAccount } = await hydrate(ctx, tx);

  return {
    transaction: { ...tx, category, account, toAccount },
    isOwner: membership.role === "owner",
  };
}
