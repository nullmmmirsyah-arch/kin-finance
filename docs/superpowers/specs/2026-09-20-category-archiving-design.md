# Category Archiving — Design

> Date: 2026-09-20
> Status: Approved
> Source: user request "implementasikan fitur archive untuk category" (lanjutan dari account archiving 2026-09-19)
> Pattern reference: `docs/superpowers/specs/2026-09-19-account-archiving-design.md`

---

## Overview

Kategori yang sudah punya transaksi/budget tidak bisa dihapus (`categories.remove` menolak selama ada referensi di `transactions.by_categoryId` / `budgets.by_categoryId`). Archiving memberi jalan keluar tanpa menghapus data: kategori archived hilang dari list utama dan picker transaksi/budget baru, tapi seluruh histori transaksi, spending analytics, dan budget tetap utuh. Archive bersifat reversible (unarchive kapan saja). Delete fisik tetap diblokir walau kategori sudah archived.

Scope: **categories saja**. Accounts archiving sudah ship; budgets/household archiving tetap out-of-scope.

---

## Keputusan brainstorming

1. **Perilaku archive:** boleh kapan saja walau ada transaksi & budget aktif (mirror `accounts.archive`). Histori/report/budget tetap utuh — bukan sembunyi total, bukan badge saja.
2. **Unarchive & delete:** reversible; delete fisik tetap `throw` selama ada transaksi/budget — archive bukan jalan pintas hapus data.
3. **Visibilitas:** mirror accounts — section Archived khusus di `categories.tsx`; member tetap ikut aturan `hidden` lama (archived + hidden → tak terlihat member; archived + visible → terlihat member di section Archived, tapi tak bisa dipakai baru).
4. **Storage (Opsi A):** `isArchived` boolean — YAGNI atas `archivedAt` timestamp (Opsi B) dan `status` enum (Opsi C). Alasan sama dengan account archiving: tanpa migrasi, upgrade ke B kelak hanya 1 baris.
5. **Aksi hanya di dalam `category-form` (edit mode, owner-only):** list `categories.tsx` menjadi display-only — tidak ada ikon eye/edit/trash per row. Tap row (owner) → `/category-form?id=...`. Hide/unhide (switch `Visible to members`), Archive/Unarchive, dan Delete semuanya di dalam form edit, section yang sama (danger zone).
6. **Picker transaksi:** create maupun edit hanya menampilkan kategori active. Transaksi lama yang kategorinya ter-archive tetap bisa dibuka dan diedit semua datanya (keep-same archived selalu lolos; backend hanya menolak pindah KE archived lain).
7. **Budget baru:** `budgets.categoryOptions` hanya active; `budgets.create` menolak kategori archived.

---

## Backend

### Schema (`convex/schema.ts`, tabel `categories`)

Tambah field optional agar tanpa migrasi (dokumen lama tanpa field = active):

```typescript
isArchived: v.optional(v.boolean()),
```

Semua logika baca memakai `(c.isArchived ?? false)`. Tidak ada index baru (`by_householdId` yang ada sudah cukup; archive adalah filter setelah collect, sama seperti pola `hidden` dan `accounts.archive`).

### `categories.list` (`convex/categories.ts`)

Bentuk return berubah dari `{ categories, isOwner }` menjadi `{ categories, archived, isOwner }`:

- Ambil semua via `by_householdId`, exclude `RESERVED_CATEGORY_NAME` dari **kedua** array (reserved tidak pernah masuk management list).
- `categories` = hanya active (`!isArchived`), lalu filter `hidden` untuk member.
- `archived` = hanya archived, lalu filter `hidden` untuk member (aturan sama: member tak lihat yang `hidden === true`).
- Owner melihat semua di kedua array.

### Mutation baru `categories.archive` / `categories.unarchive`

```typescript
archive: { categoryId: Id<"categories"> }
unarchive: { categoryId: Id<"categories"> }
```

Behavior (keduanya):

- `getUserAndMembership` + `requireOwner` (member ditolak, konsisten dengan `update`/`remove`).
- `getScopedDoc(ctx, categoryId, householdId, "Category")` untuk scoping household.
- Tolak jika `category.name === RESERVED_CATEGORY_NAME` (reserved tidak bisa di-archive, konsisten dengan proteksi update/remove).
- `archive` boleh kapan saja — **walau ada transaksi/budget** (inilah bedanya dengan `remove`). Idempoten: jika sudah archived, tetap sukses.
- `unarchive` selalu boleh. Idempoten.
- Patch `{ isArchived: true/false, updatedAt: Date.now() }`.

