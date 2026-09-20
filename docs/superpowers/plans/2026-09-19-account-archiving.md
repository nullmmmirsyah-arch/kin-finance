# Account Archiving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner dapat meng-archive/unarchive akun via account-form; akun archived hilang dari list utama dan picker transaksi baru, tapi histori, saldo, dan report tetap utuh.

**Architecture:** Tambah field optional `isArchived` di tabel `accounts` (tanpa migrasi — dokumen lama terbaca sebagai active); `accounts.list` split menjadi `{ accounts, archived }`; mutation baru `archive`/`unarchive` (owner-only); guard di `transactions.create`/`update` menolak akun archived untuk pilihan baru; UI: section Archived di tab Accounts + danger zone di account-form + filter picker di transaction-form.

**Tech Stack:** Expo SDK 54, Convex (mutation/query + convex-test), React Native + NativeWind v4 (`className`), `useThemeColors`, `@expo/vector-icons/Feather`, vitest.

## Global Constraints

- Styling uses NativeWind `className`, never `StyleSheet.create`.
- Never use `style` callback functions on `Pressable` (e.g. `style={({ pressed }) => [...]}`) — breaks NativeWind v4; use `useState` pressed + static `style` if pressed styling is needed.
- Colors via `useThemeColors()` from `@/constants/theme`, never hardcoded; icons `@expo/vector-icons/Feather`.
- After any change to `convex/*.ts`, run `npx convex codegen` first, then `npx tsc --noEmit`.
- Install deps only via `npx expo install <pkg>` (no new deps expected in this plan).
- Every `convex/*.ts` handler requires sign-in handling via `findUserAndMembership`/`getUserAndMembership` and throws `ConvexError` on operational errors.
- Path alias `@/*` maps to repo root.
- Verify with `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest — required because Tasks 1-2 touch Convex functions).
- Only `owner` may archive/unarchive (via `requireOwner` from `./helpers`); member attempts throw `ConvexError("You are not the owner of this household.")`.
- Backend error strings are contracts — use exactly `"This account is archived."` for the new guard; do not alter existing messages in `remove`/`update`.
- Scope is accounts only — do not touch `categories.ts`, `budgets.ts`, `periodBalances.ts`, or transaction analytics/queries.

---

## File Structure

- `convex/schema.ts` (modify, tabel `accounts` ~line 46-64): satu tanggung jawab — tambah `isArchived: v.optional(v.boolean())` setelah `hidden`. Optional agar dokumen lama tanpa field tetap valid (terbaca sebagai active via `?? false`).
- `convex/accounts.ts` (modify): satu tanggung jawab — split `list` menjadi `{ accounts, archived }` + mutation baru `archive`/`unarchive` (owner-only, idempoten). `remove`/`verify`/`reconcile` tidak berubah.
- `tests/accounts.archive.test.ts` (new): convex-test untuk archive/unarchive/list-split/remove-interaction, mengikuti pola seed `tests/accounts.reconcile.test.ts:19-92` (`convexTest(schema, import.meta.glob(...))`, `t.withIdentity`, insert household+users+memberships langsung via `t.run`).
- `convex/transactions.ts` (modify): satu tanggung jawab — guard archived di `create` (2 titik: `account` ~line 78, `toAccount` ~line 93) dan `update` (2 titik: `account`/`toAccount` baru vs `tx` lama ~lines 255-270). Tanpa perubahan balance logic / recompute.
- `tests/transactions.archivedGuard.test.ts` (new): convex-test untuk guard create/update + aturan edit (keep-account boleh, reassign-to-archived ditolak, archived→active boleh).
- `app/(tabs)/accounts.tsx` (modify): satu tanggung jawab — section Archived collapsed di bawah `SectionList` (~line 914), reuse komponen `VaultCard` yang sama dengan `renderItem` (~lines 900-913), navigasi `onEdit` ke `/account-form?id=...` yang sudah ada.
- `app/account-form.tsx` (modify): satu tanggung jawab — danger zone Archive/Unarchive di bawah tombol Save (edit mode + owner only), pola `Alert` + `show(getConvexErrorMessage(...))` + haptic mengikuti `handleSubmit` yang ada (~lines 89-144), plus banner saat akun archived.
- `app/transaction-form.tsx` (modify): satu tanggung jawab — picker create hanya active; edit transaksi lama tampilkan akun archived sebagai opsi terkunci (perluas `addIfMissing` di `accountOptions` ~lines 173-189) + badge Archived di `AccountPill`/`TransferDual`.

---

### Task 1: Schema + `archive`/`unarchive` + `list` split + tests

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/accounts.ts`
- Test: `tests/accounts.archive.test.ts`

