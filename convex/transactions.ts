import { ConvexError, v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const transactionType = v.union(
  v.literal("income"),
  v.literal("expense"),
  v.literal("transfer"),
);

const MAX_NOTE_LENGTH = 200;

async function getUserAndMembership(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new ConvexError("You are not signed in.");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

  if (user === null) {
    throw new ConvexError("User not found.");
  }

  const membership = await ctx.db
    .query("householdMemberships")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .first();

  if (membership === null) {
    throw new ConvexError("You are not a member of a household.");
  }

  return { user, membership };
}

function validateAmount(amount: number, type: "income" | "expense" | "transfer") {
  if (!Number.isFinite(amount)) {
    throw new ConvexError("Amount must be a finite number.");
  }
  if (amount === 0) {
    throw new ConvexError("Amount must be a non-zero number.");
  }
  if (type === "income" && amount <= 0) {
    throw new ConvexError("Amount must be positive for income transactions.");
  }
  if (type === "expense" && amount >= 0) {
    throw new ConvexError("Amount must be negative for expense transactions.");
  }
  if (type === "transfer" && amount <= 0) {
    throw new ConvexError("Amount must be positive for transfers.");
  }
  if (Math.abs(amount) < 1) {
    throw new ConvexError("Amount must be at least 1.");
  }
}

function validateNote(note: string | undefined) {
  if (note !== undefined && note.length > MAX_NOTE_LENGTH) {
    throw new ConvexError("Note must be at most 200 characters.");
  }
}

function validateDate(date: number) {
  if (!Number.isFinite(date)) {
    throw new ConvexError("Date must be a valid timestamp.");
  }
  if (date > Date.now()) {
    throw new ConvexError("Transaction date cannot be in the future.");
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

    validateAmount(args.amount, args.type);
    validateNote(args.note);
    validateDate(args.date);

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
    const rows = await ctx.db
      .query("transactions")
      .withIndex("by_household_date", (q) =>
        q
          .eq("householdId", membership.householdId)
          .gte("date", args.startDate)
          .lt("date", args.endDate),
      )
      .collect();

    const transactions = [];
    for (const row of rows) {
      const category =
        row.categoryId === undefined
          ? undefined
          : ((await ctx.db.get(row.categoryId)) ?? undefined);
      if (!isOwner && category !== undefined && category.hidden) {
        continue;
      }
      const account = (await ctx.db.get(row.accountId)) ?? undefined;
      const toAccount =
        row.toAccountId === undefined
          ? undefined
          : ((await ctx.db.get(row.toAccountId)) ?? undefined);
      transactions.push({ ...row, category, account, toAccount });
    }

    transactions.sort((a, b) => b.date - a.date);
    return { transactions, isOwner };
  },
});

export const recent = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.object({ date: v.number() })),
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
        const category =
          row.categoryId === undefined
            ? undefined
            : ((await ctx.db.get(row.categoryId)) ?? undefined);
        const account = (await ctx.db.get(row.accountId)) ?? undefined;
        const toAccount =
          row.toAccountId === undefined
            ? undefined
            : ((await ctx.db.get(row.toAccountId)) ?? undefined);
        transactions.push({ ...row, category, account, toAccount });
      }

      return { transactions, isOwner, cursor: undefined };
    }

    const SCAN_BUDGET = limit * 10;
    let scanned = 0;
    let cursorDate = args.cursor?.date;
    const collected = [];

    while (collected.length < limit && scanned < SCAN_BUDGET) {
      const batchSize = Math.min(SCAN_BUDGET - scanned, limit * 4);
      const rows = await ctx.db
        .query("transactions")
        .withIndex("by_household_date", (q) => {
          const base = q.eq("householdId", membership.householdId);
          return cursorDate !== undefined ? base.lt("date", cursorDate) : base;
        })
        .order("desc")
        .take(batchSize);

      scanned += rows.length;
      let batchMinDate = Infinity;

      for (const row of rows) {
        if (row.date < batchMinDate) batchMinDate = row.date;

        const category =
          row.categoryId === undefined
            ? undefined
            : ((await ctx.db.get(row.categoryId)) ?? undefined);
        if (category !== undefined && category.hidden) {
          continue;
        }
        const account = (await ctx.db.get(row.accountId)) ?? undefined;
        const toAccount =
          row.toAccountId === undefined
            ? undefined
            : ((await ctx.db.get(row.toAccountId)) ?? undefined);
        collected.push({ ...row, category, account, toAccount });

        if (collected.length >= limit) break;
      }

      if (collected.length >= limit || rows.length < batchSize) break;
      cursorDate = batchMinDate;
    }

    const hasMore = collected.length < limit && scanned >= SCAN_BUDGET;
    return {
      transactions: collected,
      isOwner,
      cursor: hasMore ? { date: cursorDate! } : undefined,
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

    validateAmount(amount, type);
    if (args.note !== undefined) {
      validateNote(args.note);
    }
    if (args.date !== undefined) {
      validateDate(args.date);
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