`categories.remove` **tidak berubah**: tetap menolak selama ada budget atau transaksi, walau kategori sudah archived. `categories.create`/`update` selain guard di bawah tidak berubah (uniqueness per `(householdId, type)` tetap jalan; duplikat terhadap archived tetap ditolak — archived bukan cara bypass uniqueness).

### Guard transaksi (`convex/transactions.ts`, `create` + `update`)

- `create`: setelah `getScopedDoc` category (cabang income/expense), tolak jika `(category.isArchived ?? false)` → `ConvexError("This category is archived.")`. Berlaku owner + member (berbeda dengan `hidden` yang longgar untuk owner). Transfer tidak punya kategori — tidak tersentuh.
- `update`: tolak hanya jika **kategori baru beda dari lama dan archived**:
  - `categoryId !== tx.categoryId && newCategory.isArchived` → tolak.
  - Keep-same archived (edit amount/note/date atau ganti field lain tanpa ganti kategori) tetap boleh — ini yang memungkinkan "transaksi yang kategorinya di-archive masih bisa diedit semua datanya". Ubah tipe tanpa ganti kategori tetap ditolak guard type-match yang sudah ada (`Category type must match transaction type.`), karena tipe kategori bersifat tetap.
  - Reassign archived→active boleh (jalan manual keluar dari archive).
  - Reassign active→archived atau archived→archived-lain ditolak.
- Pesan error tunggal: `"This category is archived."` (stabil untuk UI Snackbar via `getConvexErrorMessage`).

### Guard budget (`convex/budgets.ts`, `create` + `categoryOptions`)

- `categoryOptions`: exclude archived (selain filter `type === "expense"` + reserved yang sudah ada). Return shape tidak berubah (`{ _id, name, hidden, icon }`).
- `create`: setelah `getScopedDoc` category, tolak jika `(category.isArchived ?? false)` → `ConvexError("This category is archived.")`. Berlaku owner + member.
- `budgets.list`/`get`/`suggestion`/`update`/`remove`: tidak berubah — budget lama yang kategorinya ter-archive tetap tampil dengan spending/progress utuh.

### Yang eksplisit TIDAK berubah (histori utuh)

- `transactions.list/summary/recent/get`, `cashflow`, `spendingByCategory`, `periodBalances.recompute`: tanpa filter archive — report dan histori mencakup transaksi berkategori archived.
- `categories.update` type-change guard dan `remove` guard: tetap menolak selama ada referensi (tidak dilonggarkan oleh archive).
- Reserved `RESERVED_CATEGORY_NAME`: tetap excluded dari list dan terproteksi dari archive/update/remove.

### Alternatif yang ditolak

- **B: `archivedAt?: number`** — informatif tapi semua baca jadi optional-handling dengan cabang ekstra; upgrade dari A ke B kelak hanya 1 baris, jadi ditunda.
- **C: `status: "active" | "archived"`** — future-proof untuk `hidden`-merge/`deleted` tapi churn terbesar di semua query/validasi/UI untuk manfaat yang belum dibutuhkan.

---

## UI

### `app/categories.tsx` — display-only list + section Archived

- Hapus aksi per row: tidak ada lagi ikon eye/eye-off, edit, delete di list (`handleToggleVisibility`, `handleDelete`, `Alert` di file ini dihapus). `CategoryCard` dipakai sebagai display-only (props `hidden` tetap untuk badge info, tanpa `onToggleVisibility`/`onEdit`/`onDelete`).
- Owner: tap row → `router.push({ pathname: "/category-form", params: { id } })`. Bungkus `CategoryCard` dalam `Pressable` (static `style`, tanpa callback `style={({ pressed }) => ...}` per NativeWind v4 gotcha).
- Member: read-only, tanpa tap (seperti sekarang).
- Filter chips All | Income | Expense tetap dan berlaku untuk kedua list (utama dan Archived memakai state `filter` yang sama).
- Section **Archived** terpisah di bawah FlatList utama, collapsed by default, display-only: header row (`Feather "archive"`, label `Archived (n)`, chevron up/down), tap header toggle. Row archived: `CategoryCard` + badge/icon archive, tap (owner) → `/category-form?id=...`.
- Member: section Archived hanya berisi archived yang `hidden === false`.
- FAB (plus) → `/category-form`, owner only (tidak berubah). EmptyState tidak berubah.

