import { ConvexError, v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { getUserAndMembership, findUserAndMembership, getScopedDoc } from "./helpers";
import {
  validateNote,
  validateTimezone,
  validateTransactionAmount,
  validateTransactionDate,
} from "../constants/validation";

const transactionType = v.union(
  v.literal("income"),
  v.literal("expense"),
  v.literal("transfer"),
);

const MAX_LIST_ROWS = 1000;

type ListFilters = {
  accountIds?: Id<"accounts">[];
  categoryIds?: Id<"categories">[];
  type?: "income" | "expense" | "transfer";
  search?: string;
};

function normalizeSearch(raw?: string): string | undefined {
  const s = raw?.trim().toLowerCase();
  if (!s || s.length < 2) return undefined;
  return s;
}

type EnrichedTransaction = Doc<"transactions"> & {
  category?: Doc<"categories">;
  account?: Doc<"accounts">;
  toAccount?: Doc<"accounts">;
};

function matchesFilters(row: Doc<"transactions">, filters: ListFilters): boolean {
  if (filters.accountIds !== undefined && !filters.accountIds.includes(row.accountId)) return false;
  if (filters.categoryIds !== undefined) {
    if (row.categoryId === undefined) return false;
    if (!filters.categoryIds.includes(row.categoryId)) return false;
  }
  if (filters.type !== undefined && row.type !== filters.type) return false;
  if (filters.search !== undefined) {
    const hay = (row.note ?? "").toLowerCase();
    if (!hay.includes(filters.search)) return false;
  }
  return true;
}

async function hydrate(
  ctx: QueryCtx,
  row: Doc<"transactions">,
  cache?: Map<string, Doc<"accounts"> | Doc<"categories"> | undefined>,
) {
  const getEntity = async <T>(
    key: string,
    id: Id<"accounts"> | Id<"categories">,
  ): Promise<T | undefined> => {
    if (cache?.has(key)) return cache.get(key) as T | undefined;
    const doc = (await ctx.db.get(id)) as T | null;
    const value = doc ?? undefined;
    cache?.set(key, value as Doc<"accounts"> | Doc<"categories"> | undefined);
    return value;
  };

  const category =
    row.categoryId === undefined
      ? undefined
      : await getEntity<Doc<"categories">>(
          `category:${row.categoryId}`,
          row.categoryId,
        );
  const account = await getEntity<Doc<"accounts">>(
    `account:${row.accountId}`,
    row.accountId,
  );
  const toAccount =
    row.toAccountId === undefined
      ? undefined
      : await getEntity<Doc<"accounts">>(
          `account:${row.toAccountId}`,
          row.toAccountId,
        );

  return { category, account, toAccount };
}

async function applyBalanceDelta(
  ctx: MutationCtx,
  accountId: Id<"accounts">,
  delta: number,
  now: number,
) {
  if (delta === 0) return;
  const account = await ctx.db.get(accountId);
  if (account === null) return;
  await ctx.db.patch(account._id, {
    balance: account.balance + delta,
    updatedAt: now,
  });
}

async function reverseBalances(ctx: MutationCtx, tx: Doc<"transactions">, now: number) {
  if (tx.type === "transfer" && tx.toAccountId !== undefined) {
    await applyBalanceDelta(ctx, tx.accountId, tx.amount, now);
    await applyBalanceDelta(ctx, tx.toAccountId, -tx.amount, now);
  } else {
    await applyBalanceDelta(ctx, tx.accountId, -tx.amount, now);
  }
}

export const create = mutation({
  args: {
    accountId: v.id("accounts"),
    categoryId: v.optional(v.id("categories")),
    toAccountId: v.optional(v.id("accounts")),
    amount: v.number(),
    type: transactionType,
    note: v.optional(v.string()),
    date: v.number(),
  },
  handler: async (ctx, args) => {
    const { user, membership } = await getUserAndMembership(ctx);

    const err = validateTransactionAmount(args.amount, args.type);
    if (err) throw new ConvexError(err);
    const noteErr = validateNote(args.note);
    if (noteErr) throw new ConvexError(noteErr);
    const dateErr = validateTransactionDate(args.date);
    if (dateErr) throw new ConvexError(dateErr);

    const account = await getScopedDoc(ctx, args.accountId, membership.householdId, "Account");

    let category: Doc<"categories"> | undefined;
    let toAccount: Doc<"accounts"> | undefined;

    if (args.type === "transfer") {
      if (args.categoryId !== undefined) {
        throw new ConvexError("Transfers cannot have a category.");
      }
      if (args.toAccountId === undefined) {
        throw new ConvexError("To account is required for transfers.");
      }
      if (args.toAccountId === args.accountId) {
        throw new ConvexError("From and To accounts must be different.");
      }
      const to = await getScopedDoc(ctx, args.toAccountId, membership.householdId, "To account");
      toAccount = to;
    } else {
      if (args.toAccountId !== undefined) {
        throw new ConvexError(
          "Income and expense transactions cannot have a to account.",
        );
      }
      if (args.categoryId === undefined) {
        throw new ConvexError(
          "Category is required for income and expense transactions.",
        );
      }
      const cat = await getScopedDoc(ctx, args.categoryId, membership.householdId, "Category");
      if (cat.type !== args.type) {
        throw new ConvexError("Category type must match transaction type.");
      }
      category = cat;
    }

    if (membership.role !== "owner") {
      if (account.hidden) {
        throw new ConvexError(
          "You cannot create transactions on a hidden account.",
        );
      }
      if (toAccount !== undefined && toAccount.hidden) {
        throw new ConvexError("You cannot create transfers to a hidden account.");
      }
      if (category !== undefined && category.hidden) {
        throw new ConvexError(
          "You cannot create transactions on a hidden category.",
        );
      }
    }

    const now = Date.now();
    const transactionId = await ctx.db.insert("transactions", {
      householdId: membership.householdId,
      accountId: args.accountId,
      categoryId: category?._id,
      toAccountId: args.toAccountId,
      amount: args.amount,
      type: args.type,
      note: args.note,
      date: args.date,
      createdBy: user._id,
      updatedBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    if (args.type === "transfer") {
      await applyBalanceDelta(ctx, args.accountId, -args.amount, now);
      await applyBalanceDelta(
        ctx,
        args.toAccountId as Id<"accounts">,
        args.amount,
        now,
      );
    } else {
      await applyBalanceDelta(ctx, args.accountId, args.amount, now);
    }

    return transactionId;
  },
});

type PageCursor = { date: number; id: Id<"transactions"> };

function normalizeListFilters(args: {
  accountIds?: Id<"accounts">[];
  categoryIds?: Id<"categories">[];
  type?: "income" | "expense" | "transfer";
  search?: string;
}): ListFilters {
  const filters: ListFilters = {};
  if (args.accountIds !== undefined && args.accountIds.length > 0)
    filters.accountIds = args.accountIds;
  if (args.categoryIds !== undefined && args.categoryIds.length > 0)
    filters.categoryIds = args.categoryIds;
  if (args.type !== undefined) filters.type = args.type;
  const s = normalizeSearch(args.search);
  if (s !== undefined) filters.search = s;
  return filters;
}

function pickPinnedDim(filters: ListFilters): "account" | "category" | "type" | "none" {
  if (filters.accountIds !== undefined && filters.accountIds.length === 1) return "account";
  if (filters.categoryIds !== undefined && filters.categoryIds.length === 1) return "category";
  if (filters.type !== undefined) return "type";
  return "none";
}

function pinnedRangeQuery(
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
      const lower = q
        .eq("householdId", householdId)
        .eq("accountId", filters.accountIds![0])
        .gte("date", startDate);
      if (cursorDate === undefined) return lower.lt("date", endDate);
      return atBoundary ? lower.lt("date", cursorDate) : lower.lte("date", cursorDate);
    });
  } else if (pinnedDim === "category") {
    builder = base.withIndex("by_household_category_date", (q) => {
      const lower = q
        .eq("householdId", householdId)
        .eq("categoryId", filters.categoryIds![0])
        .gte("date", startDate);
      if (cursorDate === undefined) return lower.lt("date", endDate);
      return atBoundary ? lower.lt("date", cursorDate) : lower.lte("date", cursorDate);
    });
  } else if (pinnedDim === "type") {
    builder = base.withIndex("by_household_type_date", (q) => {
      const lower = q
        .eq("householdId", householdId)
        .eq("type", filters.type!)
        .gte("date", startDate);
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

export const list = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    limit: v.optional(v.number()),
    accountIds: v.optional(v.array(v.id("accounts"))),
    categoryIds: v.optional(v.array(v.id("categories"))),
    type: v.optional(transactionType),
    search: v.optional(v.string()),
    cursor: v.optional(v.object({ date: v.number(), id: v.id("transactions") })),
  },
  handler: async (ctx, args) => {
    const result = await findUserAndMembership(ctx);
    if (result === null) {
      return { transactions: null, isOwner: false, cursor: undefined, hasMore: false };
    }
    const { membership } = result;
    const isOwner = membership.role === "owner";

    const limit = Math.min(
      Math.max(Math.floor(args.limit ?? MAX_LIST_ROWS), 1),
      MAX_LIST_ROWS,
    );
    const SCAN_BUDGET = limit * 10;
    const filters = normalizeListFilters(args);
    const pinnedDim = pickPinnedDim(filters);
    const entityCache = new Map<
      string,
      Doc<"accounts"> | Doc<"categories"> | undefined
    >();

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
        const enriched = { ...row, category, account, toAccount };
        collected.push(enriched);
        lastCollected = row;
        if (collected.length >= limit) break;
      }

      if (
        rows.length < batchSize &&
        (collected.length < limit || lastScanned === rows[rows.length - 1])
      )
        rangeExhausted = true;
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
      cursor:
        hasMore && resumeRow
          ? { date: resumeRow.date, id: resumeRow._id }
          : undefined,
      hasMore,
    };
  },
});

