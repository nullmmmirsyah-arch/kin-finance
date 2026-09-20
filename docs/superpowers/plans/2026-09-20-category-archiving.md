# Category Archiving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner dapat meng-archive/unarchive kategori via category-form; kategori archived hilang dari list utama dan picker transaksi/budget baru, tapi histori, report, dan budget tetap utuh; list categories menjadi display-only dengan semua aksi di dalam form edit.

**Architecture:** Tambah field optional `isArchived` di tabel `categories` (tanpa migrasi — dokumen lama terbaca sebagai active); `categories.list` split menjadi `{ categories, archived }`; mutation baru `archive`/`unarchive` (owner-only, boleh kapan saja walau ada transaksi/budget); guard di `transactions.create`/`update` dan `budgets.create`/`categoryOptions` menolak kategori archived untuk pilihan baru; UI: categories display-only + section Archived + danger zone di category-form + picker active-only dengan locked display untuk transaksi lama.

**Tech Stack:** Expo SDK 54, Convex (mutation/query + convex-test), React Native + NativeWind v4 (`className`), `useThemeColors`, `@expo/vector-icons/Feather`, vitest.

## Global Constraints

- Styling uses NativeWind `className`, never `StyleSheet.create`.
- Never use `style` callback functions on `Pressable` (e.g. `style={({ pressed }) => [...]}`) — breaks NativeWind v4; use static `style` if pressed styling is needed.
- Colors via `useThemeColors()` from `@/constants/theme`, never hardcoded; icons `@expo/vector-icons/Feather`.
- After any change to `convex/*.ts`, run `npx convex codegen` first, then `npx tsc --noEmit`.
- Install deps only via `npx expo install <pkg>` (no new deps expected in this plan).
- Every `convex/*.ts` handler requires sign-in handling via `findUserAndMembership`/`getUserAndMembership` and throws `ConvexError` on operational errors.
- Path alias `@/*` maps to repo root.
- Verify with `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest — required because Tasks 1-2 touch Convex functions).
- Only `owner` may archive/unarchive (via `requireOwner` from `./helpers`); member attempts throw `ConvexError("You are not the owner of this household.")`.
- Backend error strings are contracts — use exactly `"This category is archived."` for the new guards; do not alter existing messages in `remove`/`update`.
- Scope is categories archiving + categories list simplification (display-only, actions move into category-form) — do not touch `accounts.ts`, `periodBalances.ts`, or transaction analytics/queries.

---

## File Structure

- `convex/schema.ts` (modify, tabel `categories` lines 67-75): satu tanggung jawab — tambah `isArchived: v.optional(v.boolean())` setelah `hidden`. Optional agar dokumen lama tanpa field tetap valid (terbaca sebagai active via `?? false`).
- `convex/categories.ts` (modify): satu tanggung jawab — split `list` menjadi `{ categories, archived }` + mutation baru `archive`/`unarchive` (owner-only, idempoten, reserved-protected). `create`/`update`/`remove` tidak berubah.
- `tests/categories.archive.test.ts` (new): convex-test untuk archive/unarchive/list-split/remove-interaction, mengikuti pola seed `tests/accounts.archive.test.ts:18-55` (`convexTest(schema, import.meta.glob(...))`, `t.withIdentity`, insert household+users+memberships langsung via `t.run`).
- `convex/transactions.ts` (modify): satu tanggung jawab — guard archived di `create` (1 titik: setelah `getScopedDoc` category) dan `update` (1 titik: kategori baru vs `tx.categoryId`). Tanpa perubahan balance logic / recompute / transfer handling.
- `convex/budgets.ts` (modify): satu tanggung jawab — `categoryOptions` exclude archived + `create` menolak kategori archived. `list`/`get`/`suggestion`/`update`/`remove` tidak berubah (budget lama tetap terbaca utuh).
- `tests/categories.archiveGuard.test.ts` (new): convex-test untuk guard transactions.create/update + budgets.create/categoryOptions + aturan edit (keep-archived boleh, reassign-to-archived ditolak, archived→active boleh).
- `app/categories.tsx` (modify): satu tanggung jawab — display-only list (hapus eye/edit/trash per row, tap row owner → form) + section Archived collapsed di bawah `FlatList`. Filter chips All|Income|Expense berlaku untuk kedua list.
- `components/CategoryCard.tsx` (modify): satu tanggung jawab — tambah badge info `hidden`/`archived` (display-only, tanpa aksi). Props aksi (`onToggleVisibility`/`onEdit`/`onDelete`) dipertahankan optional agar tak merusak consumer lain, tapi `categories.tsx` berhenti mengopernya.
- `app/category-form.tsx` (modify): satu tanggung jawab — satu-satunya tempat aksi: lookup mencakup `archived`, banner saat archived, danger zone Archive/Unarchive + Delete (disabled saat dirty), pola `Alert` + `show(getConvexErrorMessage(...))` + haptic.
- `app/transaction-form.tsx` (modify): satu tanggung jawab — `categoryOptions` hanya active + `addIfMissing` untuk kategori archived transaksi lama + locked banner + perbaiki efek null-reset agar tidak menghapus pilihan archived saat edit.
- `app/budget-form.tsx` (modify, kecil): satu tanggung jawab — tampilkan badge Archived pada kategori read-only saat edit budget lama berkategori archived (create picker otomatis active-only dari backend).
- `app/(tabs)/home.tsx`, `app/search.tsx` (modify, kecil): satu tanggung jawab — opsi filter kategori mencakup archived agar histori archived tetap filterable (mirror follow-up account archiving).

---

### Task 1: Schema + `archive`/`unarchive` + `list` split + tests

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/categories.ts`
- Test: `tests/categories.archive.test.ts`