### `app/category-form.tsx` — satu-satunya tempat aksi (edit mode, owner-only)

- Switch `Visible to members` yang sudah ada tetap — inilah cara hide/unhide (tidak ada lagi toggle di list).
- Danger zone di bawah tombol Save (hanya saat `isEdit && result.isOwner`):
  - Jika active → tombol `danger` "Archive Category" → `Alert` konfirmasi (`Archive "..."? New transactions and budgets cannot use it. History is kept.`) → `archive({ categoryId })` → snackbar `"Category archived"` + `hapticSuccess` + `router.back()`.
  - Jika archived → tombol `secondary` "Unarchive Category" → konfirmasi ringan → `unarchive(...)` → snackbar + back.
  - Tombol `danger` "Delete Category" (pindahan dari list) → `Alert` konfirmasi (`Delete "X"? This cannot be undone.`) → `remove({ categoryId })` → snackbar `"..." deleted` + back; error server (masih ada transaksi/budget) via `show(getConvexErrorMessage(...))` + `hapticError`.
  - Archive/Unarchive + Delete disabled while form dirty (`isDirty`), mengikuti follow-up account archiving (success path bypasses discard guard, jadi dirty archiving akan silently drop edits).
- Banner kecil di atas form saat mengedit kategori archived ("This category is archived — new transactions and budgets cannot use it.") agar owner sadar konteks.
- `editingCategory` lookup harus mencakup `archived` (mirror `account-form.tsx`: `result.categories.find(...) ?? result.archived.find(...)`), jika tidak maka edit kategori archived akan menampilkan "Category not found."
- Error via `show(getConvexErrorMessage(e, ...))` / inline `error` mengikuti pola yang sudah ada di file ini.

### `app/transaction-form.tsx` (create vs edit)

- **Create maupun edit:** `categoryOptions` hanya dari `categories` (active), filter `type` seperti sekarang. Archived tidak ada di opsi.
- **Edit** transaksi lama yang kategorinya ter-archive setelah transaksi dibuat: tampilkan kategori lama sebagai nilai terpilih terkunci/read-only (label + badge Archived, mengikuti pola `addIfMissing` + flag `archived` yang sudah ada untuk `accountOptions`), tidak bisa dipilih untuk transaksi lain; user wajib pilih kategori active jika ingin ganti (guard backend menegakkan; keep-same tetap bisa save).
- Badge Archived di dekat pill/selector kategori saat kategori terpilih archived.

### `app/budget-form.tsx`

- `categoryOptions` (dari `api.budgets.categoryOptions`) otomatis hanya active setelah guard backend — tidak ada perubahan query di file ini selain membaca hasil baru. Edit budget lama yang kategorinya archived: kategori lama tetap tampil sebagai nilai terpilih terkunci/read-only (tidak di-reset ke null); user wajib pilih kategori active jika ingin ganti.

### Home + Search filter sheets

- Mirror follow-up account archiving: opsi filter kategori di Home/Search mencakup archived (agar histori archived tetap filterable). Normalisasi seleksi tidak membuang ID archived yang sudah terpilih.

---

## Edit rules (transaksi & budget di kategori archived)

| Aksi | Boleh? |
|---|---|
| Buat transaksi baru memakai kategori archived | ❌ ditolak backend |
| Edit transaksi lama (amount/note/date) tanpa ganti kategori, kategori archived | ✅ owner + member |
| Ubah tipe transaksi tanpa ganti kategori (kategori archived) | ❌ ditolak guard type-match yang sudah ada |
| Reassign keluar archived → active | ✅ owner + member (jalan manual keluar dari archive) |
| Reassign ke archived (dari kategori mana pun, termasuk archived→archived-lain) | ❌ ditolak backend |
| Buat budget baru memakai kategori archived | ❌ ditolak backend |
| Edit amount budget lama yang kategorinya archived | ✅ (tidak menyentuh kategori) |