const SUMMARY_BATCH_SIZE = 10000;

export const summary = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    accountIds: v.optional(v.array(v.id("accounts"))),
    categoryIds: v.optional(v.array(v.id("categories"))),
    type: v.optional(transactionType),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await findUserAndMembership(ctx);
    if (result === null) return null;
    const { membership } = result;
    const isOwner = membership.role === "owner";

    const filters = normalizeListFilters(args);
    const pinnedDim = pickPinnedDim(filters);

    let income = 0;
    let expense = 0;
    const hiddenCategoryCache = new Map<Id<"categories">, boolean>();

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
          }
          if (hidden) continue;
        }
        if (!matchesFilters(row, filters)) continue;
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
  },
});

// ---- Timezone-aware month helpers (server-side, copied from utils/date.ts) ----
function zonedParts(ts: number, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ts));
  const result: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] = Number(part.value);
    }
  }
  return result;
}

function zonedOffsetMs(ts: number, timeZone: string): number {
  const p = zonedParts(ts, timeZone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - ts;
}

function zonedWallToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): number {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  let ts = naive - zonedOffsetMs(naive, timeZone);
  ts = naive - zonedOffsetMs(ts, timeZone);
  return ts;
}

function getYearMonthTz(ts: number, timeZone: string): { year: number; month: number } {
  const p = zonedParts(ts, timeZone);
  return { year: p.year, month: p.month };
}

