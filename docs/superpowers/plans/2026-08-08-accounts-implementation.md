# Accounts Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Accounts feature end-to-end — Convex schema, backend functions, bottom-tab navigation, Accounts list screen, and Create/Edit Account form — per `docs/superpowers/specs/2026-08-08-accounts-design.md` and `docs/Product Requirement Document/PRD_Accounts`.

**Architecture:** Add `accounts`, `categories`, and `transactions` tables to Convex. `households.create` seeds two reserved "Initial Balance" categories. A minimal `transactions.create` posts signed transactions and updates account balances atomically; `accounts.create` reuses it for opening balance. The UI restructures to an Expo Router `(tabs)` group (Home | Accounts) plus a signed-in `account-form` stack screen. Owner sees all accounts and gets edit/delete icons + FAB; Members see only visible accounts read-only.

**Tech Stack:** Expo SDK 54, React Native 0.81, expo-router 6, Convex 1.43, NativeWind, react-native-gesture-handler ~2.28 (GestureHandlerRootView).

## Global Constraints

- Expo SDK 54 (`~54.0.35`) — read exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing code (see AGENTS.md).
- Use NativeWind (`className`), never `StyleSheet.create`. Import theme from `constants/theme.ts` — no hardcoded colors.
- Gradient cards: `expo-linear-gradient` + `Gradients.card`. Shadows: `Shadow.card` / `Shadow.elevated`.
- All user-facing text and error messages in English.
- No comments in code unless asked.
- Account name: required, 2–30 chars, trimmed, unique within household.
- Account type enum: `"cash" | "bank" | "ewallet" | "credit_card"`.
- Balance display: plain number with `Intl.NumberFormat("en-US")`, no currency symbol (e.g. `1,234,567`).
- Reserved categories named exactly `"Initial Balance"` (one `income`, one `expense`) per household.
- No test framework exists in this repo. Verification = `npx tsc --noEmit`, `npm run lint`, `npx convex codegen` (regenerates `_generated`), and manual E2E via `npx expo start`. Run `npx convex dev` in a separate terminal to push schema/functions to the dev deployment (`brainy-marmot-13`).

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `convex/schema.ts` | Modify | Add `accounts`, `categories`, `transactions` tables |
| `convex/households.ts` | Modify | Seed reserved "Initial Balance" categories in `create` |
| `convex/transactions.ts` | Create | `create` mutation (post signed tx + atomic balance update) |
| `convex/accounts.ts` | Create | `list`, `create`, `update`, `remove` |
| `constants/accounts.ts` | Create | `AccountType` type + `ACCOUNT_TYPES` map (label/icon) |
| `utils/format.ts` | Create | `formatNumber` |
| `components/Chip.tsx` | Create | Filter chip |
| `components/Fab.tsx` | Create | Floating "+" button |
| `components/AccountCard.tsx` | Create | Account row (icon, name, balance) |
| `app/_layout.tsx` | Modify | Register `(tabs)` + `account-form`; add `GestureHandlerRootView` |
| `app/(tabs)/_layout.tsx` | Create | Tabs navigator (Home \| Accounts) |
| `app/(tabs)/home.tsx` | Create | Move `app/home.tsx`, live account summary |
| `app/(tabs)/accounts.tsx` | Create | Accounts list screen |
| `app/account-form.tsx` | Create | Create/Edit Account form |
| `app/home.tsx` | Delete | Superseded by `app/(tabs)/home.tsx` |

---

### Task 1: Add Accounts, Categories, and Transactions Tables

**Files:**
- Modify: `convex/schema.ts`

**Interfaces:**
- Consumes: existing `users`, `households`, `householdMemberships` tables
- Produces: `accounts` (index `by_householdId`), `categories` (index `by_householdId`), `transactions` (indexes `by_householdId`, `by_accountId`)

- [ ] **Step 1: Replace the schema with the expanded version**

```ts
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
    categoryId: v.id("categories"),
    amount: v.number(),
    type: v.union(v.literal("income"), v.literal("expense")),
    note: v.optional(v.string()),
    date: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_householdId", ["householdId"])
    .index("by_accountId", ["accountId"]),
});
```

- [ ] **Step 2: Regenerate types and typecheck**