Rasional: kunci total akan menjebak user (tak bisa betulkan typo, tak bisa pindahkan keluar karena bulk-reassign belum ada). Spending/balance yang berubah akibat edit amount adalah perilaku benar — analytics tetap konsisten karena mencakup archived.

---

## Error handling

| Kasus | Pesan (`ConvexError`) | Surface UI |
|---|---|---|
| Transaksi baru / reassign ke kategori archived | `"This category is archived."` | Snackbar (`getConvexErrorMessage`) |
| Budget baru memakai kategori archived | `"This category is archived."` | Snackbar |
| Member panggil archive/unarchive | `"You are not the owner of this household."` (via `requireOwner`) | Snackbar |
| Archive kategori reserved | `"This category cannot be modified."` (pesan yang sudah ada) | Snackbar |
| Delete kategori archived yang masih punya transaksi/budget | pesan lama `"Cannot delete category — ..."` | Snackbar/inline (tidak berubah) |

---

## Testing

### Convex unit tests (`tests/`, vitest — pola `convex-test` yang ada)

1. `archive`: owner sukses kapan saja incl. kategori bertransaksi/berbudget; member ditolak; household lain ditolak (`getScopedDoc`); reserved ditolak.
2. `unarchive`: idempoten dua arah.
3. `list`: split `categories` vs `archived` benar; member tidak lihat archived+hidden; dokumen lama tanpa field terbaca sebagai active; reserved excluded dari keduanya.
4. `transactions.create`: ke kategori archived ditolak (income/expense, owner + member); transfer tak tersentuh.
5. `transactions.update`: keep-category archived boleh (ubah note/amount); reassign-to-archived ditolak; reassign archived→active boleh.
6. `budgets.create` + `categoryOptions`: kategori archived ditolak/excluded; budget lama tetap terbaca di `budgets.list` dengan progress utuh.
7. `remove`: kategori archived bertransaksi/berbudget tetap ditolak; kategori archived tanpa referensi bisa dihapus.
8. Analytics (`spendingByCategory`, `summary`): mencakup kategori archived (tidak ada regresi exclusion).

### UI tests (jika pola tersedia) / Manual (Expo)

1. Buat kategori + transaksi + budget → archive via category-form → kategori pindah ke section Archived, hilang dari picker create maupun daftar pilih saat ganti kategori (nilai archived lama tampil terkunci saat edit), transaksi lama + report + budget tetap.
2. Buka transaksi lama (kategori archived) → nilai tampil terkunci → edit note/amount → sukses tersimpan.
3. Coba reassign transaksi ke kategori archived (via API/picker terkunci) → Snackbar `"This category is archived."`.
4. Coba buat budget dengan kategori archived → ditolak.
5. Unarchive → kembali ke list utama + picker.
6. Sebagai member: archived+hidden tak terlihat; archived+visible terlihat tapi tak bisa dipakai baru.
7. List categories: tidak ada ikon eye/edit/trash; tap row (owner) masuk edit; hide/unhide + archive + delete semuanya di dalam form.

Typecheck (`npx tsc --noEmit`) + lint (`npm run lint`) setelah perubahan `convex/*.ts` diawali `npx convex codegen`.

---

## Review follow-ups (PR)

- `transactions.restore` (undo-only): `transaction-form` "Undo" setelah delete kini memakai `restore`, bukan `create` — semua validasi `create` berlaku kecuali guard archived, sehingga transaksi lama di kategori/akun archived bisa dikembalikan. `create` tidak berubah.
- FilterSheet Home/Search menerima `categoryOptions` inklusif-archived (bukan hanya active), sehingga kategori archived tampil dan bisa dipilih sebagai filter; type-filtering tetap di dalam sheet.
- Ganti tipe saat edit transaksi legacy berkategori archived me-reset pilihan kategori (nilai archived hanya dipertahankan jika tipe tidak berubah), agar tidak tersangkut guard type-match.

## Out of scope (tidak dikerjakan di sini)

- Bulk reassign-then-delete (`reassignMany`) — tetap manual satu per satu via `transaction-form`.
- `archivedAt` timestamp / audit log (upgrade mudah dari boolean bila dibutuhkan).
- Household archiving (tetap future, PRD Appendix A).
- Perubahan pada tab Accounts / account archiving yang sudah ship (selain pola yang di-mirror).