**Interfaces:**
- Consumes: `getUserAndMembership`, `requireOwner`, `getScopedDoc` from `./helpers`; `findUserAndMembership` (sudah dipakai `list`).
- Produces: `accounts.list → { accounts: Doc<"accounts">[] | null, archived: Doc<"accounts">[] | null, isOwner: boolean }`; `accounts.archive({ accountId }) → Doc<"accounts"> | null`; `accounts.unarchive({ accountId }) → Doc<"accounts"> | null`. Semua consumer UI (Task 3-5) memakai bentuk return ini.

- [ ] **Step 1: Tambah field schema**

Di `convex/schema.ts`, tabel `accounts`, setelah `hidden: v.boolean(),` tambahkan:

```ts
isArchived: v.optional(v.boolean()),
```

- [ ] **Step 2: Regenerate + typecheck**

Run: `npx convex codegen`
Run: `npx tsc --noEmit`
Expected: PASS (field optional → tidak ada error di dokumen lama).

- [ ] **Step 3: Tulis failing test untuk archive/unarchive/list**

Buat `tests/accounts.archive.test.ts`:

```ts
/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|archive-test";
const MEMBER_TOKEN = "member|archive-test";

describe("accounts archive/unarchive", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  });

  async function seed() {
    return await t.run(async (ctx) => {
      const householdId = await ctx.db.insert("households", {
        name: "Archive HH",
        createdAt: 1,
        updatedAt: 1,
      });
      const ownerId = await ctx.db.insert("users", {
        tokenIdentifier: OWNER_TOKEN,
        clerkUserId: "clerk-owner-archive",
      });
      const memberId = await ctx.db.insert("users", {
        tokenIdentifier: MEMBER_TOKEN,
        clerkUserId: "clerk-member-archive",
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
      return { householdId, ownerId, memberId, cashId };
    });
  }

  it("owner archives an account; list splits active/archived", async () => {
    const { cashId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.accounts.archive, { accountId: cashId as any });
    const result = await owner.query(api.accounts.list, {});
    expect(result.accounts!.map((a) => a._id)).not.toContain(cashId);
    expect(result.archived!.map((a) => a._id)).toContain(cashId);
  });

  it("member cannot archive", async () => {
    const { cashId } = await seed();
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    await expect(
      member.mutation(api.accounts.archive, { accountId: cashId as any }),
    ).rejects.toThrow("You are not the owner of this household.");
  });

  it("unarchive restores to active list", async () => {
    const { cashId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.accounts.archive, { accountId: cashId as any });
    await owner.mutation(api.accounts.unarchive, { accountId: cashId as any });
    const result = await owner.query(api.accounts.list, {});
    expect(result.accounts!.map((a) => a._id)).toContain(cashId);
    expect(result.archived).toHaveLength(0);
  });

  it("legacy doc without isArchived reads as active", async () => {
    await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const result = await owner.query(api.accounts.list, {});
    expect(result.accounts!.length).toBe(1);
    expect(result.archived).toHaveLength(0);
  });

  it("member does not see archived+hidden accounts", async () => {
    const { cashId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.accounts.update, {
      accountId: cashId as any,
      hidden: true,
    });
    await owner.mutation(api.accounts.archive, { accountId: cashId as any });
    const member = t.withIdentity({ tokenIdentifier: MEMBER_TOKEN, subject: "member" });
    const result = await member.query(api.accounts.list, {});
    expect(result.accounts).toHaveLength(0);
    expect(result.archived).toHaveLength(0);
  });

  it("remove stays blocked for archived account with transactions", async () => {
    const { householdId, cashId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const foodId = await t.run(async (ctx) =>
      ctx.db.insert("categories", {
        householdId,
        name: "Food",
        type: "expense",
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
    await owner.mutation(api.accounts.archive, { accountId: cashId as any });
    await expect(
      owner.mutation(api.accounts.remove, { accountId: cashId as any }),
    ).rejects.toThrow("Cannot delete account");
  });

  it("archived account without transactions can be deleted", async () => {
    const { cashId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.accounts.archive, { accountId: cashId as any });
    await owner.mutation(api.accounts.remove, { accountId: cashId as any });
    const result = await owner.query(api.accounts.list, {});
    expect(result.accounts).toHaveLength(0);
    expect(result.archived).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Run test, pastikan FAIL (mutation belum ada)**

Run: `npm test -- tests/accounts.archive.test.ts`
Expected: FAIL dengan pesan tidak ada fungsi `archive` (atau `archived` undefined di hasil `list`).

- [ ] **Step 5: Implementasi minimal di `convex/accounts.ts`**

(a) Di `list` (~lines 28-37), ganti:

```ts
const accounts = isOwner ? all : all.filter((account) => !account.hidden);
return { accounts, isOwner };
```

menjadi:

```ts
const active = all.filter((a) => !(a.isArchived ?? false));
const archivedAll = all.filter((a) => a.isArchived ?? false);
const accounts = isOwner ? active : active.filter((account) => !account.hidden);
const archived = isOwner ? archivedAll : archivedAll.filter((account) => !account.hidden);
return { accounts, archived, isOwner };
```

(b) Setelah mutation `update` (~line 204, sebelum `remove`), tambahkan:

```ts
export const archive = mutation({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);
    requireOwner(membership);

    await getScopedDoc(ctx, args.accountId, membership.householdId, "Account");

    await ctx.db.patch(args.accountId, {
      isArchived: true,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(args.accountId);
  },
});

