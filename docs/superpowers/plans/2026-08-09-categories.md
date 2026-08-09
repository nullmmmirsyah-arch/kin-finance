# Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Categories feature (list/create/edit/delete/toggle visibility) reached from a new minimal Settings tab, per the approved design in `docs/superpowers/specs/2026-08-09-categories-design.md`.

**Architecture:** Convex backend (`convex/categories.ts`) exposing `list`/`create`/`update`/`remove` following the existing `convex/accounts.ts` conventions (shared membership/owner helper, `ConvexError` messages). Three screens on the Expo Router stack: minimal `Settings` tab → pushed `Categories` list → pushed `CategoryForm`. Reuses existing `Button`, `Input`, `Chip`, `Fab`, `EmptyState` components and theme tokens.

**Tech Stack:** Expo SDK 54 / React Native 0.81, Expo Router 6, Convex 1.43, NativeWind v4, TypeScript strict, Feather icons.

## Global Constraints

- No automated test runner exists in this repo. Verification gates are: `npx tsc --noEmit` (typecheck), `npm run lint` (expo lint), and after any `convex/*.ts` change, `npx convex codegen` (regenerates `convex/_generated`). Manual smoke test in the Expo dev client for behavioral checks.
- Use NativeWind `className` for styling; never `StyleSheet.create`. Import colors/shadows/radii from `@/constants/theme` — never hardcode colors.
- Never use `style={({ pressed }) => [...]}` callbacks on `Pressable` (NativeWind v4 bug). Use `useState` pressed state + static `style`/`className`.
- Reuse `@/components/Button`, `@/components/Input`, `@/components/Chip`, `@/components/Fab`, `@/components/EmptyState`. Do not create new primitives.
- Type badge colors: income → `Colors.success`, expense → `Colors.error`.
- Reserved "Initial Balance" categories: excluded from `list`, and `create`/`update`/`remove` reject them. Uniqueness = `(householdId, name, type)`.
- Error copy must match the PRD text exactly (listed in each task).
- No comments in code unless the task shows them.

---

### Task 1: Convex backend — `convex/categories.ts`

**Files:**
- Create: `convex/categories.ts`
- Modify: `convex/schema.ts` (add `by_categoryId` index to `transactions`)

**Interfaces:**
- Consumes: existing `householdMemberships`, `categories`, `transactions` tables; `transactions.by_categoryId` index (added here).
- Produces (used by later tasks):
  - `api.categories.list` query `{}` → `{ categories: Category[] | null, isOwner: boolean }`
  - `api.categories.create` mutation `{ name: string, type: "income" | "expense", hidden?: boolean }` → `Category | null`
  - `api.categories.update` mutation `{ categoryId: Id<"categories">, name?: string, type?: "income" | "expense", hidden?: boolean }` → `Category | null`
  - `api.categories.remove` mutation `{ categoryId: Id<"categories"> }` → `void`

- [ ] **Step 1: Add `by_categoryId` index to the `transactions` table**

In `convex/schema.ts`, change the `transactions` table definition from:

```ts
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
```

to:

```ts
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
    .index("by_accountId", ["accountId"])
    .index("by_categoryId", ["categoryId"]),
```

- [ ] **Step 2: Create `convex/categories.ts`**