function zonedMonthStartTz(year: number, month: number, timeZone: string): number {
  return zonedWallToUtc(year, month, 1, 0, 0, 0, timeZone);
}

function getMonthStartForDate(ts: number, timeZone: string): number {
  const { year, month } = getYearMonthTz(ts, timeZone);
  return zonedMonthStartTz(year, month, timeZone);
}

function getNextMonthStart(periodStart: number, timeZone: string): number {
  const { year, month } = getYearMonthTz(periodStart, timeZone);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return zonedMonthStartTz(nextYear, nextMonth, timeZone);
}

function formatMonthLabelTz(timestamp: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

export const cashflow = query({
  args: { startDate: v.number(), endDate: v.number(), timezone: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new ConvexError("Not authenticated.");
    const auth = await findUserAndMembership(ctx);
    if (auth === null) return null;
    const { membership } = auth;
    const household = await ctx.db.get(membership.householdId);
    const storedTz = (household as { timezone?: string } | null)?.timezone;
    const rawTz = args.timezone ?? storedTz ?? "UTC";
    const tzErr = validateTimezone(rawTz);
    if (tzErr) throw new ConvexError(tzErr);
    const timezone = rawTz;
    if (args.endDate <= args.startDate) throw new ConvexError("Invalid window.");
    if (args.endDate - args.startDate > 200 * 86_400_000) throw new ConvexError("Window too large.");
    const isOwner = membership.role === "owner";

    // Bounded single scan — avoid unbounded collect, cap at 10k rows (6 months typical <2k)
    const rows = await ctx.db
      .query("transactions")
      .withIndex("by_household_date", (q) =>
        q.eq("householdId", membership.householdId).gte("date", args.startDate).lt("date", args.endDate),
      )
      .take(10001);
    if (rows.length > 10000) throw new ConvexError("Too many transactions for this range. Please shorten the window.");

    // Build buckets for every month intersecting [startDate, endDate)
    const buckets = new Map<number, { income: number; expense: number }>();
    let cursor = getMonthStartForDate(args.startDate, timezone);
    // Avoid infinite loop guard (max 12 months for 200 days)
    let iterations = 0;
    while (cursor < args.endDate && iterations < 24) {
      buckets.set(cursor, { income: 0, expense: 0 });
      cursor = getNextMonthStart(cursor, timezone);
      iterations++;
    }

    const hiddenCache = new Map<Id<"categories">, boolean>();

    for (const row of rows) {
      if (row.type === "transfer") continue;
      if (!isOwner && row.categoryId !== undefined) {
        let hidden = hiddenCache.get(row.categoryId);
        if (hidden === undefined) {
          const cat = await ctx.db.get(row.categoryId);
          hidden = cat?.hidden ?? false;
          hiddenCache.set(row.categoryId, hidden);
        }
        if (hidden) continue;
      }
      const bucketKey = getMonthStartForDate(row.date, timezone);
      const bucket = buckets.get(bucketKey);
      if (bucket === undefined) continue;
      if (row.type === "income") {
        bucket.income += row.amount;
      } else if (row.type === "expense") {
        bucket.expense += Math.abs(row.amount);
      }
    }

    const cashflow = Array.from(buckets.entries())
      .map(([periodStart, v]) => ({
        periodStart,
        label: formatMonthLabelTz(periodStart, timezone),
        income: v.income,
        expense: v.expense,
        net: v.income - v.expense,
      }))
      .sort((a, b) => a.periodStart - b.periodStart);

    return { cashflow, isOwner };
  },
});

export const spendingByCategory = query({
  args: { startDate: v.number(), endDate: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new ConvexError("Not authenticated.");
    const auth = await findUserAndMembership(ctx);
    if (auth === null) return null;
    const { membership } = auth;
    const isOwner = membership.role === "owner";
    if (args.endDate <= args.startDate) throw new ConvexError("Invalid window.");
    if (args.endDate - args.startDate > 32 * 86_400_000) throw new ConvexError("Period too large.");
    // Bounded scan — 1 month typical <1k rows, cap at 10k
    const rows = await ctx.db
      .query("transactions")
      .withIndex("by_household_date", (q) =>
        q.eq("householdId", membership.householdId).gte("date", args.startDate).lt("date", args.endDate),
      )
      .take(10001);
    if (rows.length > 10000) throw new ConvexError("Too many transactions for this range. Please shorten the window.");

    const hiddenCache = new Map<Id<"categories">, boolean>();
    const nameCache = new Map<Id<"categories">, string>();
    const agg = new Map<Id<"categories">, number>();

    for (const row of rows) {
      if (row.type !== "expense" || row.categoryId === undefined) continue;
      if (!isOwner) {
        let hidden = hiddenCache.get(row.categoryId);
        if (hidden === undefined) {
          const cat = await ctx.db.get(row.categoryId);
          hidden = cat?.hidden ?? false;
          hiddenCache.set(row.categoryId, hidden);
          if (cat) nameCache.set(row.categoryId, cat.name);
        }
        if (hidden) continue;
      } else if (!nameCache.has(row.categoryId)) {
        const cat = await ctx.db.get(row.categoryId);
        if (cat) nameCache.set(row.categoryId, cat.name);
      }
      agg.set(row.categoryId, (agg.get(row.categoryId) ?? 0) + Math.abs(row.amount));
    }

    const sorted = Array.from(agg.entries())
      .map(([categoryId, amount]) => ({
        categoryId,
        name: nameCache.get(categoryId) ?? "Unknown",
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
    const total = sorted.reduce((s, x) => s + x.amount, 0);
    const segments = sorted.slice(0, 10);
    const othersAmount = sorted.length > 10 ? sorted.slice(10).reduce((s, x) => s + x.amount, 0) : 0;
    return { segments, total, othersAmount, isOwner };
  },
});

export const recent = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.object({ date: v.number(), id: v.id("transactions") })),
  },
  handler: async (ctx, args) => {
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

    // member path (original logic kept to preserve existing test expectations)
    let scanned = 0;
    let cursorDate = args.cursor?.date;
    let cursorId = args.cursor?.id;
    let atBoundary = false;
    const collected = [];
    const entityCache = new Map<string, any>();

    while (collected.length < limit && scanned < SCAN_BUDGET) {
      const batchSize = Math.min(SCAN_BUDGET - scanned, limit * 4);
      const rows = await ctx.db
        .query("transactions")
        .withIndex("by_household_date", (q) => {
          const base = q.eq("householdId", membership.householdId);
          if (cursorDate === undefined) return base;
          return atBoundary
            ? base.lt("date", cursorDate)
            : base.lte("date", cursorDate);
        })
        .order("desc")
        .take(batchSize);

      scanned += rows.length;
      let pastCursor = cursorDate === undefined || atBoundary;
      let cursorFound = pastCursor;

      for (const row of rows) {
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

        if (collected.length >= limit) break;
      }

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

    const hasMore = collected.length < limit && scanned >= SCAN_BUDGET;
    return {
      transactions: collected,
      isOwner,
      cursor:
        hasMore && cursorDate !== undefined && cursorId !== undefined
          ? { date: cursorDate, id: cursorId }
          : undefined,
      hasMore,
    };
  },
});

export const get = query({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
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
  },
});