Run: `npx convex codegen`
Expected: `convex/_generated/*` regenerate; no errors.
Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add accounts, categories, and transactions tables"
```

---

### Task 2: Seed Reserved "Initial Balance" Categories in households.create

**Files:**
- Modify: `convex/households.ts:44-57` (inside `create` handler, after membership insert)

**Interfaces:**
- Consumes: `categories` table from Task 1
- Produces: two reserved categories per household — `accounts.create` selects by sign (`income` when opening balance > 0, `expense` when < 0)

- [ ] **Step 1: Insert the two reserved categories**

In `convex/households.ts`, inside the `create` mutation handler, immediately after the `householdMemberships` insert and before the `return` statement, add:

```ts
    const reservedCategories = [
      { name: "Initial Balance", type: "income" as const },
      { name: "Initial Balance", type: "expense" as const },
    ];
    for (const category of reservedCategories) {
      await ctx.db.insert("categories", {
        householdId,
        name: category.name,
        type: category.type,
        hidden: false,
        createdAt: now,
        updatedAt: now,
      });
    }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add convex/households.ts
git commit -m "feat: seed reserved Initial Balance categories on household creation"
```

---

### Task 3: Create transactions.create Mutation

**Files:**
- Create: `convex/transactions.ts`

**Interfaces:**
- Consumes: `users`, `households`, `householdMemberships`, `accounts`, `categories`, `transactions` tables
- Produces: `api.transactions.create` with args `{ accountId, categoryId, amount, type, note?, date }` — inserts the transaction and atomically applies the amount to the account balance. `accounts.create` (Task 5) calls this via `ctx.runMutation`.

- [ ] **Step 1: Create transactions.ts**

```ts
import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";

