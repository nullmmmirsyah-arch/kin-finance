import { ConvexError, v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { getUserAndMembership } from "./helpers";
import {
  validateNote,
  validateTransactionAmount,
  validateTransactionDate,
} from "../constants/validation";

const transactionType = v.union(
  v.literal("income"),
  v.literal("expense"),
  v.literal("transfer"),
);

const MAX_LIST_ROWS = 1000;

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

    const account = await ctx.db.get(args.accountId);
    if (account === null || account.householdId !== membership.householdId) {
      throw new ConvexError("Account not found.");
    }

    let category:
      | {
          _id: Id<"categories">;
          householdId: Id<"households">;
          name: string;
          type: "income" | "expense";
          hidden: boolean;
          createdAt: number;
          updatedAt: number;
        }
      | undefined;
    let toAccount:
      | {
          _id: Id<"accounts">;
          householdId: Id<"households">;
          name: string;
          type: "cash" | "bank" | "ewallet" | "credit_card";
          balance: number;
          hidden: boolean;
          createdAt: number;
          updatedAt: number;
        }
      | undefined;

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
      const to = await ctx.db.get(args.toAccountId);
      if (to === null || to.householdId !== membership.householdId) {
        throw new ConvexError("To account not found.");
      }
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
      const cat = await ctx.db.get(args.categoryId);
      if (cat === null || cat.householdId !== membership.householdId) {
        throw new ConvexError("Category not found.");
      }
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
      await ctx.db.patch(args.accountId, {
        balance: account.balance - args.amount,
        updatedAt: now,
      });
      await ctx.db.patch(args.toAccountId as Id<"accounts">, {
        balance: toAccount!.balance + args.amount,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(args.accountId, {
        balance: account.balance + args.amount,
        updatedAt: now,
      });
    }

    return transactionId;
  },
});

export const list = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return { transactions: null, isOwner: false };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      return { transactions: null, isOwner: false };
    }

    const membership = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (membership === null) {
      return { transactions: null, isOwner: false };
    }

    const isOwner = membership.role === "owner";
    const limit = Math.min(
      Math.max(Math.floor(args.limit ?? MAX_LIST_ROWS), 1),
      MAX_LIST_ROWS,
    );
    const entityCache = new Map<
      string,
      Doc<"accounts"> | Doc<"categories"> | undefined
    >();

    if (isOwner) {
      const rows = await ctx.db
        .query("transactions")
        .withIndex("by_household_date", (q) =>
          q
            .eq("householdId", membership.householdId)
            .gte("date", args.startDate)
            .lt("date", args.endDate),
        )
        .order("desc")
        .take(limit);

      const transactions = [];
      for (const row of rows) {
        const { category, account, toAccount } = await hydrate(ctx, row, entityCache);
        transactions.push({ ...row, category, account, toAccount });
      }

      return { transactions, isOwner };
    }

    const SCAN_BUDGET = limit * 10;
    let scanned = 0;
    let cursorDate: number | undefined;
    let cursorId: Id<"transactions"> | undefined;
    let atBoundary = false;
    const collected = [];

    while (collected.length < limit && scanned < SCAN_BUDGET) {
      const batchSize = Math.min(SCAN_BUDGET - scanned, limit * 4);
      const rows = await ctx.db
        .query("transactions")
        .withIndex("by_household_date", (q) => {
          const base = q
            .eq("householdId", membership.householdId)
            .gte("date", args.startDate);
          if (cursorDate === undefined) {
            return base.lt("date", args.endDate);
          }
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

    return { transactions: collected, isOwner };
  },
});

