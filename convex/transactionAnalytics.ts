import { ConvexError } from "convex/values";
import { QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { findUserAndMembership } from "./helpers";
import { validateTimezone } from "../constants/validation";
import { getMonthBounds, formatMonthLabel } from "../utils/periodTime";

/**
 * Deep module: transactionAnalytics — analytics seam hides cashflow/spending.
 * - interface: (ctx, args) => result  — local-substitutable, convex-test is adapter
 * - depth: single seam hides timezone wall-clock (via utils/periodTime), hidden cache, bounded scan
 * - adapter: only now:()=>Date injected via args/window; no expo-localization import here
 */

function getMonthStartForDate(ts: number, timeZone: string): number {
  return getMonthBounds(ts, timeZone).start;
}
function getNextMonthStart(periodStart: number, timeZone: string): number {
  return getMonthBounds(periodStart, timeZone).end;
}
function formatMonthLabelTz(timestamp: number, timeZone: string): string {
  return formatMonthLabel(timestamp, timeZone);
}

export async function handleCashflow(
  ctx: QueryCtx,
  args: { startDate: number; endDate: number; timezone?: string },
) {
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

  const rows = await ctx.db
    .query("transactions")
    .withIndex("by_household_date", (q) =>
      q.eq("householdId", membership.householdId).gte("date", args.startDate).lt("date", args.endDate),
    )
    .take(10001);
  if (rows.length > 10000) throw new ConvexError("Too many transactions for this range. Please shorten the window.");

  const buckets = new Map<number, { income: number; expense: number }>();
  let cursor = getMonthStartForDate(args.startDate, timezone);
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
}

export async function handleSpendingByCategory(
  ctx: QueryCtx,
  args: { startDate: number; endDate: number },
) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) throw new ConvexError("Not authenticated.");
  const auth = await findUserAndMembership(ctx);
  if (auth === null) return null;
  const { membership } = auth;
  const isOwner = membership.role === "owner";
  if (args.endDate <= args.startDate) throw new ConvexError("Invalid window.");
  if (args.endDate - args.startDate > 32 * 86_400_000) throw new ConvexError("Period too large.");
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
}