export const create = mutation({
  args: {
    accountId: v.id("accounts"),
    categoryId: v.id("categories"),
    amount: v.number(),
    type: v.union(v.literal("income"), v.literal("expense")),
    note: v.optional(v.string()),
    date: v.number(),
  },
  handler: async (ctx, args) => {
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

    const account = await ctx.db.get(args.accountId);
    if (account === null || account.householdId !== membership.householdId) {
      throw new ConvexError("Account does not belong to your household.");
    }

    const category = await ctx.db.get(args.categoryId);
    if (category === null || category.householdId !== membership.householdId) {
      throw new ConvexError("Category does not belong to your household.");
    }

    if (args.type === "income" && args.amount <= 0) {
      throw new ConvexError("Amount must be positive for income transactions.");
    }
    if (args.type === "expense" && args.amount >= 0) {
      throw new ConvexError("Amount must be negative for expense transactions.");
    }
    if (category.type !== args.type) {
      throw new ConvexError("Category type must match transaction type.");
    }

    const now = Date.now();
    const transactionId = await ctx.db.insert("transactions", {
      householdId: membership.householdId,
      accountId: args.accountId,
      categoryId: args.categoryId,
      amount: args.amount,
      type: args.type,
      note: args.note,
      date: args.date,
      createdBy: user._id,
      updatedBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.accountId, {
      balance: account.balance + args.amount,
      updatedAt: now,
    });

    return transactionId;
  },
});
```

- [ ] **Step 2: Regenerate types and typecheck**

Run: `npx convex codegen`
Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add convex/transactions.ts
git commit -m "feat: add transactions.create with atomic balance update"
```

---

### Task 4: Create accounts.list Query

**Files:**
- Create: `convex/accounts.ts`

**Interfaces:**
- Consumes: `users`, `householdMemberships`, `accounts` tables
- Produces: `api.accounts.list` → `{ accounts: Account[] | null, isOwner: boolean }` — Owner sees all, Member sees `hidden === false`; `isOwner` drives UI (FAB, edit/delete icons)

- [ ] **Step 1: Create accounts.ts with the list query and shared helpers**

```ts
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

const accountType = v.union(
  v.literal("cash"),
  v.literal("bank"),
  v.literal("ewallet"),
  v.literal("credit_card"),
);

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

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return { accounts: null, isOwner: false };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      return { accounts: null, isOwner: false };
    }

    const membership = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (membership === null) {
      return { accounts: null, isOwner: false };
    }

    const isOwner = membership.role === "owner";
    const all = await ctx.db
      .query("accounts")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", membership.householdId),
      )
      .collect();

    const accounts = isOwner ? all : all.filter((account) => !account.hidden);
    return { accounts, isOwner };
  },
});
```

Note: the `getUserAndMembership` helper uses `MutationCtx`; import it from `./_generated/server`:

```ts
import { mutation, query, MutationCtx } from "./_generated/server";
```

The helper is used by Tasks 5 and 6. `accountType` is used by Tasks 5 and 6.

- [ ] **Step 2: Regenerate types and typecheck**

Run: `npx convex codegen`
Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Smoke-test the query against the dev deployment**

Ensure `npx convex dev` is running (pushes schema + code), then:

Run: `npx convex run accounts:list '{}'`
Expected: `{ "accounts": null, "isOwner": false }` (unauthenticated CLI → null accounts).

- [ ] **Step 4: Commit**

```bash
git add convex/accounts.ts
git commit -m "feat: add accounts.list query with owner/member visibility"
```

---

### Task 5: Add accounts.create Mutation

**Files:**
- Modify: `convex/accounts.ts`

**Interfaces:**
- Consumes: `getUserAndMembership`, `accountType` (Task 4); `api.transactions.create` (Task 3); reserved `categories`
- Produces: `api.accounts.create` with args `{ name, type, openingBalance? }` — creates account with zero balance, then posts a signed "Initial balance" transaction via `transactions.create` when opening balance is non-zero

- [ ] **Step 1: Append the create mutation to accounts.ts**

```ts
import { api } from "./_generated/api";

export const create = mutation({
  args: {
    name: v.string(),
    type: accountType,
    openingBalance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);

    if (membership.role !== "owner") {
      throw new ConvexError("You are not the owner of this household.");
    }

    const name = args.name.trim();
    if (name.length === 0) {
      throw new ConvexError("Account name is required.");
    }
    if (name.length < 2) {
      throw new ConvexError("Account name must be at least 2 characters.");
    }
    if (name.length > 30) {
      throw new ConvexError("Account name must be at most 30 characters.");
    }

    const existing = await ctx.db
      .query("accounts")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", membership.householdId),
      )
      .filter((q) => q.eq(q.field("name"), name))
      .first();
    if (existing !== null) {
      throw new ConvexError("Account name already exists.");
    }

    const openingBalance = args.openingBalance ?? 0;
    if (!Number.isFinite(openingBalance)) {
      throw new ConvexError("Opening balance must be a valid number.");
    }

    const now = Date.now();
    const accountId = await ctx.db.insert("accounts", {
      householdId: membership.householdId,
      name,
      type: args.type,
      balance: 0,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    });

    if (openingBalance !== 0) {
      const txType = openingBalance > 0 ? "income" : "expense";
      const category = await ctx.db
        .query("categories")
        .withIndex("by_householdId", (q) =>
          q.eq("householdId", membership.householdId),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), "Initial Balance"),
            q.eq(q.field("type"), txType),
          ),
        )
        .first();

      if (category === null) {
        throw new ConvexError("Initial Balance category not found.");
      }

      await ctx.runMutation(api.transactions.create, {
        accountId,
        categoryId: category._id,
        amount: openingBalance,
        type: txType,
        note: "Initial balance",
        date: now,
      });
    }

    return await ctx.db.get(accountId);
  },
});
```

- [ ] **Step 2: Regenerate types and typecheck**

Run: `npx convex codegen`
Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add convex/accounts.ts
git commit -m "feat: add accounts.create with opening balance flow"
```

---

### Task 6: Add accounts.update and accounts.remove Mutations

**Files:**
- Modify: `convex/accounts.ts`

**Interfaces:**
- Consumes: `getUserAndMembership`, `accountType` (Task 4); `transactions` table for the delete guard
- Produces: `api.accounts.update` (args `{ accountId, name?, type?, hidden? }`) and `api.accounts.remove` (args `{ accountId }`) — the delete mutation is named `remove` because `delete` is a reserved word

- [ ] **Step 1: Append update mutation**

```ts
export const update = mutation({
  args: {
    accountId: v.id("accounts"),
    name: v.optional(v.string()),
    type: v.optional(accountType),
    hidden: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);

    if (membership.role !== "owner") {
      throw new ConvexError("You are not the owner of this household.");
    }

    const account = await ctx.db.get(args.accountId);
    if (account === null || account.householdId !== membership.householdId) {
      throw new ConvexError("Account not found.");
    }

    const patch: {
      name?: string;
      type?: "cash" | "bank" | "ewallet" | "credit_card";
      hidden?: boolean;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length === 0) {
        throw new ConvexError("Account name is required.");
      }
      if (name.length < 2) {
        throw new ConvexError("Account name must be at least 2 characters.");
      }
      if (name.length > 30) {
        throw new ConvexError("Account name must be at most 30 characters.");
      }

      const existing = await ctx.db
        .query("accounts")
        .withIndex("by_householdId", (q) =>
          q.eq("householdId", membership.householdId),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), name),
            q.neq(q.field("_id"), args.accountId),
          ),
        )
        .first();
      if (existing !== null) {
        throw new ConvexError("Account name already exists.");
      }

      patch.name = name;
    }

    if (args.type !== undefined) {
      patch.type = args.type;
    }
    if (args.hidden !== undefined) {
      patch.hidden = args.hidden;
    }

    await ctx.db.patch(args.accountId, patch);
    return await ctx.db.get(args.accountId);
  },
});
```

- [ ] **Step 2: Append remove (delete) mutation**

```ts
export const remove = mutation({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);

    if (membership.role !== "owner") {
      throw new ConvexError("You are not the owner of this household.");
    }

    const account = await ctx.db.get(args.accountId);
    if (account === null || account.householdId !== membership.householdId) {
      throw new ConvexError("Account not found.");
    }

    const referencingTx = await ctx.db
      .query("transactions")
      .withIndex("by_accountId", (q) => q.eq("accountId", args.accountId))
      .first();

    if (referencingTx !== null) {
      throw new ConvexError(
        "Cannot delete account — existing transactions reference this account. Delete or reassign those transactions first.",
      );
    }

    await ctx.db.delete(args.accountId);
  },
});
```

- [ ] **Step 3: Regenerate types and typecheck**

Run: `npx convex codegen`
Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add convex/accounts.ts
git commit -m "feat: add accounts.update and accounts.remove mutations"
```

