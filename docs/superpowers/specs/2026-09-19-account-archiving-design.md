# Account Archiving — Design

> Date: 2026-09-19
> Status: Approved
> Source: user request "implementasikan archiving untuk accounts terlebih dahulu" (lanjutan dari analisis delete category/account yang diblokir saat ada transaksi eksisting)

---

## Overview

Akun yang sudah punya transaksi tidak bisa dihapus (`accounts.remove` menolak selama ada referensi di `transactions.by_accountId` / `by_toAccountId`). Archiving memberi jalan keluar tanpa menghapus data: akun archived hilang dari list utama dan picker transaksi baru, tapi seluruh histori transaksi, saldo, dan report tetap utuh. Archive bersifat reversible (unarchive kapan saja). Delete fisik tetap diblokir walau akun sudah archived.

Scope: **accounts saja**. Categories, budgets, dan household archiving tetap out-of-scope (PRD Appendix A).

---

## Keputusan brainstorming

1. **Perilaku archive:** sembunyi dari picker + list utama, histori utuh (bukan sembunyi total, bukan badge saja).
2. **Unarchive & delete:** reversible; delete fisik tetap `throw` selama ada transaksi — archive bukan jalan pintas hapus data.
3. **Visibilitas:** section Archived khusus di tab Accounts; member tetap ikut aturan `hidden` lama (archived + hidden → tak terlihat member; archived + visible → terlihat member di section Archived).
4. **Storage (Opsi A):** `isArchived` boolean — YAGNI atas `archivedAt` timestamp (Opsi B) dan `status` enum (Opsi C).
5. **Aksi via `account-form`** (danger zone, edit mode, owner-only) — bukan swipe/long-press di list.
6. **Edit transaksi di akun archived:** tetap bisa (batasan § Edit rules).

---

## Backend

### Schema (`convex/schema.ts`, tabel `accounts`)

Tambah field optional agar tanpa migrasi (dokumen lama tanpa field = active):

```typescript
isArchived: v.optional(v.boolean()),
```

Semua logika baca memakai `(a.isArchived ?? false)`. Tidak ada index baru (`by_householdId` yang ada sudah cukup; archive adalah filter client-side setelah collect, sama seperti pola `hidden`).

### `accounts.list` (`convex/accounts.ts`)

Bentuk return berubah dari `{ accounts, isOwner }` menjadi `{ accounts, archived, isOwner }`:

- `accounts` = hanya active (`!isArchived`), lalu filter `hidden` untuk member (tidak berubah).
- `archived` = hanya archived, lalu filter `hidden` untuk member (aturan sama: member tak lihat yang `hidden === true`).
- Owner melihat semua di kedua array.

### Mutation baru `accounts.archive` / `accounts.unarchive`

```typescript
archive: { accountId: Id<"accounts"> }
unarchive: { accountId: Id<"accounts"> }
```

Behavior (keduanya):

- `getUserAndMembership` + `requireOwner` (member ditolak, konsisten dengan `update`/`remove`).
- `getScopedDoc(ctx, accountId, householdId, "Account")` untuk scoping household.
- `archive` boleh kapan saja — **walau ada transaksi** (inilah bedanya dengan `remove`). Idempoten: jika sudah archived, tetap sukses.
- `unarchive` selalu boleh. Idempoten.
- Patch `{ isArchived: true/false, updatedAt: Date.now() }`.

`accounts.remove` **tidak berubah**: tetap menolak selama ada transaksi (`by_accountId` / `by_toAccountId`), walau akun sudah archived.

### Guard transaksi (`convex/transactions.ts`, `create` + `update`)

- `create`: setelah `getScopedDoc` account (+ `toAccount` untuk transfer), tolak jika `(account.isArchived ?? false)` → `ConvexError("This account is archived.")`. Berlaku owner + member (berbeda dengan `hidden` yang longgar untuk owner). Sama untuk `toAccountId`.
- `update`: tolak hanya jika **pilihan baru** menyentuh akun archived:
  - `accountId !== tx.accountId && newAccount.isArchived` → tolak.
  - `toAccountId !== tx.toAccountId && newToAccount.isArchived` → tolak.
  - Edit yang tidak mengganti akun (amount/note/date/category) tetap boleh walau akun archived.
- Pesan error tunggal: `"This account is archived."` (tanpa menyebut from/to agar stabil untuk UI Snackbar via `getConvexErrorMessage`).

### Yang eksplisit TIDAK berubah (histori utuh)

- `accounts.verify` / `reconcile` (`computeExpectedBalances`): query `by_householdId` tanpa filter archive — saldo archived tetap terverifikasi.
- `transactions.list/summary/recent/get`, `cashflow`, `spendingByCategory`, `periodBalances.recompute`: tanpa filter archive — report dan histori mencakup transaksi archived.
- `budgets.*`: tidak menyentuh akun sama sekali.

### Alternatif yang ditolak

- **B: `archivedAt?: number`** — informatif (waktu + sort) tapi semua baca jadi optional-handling dengan cabang ekstra; upgrade dari Opsi A ke B kelak hanya 1 baris (`true → Date.now()`), jadi ditunda.
- **C: `status: "active" | "archived"`** — future-proof untuk `closed`/`frozen` tapi churn terbesar di semua query/validasi/UI untuk manfaat yang belum dibutuhkan.