export const update = mutation({
  args: {
    transactionId: v.id("transactions"),
    accountId: v.optional(v.id("accounts")),
    categoryId: v.optional(v.id("categories")),
    toAccountId: v.optional(v.id("accounts")),
    amount: v.optional(v.number()),
    type: v.optional(transactionType),
    note: v.optional(v.string()),
    date: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, membership } = await getUserAndMembership(ctx);

    const tx = await getScopedDoc(ctx, args.transactionId, membership.householdId, "Transaction");

    const type = args.type ?? tx.type;
    const amount = args.amount ?? tx.amount;
    const accountId = args.accountId ?? tx.accountId;

    let categoryId: Id<"categories"> | undefined;
    let toAccountId: Id<"accounts"> | undefined;
    if (type === "transfer") {
      if (args.categoryId !== undefined) {
        throw new ConvexError("Transfers cannot have a category.");
      }
      toAccountId = args.toAccountId ?? tx.toAccountId;
      if (toAccountId === undefined) {
        throw new ConvexError("To account is required for transfers.");
      }
      if (toAccountId === accountId) {
        throw new ConvexError("From and To accounts must be different.");
      }
    } else {
      if (args.toAccountId !== undefined) {
        throw new ConvexError(
          "Income and expense transactions cannot have a to account.",
        );
      }
      categoryId = args.categoryId ?? tx.categoryId;
      if (categoryId === undefined) {
        throw new ConvexError(
          "Category is required for income and expense transactions.",
        );
      }
    }

    const err = validateTransactionAmount(amount, type);
    if (err) throw new ConvexError(err);
    const noteErr = validateNote(args.note);
    if (noteErr) throw new ConvexError(noteErr);
    if (args.date !== undefined) {
      const dateErr = validateTransactionDate(args.date);
      if (dateErr) throw new ConvexError(dateErr);
    }

    const account = await getScopedDoc(ctx, accountId, membership.householdId, "Account");

    let category: Doc<"categories"> | undefined;
    if (categoryId !== undefined) {
      const cat = await getScopedDoc(ctx, categoryId, membership.householdId, "Category");
      if (cat.type !== type) {
        throw new ConvexError("Category type must match transaction type.");
      }
      category = cat;
    }

    let toAccount: Doc<"accounts"> | undefined;
    if (toAccountId !== undefined) {
      const to = await getScopedDoc(ctx, toAccountId, membership.householdId, "To account");
      toAccount = to;
    }

    if (membership.role !== "owner" && tx.categoryId !== undefined) {
      const existingCategory = await ctx.db.get(tx.categoryId);
      if (existingCategory !== null && existingCategory.hidden) {
        throw new ConvexError(
          "You cannot edit transactions on a hidden category.",
        );
      }
    }

    if (membership.role !== "owner") {
      if (accountId !== tx.accountId && account.hidden) {
        throw new ConvexError("You cannot reassign to a hidden account.");
      }
      if (
        toAccount !== undefined &&
        toAccountId !== tx.toAccountId &&
        toAccount.hidden
      ) {
        throw new ConvexError("You cannot reassign to a hidden account.");
      }
      if (
        category !== undefined &&
        categoryId !== tx.categoryId &&
        category.hidden
      ) {
        throw new ConvexError("You cannot reassign to a hidden category.");
      }
    }

    const now = Date.now();

    const deltas = new Map<string, number>();
    const applyDelta = (id: string, delta: number) => {
      deltas.set(id, (deltas.get(id) ?? 0) + delta);
    };

    if (tx.type === "transfer" && tx.toAccountId !== undefined) {
      applyDelta(tx.accountId, tx.amount);
      applyDelta(tx.toAccountId, -tx.amount);
    } else {
      applyDelta(tx.accountId, -tx.amount);
    }

    if (type === "transfer" && toAccountId !== undefined) {
      applyDelta(accountId, -amount);
      applyDelta(toAccountId, amount);
    } else {
      applyDelta(accountId, amount);
    }

    for (const [id, delta] of deltas) {
      await applyBalanceDelta(ctx, id as Id<"accounts">, delta, now);
    }

    await ctx.db.patch(args.transactionId, {
      accountId,
      categoryId: category?._id,
      toAccountId,
      amount,
      type,
      note: args.note !== undefined ? args.note : tx.note,
      date: args.date ?? tx.date,
      updatedBy: user._id,
      updatedAt: now,
    });

    return await ctx.db.get(args.transactionId);
  },
});

export const remove = mutation({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);

    const tx = await getScopedDoc(ctx, args.transactionId, membership.householdId, "Transaction");

    if (membership.role !== "owner" && tx.categoryId !== undefined) {
      const category = await ctx.db.get(tx.categoryId);
      if (category !== null && category.hidden) {
        throw new ConvexError(
          "You cannot delete transactions on a hidden category.",
        );
      }
    }

    const now = Date.now();
    await reverseBalances(ctx, tx, now);
    await ctx.db.delete(args.transactionId);
  },
});