**Interfaces:**
- Consumes: `getUserAndMembership`, `requireOwner`, `getScopedDoc` from `./helpers`; `findUserAndMembership` (sudah dipakai `list`); `RESERVED_CATEGORY_NAME` dari `../constants/categories`.
- Produces: `categories.list → { categories: Doc<"categories">[] | null, archived: Doc<"categories">[] | null, isOwner: boolean }`; `categories.archive({ categoryId }) → Doc<"categories"> | null`; `categories.unarchive({ categoryId }) → Doc<"categories"> | null`. Semua consumer UI (Task 3-5) memakai bentuk return ini.

- [ ] **Step 1: Tambah field schema**

Di `convex/schema.ts`, tabel `categories`, setelah `hidden: v.boolean(),` tambahkan:

```ts
isArchived: v.optional(v.boolean()),
```

- [ ] **Step 2: Regenerate + typecheck**

Run: `npx convex codegen`
Run: `npx tsc --noEmit`
Expected: PASS (field optional → tidak ada error di dokumen lama).

- [ ] **Step 3: Tulis failing test untuk archive/unarchive/list**

Buat `tests/categories.archive.test.ts`:

```ts
/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|category-archive-test";
const MEMBER_TOKEN = "member|category-archive-test";

describe("categories archive/unarchive", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed() {
    return await t.run(async (ctx) => {
      const householdId = await ctx.db.insert("households", {
        name: "Category Archive HH",
        createdAt: 1,
        updatedAt: 1,
      });
      const ownerId = await ctx.db.insert("users", {
        tokenIdentifier: OWNER_TOKEN,
        clerkUserId: "clerk-owner-catarchive",
      });
      const memberId = await ctx.db.insert("users", {
        tokenIdentifier: MEMBER_TOKEN,
        clerkUserId: "clerk-member-catarchive",
      });
      await ctx.db.insert("householdMemberships", {
        householdId,
        userId: ownerId,
        role: "owner",
      });
      await ctx.db.insert("householdMemberships", {
        householdId,
        userId: memberId,
        role: "member",
      });
      const foodId = await ctx.db.insert("categories", {
        householdId,
        name: "Food",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      return { householdId, ownerId, memberId, foodId };
    });
  }

  it("owner archives a category; list splits active/archived", async () => {
    const { foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    const result = await owner.query(api.categories.list, {});
    expect(result.categories!.map((c) => c._id)).not.toContain(foodId);
    expect(result.archived!.map((c) => c._id)).toContain(foodId);
  });

  it("member cannot archive", async () => {
    const { foodId } = await seed();
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    await expect(
      member.mutation(api.categories.archive, { categoryId: foodId as any }),
    ).rejects.toThrow("You are not the owner of this household.");
  });

  it("unarchive restores to active list", async () => {
    const { foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    await owner.mutation(api.categories.unarchive, { categoryId: foodId as any });
    const result = await owner.query(api.categories.list, {});
    expect(result.categories!.map((c) => c._id)).toContain(foodId);
    expect(result.archived).toHaveLength(0);
  });

  it("legacy doc without isArchived reads as active", async () => {
    await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const result = await owner.query(api.categories.list, {});
    expect(result.categories!.length).toBe(1);
    expect(result.archived).toHaveLength(0);
  });

  it("member does not see archived+hidden categories", async () => {
    const { foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.categories.update, {
      categoryId: foodId as any,
      hidden: true,
    });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const result = await member.query(api.categories.list, {});
    expect(result.categories).toHaveLength(0);
    expect(result.archived).toHaveLength(0);
  });

  it("member sees archived+visible categories in archived", async () => {
    const { foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const result = await member.query(api.categories.list, {});
    expect(result.categories).toHaveLength(0);
    expect(result.archived!.map((c) => c._id)).toContain(foodId);
  });

  it("remove stays blocked for archived category with transactions", async () => {
    const { householdId, foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const cashId = await t.run(async (ctx) =>
      ctx.db.insert("accounts", {
        householdId,
        name: "Cash",
        type: "asset",
        subType: "cash",
        balance: 0,
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    await owner.mutation(api.transactions.create, {
      accountId: cashId as any,
      categoryId: foodId as any,
      amount: -100,
      type: "expense",
      date: Date.now(),
    });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    await expect(
      owner.mutation(api.categories.remove, { categoryId: foodId as any }),
    ).rejects.toThrow("Cannot delete category");
  });

  it("archived category without references can be deleted", async () => {
    const { foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    await owner.mutation(api.categories.remove, { categoryId: foodId as any });
    const result = await owner.query(api.categories.list, {});
    expect(result.categories).toHaveLength(0);
    expect(result.archived).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Run test, pastikan FAIL (mutation belum ada)**

Run: `npm test -- tests/categories.archive.test.ts`
Expected: FAIL dengan pesan tidak ada fungsi `archive` (atau `archived` undefined di hasil `list`).

- [ ] **Step 5: Implementasi minimal di `convex/categories.ts`**

(a) Di `list`, ganti blok filter/return (lines 26-32):

```ts
const manageable = all.filter(
  (category) => category.name !== RESERVED_CATEGORY_NAME,
);
const active = manageable.filter((c) => !(c.isArchived ?? false));
const archivedAll = manageable.filter((c) => c.isArchived ?? false);
const categories = isOwner
  ? active
  : active.filter((category) => !category.hidden);