export const unarchive = mutation({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    const { membership } = await getUserAndMembership(ctx);
    requireOwner(membership);

    await getScopedDoc(ctx, args.accountId, membership.householdId, "Account");

    await ctx.db.patch(args.accountId, {
      isArchived: false,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(args.accountId);
  },
});
```

`remove`, `verify`, `reconcile` tidak diubah.

- [ ] **Step 6: Codegen + run test sampai PASS**

Run: `npx convex codegen && npx tsc --noEmit`
Expected: PASS.
Run: `npm test -- tests/accounts.archive.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 7: Commit**

```bash
git add convex/schema.ts convex/accounts.ts tests/accounts.archive.test.ts
git commit -m "feat: account archive/unarchive with list split"
```

---

### Task 2: Guard archived di `transactions.create`/`update` + tests

**Files:**
- Modify: `convex/transactions.ts`
- Test: `tests/transactions.archivedGuard.test.ts`

**Interfaces:**
- Consumes: return `accounts.archive` dari Task 1 (untuk setup test); `Doc<"accounts">.isArchived` (optional boolean).
- Produces: tidak ada interface baru — hanya `ConvexError("This account is archived.")` baru pada kondisi di bawah; semua UI mengandalkan pesan ini via `getConvexErrorMessage`.

- [ ] **Step 1: Tulis failing test**

Buat `tests/transactions.archivedGuard.test.ts`:

```ts
/// <reference types="vite/client" />

import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const OWNER_TOKEN = "owner|archguard-test";

describe("transactions archived-account guard", () => {
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
        clerkUserId: "clerk-owner-guard",
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
      const bankId = await ctx.db.insert("accounts", {
        householdId,
        name: "Bank",
        type: "asset",
        subType: "bank",
        balance: 0,
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      });
      return { householdId, ownerId, foodId, cashId, bankId };
    });
  }

  it("create expense on archived account is rejected", async () => {
    const { cashId, foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.accounts.archive, { accountId: cashId as any });
    await expect(
      owner.mutation(api.transactions.create, {
        accountId: cashId as any,
        categoryId: foodId as any,
        amount: -500,
        type: "expense",
        date: Date.now(),
      }),
    ).rejects.toThrow("This account is archived.");
  });

  it("create transfer to archived account is rejected", async () => {
    const { cashId, bankId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    await owner.mutation(api.accounts.archive, { accountId: bankId as any });
    await expect(
      owner.mutation(api.transactions.create, {
        accountId: cashId as any,
        toAccountId: bankId as any,
        amount: 100,
        type: "transfer",
        date: Date.now(),
      }),
    ).rejects.toThrow("This account is archived.");
  });

  it("update keeping the archived account is allowed", async () => {
    const { cashId, foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const txId = await owner.mutation(api.transactions.create, {
      accountId: cashId as any,
      categoryId: foodId as any,
      amount: -500,
      type: "expense",
      date: Date.now(),
    });
    await owner.mutation(api.accounts.archive, { accountId: cashId as any });
    const updated = await owner.mutation(api.transactions.update, {
      transactionId: txId as any,
      note: "fixed note",
    });
    expect(updated!.note).toBe("fixed note");
  });

  it("update reassigning to an archived account is rejected", async () => {
    const { cashId, bankId, foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const txId = await owner.mutation(api.transactions.create, {
      accountId: cashId as any,
      categoryId: foodId as any,
      amount: -500,
      type: "expense",
      date: Date.now(),
    });
    await owner.mutation(api.accounts.archive, { accountId: bankId as any });
    await expect(
      owner.mutation(api.transactions.update, {
        transactionId: txId as any,
        accountId: bankId as any,
      }),
    ).rejects.toThrow("This account is archived.");
  });

  it("update reassigning archived -> active is allowed and fixes balances", async () => {
    const { cashId, bankId, foodId } = await seed();
    const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
    const txId = await owner.mutation(api.transactions.create, {
      accountId: cashId as any,
      categoryId: foodId as any,
      amount: -500,
      type: "expense",
      date: Date.now(),
    });
    await owner.mutation(api.accounts.archive, { accountId: cashId as any });
    await owner.mutation(api.transactions.update, {
      transactionId: txId as any,
      accountId: bankId as any,
    });
    const list = await owner.query(api.accounts.list, {});
    // Cash archived → ada di `archived` (bukan `accounts`); Bank active.
    const cash = list.archived!.find((a) => a.name === "Cash")!;
    const bank = list.accounts!.find((a) => a.name === "Bank")!;
    expect(bank.balance).toBe(-500);
    expect(cash.balance).toBe(0);
  });
});

- [ ] **Step 2: Run test, pastikan FAIL**

Run: `npm test -- tests/transactions.archivedGuard.test.ts`
Expected: FAIL — 2 test pertama (create guards) gagal karena guard belum ada (mutasi sukses padahal harus throw).

- [ ] **Step 3: Guard di `create` (2 titik)**

(a) Setelah `const account = await getScopedDoc(ctx, args.accountId, ...)` (~line 78), tambahkan:

```ts
if (account.isArchived ?? false) {
  throw new ConvexError("This account is archived.");
}
```

(b) Di cabang transfer, setelah `const to = await getScopedDoc(ctx, args.toAccountId, ...)` (~line 93), tambahkan:

```ts
if (to.isArchived ?? false) {
  throw new ConvexError("This account is archived.");
}
```

- [ ] **Step 4: Guard di `update` (2 titik)**

Setelah blok fetch `toAccount` (~lines 266-270, sebelum cek `membership.role !== "owner" && tx.categoryId`), tambahkan:

```ts
if (accountId !== tx.accountId && (account.isArchived ?? false)) {
  throw new ConvexError("This account is archived.");
}
if (
  toAccount !== undefined &&
  toAccountId !== tx.toAccountId &&
  (toAccount.isArchived ?? false)
) {
  throw new ConvexError("This account is archived.");
}
```

Pola `!== tx.*` mengikuti cek hidden yang sudah ada tepat di bawahnya (~lines 279-289) — edit tanpa ganti akun tetap lolos.

- [ ] **Step 5: Codegen + run tests sampai PASS**

Run: `npx convex codegen && npx tsc --noEmit`
Expected: PASS.
Run: `npm test -- tests/transactions.archivedGuard.test.ts tests/accounts.archive.test.ts`
Expected: PASS semua.

- [ ] **Step 6: Commit**

```bash
git add convex/transactions.ts tests/transactions.archivedGuard.test.ts
git commit -m "feat: reject archived accounts in transaction create/update"
```

---

### Task 3: Section Archived di tab Accounts

**Files:**
- Modify: `app/(tabs)/accounts.tsx`

**Interfaces:**
- Consumes: `result.archived` dari Task 1 (`api.accounts.list` sekarang `{ accounts, archived, isOwner }`).
- Produces: section Archived collapsed (UI only, tanpa interface baru).

- [ ] **Step 1: Ambil array archived + state collapsed**

Di `Accounts()` setelah `const accounts = result?.accounts ?? null;` (~line 611), tambahkan:

```tsx
const archivedAccounts = result?.archived ?? [];
const [archivedOpen, setArchivedOpen] = useState(false);
```

`useState` sudah diimport (~line 1).

- [ ] **Step 2: Render section Archived di bawah SectionList**

Setelah penutup `/>` `SectionList` (~line 914, sebelum `{isOwner ? (<Fab ...` ~line 916)), sisipkan:

```tsx
{archivedAccounts.length > 0 ? (
  <View className="px-5 pb-4">
    <Pressable
      onPress={() => setArchivedOpen((v) => !v)}
      accessibilityRole="button"
      accessibilityLabel={archivedOpen ? "Collapse archived accounts" : "Expand archived accounts"}
      className="flex-row items-center gap-2 py-3"
    >
      <Feather name="archive" size={16} color={C.textSecondary} />
      <Text className="flex-1 text-sm font-semibold text-text-secondary dark:text-text-secondary-dark">
        Archived ({archivedAccounts.length})
      </Text>
      <Feather
        name={archivedOpen ? "chevron-up" : "chevron-down"}
        size={16}
        color={C.textSecondary}
      />
    </Pressable>
    {archivedOpen
      ? archivedAccounts.map((item, index) => (
          <VaultCard
            key={item._id}
            item={item as any}
            index={index}
            isOwner={isOwner}
            onEdit={() =>
              router.push({
                pathname: "/account-form",
                params: { id: item._id },
              })
            }
            onDelete={() => handleDelete(item as any)}
          />
        ))
      : null}
  </View>
) : null}
```

Reuse `VaultCard`, `Feather`, `router.push`, `handleDelete` yang sudah ada di file (tanpa komponen baru). Saldo archived otomatis tidak masuk total utama karena `accounts` dari backend kini hanya active (`visibleAccounts`/`sections` ~lines 614-633 tidak berubah).

- [ ] **Step 3: Typecheck + lint file ini**

Run: `npx tsc --noEmit`
Expected: PASS (jika error `archived` tidak ada di tipe `list`, berarti codegen Task 1 belum dijalankan — jalankan `npx convex codegen` dulu).
Run: `npm run lint -- app/\(tabs\)/accounts.tsx`
Expected: PASS, tanpa warning baru.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/accounts.tsx"
git commit -m "feat: archived accounts section in accounts tab"
```

---

### Task 4: Danger zone Archive/Unarchive di account-form

**Files:**
- Modify: `app/account-form.tsx`

**Interfaces:**
- Consumes: `api.accounts.archive`, `api.accounts.unarchive` dari Task 1; `editingAccount`/`result` yang sudah ada di file.
- Produces: tidak ada interface baru.

- [ ] **Step 1: Tambah mutations + derived state**

Setelah `const updateAccount = useMutation(api.accounts.update);` (~line 31), tambahkan:

```tsx
const archiveAccount = useMutation(api.accounts.archive);
const unarchiveAccount = useMutation(api.accounts.unarchive);
```

Setelah `const canSubmit = ...` (~lines 62-66), tambahkan:

```tsx
const isArchived = (editingAccount as { isArchived?: boolean } | undefined)?.isArchived ?? false;
const canArchive = isEdit && result !== undefined && (result as { isOwner?: boolean }).isOwner === true;
```

Catatan: jika codegen Task 1 sudah jalan, tipe `isArchived`/`isOwner` tersedia langsung — hapus cast `as` dan pakai `editingAccount.isArchived ?? false` serta `result.isOwner`.

- [ ] **Step 2: Handler archive/unarchive**

Setelah `handleSubmit` (~line 144), tambahkan:

```tsx
const handleArchiveToggle = async () => {
  if (accountId === undefined) return;
  const action = isArchived ? unarchiveAccount : archiveAccount;
  const verb = isArchived ? "Unarchive" : "Archive";
  Alert.alert(
    `${verb} Account`,
    isArchived
      ? `Unarchive "${name.trim()}"? It will return to the main list and pickers.`
      : `Archive "${name.trim()}"? New transactions cannot use it. History is kept.`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: verb,
        style: isArchived ? "default" : "destructive",
        onPress: () => {
          setIsLoading(true);
          action({ accountId: accountId as Id<"accounts"> })
            .then(() => {
              show(isArchived ? "Account unarchived" : "Account archived");
              void hapticSuccess();
              markIntentional();
              router.back();
            })
            .catch((e: unknown) => {
              void hapticError();
              show(getConvexErrorMessage(e, `Failed to ${verb.toLowerCase()} account.`));
            })
            .finally(() => setIsLoading(false));
        },
      },
    ],
  );
};
```

Import yang dipakai (`Alert`, `show`, `getConvexErrorMessage`, `hapticError`, `hapticSuccess`, `markIntentional`, `router`, `Id`) — `Alert` belum diimport di file ini (import saat ini ~line 4: `Pressable, Switch, Text, View` dari react-native). Tambahkan `Alert` ke import itu. Sisanya (`hapticError`, `hapticSuccess`, `hapticWarning` ~line 20; `getConvexErrorMessage` ~line 19; `Id` ~line 9) sudah ada.

- [ ] **Step 3: Render danger zone + banner**

(a) Banner — di dalam `KeyboardAwareScrollView`, tepat sebelum `<Input label="Account name" ...>` (~line 186), sisipkan:

```tsx
{isEdit && isArchived ? (
  <View
    style={{ borderColor: C.border }}
    className="flex-row items-center gap-2 rounded-[12px] border bg-surface px-4 py-3 dark:bg-surface-dark"
  >
    <Feather name="archive" size={16} color={C.textSecondary} />
    <Text className="flex-1 text-sm text-text-secondary dark:text-text-secondary-dark">
      This account is archived — new transactions cannot use it.
    </Text>
  </View>
) : null}
```

`Feather` dan `C` (`useThemeColors`) sudah ada di file (~lines 7, 32).

(b) Danger zone — setelah `<Button title={isEdit ? "Save Changes" : ...} ... />` (~lines 267-272), sisipkan:

```tsx
{canArchive ? (
  <Button
    title={isArchived ? "Unarchive Account" : "Archive Account"}
    variant={isArchived ? "secondary" : "danger"}
    onPress={handleArchiveToggle}
    loading={isLoading}
    disabled={isLoading}
  />
) : null}
```

Variant mengikuti tombol Delete di `transaction-form.tsx:997-1003` (`variant="danger"` ada; `"secondary"` dipakai di date-picker Done ~line 1106 — keduanya valid untuk `components/Button`).

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `npm run lint -- app/account-form.tsx`
Expected: PASS, tanpa warning baru.

- [ ] **Step 5: Commit**

```bash
git add app/account-form.tsx
git commit -m "feat: archive/unarchive danger zone in account form"
```

---

### Task 5: Picker transaction-form — hanya active + locked display

**Files:**
- Modify: `app/transaction-form.tsx`

**Interfaces:**
- Consumes: `accountResult.accounts` (kini active-only dari Task 1) + `accountResult.archived` (untuk label terkunci saat edit).
- Produces: tidak ada interface baru.

- [ ] **Step 1: Perluas `addIfMissing` dengan flag archived**

Di `accountOptions` (~lines 173-189), ubah `addIfMissing` agar menandai opsi yang berasal dari transaksi lama (berpotensi archived):

```tsx
const accountOptions = useMemo(() => {
  const accounts = accountResult?.accounts ?? [];
  const archived = accountResult?.archived ?? [];
  const archivedIds = new Set(archived.map((a) => a._id));
  const options = accounts.map((a) => ({ id: a._id, label: a.name, archived: false }));
  const addIfMissing = (
    id: Id<"accounts"> | undefined,
    name: string | undefined,
  ) => {
    if (id && name && !options.some((o) => o.id === id)) {
      options.push({ id, label: name, archived: archivedIds.has(id as string) });
    }
  };
  if (isEdit && editingTx) {
    addIfMissing(editingTx.accountId, editingTx.account?.name);
    addIfMissing(editingTx.toAccountId, editingTx.toAccount?.name);
  }
  return options;
}, [accountResult, isEdit, editingTx]);
```

Bentuk option berubah `{ id, label }` → `{ id, label, archived }`. Semua pemakaian `accountOptions` yang ada (`isVisible` ~line 157, default select ~lines 240-254, `accountOptions[0]?.id`) hanya memakai `.id`/`.some(o => o.id)` — tetap kompatibel.

- [ ] **Step 2: Tandai opsi terkunci di sheet + pill**

(a) Di `renderItem` sheet akun (~lines 1038-1064), setelah `<Text ...>{item.label}</Text>`, tambahkan badge untuk opsi archived:

```tsx
{(item as { archived?: boolean }).archived ? (
  <Text className="text-xs" style={{ color: C.textSecondary }}>
    Archived
  </Text>
) : null}
```

(b) Di `AccountPill` expense/income (~lines 815-822) dan `TransferDual` (~lines 788-800): tidak ada perubahan struktur — backend menolak pilihan archived saat submit (`canSubmit` tetap, error via Snackbar `getConvexErrorMessage` di `doCreate` ~lines 471-479 menampilkan `"This account is archived."`). Jika `selectedAccount`/`toAcc` (dari `accountResult.accounts.find`) null karena archived, `account` prop yang `null` sudah dirender sebagai "Select account" oleh komponen yang ada — tidak perlu cabang baru.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `npm run lint -- app/transaction-form.tsx`
Expected: PASS, tanpa warning baru.

- [ ] **Step 4: Commit**

```bash
git add app/transaction-form.tsx
git commit -m "feat: hide archived accounts from transaction pickers"
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
Expected: PASS semua (termasuk 2 file baru + tidak ada regresi di `accounts.*`, `transactions.*`, `budgets.*`, `periodBalances`).

- [ ] **Step 2: Checklist manual di Expo Go / dev-client**

1. Buat akun + transaksi → archive via account-form → akun pindah ke section Archived (collapsed), hilang dari picker create, transaksi lama + saldo + report tetap muncul.
2. Edit transaksi lama di akun archived (ubah note/amount) → sukses, saldo section Archived terkoreksi.
3. Coba reassign transaksi ke akun archived → Snackbar `"This account is archived."`.
4. Unarchive → akun kembali ke list utama + picker.
5. Sebagai member: akun archived+hidden tidak terlihat; archived+visible terlihat di section Archived tapi tidak bisa dipakai untuk transaksi baru.
6. Delete akun archived yang masih punya transaksi → tetap ditolak dengan pesan lama.

- [ ] **Step 3: Update docs selebihnya (jika perlu)**

Jika ada bagian `docs/PRD.md` / `docs/ARCHITECTURE.md` yang menyebut delete-guarded accounts, tambahkan satu baris tentang archiving (ikuti gaya commit docs yang ada, mis. `b29595a docs: ...`). Tanpa perubahan perilaku lain.