```ts
import { ConvexError, v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";

const categoryType = v.union(v.literal("income"), v.literal("expense"));

const RESERVED_CATEGORY_NAME = "Initial Balance";

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

function validateName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ConvexError("Category name is required.");
  }
  if (trimmed.length < 2) {
    throw new ConvexError("Category name must be at least 2 characters.");
  }
  if (trimmed.length > 30) {
    throw new ConvexError("Category name must be at most 30 characters.");
  }
  return trimmed;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return { categories: null, isOwner: false };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user === null) {
      return { categories: null, isOwner: false };
    }

    const membership = await ctx.db
      .query("householdMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (membership === null) {
      return { categories: null, isOwner: false };
    }

    const isOwner = membership.role === "owner";
    const all = await ctx.db
      .query("categories")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", membership.householdId),
      )
      .collect();

    const manageable = all.filter(
      (category) => category.name !== RESERVED_CATEGORY_NAME,
    );
    const categories = isOwner
      ? manageable
      : manageable.filter((category) => !category.hidden);
    return { categories, isOwner };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    type: categoryType,
    hidden: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);

    if (membership.role !== "owner") {
      throw new ConvexError("You are not the owner of this household.");
    }

    const name = validateName(args.name);

    if (name === RESERVED_CATEGORY_NAME) {
      throw new ConvexError("This category name is reserved.");
    }

    const existing = await ctx.db
      .query("categories")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", membership.householdId),
      )
      .filter((q) =>
        q.and(q.eq(q.field("name"), name), q.eq(q.field("type"), args.type)),
      )
      .first();
    if (existing !== null) {
      throw new ConvexError("Category name already exists.");
    }

    const now = Date.now();
    const categoryId = await ctx.db.insert("categories", {
      householdId: membership.householdId,
      name,
      type: args.type,
      hidden: args.hidden ?? false,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(categoryId);
  },
});

export const update = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.optional(v.string()),
    type: v.optional(categoryType),
    hidden: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);

    if (membership.role !== "owner") {
      throw new ConvexError("You are not the owner of this household.");
    }

    const category = await ctx.db.get(args.categoryId);
    if (category === null || category.householdId !== membership.householdId) {
      throw new ConvexError("Category not found.");
    }

    if (category.name === RESERVED_CATEGORY_NAME) {
      throw new ConvexError("This category cannot be modified.");
    }

    const patch: {
      name?: string;
      type?: "income" | "expense";
      hidden?: boolean;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.name !== undefined) {
      const name = validateName(args.name);
      if (name === RESERVED_CATEGORY_NAME) {
        throw new ConvexError("This category name is reserved.");
      }

      const existing = await ctx.db
        .query("categories")
        .withIndex("by_householdId", (q) =>
          q.eq("householdId", membership.householdId),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), name),
            q.neq(q.field("_id"), args.categoryId),
          ),
        )
        .first();
      if (existing !== null) {
        throw new ConvexError("Category name already exists.");
      }

      patch.name = name;
    }

    if (args.type !== undefined && args.type !== category.type) {
      const referencingTx = await ctx.db
        .query("transactions")
        .withIndex("by_categoryId", (q) => q.eq("categoryId", args.categoryId))
        .first();
      if (referencingTx !== null) {
        throw new ConvexError(
          "Cannot change category type — existing transactions or budgets use this category.",
        );
      }
      patch.type = args.type;
    }

    if (args.hidden !== undefined) {
      patch.hidden = args.hidden;
    }

    await ctx.db.patch(args.categoryId, patch);
    return await ctx.db.get(args.categoryId);
  },
});

export const remove = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);

    if (membership.role !== "owner") {
      throw new ConvexError("You are not the owner of this household.");
    }

    const category = await ctx.db.get(args.categoryId);
    if (category === null || category.householdId !== membership.householdId) {
      throw new ConvexError("Category not found.");
    }

    if (category.name === RESERVED_CATEGORY_NAME) {
      throw new ConvexError("This category cannot be deleted.");
    }

    const referencingTx = await ctx.db
      .query("transactions")
      .withIndex("by_categoryId", (q) => q.eq("categoryId", args.categoryId))
      .first();

    if (referencingTx !== null) {
      throw new ConvexError(
        "Cannot delete category — existing transactions or budgets reference this category. Delete or reassign those first.",
      );
    }

    await ctx.db.delete(args.categoryId);
  },
});
```

- [ ] **Step 3: Regenerate Convex client types**

Run: `npx convex codegen`
Expected: `convex/_generated/api.d.ts` now includes `categories` functions (`list`, `create`, `update`, `remove`). If codegen errors, confirm `.env.local` has `CONVEX_URL` set and the deployment is reachable.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add convex/categories.ts convex/schema.ts
git commit -m "feat: add categories convex backend (list/create/update/remove)"
```

---

### Task 2: Category constants + `CategoryCard` row component

**Files:**
- Create: `constants/categories.ts`
- Create: `components/CategoryCard.tsx`

**Interfaces:**
- Consumes: `CategoryType` type defined here; Feather icons; theme tokens.
- Produces (used by later tasks):
  - `CATEGORY_TYPES: { id: "income" | "expense"; label: string }[]`
  - `CategoryType = "income" | "expense"`
  - `CategoryCard` component with props:
    - `{ name: string; type: CategoryType; hidden: boolean; onToggleVisibility?: () => void; onEdit?: () => void; onDelete?: () => void }`

- [ ] **Step 1: Create `constants/categories.ts`**

```ts
export type CategoryType = "income" | "expense";

export const CATEGORY_TYPES: { id: CategoryType; label: string }[] = [
  { id: "income", label: "Income" },
  { id: "expense", label: "Expense" },
];
```

- [ ] **Step 2: Create `components/CategoryCard.tsx`**

```tsx
import Feather from "@expo/vector-icons/Feather";
import { Colors, Radius, Shadow } from "@/constants/theme";
import { CategoryType } from "@/constants/categories";
import { Pressable, Text, View } from "react-native";