const archived = isOwner
  ? archivedAll
  : archivedAll.filter((category) => !category.hidden);
return { categories, archived, isOwner };
```

(b) Setelah mutation `update` (sebelum `remove`), tambahkan:

```ts
export const archive = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);
    requireOwner(membership);

    const category = await getScopedDoc(ctx, args.categoryId, membership.householdId, "Category");

    if (category.name === RESERVED_CATEGORY_NAME) {
      throw new ConvexError("This category cannot be modified.");
    }

    await ctx.db.patch(args.categoryId, {
      isArchived: true,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(args.categoryId);
  },
});

export const unarchive = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);
    requireOwner(membership);

    const category = await getScopedDoc(ctx, args.categoryId, membership.householdId, "Category");

    if (category.name === RESERVED_CATEGORY_NAME) {
      throw new ConvexError("This category cannot be modified.");
    }

    await ctx.db.patch(args.categoryId, {
      isArchived: false,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(args.categoryId);
  },
});
```

`create`, `update`, `remove` tidak diubah.

- [ ] **Step 6: Codegen + run test sampai PASS**

Run: `npx convex codegen && npx tsc --noEmit`
Expected: PASS.
Run: `npm test -- tests/categories.archive.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 7: Commit**

```bash
git add convex/schema.ts convex/categories.ts tests/categories.archive.test.ts
git commit -m "feat: category archive/unarchive with list split"
```

---

### Task 2: Guard archived di `transactions.create`/`update` + `budgets` + tests

**Files:**
- Modify: `convex/transactions.ts`
- Modify: `convex/budgets.ts`
- Test: `tests/categories.archiveGuard.test.ts`

**Interfaces:**
- Consumes: `categories.archive` dari Task 1 (untuk setup test); `Doc<"categories">.isArchived` (optional boolean).
- Produces: tidak ada interface baru — hanya `ConvexError("This category is archived.")` baru pada kondisi di bawah; semua UI mengandalkan pesan ini via `getConvexErrorMessage`. `budgets.categoryOptions` otomatis hanya active (return shape tidak berubah).

- [ ] **Step 1: Tulis failing test**

Buat `tests/categories.archiveGuard.test.ts`:

```ts
/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|catguard-test";

describe("category archived guards", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed() {
    return await t.run(async (ctx) => {
      const householdId = await ctx.db.insert("households", {
        name: "Guard HH",
        createdAt: 1,
        updatedAt: 1,
      });
      const ownerId = await ctx.db.insert("users", {
        tokenIdentifier: OWNER_TOKEN,
        clerkUserId: "clerk-owner-catguard",
      });
      await ctx.db.insert("householdMemberships", {
        householdId,
        userId: ownerId,
        role: "owner",
      });
      const foodId = await ctx.db.insert("categories", {
        householdId,
        name: "Food",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const salaryId = await ctx.db.insert("categories", {
        householdId,
        name: "Salary",
        type: "income",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const snacksId = await ctx.db.insert("categories", {
        householdId,
        name: "Snacks",
        type: "expense",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const cashId = await ctx.db.insert("accounts", {
        householdId,
        name: "Cash",
        type: "asset",
        subType: "cash",
        balance: 0,
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      return { householdId, ownerId, foodId, salaryId, snacksId, cashId };
    });
  }

  it("create expense on archived category is rejected", async () => {
    const { cashId, foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    await expect(
      owner.mutation(api.transactions.create, {
        accountId: cashId as any,
        categoryId: foodId as any,
        amount: -500,
        type: "expense",
        date: Date.now(),
      }),
    ).rejects.toThrow("This category is archived.");
  });

  it("update keeping the archived category is allowed", async () => {
    const { cashId, foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const txId = await owner.mutation(api.transactions.create, {
      accountId: cashId as any,
      categoryId: foodId as any,
      amount: -500,
      type: "expense",
      date: Date.now(),
    });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    const updated = await owner.mutation(api.transactions.update, {
      transactionId: txId as any,
      note: "fixed note",
    });
    expect(updated!.note).toBe("fixed note");
  });

  it("update reassigning to an archived category is rejected", async () => {
    const { cashId, foodId, snacksId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const txId = await owner.mutation(api.transactions.create, {
      accountId: cashId as any,
      categoryId: foodId as any,
      amount: -500,
      type: "expense",
      date: Date.now(),
    });
    await owner.mutation(api.categories.archive, { categoryId: snacksId as any });
    await expect(
      owner.mutation(api.transactions.update, {
        transactionId: txId as any,
        categoryId: snacksId as any,
      }),
    ).rejects.toThrow("This category is archived.");
  });

  it("update reassigning archived -> active is allowed", async () => {
    const { cashId, foodId, snacksId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const txId = await owner.mutation(api.transactions.create, {
      accountId: cashId as any,
      categoryId: foodId as any,
      amount: -500,
      type: "expense",
      date: Date.now(),
    });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    const updated = await owner.mutation(api.transactions.update, {
      transactionId: txId as any,
      categoryId: snacksId as any,
    });
    expect(updated!.categoryId).toBe(snacksId);
  });

  it("budgets.categoryOptions excludes archived categories", async () => {
    const { foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    const options = await owner.query(api.budgets.categoryOptions, {});
    expect(options.map((o) => o._id)).not.toContain(foodId);
  });

  it("budgets.create on archived category is rejected", async () => {
    const { foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    await expect(
      owner.mutation(api.budgets.create, {
        categoryId: foodId as any,
        amount: 100000,
        periodStart: 1,
      }),
    ).rejects.toThrow("This category is archived.");
  });

  it("existing budget on newly-archived category still lists with progress", async () => {
    const { foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const periodStart = new Date("2026-09-01T00:00:00Z").getTime();
    await owner.mutation(api.budgets.create, {
      categoryId: foodId as any,
      amount: 100000,
      periodStart,
    });
    await owner.mutation(api.categories.archive, { categoryId: foodId as any });
    const result = await owner.query(api.budgets.list, {
      periodStart,
      periodEnd: periodStart + 30 * 86_400_000,
    });
    expect(result.budgets!.length).toBe(1);
    expect(result.budgets![0].category?.name).toBe("Food");
  });
});
```