---

### Task 7: Add Account Type Constants and Number Formatting

**Files:**
- Create: `constants/accounts.ts`
- Create: `utils/format.ts`

**Interfaces:**
- Produces: `AccountType` type + `ACCOUNT_TYPES` array `{ id, label, icon }`; `formatNumber(n: number) => string`

- [ ] **Step 1: Create constants/accounts.ts**

```ts
import { ComponentProps } from "react";
import Feather from "@expo/vector-icons/Feather";

export type AccountType = "cash" | "bank" | "ewallet" | "credit_card";

export const ACCOUNT_TYPES: {
  id: AccountType;
  label: string;
  icon: ComponentProps<typeof Feather>["name"];
}[] = [
  { id: "cash", label: "Cash", icon: "dollar-sign" },
  { id: "bank", label: "Bank", icon: "briefcase" },
  { id: "ewallet", label: "E-Wallet", icon: "smartphone" },
  { id: "credit_card", label: "Credit Card", icon: "credit-card" },
];
```

- [ ] **Step 2: Create utils/format.ts**

```ts
const formatter = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return formatter.format(value);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add constants/accounts.ts utils/format.ts
git commit -m "feat: add account type constants and number formatting"
```

---

### Task 8: Add Shared UI Components (Chip, Fab, AccountCard)

**Files:**
- Create: `components/Chip.tsx`
- Create: `components/Fab.tsx`
- Create: `components/AccountCard.tsx`

**Interfaces:**
- `Chip({ label, active, onPress })` — filter chip
- `Fab({ onPress, accessibilityLabel })` — floating "+"
- `AccountCard({ name, type, balance, onEdit?, onDelete? })` — row content; renders Edit/Delete icon buttons when handlers are provided

- [ ] **Step 1: Create components/Chip.tsx**