---

## UI

### Tab Accounts (`app/(tabs)/accounts.tsx`)

- Section **Archived** terpisah di bawah section ASSET/DEBT, collapsed by default, display-only. Saldo akun archived **tidak** masuk ke total/subtotal utama ASSET/DEBT; section Archived menampilkan subtotalnya sendiri.
- Row archived: nama + badge/icon archive (`Feather "archive"`), tap → navigasi ke `account-form?id=...` (tempat aksi unarchive).
- Member: section Archived hanya berisi akun archived yang `hidden === false`.
- Tidak ada swipe/long-press archive di list (per revisi §2).

### `app/account-form.tsx` — edit mode, owner-only

- Danger zone di bawah tombol Save (hanya saat `isEdit && result.isOwner`):
  - Jika active → tombol `danger` "Archive Account" → `Alert` konfirmasi ("Archive ...? New transactions cannot use it. History is kept.") → `archive({ accountId })` → snackbar `"... archived"` + `hapticSuccess` + `router.back()`.
  - Jika archived → tombol `secondary` "Unarchive Account" → konfirmasi ringan → `unarchive(...)` → snackbar + back.
- Error via `show(getConvexErrorMessage(e, ...))` + `hapticError` (pola yang sudah ada di file ini).
- Banner kecil di atas form saat mengedit akun archived ("This account is archived — new transactions cannot use it.") agar owner sadar konteks.

### `app/transaction-form.tsx` (create vs edit)

- **Create:** `accountOptions` hanya dari `accounts` (active). Tidak ada perubahan query selain membaca field baru dari `list`.
- **Edit** transaksi lama yang akunnya ter-archive setelah transaksi dibuat: tampilkan akun lama sebagai opsi terkunci/read-only (label + badge Archived, mengikuti pola `addIfMissing` yang sudah ada di `accountOptions`), tidak bisa dipilih untuk transaksi lain; user wajib pilih akun active jika ingin ganti (guard backend menegakkan).
- Badge Archived di dekat `AccountPill` / `TransferDual` saat salah satu sisi archived.

---

## Edit rules (transaksi di akun archived)

| Aksi | Boleh? |
|---|---|
| Ubah amount/note/date/category, akun tidak diganti | ✅ owner + member |
| Reassign keluar archived → active | ✅ owner + member (menjadi jalan manual keluar dari archive) |
| Reassign ke archived (dari akun mana pun) | ❌ ditolak backend |
| Reassign antar-archived | ❌ ditolak backend |
| Create baru memakai akun archived | ❌ ditolak backend |

Rasional: kunci total akan menjebak user (tak bisa betulkan typo, tak bisa pindahkan keluar karena bulk-reassign belum ada). Saldo akun archived yang berubah akibat edit amount adalah perilaku benar — `verify`/`recompute` tetap konsisten karena mencakup archived.

---

## Error handling

| Kasus | Pesan (`ConvexError`) | Surface UI |
|---|---|---|
| Transaksi baru / reassign ke akun archived | `"This account is archived."` | Snackbar (`getConvexErrorMessage`) |
| Member panggil archive/unarchive | `"Only household owners can ..."` (via `requireOwner` yang ada) | Snackbar |
| Delete akun archived yang masih punya transaksi | pesan lama `"Cannot delete account — existing transactions reference this account. ..."` | Snackbar (tidak berubah) |

---

## Testing

### Convex unit tests (`tests/`, vitest — pola `convex-test` yang ada)

1. `archive`: owner sukses kapan saja incl. akun bertransaksi; member ditolak; household lain ditolak (`getScopedDoc`).
2. `unarchive`: idempoten dua arah (`false → false`, `true → false → true`).
3. `list`: split `accounts` vs `archived` benar; member tidak lihat archived+hidden; dokumen lama tanpa field terbaca sebagai active.
4. `transactions.create`: ke akun archived ditolak (income/expense/transfer from/to, owner + member).
5. `transactions.update`: keep-account boleh; reassign-to-archived ditolak; reassign archived→active boleh + balance terkoreksi.
6. `remove`: akun archived bertransaksi tetap ditolak; akun archived tanpa transaksi bisa dihapus.
7. `verify/reconcile`: mencakup akun archived (tidak ada regresi exclusion).

### Manual (Expo)

1. Buat akun + transaksi → archive via account-form → akun pindah ke section Archived, hilang dari picker create, transaksi lama + saldo + report tetap.
2. Edit transaksi lama (ubah note/amount) → sukses, saldo archived terkoreksi.
3. Coba reassign ke akun archived → Snackbar `"This account is archived."`.
4. Unarchive → kembali ke list utama + picker.
5. Sebagai member: archived+hidden tak terlihat; archived+visible terlihat tapi tak bisa dipakai baru.

Typecheck (`npx tsc --noEmit`) + lint (`npm run lint`) setelah perubahan `convex/*.ts` diawali `npx convex codegen`.

---

## Out of scope (tidak dikerjakan di sini)

- Category archiving (pola sama, spec terpisah jika diminta).
- Bulk reassign-then-delete (`reassignMany`) — tetap manual satu per satu via `transaction-form`.
- `archivedAt` timestamp / audit log (upgrade mudah dari boolean bila dibutuhkan).
- Household archiving (tetap future, PRD Appendix A).