- [ ] **Step 2: Run test, pastikan FAIL**

Run: `npm test -- tests/categories.archiveGuard.test.ts`
Expected: FAIL — test create-guard dan budgets-guard gagal karena guard belum ada (mutasi sukses padahal harus throw; categoryOptions masih berisi archived).

- [ ] **Step 3: Guard di `transactions.create` (1 titik)**

Di `convex/transactions.ts`, cabang income/expense, setelah:

```ts
const cat = await getScopedDoc(ctx, args.categoryId, membership.householdId, "Category");
```

dan sebelum `if (cat.type !== args.type)`, tambahkan:

```ts
if (cat.isArchived ?? false) {
  throw new ConvexError("This category is archived.");
}
```

Cabang transfer tidak tersentuh (tidak punya kategori).

- [ ] **Step 4: Guard di `transactions.update` (1 titik)**

Di `convex/transactions.ts` handler `update`, setelah blok fetch `category`:

```ts
let category: Doc<"categories"> | undefined;
if (categoryId !== undefined) {
  const cat = await getScopedDoc(ctx, categoryId, membership.householdId, "Category");
  ...
  category = cat;
}
```

tepat setelah blok itu (sebelum fetch `toAccount`), tambahkan:

```ts
if (
  category !== undefined &&
  categoryId !== tx.categoryId &&
  (category.isArchived ?? false)
) {
  throw new ConvexError("This category is archived.");
}
```

Pola `!== tx.categoryId` mengikuti cek hidden yang sudah ada di bawahnya — edit tanpa ganti kategori tetap lolos.

- [ ] **Step 5: Guard di `budgets.ts` (2 titik)**

(a) Di `categoryOptions`, setelah `.collect()`, filter archived di JS. Ganti:

```ts
const categories = await ctx.db
  .query("categories")
  .withIndex("by_householdId", (q) =>
    q.eq("householdId", membership.householdId),
  )
  .filter((q) =>
    q.and(
      q.eq(q.field("type"), "expense"),
      q.neq(q.field("name"), RESERVED_CATEGORY_NAME),
    ),
  )
  .collect();

return categories.map((c) => ({ _id: c._id, name: c.name, hidden: c.hidden, icon: c.icon }));
```

menjadi:

```ts
const categories = await ctx.db
  .query("categories")
  .withIndex("by_householdId", (q) =>
    q.eq("householdId", membership.householdId),
  )
  .filter((q) =>
    q.and(
      q.eq(q.field("type"), "expense"),
      q.neq(q.field("name"), RESERVED_CATEGORY_NAME),
    ),
  )
  .collect();

return categories
  .filter((c) => !(c.isArchived ?? false))
  .map((c) => ({ _id: c._id, name: c.name, hidden: c.hidden, icon: c.icon }));
```

(b) Di `create`, setelah:

```ts
const category = await getScopedDoc(ctx, args.categoryId, membership.householdId, "Category");
```

tambahkan sebelum cek `category.type !== "expense"`:

```ts
if (category.isArchived ?? false) {
  throw new ConvexError("This category is archived.");
}
```

- [ ] **Step 6: Codegen + run tests sampai PASS**

Run: `npx convex codegen && npx tsc --noEmit`
Expected: PASS.
Run: `npm test -- tests/categories.archiveGuard.test.ts tests/categories.archive.test.ts`
Expected: PASS semua.

- [ ] **Step 7: Commit**

```bash
git add convex/transactions.ts convex/budgets.ts tests/categories.archiveGuard.test.ts
git commit -m "feat: reject archived categories in transaction and budget create/update"
```

---

### Task 3: `categories.tsx` display-only + section Archived + badge di `CategoryCard`

**Files:**
- Modify: `components/CategoryCard.tsx`
- Modify: `app/categories.tsx`

**Interfaces:**
- Consumes: `result.archived` dari Task 1 (`api.categories.list` sekarang `{ categories, archived, isOwner }`).
- Produces: list display-only + section Archived collapsed (UI only, tanpa interface baru). `category-form` (Task 4) menerima tap navigasi `router.push({ pathname: "/category-form", params: { id } })`.