```tsx
import { Colors, Radius } from "@/constants/theme";
import { Pressable, Text } from "react-native";

type Props = {
  label: string;
  active: boolean;
  onPress: () => void;
};

export function Chip({ label, active, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        {
          borderRadius: 999,
          backgroundColor: active ? Colors.primary : "#FFF",
          borderWidth: 1,
          borderColor: active ? Colors.primary : Colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      className="min-h-11 items-center justify-center px-4"
    >
      <Text
        className={`text-sm font-medium ${
          active ? "text-[#FFFBF5]" : "text-text-secondary"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Create components/Fab.tsx**

```tsx
import Feather from "@expo/vector-icons/Feather";
import { Colors, Shadow } from "@/constants/theme";
import { Pressable } from "react-native";

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
};

export function Fab({ onPress, accessibilityLabel }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        Shadow.elevated,
        {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: Colors.primary,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      className="absolute bottom-6 right-6 items-center justify-center"
    >
      <Feather name="plus" size={26} color={Colors.background} />
    </Pressable>
  );
}
```

- [ ] **Step 3: Note — `AccountCard` carries `onEdit`/`onDelete`**

No swipe wrapper is created. `AccountCard` takes optional `onEdit` and `onDelete` props; when either is provided it renders Edit (Feather `edit-2`, primary) and Delete (Feather `trash-2`, error) icon buttons on the right edge of the card. The Accounts screen passes these for owner rows only; member rows stay read-only.

- [ ] **Step 4: Create components/AccountCard.tsx**

```tsx
import Feather from "@expo/vector-icons/Feather";
import { Colors, Radius, Shadow } from "@/constants/theme";
import { ACCOUNT_TYPES, AccountType } from "@/constants/accounts";
import { formatNumber } from "@/utils/format";
import { Pressable, Text, View } from "react-native";

type Props = {
  name: string;
  type: AccountType;
  balance: number;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function AccountCard({ name, type, balance, onEdit, onDelete }: Props) {
  const meta = ACCOUNT_TYPES.find((t) => t.id === type) ?? ACCOUNT_TYPES[0];

  return (
    <View
      style={[
        Shadow.card,
        {
          borderRadius: Radius.md,
          backgroundColor: Colors.background,
          borderWidth: 1,
          borderColor: Colors.border,
        },
      ]}
      className="flex-row items-center gap-3 px-4 py-4"
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: Radius.sm,
          backgroundColor: Colors.surface,
        }}
        className="items-center justify-center"
      >
        <Feather name={meta.icon} size={20} color={Colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-text-primary">{name}</Text>
        <Text className="text-sm text-text-secondary">{meta.label}</Text>
      </View>
      {onEdit !== undefined || onDelete !== undefined ? (
        <View className="flex-row items-center gap-1">
          {onEdit !== undefined ? (
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit account"
              style={{ width: 40, height: 40 }}
              className="items-center justify-center"
            >
              <Feather name="edit-2" size={18} color={Colors.primary} />
            </Pressable>
          ) : null}
          {onDelete !== undefined ? (
            <Pressable
              onPress={onDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
              style={{ width: 40, height: 40 }}
              className="items-center justify-center"
            >
              <Feather name="trash-2" size={18} color={Colors.error} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Text className="text-base font-semibold text-text-primary">
        {formatNumber(balance)}
      </Text>
    </View>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add components/Chip.tsx components/Fab.tsx components/AccountCard.tsx
git commit -m "feat: add shared UI components for accounts"
```

---

### Task 9: Restructure Navigation (Tabs + Root Layout)

**Files:**
- Create: `app/(tabs)/_layout.tsx`
- Modify: `app/_layout.tsx`
- Create: `app/(tabs)/home.tsx` (move from `app/home.tsx`)
- Delete: `app/home.tsx`

**Interfaces:**
- Consumes: `app/index.tsx` (auth, stays at `/`), `app/onboarding.tsx`
- Produces: `(tabs)` group at root Stack (URLs `/home`, `/accounts`) and `account-form` stack screen; `GestureHandlerRootView` wraps the app

- [ ] **Step 1: Create app/(tabs)/_layout.tsx**

```tsx
import Feather from "@expo/vector-icons/Feather";
import { Tabs } from "expo-router";
import { Colors } from "@/constants/theme";

export const unstable_settings = { initialRouteName: "home" };

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: { backgroundColor: Colors.background },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Feather name="home" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: "Accounts",
          tabBarIcon: ({ color }) => (
            <Feather name="credit-card" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Modify app/_layout.tsx**

Wrap the whole tree in `GestureHandlerRootView` and register `(tabs)` + `account-form`. Replace the file's `RootNavigator` return and add the import:

```tsx
import { GestureHandlerRootView } from "react-native-gesture-handler";
```

Then in `RootNavigator`, replace the signed-in `Stack.Protected` children:

```tsx
      <Stack.Protected guard={!!isSignedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="account-form" />
      </Stack.Protected>
```

And wrap the returned tree of `RootLayout` so `GestureHandlerRootView` is outermost inside providers:

```tsx
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <ClerkLoading>
            <View className="flex-1 items-center justify-center bg-background">
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          </ClerkLoading>
          <ClerkLoaded>
            <RootNavigator />
          </ClerkLoaded>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 3: Move app/home.tsx to app/(tabs)/home.tsx**

Create `app/(tabs)/home.tsx` with the exact current contents of `app/home.tsx` (no changes yet). Do NOT use `git mv` — the old file is removed via `git rm` in Step 6 (a plain move leaves `app/home.tsx` untracked-deleted and the staged rename is not needed).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Verify routes render**

Run: `npx expo start`
Expected:
1. Signed out → auth screen at `/`.
2. Signed in with household → tab bar shows Home + Accounts at `/home`.
3. `/accounts` opens the (empty) Accounts tab (screen built in Task 10 — for now a blank placeholder is acceptable only if Task 10 is not yet done; otherwise verify the full list).
4. No route conflict warnings for `/`.

- [ ] **Step 6: Commit**

```bash
git add app/_layout.tsx "app/(tabs)/_layout.tsx" "app/(tabs)/home.tsx"
git rm app/home.tsx
git commit -m "feat: add bottom tab navigation with home and accounts tabs"
```

---

### Task 10: Create Accounts Screen

**Files:**
- Create: `app/(tabs)/accounts.tsx`

**Interfaces:**
- Consumes: `api.accounts.list`, `api.accounts.remove`, `ACCOUNT_TYPES`, `formatNumber`, `Chip`, `Fab`, `AccountCard`
- Produces: `/accounts` route — filter chips, account list (owner rows with edit/delete icons), FAB (owner only), empty state

- [ ] **Step 1: Create accounts.tsx**

```tsx
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Colors, Shadow } from "@/constants/theme";
import { ACCOUNT_TYPES, AccountType } from "@/constants/accounts";
import { Chip } from "@/components/Chip";
import { Fab } from "@/components/Fab";
import { AccountCard } from "@/components/AccountCard";
import { EmptyState } from "@/components/EmptyState";

type Filter = "all" | AccountType;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  ...ACCOUNT_TYPES.map((t) => ({ id: t.id as Filter, label: t.label })),
];

export default function Accounts() {
  const router = useRouter();
  const result = useQuery(api.accounts.list);
  const removeAccount = useMutation(api.accounts.remove);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  const accounts = result?.accounts ?? null;
  const isOwner = result?.isOwner ?? false;

  const visibleAccounts = useMemo(() => {
    if (accounts === null) return null;
    return filter === "all"
      ? accounts
      : accounts.filter((a) => a.type === filter);
  }, [accounts, filter]);

  const handleDelete = useCallback(
    (account: { _id: string; name: string }) => {
      setError(null);
      Alert.alert(
        "Delete Account",
        `Delete "${account.name}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              removeAccount({ accountId: account._id })
                .then(() => setError(null))
                .catch((e: unknown) => {
                  const message =
                    e instanceof Error ? e.message : "Failed to delete account.";
                  setError(message);
                });
            },
          },
        ],
      );
    },
    [removeAccount],
  );

  if (accounts === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-5 pt-4">
        <Text className="text-[28px] font-bold text-text-primary">Accounts</Text>
        {error ? (
          <Text className="mt-2 text-sm text-error">{error}</Text>
        ) : null}
      </View>

      <View className="mt-4 flex-row gap-2 px-5">
        {FILTERS.map((f) => (
          <Chip
            key={f.id}
            label={f.label}
            active={filter === f.id}
            onPress={() => setFilter(f.id)}
          />
        ))}
      </View>

      {visibleAccounts !== null && visibleAccounts.length === 0 ? (
        <View className="mt-6 flex-1 px-5">
          <View style={Shadow.card} className="rounded-[16px] bg-background">
            <EmptyState
              icon="credit-card"
              title="No accounts yet"
              description="Add your first account to start tracking your money."
              actionLabel={isOwner ? "Add Account" : undefined}
              onAction={
                isOwner ? () => router.push("/account-form") : undefined
              }
            />
          </View>
        </View>
      ) : (
        <FlatList
          className="mt-4 flex-1"
          contentContainerClassName="gap-3 px-5 pb-28"
          data={visibleAccounts ?? []}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) =>
            isOwner ? (
              <AccountCard
                name={item.name}
                type={item.type}
                balance={item.balance}
                onEdit={() =>
                  router.push({
                    pathname: "/account-form",
                    params: { id: item._id },
                  })
                }
                onDelete={() => handleDelete(item)}
              />
            ) : (
              <AccountCard
                name={item.name}
                type={item.type}
                balance={item.balance}
              />
            )
          }
        />
      )}

      {isOwner ? (
        <Fab
          onPress={() => router.push("/account-form")}
          accessibilityLabel="Add account"
        />
      ) : null}
    </SafeAreaView>
  );
}
```

Note: `item._id` is typed by Convex as `Id<"accounts">`; the `handleDelete` parameter uses a structural `{ _id: string; name: string }` — assignable because `Id<"accounts">` is a branded string.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Verify manually**

Run: `npx expo start` (with `npx convex dev` running)
Expected:
1. Owner sees all accounts; each owner row shows Edit and Delete icon buttons.
2. Delete shows an Alert confirmation; confirming calls `accounts.remove`.
3. Member (second account, role member) sees only visible accounts, no FAB, no edit/delete icons.
4. Empty state shows for zero accounts; "Add Account" button (owner only) navigates to `/account-form`.
5. Filter chips filter the list by type.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/accounts.tsx"
git commit -m "feat: add accounts list screen with filters, edit/delete icons, and FAB"
```