type Props = {
  name: string;
  type: CategoryType;
  hidden: boolean;
  onToggleVisibility?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function CategoryCard({
  name,
  type,
  hidden,
  onToggleVisibility,
  onEdit,
  onDelete,
}: Props) {
  const isIncome = type === "income";

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
        <Feather name="tag" size={20} color={Colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-text-primary">{name}</Text>
        <View className="mt-1 self-start rounded-full border border-border bg-background px-2 py-0.5">
          <Text
            className={`text-xs font-medium ${isIncome ? "text-success" : "text-error"}`}
          >
            {isIncome ? "Income" : "Expense"}
          </Text>
        </View>
      </View>
      {onToggleVisibility !== undefined ||
      onEdit !== undefined ||
      onDelete !== undefined ? (
        <View className="flex-row items-center gap-1">
          {onToggleVisibility !== undefined ? (
            <Pressable
              onPress={onToggleVisibility}
              accessibilityRole="button"
              accessibilityLabel={
                hidden
                  ? "Show category to members"
                  : "Hide category from members"
              }
              style={{ width: 40, height: 40 }}
              className="items-center justify-center"
            >
              <Feather
                name={hidden ? "eye-off" : "eye"}
                size={18}
                color={Colors.textSecondary}
              />
            </Pressable>
          ) : null}
          {onEdit !== undefined ? (
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit category"
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
              accessibilityLabel="Delete category"
              style={{ width: 40, height: 40 }}
              className="items-center justify-center"
            >
              <Feather name="trash-2" size={18} color={Colors.error} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add constants/categories.ts components/CategoryCard.tsx
git commit -m "feat: add category type constants and CategoryCard component"
```

---

### Task 3: Categories list screen + stack registration

**Files:**
- Create: `app/categories.tsx`
- Modify: `app/_layout.tsx` (add `<Stack.Screen name="categories" />`)

**Interfaces:**
- Consumes: `api.categories.list`, `api.categories.update`, `api.categories.remove`; `CategoryCard`, `Chip`, `Fab`, `EmptyState`; `CATEGORY_TYPES`.
- Produces: route `/categories` (pushed from Settings in Task 5), which itself pushes `/category-form` with `{ id }` param in edit mode.

- [ ] **Step 1: Create `app/categories.tsx`**

```tsx
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import Feather from "@expo/vector-icons/Feather";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Colors, Shadow } from "@/constants/theme";
import { CATEGORY_TYPES, CategoryType } from "@/constants/categories";
import { Chip } from "@/components/Chip";
import { Fab } from "@/components/Fab";
import { CategoryCard } from "@/components/CategoryCard";
import { EmptyState } from "@/components/EmptyState";

type Filter = "all" | CategoryType;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  ...CATEGORY_TYPES.map((t) => ({ id: t.id as Filter, label: t.label })),
];

export default function Categories() {
  const router = useRouter();
  const result = useQuery(api.categories.list);
  const updateCategory = useMutation(api.categories.update);
  const removeCategory = useMutation(api.categories.remove);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  const categories = result?.categories ?? null;
  const isOwner = result?.isOwner ?? false;

  const visibleCategories = useMemo(() => {
    if (categories === null) return null;
    return filter === "all"
      ? categories
      : categories.filter((c) => c.type === filter);
  }, [categories, filter]);

  const handleToggleVisibility = useCallback(
    (category: { _id: Id<"categories">; hidden: boolean }) => {
      setError(null);
      updateCategory({ categoryId: category._id, hidden: !category.hidden })
        .then(() => setError(null))
        .catch((e: unknown) => {
          setError(
            e instanceof Error ? e.message : "Failed to update category.",
          );
        });
    },
    [updateCategory],
  );

  const handleDelete = useCallback(
    (category: { _id: Id<"categories">; name: string }) => {
      setError(null);
      Alert.alert(
        "Delete Category",
        `Delete "${category.name}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              removeCategory({ categoryId: category._id })
                .then(() => setError(null))
                .catch((e: unknown) => {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Failed to delete category.",
                  );
                });
            },
          },
        ],
      );
    },
    [removeCategory],
  );

  if (categories === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-5 pt-4">
        <View className="flex-row items-center gap-2">
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
            Categories
          </Text>
        </View>
        {error ? (
          <Text className="mt-2 text-sm text-error">{error}</Text>
        ) : null}
      </View>

      <View className="mt-4 flex-row flex-wrap gap-2 px-5">
        {FILTERS.map((f) => (
          <Chip
            key={f.id}
            label={f.label}
            active={filter === f.id}
            onPress={() => setFilter(f.id)}
          />
        ))}
      </View>

      {visibleCategories !== null && visibleCategories.length === 0 ? (
        <View className="mt-6 flex-1 px-5">
          <View style={Shadow.card} className="rounded-[16px] bg-background">
            <EmptyState
              icon="tag"
              title="No categories yet"
              description="Create categories to organize your transactions."
              actionLabel={isOwner ? "Add Category" : undefined}
              onAction={
                isOwner ? () => router.push("/category-form") : undefined
              }
            />
          </View>
        </View>
      ) : (
        <FlatList
          className="mt-4 flex-1"
          contentContainerClassName="gap-3 px-5 pb-28"
          data={visibleCategories ?? []}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) =>
            isOwner ? (
              <CategoryCard
                name={item.name}
                type={item.type}
                hidden={item.hidden}
                onToggleVisibility={() => handleToggleVisibility(item)}
                onEdit={() =>
                  router.push({
                    pathname: "/category-form",
                    params: { id: item._id },
                  })
                }
                onDelete={() => handleDelete(item)}
              />
            ) : (
              <CategoryCard
                name={item.name}
                type={item.type}
                hidden={item.hidden}
              />
            )
          }
        />
      )}

      {isOwner ? (
        <Fab
          onPress={() => router.push("/category-form")}
          accessibilityLabel="Add category"
        />
      ) : null}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Register `categories` in the root Stack**

In `app/_layout.tsx`, inside the signed-in `<Stack.Protected guard={!!isSignedIn}>` block, after the `<Stack.Screen name="account-form" />` line, add:

```tsx
        <Stack.Screen name="categories" />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Run: `npm start`, open the app, navigate to the Settings tab (once Task 5 lands) or open `/categories` directly via the router. Verify list renders, filter chips switch between All/Income/Expense, owner rows show eye/edit/delete and member rows show none.

- [ ] **Step 6: Commit**

```bash
git add app/categories.tsx app/_layout.tsx
git commit -m "feat: add categories list screen"
```

---

### Task 4: Category form + stack registration

**Files:**
- Create: `app/category-form.tsx`
- Modify: `app/_layout.tsx` (add `<Stack.Screen name="category-form" />`)

**Interfaces:**
- Consumes: `api.categories.list`, `api.categories.create`, `api.categories.update`; `CATEGORY_TYPES`, `CategoryType`; `Button`, `Input`, `Chip`.
- Produces: route `/category-form` (create) and `/category-form?id=<Id>` (edit). Pushed from `app/categories.tsx` in Task 3.

- [ ] **Step 1: Create `app/category-form.tsx`**

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Id } from "@/convex/_generated/dataModel";
import { Colors } from "@/constants/theme";
import { CATEGORY_TYPES, CategoryType } from "@/constants/categories";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Chip } from "@/components/Chip";

export default function CategoryForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const categoryId = params.id;
  const isEdit = categoryId !== undefined;

  const result = useQuery(api.categories.list);
  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);

  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const editingCategory = useMemo(() => {
    if (!isEdit || result?.categories === null) return undefined;
    return result?.categories?.find((c) => c._id === categoryId);
  }, [isEdit, categoryId, result]);

  const seeded = useRef(false);

  useEffect(() => {
    if (editingCategory && !seeded.current) {
      seeded.current = true;
      setName(editingCategory.name);
      setType(editingCategory.type);
      setHidden(editingCategory.hidden);
    }
  }, [editingCategory]);

  const trimmedName = name.trim();
  const canSubmit =
    trimmedName.length >= 2 &&
    trimmedName.length <= 30 &&
    !isLoading &&
    (!isEdit || editingCategory !== undefined);

  const handleSubmit = async () => {
    setError(null);
    if (trimmedName.length < 2) {
      setError("Category name must be at least 2 characters.");
      return;
    }
    if (trimmedName.length > 30) {
      setError("Category name must be at most 30 characters.");
      return;
    }

    setIsLoading(true);
    try {
      if (isEdit && categoryId !== undefined) {
        await updateCategory({
          categoryId: categoryId as Id<"categories">,
          name: trimmedName,
          type,
          hidden,
        });
      } else {
        await createCategory({
          name: trimmedName,
          type,
          hidden,
        });
      }
      router.back();
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : isEdit
            ? "Failed to update category."
            : "Failed to create category.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isEdit && result !== undefined && editingCategory === undefined) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-sm text-text-secondary">Category not found.</Text>
      </SafeAreaView>
    );
  }

  if (isEdit && editingCategory === undefined) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-sm text-text-secondary">Loading category…</Text>
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
            {isEdit ? "Edit Category" : "Create Category"}
          </Text>
        </View>

        <ScrollView
          contentContainerClassName="gap-4 px-5 py-6"
          keyboardShouldPersistTaps="handled"
        >
          <Input
            label="Category name"
            placeholder="e.g. Food, Salary"
            value={name}
            onChangeText={setName}
            maxLength={30}
            error={error}
          />

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-text-primary">
              Category type
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {CATEGORY_TYPES.map((t) => (
                <Chip
                  key={t.id}
                  label={t.label}
                  active={type === t.id}
                  onPress={() => setType(t.id)}
                />
              ))}
            </View>
          </View>

          <View
            style={{ borderColor: Colors.border }}
            className="flex-row items-center justify-between rounded-[12px] border bg-surface px-4 py-3"
          >
            <View className="flex-1">
              <Text className="text-base font-medium text-text-primary">
                Visible to members
              </Text>
              <Text className="text-sm text-text-secondary">
                Members can see and use this category.
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
            title={isEdit ? "Save Changes" : "Create Category"}
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

- [ ] **Step 2: Register `category-form` in the root Stack**

In `app/_layout.tsx`, inside the same `<Stack.Protected guard={!!isSignedIn}>` block, after the `<Stack.Screen name="categories" />` line, add:

```tsx
        <Stack.Screen name="category-form" />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Verify: create flow (blank fields, default Expense type, "Visible to members" on → Create → returns to list with new category); edit flow (pre-filled, "Save Changes"); duplicate name surfaces "Category name already exists."; changing type on a category that has transactions surfaces "Cannot change category type — existing transactions or budgets use this category."

- [ ] **Step 6: Commit**

```bash
git add app/category-form.tsx app/_layout.tsx
git commit -m "feat: add category create/edit form screen"
```

---

### Task 5: Settings tab + navigation wiring

**Files:**
- Create: `app/(tabs)/settings.tsx`
- Modify: `app/(tabs)/_layout.tsx` (add Settings tab)

**Interfaces:**
- Consumes: `Colors`, `Radius`, `Shadow` from theme; Feather icons.
- Produces: Settings tab (Feather `settings` icon) with a "Categories" row that pushes `/categories`. Completes the user flow `Settings → Categories`.

- [ ] **Step 1: Create `app/(tabs)/settings.tsx`**

```tsx
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Radius, Shadow } from "@/constants/theme";

export default function Settings() {
  const router = useRouter();
  const [pressed, setPressed] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-5 pt-4">
        <Text className="text-[28px] font-bold text-text-primary">Settings</Text>
      </View>

      <View className="mt-4 px-5">
        <Text className="text-sm font-medium text-text-primary">Household</Text>
        <Pressable
          onPress={() => router.push("/categories")}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          accessibilityRole="button"
          accessibilityLabel="Categories"
          style={[
            Shadow.card,
            {
              borderRadius: Radius.md,
              backgroundColor: Colors.background,
              borderWidth: 1,
              borderColor: Colors.border,
            },
            pressed ? { backgroundColor: Colors.surface } : undefined,
          ]}
          className="mt-2 flex-row items-center justify-between px-4 py-4"
        >
          <View className="flex-row items-center gap-3">
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: Radius.sm,
                backgroundColor: Colors.surface,
              }}
              className="items-center justify-center"
            >
              <Feather name="tag" size={20} color={Colors.primary} />
            </View>
            <Text className="text-base font-semibold text-text-primary">
              Categories
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Add the Settings tab**

In `app/(tabs)/_layout.tsx`, after the existing `<Tabs.Screen name="accounts" ... />`, add:

```tsx
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <Feather name="settings" size={22} color={color} />
          ),
        }}
      />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual smoke test (full flow)**

Run: `npm start`. Verify end-to-end:
- Settings tab visible with a "Categories" row under "Household".
- Tap row → Categories list (back arrow returns to Settings).
- Owner: FAB present; create a category; edit it; toggle eye visibility; delete with confirmation. Duplicate name rejected.
- Member (second account in same household): Settings → Categories shows only visible categories, read-only (no icons, no FAB, no empty-state action).
- Reserved "Initial Balance" categories never appear in the list.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/settings.tsx" "app/(tabs)/_layout.tsx"
git commit -m "feat: add Settings tab with Categories entry point"
```

---

## Post-Implementation Review

Run the full verification suite once after all tasks:

```bash
npx convex codegen
npx tsc --noEmit
npm run lint
```

Expected: all pass. Then confirm the success criteria from the design doc: owner CRUD + visibility toggle; member read-only visible list; uniqueness guard; reserved categories protected; type-change/delete guards with PRD error text; empty state present.