- [ ] **Step 1: Tambah badge info di `CategoryCard`**

Di `components/CategoryCard.tsx`, tambah props optional:

```tsx
type Props = {
  name: string;
  type: CategoryType;
  icon?: string;
  hidden: boolean;
  archived?: boolean;
  onToggleVisibility?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};
```

Destructure `archived = false`, dan setelah badge Income/Expense (`</View>` penutup type badge, sebelum blok aksi), sisipkan:

```tsx
<View className="flex-row gap-1.5">
  {hidden ? (
    <View className="self-start rounded-full border border-border bg-background px-2.5 py-1 dark:border-border-dark dark:bg-background-dark">
      <Text className="text-[11px] font-semibold tracking-[0.08em] leading-3 text-text-secondary dark:text-text-secondary-dark">
        Hidden
      </Text>
    </View>
  ) : null}
  {archived ? (
    <View className="self-start rounded-full border border-border bg-background px-2.5 py-1 dark:border-border-dark dark:bg-background-dark">
      <Text className="text-[11px] font-semibold tracking-[0.08em] leading-3 text-text-secondary dark:text-text-secondary-dark">
        Archived
      </Text>
    </View>
  ) : null}
</View>
```

Struktur badge meniru type badge yang sudah ada (rounded-full border). Props aksi lama dibiarkan (optional) agar tak merusak consumer lain.

- [ ] **Step 2: Sederhanakan `categories.tsx` — hapus aksi inline**

Hapus dari `app/categories.tsx`:
- import `Alert`, `useCallback`, `useMutation`, `Id`, `useSnackbar`, `getConvexErrorMessage` yang hanya dipakai aksi inline (sisakan yang masih dipakai).
- `updateCategory` / `removeCategory` mutations, `handleToggleVisibility`, `handleDelete`.
- Oper `onToggleVisibility`/`onEdit`/`onDelete` ke `CategoryCard` di `renderItem`.

Ganti `renderItem` menjadi display-only dengan tap-to-edit untuk owner:

```tsx
renderItem={({ item }) =>
  isOwner ? (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/category-form",
          params: { id: item._id },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`Edit ${item.name}`}
    >
      <CategoryCard
        name={item.name}
        type={item.type}
        icon={item.icon}
        hidden={item.hidden}
        archived={(item as { isArchived?: boolean }).isArchived ?? false}
      />
    </Pressable>
  ) : (
    <CategoryCard
      name={item.name}
      type={item.type}
      icon={item.icon}
      hidden={item.hidden}
      archived={(item as { isArchived?: boolean }).isArchived ?? false}
    />
  )
}
```

Catatan: jika codegen Task 1 sudah jalan, tipe `isArchived` tersedia langsung — hapus cast `as` dan pakai `item.isArchived ?? false`.

- [ ] **Step 3: Tambah section Archived collapsed**

Setelah `const categories = result?.categories ?? null;` tambahkan:

```tsx
const archivedCategories = result?.archived ?? [];
const [archivedOpen, setArchivedOpen] = useState(false);
```

`useState` sudah diimport. Filter `visibleCategories` tetap untuk list utama; tambah:

```tsx
const visibleArchived = useMemo(() => {
  if (categories === null) return [];
  return filter === "all"
    ? archivedCategories
    : archivedCategories.filter((c) => c.type === filter);
}, [archivedCategories, categories, filter]);
```

Setelah penutup `/>` `FlatList` (sebelum `{isOwner ? (<Fab ...`), sisipkan:

```tsx
{visibleArchived.length > 0 ? (
  <View className="px-5 pb-4">
    <Pressable
      onPress={() => setArchivedOpen((v) => !v)}
      accessibilityRole="button"
      accessibilityLabel={archivedOpen ? "Collapse archived categories" : "Expand archived categories"}
      className="flex-row items-center gap-2 py-3"
    >
      <Feather name="archive" size={16} color={C.textSecondary} />
      <Text className="flex-1 text-sm font-semibold text-text-secondary dark:text-text-secondary-dark">
        Archived ({visibleArchived.length})
      </Text>
      <Feather
        name={archivedOpen ? "chevron-up" : "chevron-down"}
        size={16}
        color={C.textSecondary}
      />
    </Pressable>
    {archivedOpen
      ? visibleArchived.map((item) =>
          isOwner ? (
            <Pressable
              key={item._id}
              onPress={() =>
                router.push({
                  pathname: "/category-form",
                  params: { id: item._id },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.name}`}
            >
              <CategoryCard
                name={item.name}
                type={item.type}
                icon={item.icon}
                hidden={item.hidden}
                archived
              />
            </Pressable>
          ) : (
            <CategoryCard
              key={item._id}
              name={item.name}
              type={item.type}
              icon={item.icon}
              hidden={item.hidden}
              archived
            />
          ),
        )
      : null}
  </View>
) : null}
```

Reuse `Feather`, `router.push`, `C` (`useThemeColors`) yang sudah ada di file (tanpa komponen baru). Karena `FlatList` utama adalah scroll container, section Archived di bawahnya tetap terlihat saat scroll ke bawah (mirror penempatan yang sudah terbukti di tab Accounts; jika SectionList `flex-1` menelan footer, pindahkan ke `ListFooterComponent` seperti follow-up account archiving).

- [ ] **Step 4: Typecheck + lint file ini**

Run: `npx tsc --noEmit`
Expected: PASS (jika error `archived` tidak ada di tipe `list`, berarti codegen Task 1 belum dijalankan — jalankan `npx convex codegen` dulu).
Run: `npm run lint -- app/categories.tsx components/CategoryCard.tsx`
Expected: PASS, tanpa warning baru.

- [ ] **Step 5: Commit**

```bash
git add app/categories.tsx components/CategoryCard.tsx
git commit -m "feat: categories list display-only with archived section"
```

---

### Task 4: Danger zone Archive/Unarchive + Delete di `category-form`

**Files:**
- Modify: `app/category-form.tsx`

**Interfaces:**
- Consumes: `api.categories.archive`, `api.categories.unarchive`, `api.categories.remove` (remove sudah ada); `editingCategory`/`result` yang sudah ada di file.
- Produces: tidak ada interface baru.

- [ ] **Step 1: Tambah mutations + import `Alert`**

Setelah `const updateCategory = useMutation(api.categories.update);` tambahkan:

```tsx
const archiveCategory = useMutation(api.categories.archive);
const unarchiveCategory = useMutation(api.categories.unarchive);
const removeCategory = useMutation(api.categories.remove);
```

Tambahkan `Alert` ke import react-native (import saat ini: `Pressable, Switch, Text, View`):

```ts
import {
  Alert,
  Pressable,
  Switch,
  Text,
  View,
} from "react-native";
```

`show` (`useSnackbar`), `getConvexErrorMessage`, `hapticSuccess` sudah ada; tambah `hapticError` ke import `@/lib/haptics` (saat ini hanya `hapticSuccess`):

```ts
import { hapticError, hapticSuccess } from "@/lib/haptics";
```

- [ ] **Step 2: Lookup mencakup archived + derived state**

Ganti:

```tsx
const editingCategory = useMemo(() => {
  if (!isEdit || result?.categories === null) return undefined;
  return result?.categories?.find((c) => c._id === categoryId);
}, [isEdit, categoryId, result]);
```

menjadi (mirror `account-form.tsx:46-52`):

```tsx
const editingCategory = useMemo(() => {
  if (!isEdit || result?.categories === null) return undefined;
  return (
    result?.categories?.find((c) => c._id === categoryId) ??
    result?.archived?.find((c) => c._id === categoryId)
  );
}, [isEdit, categoryId, result]);
```

Setelah `const canSubmit = ...` tambahkan:

```tsx
const isArchived = editingCategory?.isArchived ?? false;
const canManage = isEdit && result !== undefined && result.isOwner === true;
```

Catatan: jika codegen Task 1 sudah jalan, tulis langsung `editingCategory?.isArchived ?? false` dan `result?.archived?.find(...)`. Jika codegen belum jalan (tipe belum ada), tulis sementara `((editingCategory as unknown as { isArchived?: boolean } | undefined)?.isArchived ?? false)` dan `(result as unknown as { archived?: typeof result.categories } | undefined)?.archived?.find(...)`, lalu jalankan `npx convex codegen` dan kembalikan ke bentuk langsung.

- [ ] **Step 3: Handler archive/unarchive + delete**

Setelah `handleSubmit`, tambahkan:

```tsx
const handleArchiveToggle = async () => {
  if (categoryId === undefined) return;
  const action = isArchived ? unarchiveCategory : archiveCategory;
  const verb = isArchived ? "Unarchive" : "Archive";
  Alert.alert(
    `${verb} Category`,
    isArchived
      ? `Unarchive "${name.trim()}"? It will return to the main list and pickers.`
      : `Archive "${name.trim()}"? New transactions and budgets cannot use it. History is kept.`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: verb,
        style: isArchived ? "default" : "destructive",
        onPress: () => {
          setIsLoading(true);
          action({ categoryId: categoryId as Id<"categories"> })
            .then(() => {
              show(isArchived ? "Category unarchived" : "Category archived");
              void hapticSuccess();
              markIntentional();
              router.back();
            })
            .catch((e: unknown) => {
              void hapticError();
              show(getConvexErrorMessage(e, `Failed to ${verb.toLowerCase()} category.`));
            })
            .finally(() => setIsLoading(false));
        },
      },
    ],
  );
};