export const recent = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.object({ date: v.number(), id: v.id("transactions") })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return { transactions: null, isOwner: false };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      return { transactions: null, isOwner: false };
    }

    const membership = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (membership === null) {
      return { transactions: null, isOwner: false };
    }

    const isOwner = membership.role === "owner";
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 5), 1), 20);

    if (isOwner) {
      const rows = await ctx.db
        .query("transactions")
        .withIndex("by_household_date", (q) =>
          q.eq("householdId", membership.householdId),
        )
        .order("desc")
        .take(limit);

      const transactions = [];
      for (const row of rows) {
        const { category, account, toAccount } = await hydrate(ctx, row);
        transactions.push({ ...row, category, account, toAccount });
      }

      return { transactions, isOwner, cursor: undefined };
    }

    const SCAN_BUDGET = limit * 10;
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
    };
  },
});

export const get = query({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      return null;
    }

    const membership = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (membership === null) {
      return null;
    }

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

    const category =
      tx.categoryId === undefined
        ? undefined
        : ((await ctx.db.get(tx.categoryId)) ?? undefined);
    const account = (await ctx.db.get(tx.accountId)) ?? undefined;
    const toAccount =
      tx.toAccountId === undefined
        ? undefined
        : ((await ctx.db.get(tx.toAccountId)) ?? undefined);

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

    const tx = await ctx.db.get(args.transactionId);
    if (tx === null || tx.householdId !== membership.householdId) {
      throw new ConvexError("Transaction not found.");
    }

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

    const account = await ctx.db.get(accountId);
    if (account === null || account.householdId !== membership.householdId) {
      throw new ConvexError("Account not found.");
    }

    let category:
      | {
          _id: Id<"categories">;
          householdId: Id<"households">;
          name: string;
          type: "income" | "expense";
          hidden: boolean;
          createdAt: number;
          updatedAt: number;
        }
      | undefined;
    if (categoryId !== undefined) {
      const cat = await ctx.db.get(categoryId);
      if (cat === null || cat.householdId !== membership.householdId) {
        throw new ConvexError("Category not found.");
      }
      if (cat.type !== type) {
        throw new ConvexError("Category type must match transaction type.");
      }
      category = cat;
    }

    let toAccount:
      | {
          _id: Id<"accounts">;
          householdId: Id<"households">;
          name: string;
          type: "cash" | "bank" | "ewallet" | "credit_card";
          balance: number;
          hidden: boolean;
          createdAt: number;
          updatedAt: number;
        }
      | undefined;
    if (toAccountId !== undefined) {
      const to = await ctx.db.get(toAccountId);
      if (to === null || to.householdId !== membership.householdId) {
        throw new ConvexError("To account not found.");
      }
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
      if (delta === 0) continue;
      const doc = await ctx.db.get(id as Id<"accounts">);
      if (doc !== null) {
        await ctx.db.patch(doc._id, {
          balance: doc.balance + delta,
          updatedAt: now,
        });
      }
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

    const tx = await ctx.db.get(args.transactionId);
    if (tx === null || tx.householdId !== membership.householdId) {
      throw new ConvexError("Transaction not found.");
    }

    if (membership.role !== "owner" && tx.categoryId !== undefined) {
      const category = await ctx.db.get(tx.categoryId);
      if (category !== null && category.hidden) {
        throw new ConvexError(
          "You cannot delete transactions on a hidden category.",
        );
      }
    }

    const now = Date.now();
    if (tx.type === "transfer" && tx.toAccountId !== undefined) {
      const from = await ctx.db.get(tx.accountId);
      const to = await ctx.db.get(tx.toAccountId);
      if (from !== null) {
        await ctx.db.patch(from._id, {
          balance: from.balance + tx.amount,
          updatedAt: now,
        });
      }
      if (to !== null) {
        await ctx.db.patch(to._id, {
          balance: to.balance - tx.amount,
          updatedAt: now,
        });
      }
    } else {
      const account = await ctx.db.get(tx.accountId);
      if (account !== null) {
        await ctx.db.patch(account._id, {
          balance: account.balance - tx.amount,
          updatedAt: now,
        });
      }
    }

    await ctx.db.delete(args.transactionId);
  },
});
