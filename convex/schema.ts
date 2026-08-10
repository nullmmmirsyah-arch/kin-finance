import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    clerkUserId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),

  households: defineTable({
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  householdMemberships: defineTable({
    householdId: v.id("households"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("member")),
  })
    .index("by_householdId", ["householdId"])
    .index("by_userId", ["userId"]),

  accounts: defineTable({
    householdId: v.id("households"),
    name: v.string(),
    type: v.union(
      v.literal("cash"),
      v.literal("bank"),
      v.literal("ewallet"),
      v.literal("credit_card"),
    ),
    balance: v.number(),
    hidden: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_householdId", ["householdId"]),

  categories: defineTable({
    householdId: v.id("households"),
    name: v.string(),
    type: v.union(v.literal("income"), v.literal("expense")),
    hidden: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_householdId", ["householdId"]),

  transactions: defineTable({
    householdId: v.id("households"),
    accountId: v.id("accounts"),
    categoryId: v.optional(v.id("categories")),
    toAccountId: v.optional(v.id("accounts")),
    amount: v.number(),
    type: v.union(v.literal("income"), v.literal("expense"), v.literal("transfer")),
    note: v.optional(v.string()),
    date: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_householdId", ["householdId"])
    .index("by_household_date", ["householdId", "date"])
    .index("by_accountId", ["accountId"])
    .index("by_toAccountId", ["toAccountId"])
    .index("by_categoryId", ["categoryId"]),

  budgets: defineTable({
    householdId: v.id("households"),
    categoryId: v.id("categories"),
    periodStart: v.number(),
    amount: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_householdId", ["householdId"])
    .index("by_categoryId", ["categoryId"])
    .index("by_household_period", ["householdId", "periodStart"]),
});