const handleDelete = async () => {
  if (categoryId === undefined || !editingCategory) return;
  Alert.alert(
    "Delete Category",
    `Delete "${editingCategory.name}"? This cannot be undone.`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setIsLoading(true);
          removeCategory({ categoryId: categoryId as Id<"categories"> })
            .then(() => {
              show(`"${editingCategory.name}" deleted`);
              void hapticSuccess();
              markIntentional();
              router.back();
            })
            .catch((e: unknown) => {
              void hapticError();
              show(getConvexErrorMessage(e, "Failed to delete category."));
            })
            .finally(() => setIsLoading(false));
        },
      },
    ],
  );
};
```

`Id`, `markIntentional`, `router`, `show`, `getConvexErrorMessage` sudah ada di file.

- [ ] **Step 4: Render banner + danger zone**

(a) Banner — di dalam `KeyboardAwareScrollView`, tepat sebelum `<Input label="Category name" ...>`, sisipkan:

```tsx
{isEdit && isArchived ? (
  <View
    style={{ borderColor: C.border }}
    className="flex-row items-center gap-2 rounded-[12px] border bg-surface px-4 py-3 dark:bg-surface-dark"
  >
    <Feather name="archive" size={16} color={C.textSecondary} />
    <Text className="flex-1 text-sm text-text-secondary dark:text-text-secondary-dark">
      This category is archived — new transactions and budgets cannot use it.
    </Text>
  </View>
) : null}
```

`Feather` dan `C` (`useThemeColors`) sudah ada di file.

(b) Danger zone — setelah `<Button title={isEdit ? "Save Changes" : ...} ... />`, sisipkan:

```tsx
{canManage ? (
  <Button
    title={isArchived ? "Unarchive Category" : "Archive Category"}
    variant={isArchived ? "secondary" : "danger"}
    onPress={handleArchiveToggle}
    loading={isLoading}
    disabled={isLoading || isDirty}
  />
) : null}
{canManage ? (
  <Button
    title="Delete Category"
    variant="danger"
    onPress={handleDelete}
    loading={isLoading}
    disabled={isLoading || isDirty}
  />
) : null}
```

`disabled={isLoading || isDirty}` mengikuti follow-up account archiving (success path bypasses discard guard, jadi dirty archiving/deleting akan silently drop edits). Variant `danger`/`secondary` sudah dipakai di `account-form.tsx` untuk `components/Button` yang sama.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `npm run lint -- app/category-form.tsx`
Expected: PASS, tanpa warning baru.

- [ ] **Step 6: Commit**

```bash
git add app/category-form.tsx
git commit -m "feat: archive/unarchive/delete danger zone in category form"
```

---

### Task 5: Picker `transaction-form` + `budget-form` + filter Home/Search

**Files:**
- Modify: `app/transaction-form.tsx`
- Modify: `app/budget-form.tsx`
- Modify: `app/(tabs)/home.tsx`
- Modify: `app/search.tsx`

**Interfaces:**
- Consumes: `categoryResult.archived` dari Task 1 (untuk locked display saat edit); `editingTx.category` dari `api.transactions.get` (sudah mengembalikan `category` terhidrasi — mencakup doc archived).
- Produces: tidak ada interface baru.

- [ ] **Step 1: `categoryOptions` active-only + `addIfMissing` untuk edit**

Di `app/transaction-form.tsx`, ganti (lines 193-198):

```tsx
const categoryOptions = useMemo(() => {
  const categories = categoryResult?.categories ?? [];
  return categories
    .filter((c) => c.type === type)
    .map((c) => ({ id: c._id, label: c.name, icon: c.icon }));
}, [categoryResult, type]);
```

menjadi (mirror pola `accountOptions` lines 173-191):

```tsx
const categoryOptions = useMemo(() => {
  const categories = (categoryResult?.categories ?? []).filter((c) => c.type === type);
  const archivedOfType = (categoryResult?.archived ?? []).filter((c) => c.type === type);
  const archivedIds = new Set<string>(archivedOfType.map((a) => a._id));
  const options = categories.map((c) => ({
    id: c._id,
    label: c.name,
    icon: c.icon,
    archived: false,
  }));
  if (isEdit && editingTx?.categoryId) {
    const currentId = editingTx.categoryId as string;
    if (!options.some((o) => o.id === currentId)) {
      options.push({
        id: editingTx.categoryId,
        label: editingTx.category?.name ?? "Archived category",
        icon: editingTx.category?.icon,
        archived: archivedIds.has(currentId),
      });
    }
  }
  return options;
}, [categoryResult, type, isEdit, editingTx]);
```

Bentuk option berubah `{ id, label, icon }` → `{ id, label, icon, archived }`. Pemakaian yang ada (`categoryOptions.some(o => o.id)`, `categoryOptions.map(o => o.id)`, `options={categoryOptions}` ke `CategoryGrid`) hanya memakai `.id` — tetap kompatibel karena `CategoryOption` di `CategoryGrid` mengabaikan field ekstra (`archived` tidak dipakai grid, hanya untuk banner di Step 2).

- [ ] **Step 2: Perbaiki efek null-reset agar tidak menghapus pilihan archived saat edit**

Efek saat ini (lines 200-209) me-reset `categoryId` ke null jika tidak ada di `categoryOptions` — dengan Step 1 opsi archived sudah ditambahkan saat edit, efek ini aman untuk keep-same. Tetapi saat `categoryResult` masih loading (`undefined`) efek skip; tidak ada perubahan perilaku create (archived tidak ada di opsi → tidak bisa dipilih). Tambahkan guard edit agar reset tidak menendang locked value saat tipe berubah: ganti kondisi menjadi skip jika `isEdit` dan `categoryId` sama dengan `editingTx.categoryId`:

```tsx
useEffect(() => {
  if (categoryResult === undefined) return;
  if (
    type !== "transfer" &&
    categoryId !== null &&
    !categoryOptions.some((o) => o.id === categoryId)
  ) {
    if (isEdit && editingTx?.categoryId === categoryId) return;
    setCategoryId(null);
  }
}, [categoryResult, type, categoryId, categoryOptions, isEdit, editingTx]);
```

- [ ] **Step 3: Locked banner untuk kategori archived di transaction-form**

Setelah blok `{/* Category grid or Transfer dual */}` dan sebelum `{type !== "transfer" && categoryError ...}`, tidak perlu cabang baru di `CategoryGrid` — sisipkan banner tepat sebelum `<CategoryGrid ...>` di dalam `{type !== "transfer" ? (` cabang:

```tsx
{type !== "transfer" &&
categoryId !== null &&
(categoryOptions.find((o) => o.id === categoryId) as { archived?: boolean } | undefined)?.archived ? (
  <View
    style={{ borderColor: C.border }}
    className="mx-3 mb-2 flex-row items-center gap-2 rounded-[12px] border bg-surface px-4 py-3 dark:bg-surface-dark"
  >
    <Feather name="archive" size={16} color={C.textSecondary} />
    <Text className="flex-1 text-sm text-text-secondary dark:text-text-secondary-dark">
      This transaction uses an archived category. You can still edit and save, or pick an active category.
    </Text>
  </View>
) : null}
```

`Feather`, `C`, `View`, `Text` sudah ada di file ini.

- [ ] **Step 4: Badge Archived di `budget-form` edit mode**

Edit mode `budget-form.tsx` (lines 229-249) sudah menampilkan kategori read-only (`existingBudget.category.name`) — bekerja otomatis untuk archived karena `budgets.get` mengembalikan kategori apa adanya. Tambahkan badge setelah nama:

```tsx
{/* di dalam View row kategori edit mode, setelah <Text ...>{existingBudget?.category?.name ?? "Unknown"}</Text> */}
{(existingBudget?.category as { isArchived?: boolean } | undefined)?.isArchived === true ? (
  <View className="rounded-full border border-border bg-background px-2.5 py-1 dark:border-border-dark dark:bg-background-dark">
    <Text className="text-[11px] font-semibold tracking-[0.08em] leading-3 text-text-secondary dark:text-text-secondary-dark">
      Archived
    </Text>
  </View>
) : null}
```

Create mode (`SelectField` + `options` dari `api.budgets.categoryOptions`) otomatis hanya active setelah Task 2 — tanpa perubahan kode.

- [ ] **Step 5: Filter Home/Search mencakup archived**

Di `app/(tabs)/home.tsx` (line 191), ganti:

```tsx
const categoryOptions = useMemo(() => categoriesResult?.categories ?? [], [categoriesResult]);
```

menjadi:

```tsx
const categoryOptions = useMemo(
  () => [...(categoriesResult?.categories ?? []), ...(categoriesResult?.archived ?? [])],
  [categoriesResult],
);
```

Di `app/search.tsx` (line 85), ganti dengan baris yang sama persis (variabel `categoriesResult` tersedia di file itu):

```tsx
const categoryOptions = useMemo(
  () => [...(categoriesResult?.categories ?? []), ...(categoriesResult?.archived ?? [])],
  [categoriesResult],
);
```

Mirror follow-up account archiving (`accountOptions` di kedua file sudah `[...accounts, ...archived]`). Normalisasi seleksi (`normalizeSelection`) dan FilterSheet tidak berubah — ID archived yang sudah terpilih tidak dibuang.

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `npm run lint -- app/transaction-form.tsx app/budget-form.tsx "app/(tabs)/home.tsx" app/search.tsx`
Expected: PASS, tanpa warning baru.

- [ ] **Step 7: Commit**

```bash
git add app/transaction-form.tsx app/budget-form.tsx "app/(tabs)/home.tsx" app/search.tsx
git commit -m "feat: hide archived categories from pickers with locked legacy display"
```

---

### Task 6: Verifikasi penuh + checklist manual

**Files:** tidak ada perubahan kode (verifikasi saja).

- [ ] **Step 1: Full typecheck, lint, dan test suite**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `npm run lint`
Expected: PASS.
Run: `npm test`
Expected: PASS semua (termasuk 2 file baru + tidak ada regresi di `categories.*`, `transactions.*`, `budgets.*`, `accounts.*`).

- [ ] **Step 2: Checklist manual di Expo Go / dev-client**

1. Buat kategori + transaksi + budget → archive via category-form → kategori pindah ke section Archived (collapsed), hilang dari picker create maupun daftar pilih saat ganti kategori (nilai archived lama tampil terkunci saat edit), transaksi lama + report + budget tetap muncul.
2. Buka transaksi lama (kategori archived) → banner terkunci tampil → edit note/amount → sukses tersimpan.
3. Coba reassign transaksi ke kategori archived → Snackbar `"This category is archived."`.
4. Coba buat budget dengan kategori archived → ditolak `"This category is archived."`.
5. Unarchive → kategori kembali ke list utama + picker.
6. Sebagai member: kategori archived+hidden tidak terlihat; archived+visible terlihat di section Archived tapi tidak bisa dipakai untuk transaksi/budget baru.
7. List categories: tidak ada ikon eye/edit/trash; tap row (owner) masuk edit; hide/unhide + archive + delete semuanya di dalam form; delete kategori bertransaksi tetap ditolak dengan pesan lama.
8. Filter Home/Search: histori berkategori archived tetap bisa difilter.

- [ ] **Step 3: Update docs selebihnya (jika perlu)**

Jika ada bagian `docs/PRD.md` / `docs/ARCHITECTURE.md` yang menyebut delete-guarded categories, tambahkan satu baris tentang archiving (ikuti gaya commit docs yang ada). Tanpa perubahan perilaku lain.