---

### Task 11: Create Account Form Screen

**Files:**
- Create: `app/account-form.tsx`

**Interfaces:**
- Consumes: `api.accounts.list`, `api.accounts.create`, `api.accounts.update`, `ACCOUNT_TYPES`, `Button`, `Input`, `Chip`
- Produces: `/account-form` route — create mode (no `id` param) and edit mode (`id` param)

- [ ] **Step 1: Create account-form.tsx**

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { api } from "@/convex/_generated/api";
import { Colors } from "@/constants/theme";
import { ACCOUNT_TYPES, AccountType } from "@/constants/accounts";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Chip } from "@/components/Chip";

export default function AccountForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const accountId = params.id;
  const isEdit = accountId !== undefined;

  const result = useQuery(api.accounts.list);
  const createAccount = useMutation(api.accounts.create);
  const updateAccount = useMutation(api.accounts.update);

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("cash");
  const [openingBalance, setOpeningBalance] = useState("");
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const editingAccount = useMemo(() => {
    if (!isEdit || result?.accounts === null) return undefined;
    return result.accounts?.find((a) => a._id === accountId);
  }, [isEdit, accountId, result]);

  useEffect(() => {
    if (editingAccount) {
      setName(editingAccount.name);
      setType(editingAccount.type);
      setHidden(editingAccount.hidden);
    }
  }, [editingAccount]);

  const trimmedName = name.trim();
  const canSubmit =
    trimmedName.length >= 2 &&
    trimmedName.length <= 30 &&
    !isLoading &&
    (!isEdit || editingAccount !== undefined);

  const handleSubmit = async () => {
    setError(null);
    if (trimmedName.length < 2) {
      setError("Account name must be at least 2 characters.");
      return;
    }
    if (trimmedName.length > 30) {
      setError("Account name must be at most 30 characters.");
      return;
    }

    setIsLoading(true);
    try {
      if (isEdit && accountId !== undefined) {
        await updateAccount({
          accountId,
          name: trimmedName,
          type,
          hidden,
        });
      } else {
        const parsedBalance =
          openingBalance.trim() === ""
            ? undefined
            : Number(openingBalance.replace(/,/g, ""));
        if (parsedBalance !== undefined && Number.isNaN(parsedBalance)) {
          setError("Opening balance must be a valid number.");
          return;
        }
        await createAccount({
          name: trimmedName,
          type,
          openingBalance: parsedBalance,
          hidden,
        });
      }
      router.back();
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : isEdit
            ? "Failed to update account."
            : "Failed to create account.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isEdit && editingAccount === undefined) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-sm text-text-secondary">Loading account…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-row items-center gap-2 px-5 pt-4">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 40, height: 40 }}
            className="items-center justify-center"
          >
            <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text className="text-[28px] font-bold text-text-primary">
            {isEdit ? "Edit Account" : "Create Account"}
          </Text>
        </View>

        <ScrollView
          contentContainerClassName="gap-4 px-5 py-6"
          keyboardShouldPersistTaps="handled"
        >
          <Input
            label="Account name"
            placeholder="e.g. Cash, BCA Savings"
            value={name}
            onChangeText={setName}
            maxLength={30}
            error={error}
          />

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-text-primary">
              Account type
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {ACCOUNT_TYPES.map((t) => (
                <Chip
                  key={t.id}
                  label={t.label}
                  active={type === t.id}
                  onPress={() => setType(t.id)}
                />
              ))}
            </View>
          </View>

          {!isEdit ? (
            <Input
              label="Opening balance (optional)"
              placeholder="0"
              value={openingBalance}
              onChangeText={setOpeningBalance}
              keyboardType="numbers-and-punctuation"
              amount
            />
          ) : null}

          <View
            style={{ borderColor: Colors.border }}
            className="flex-row items-center justify-between rounded-[12px] border bg-surface px-4 py-3"
          >
            <View className="flex-1">
              <Text className="text-base font-medium text-text-primary">
                Visible to members
              </Text>
              <Text className="text-sm text-text-secondary">
                Members can see and use this account.
              </Text>
            </View>
            <Switch
              value={!hidden}
              onValueChange={(value) => setHidden(!value)}
              trackColor={{ true: Colors.primary, false: Colors.border }}
              thumbColor={Colors.background}
            />
          </View>

          <Button
            title={isEdit ? "Save Changes" : "Create Account"}
            onPress={handleSubmit}
            loading={isLoading}
            disabled={!canSubmit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Verify manually**

Run: `npx expo start` (with `npx convex dev` running)
Expected:
1. Create: FAB → form → enter name, pick type, optional opening balance → "Create Account" → back to Accounts; new account appears with balance equal to opening balance.
2. Opening balance auto-posts an "Initial balance" transaction (verify in Convex dashboard: `transactions` table has one row, `accounts.balance` reflects it).
3. Edit: tap the Edit icon → pre-filled name/type/visibility → change → "Save Changes" → back to Accounts; name/type/visibility updated.
4. Visibility toggle off → member no longer sees the account.
5. Validation: name < 2 chars shows error; duplicate name shows "Account name already exists."
6. Negative opening balance creates an expense-type initial transaction.

- [ ] **Step 4: Commit**

```bash
git add app/account-form.tsx
git commit -m "feat: add create/edit account form"
```

---

### Task 12: Wire Home Account Summary

**Files:**
- Modify: `app/(tabs)/home.tsx`

**Interfaces:**
- Consumes: `api.accounts.list`, `formatNumber`, `router`
- Produces: live "My Accounts" section (summary + Manage link) instead of a static EmptyState

- [ ] **Step 1: Add account summary to home**

In `app/(tabs)/home.tsx`:

1. Add imports:
```ts
import { api } from "@/convex/_generated/api";
import { formatNumber } from "@/utils/format";
```
(update the existing `api` import — it is already imported as `api` in home.tsx; add `formatNumber`).

2. Add the query near the other queries:
```ts
const accountData = useQuery(api.accounts.list);
```

3. Replace the static "My Accounts" `EmptyState` block with a live summary:

```tsx
        <View className="mt-8">
          <View className="flex-row items-center justify-between">
            <Text className="mb-1 text-xl font-semibold text-text-primary">
              My Accounts
            </Text>
            <Pressable
              onPress={() => router.push("/accounts")}
              accessibilityRole="button"
              className="min-h-11 items-center justify-center"
            >
              <Text className="text-sm font-medium text-primary">Manage</Text>
            </Pressable>
          </View>
          <View style={Shadow.card} className="mt-2 rounded-[16px] bg-background">
            {accountData?.accounts?.length === 0 ? (
              <EmptyState
                icon="credit-card"
                title="No accounts yet"
                description="Add your first account to start tracking"
                actionLabel={
                  accountData.isOwner ? "Add Account" : undefined
                }
                onAction={
                  accountData.isOwner
                    ? () => router.push("/account-form")
                    : undefined
                }
              />
            ) : (
              <View className="gap-2 px-4 py-4">
                <Text className="text-base font-semibold text-text-primary">
                  {accountData?.accounts?.length ?? 0}{" "}
                  {accountData?.accounts?.length === 1 ? "account" : "accounts"}
                </Text>
                <Text className="text-sm text-text-secondary">
                  Total balance:{" "}
                  {formatNumber(
                    accountData?.accounts?.reduce(
                      (sum, account) => sum + account.balance,
                      0,
                    ) ?? 0,
                  )}
                </Text>
              </View>
            )}
          </View>
        </View>
```

Note: `Pressable` and `Shadow` are already imported in home.tsx; keep the existing `EmptyState` import.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Verify manually**

Run: `npx expo start`
Expected: Home tab shows live account count + total balance and a "Manage" link to the Accounts tab; empty state with "Add Account" for owners with no accounts.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/home.tsx"
git commit -m "feat: show live account summary on home screen"
```

---

### Task 13: End-to-End Verification

**Files:**
- None (testing only)

- [ ] **Step 1: Run full checks**

Run: `npx convex codegen`
Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: All pass with no errors.

- [ ] **Step 2: Test Owner flow**

1. Sign in as owner with a household.
2. Accounts tab → empty state → "Add Account".
3. Create "Cash" with opening balance 1000000 → appears with balance `1,000,000`.
4. Verify Convex dashboard: `transactions` table has one "Initial balance" transaction (income, amount 1000000); `accounts.balance` = 1000000.
5. Create a "Credit Card" with opening balance -500000 → expense-type initial transaction, balance `-500,000`.
6. Edit "Cash" name/type; toggle visibility off.
7. Try deleting an account with transactions → shows the PRD guard message. Delete an account with no transactions → succeeds.

- [ ] **Step 3: Test Member flow**

1. Add a member via a second user + invite flow (MultiMember feature — if invite flow is not yet built, simulate by setting the membership role to `member` in the Convex dashboard).
2. Member sees only visible accounts; no FAB, no edit/delete icons.
3. Hidden account is not visible to the member.

- [ ] **Step 4: Test validation + errors**

1. Name < 2 chars → error shown, submit blocked.
2. Duplicate name → "Account name already exists."
3. Non-numeric opening balance → error shown.
4. Empty states render correctly for both roles.

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: accounts feature end-to-end fixes"
```

---

## Success Criteria

- [ ] Owner can create an Account (name, type, optional opening balance).
- [ ] Opening balance auto-records a signed "Initial balance" transaction via `transactions.create`.
- [ ] Account balance reflects the opening balance and auto-updates via the standard transaction path.
- [ ] Owner can edit Account name, type, and visibility.
- [ ] Owner can delete an Account; delete rejected with the PRD guard message when transactions reference it.
- [ ] Owner can toggle Account visibility.
- [ ] Member sees only visible Accounts; Member cannot create/edit/delete/toggle.
- [ ] Accounts screen renders filter chips, empty state, and FAB (owner only).
- [ ] Edit and Delete icons work for Owner rows.
- [ ] Validation works (name 2–30, unique, enum type).
- [ ] Error states use plain English, no technical backend errors.
- [ ] `npx tsc --noEmit` and `npm run lint` pass.
