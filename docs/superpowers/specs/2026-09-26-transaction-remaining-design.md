# Sisa Amount Live di Form Transaksi — Design

Tanggal: 2026-09-26 | Pendekatan: A (client-only derive, tanpa backend baru)
Status: disetujui user per bagian (data flow, UI, edge cases)

## Tujuan

Saat input transaksi (`app/transaction-form.tsx`), user melihat informasi sisa
amount untuk account dan budget yang akan dipilih — sebagai **proyeksi live**:
`sisa saat ini − amount yang sedang diketik`, update tiap keypad ditekan.
Membantu memilih account/kategori tanpa pindah layar. Warning visual saja,
tidak memblokir submit.

## Data Flow & Rumus Proyeksi

- **Account:** tanpa query baru. `api.accounts.list` yang sudah ada di form
  membawa `balance` penuh (`convex/accounts.ts:21-43`).
  `amountValue` memakai nilai yang sudah ada (`evaluateKeypadExpression`,
  `transaction-form.tsx:327-334`). Proyeksi:
  - expense: `balance − amount`
  - income: `balance + amount`
  - transfer: From `balance − amount`, To `balance + amount`
    (konsisten dengan Account Balance Auto-Update di `docs/ARCHITECTURE.md`).
  - Amount kosong/invalid → tampil saldo mentah saja, tanpa panah `→`.
- **Budget:** satu query tambahan `api.budgets.list` dengan periode dari
  **tanggal transaksi** (`getPeriodBounds(date, tz, monthly)` → `periodStart` /
  `periodEnd`), bukan tanggal hari ini. Di-skip saat type `income` /
  `transfer`. Dipetakan `remaining = amount − spent` per kategori mengikuti
  `convex/budgets.ts:70-82`.
- **Edit mode:** `balance` / `spent` tersimpan sudah mencakup efek transaksi
  lama, jadi proyeksi memakai koreksi delta:
  - account yang sama: `balance + (signedBaru − signedLama)`
  - account diganti: `balance + signedBaru`
  - kategori yang sama: `spent − |lama| + |baru|`
- **Privasi:** kategori hidden + role member → `spent` undefined (redacted,
  sesuai `convex/budgets.ts`) → tidak tampilkan angka sama sekali.

## Komponen & UI

Aturan repo berlaku: NativeWind `className`, token `useThemeColors()`,
`formatNumber`, ikon Feather. Tanpa haptic pada proyeksi (warna saja agar
tidak spam tiap ketikan).

1. **Baris sheet account** (Modal `FlatList`, `transaction-form.tsx:1096-1134`):
   kolom kanan tiap baris tampil `balance → proyeksi` (proyeksi hanya jika
   amount valid). Merah (`C.error`) jika proyeksi < 0.
2. **`AccountPill`**: prop baru `subLabel?` sebagai baris kedua kecil di bawah
   nama (`12.000 → 9.000`, merah jika minus). Dipakai pill expense/income dan
   kedua pill `TransferDual` (From berkurang, To bertambah).
3. **Tile `CategoryGrid`**: caption kecil di bawah label, hanya jika kategori
   punya budget di periode itu: `sisa X` (merah jika `remaining − amount < 0`).
   Tanpa budget → tanpa caption (grid tetap bersih). Redacted → tanpa caption.
4. **Ringkasan kategori terpilih** (baris baru di bawah grid; hanya expense +
   kategori terpilih + ada budget):
   `Budget 50.000 • Terpakai 45.000 • Sisa 5.000 → 2.000`, merah saat over.
5. **Loading:** `budgets.list` masih `undefined` → tile tanpa caption (tanpa
   skeleton, hindari layout-shift); ringkasan disembunyikan sampai data ada.
   `null` (bukan member) → semua caption budget disembunyikan.

## Non-Goals / Edge Cases

- Warning-only: tidak mengubah `canSubmit`, tidak ada Alert/haptic tambahan.
  Submit, duplicate-check, dan validasi existing tidak disentuh.
- Archived: account/kategori archived tampil tanpa caption sisa.
- Debt account: rumus sama (backend `balance += signed` tanpa pandang type);
  merah saat proyeksi < 0. Tanpa logika khusus utang di V1.

## Testing

- Ekstrak rumus ke fungsi murni di `utils/` (`projectAccountBalance`,
  `projectBudgetRemaining`, termasuk koreksi edit-mode) + unit test vitest:
  expense/income/transfer, amount kosong, edit-mode same-account vs ganti
  account, redacted/no-budget → undefined.
- Verifikasi: `npx tsc --noEmit`, `npm run lint`.

## Implementation Notes (post-review, 2026-09-26)

Tiga koreksi dari review, di-commit `ff19ab9` di atas implementasi plan:

- **Pill archived tanpa caption:** `selectedAccount`/`toAcc` yang ter-resolve ke
  dokumen archived (edit transaksi legacy) kini `subLabel`-nya null — aturan
  yang sama dengan baris picker.
- **Koreksi old-amount terikat periode:** `isSameCategory` kini mensyaratkan
  `editingTx.date` masih di dalam periode budget yang di-query
  (`oldTxInBudgetPeriod`); edit yang tanggalnya dipindah ke bulan lain tidak
  lagi menggelembungkan sisa.
- **Sisa mentah saat amount kosong:** `projectBudgetRemaining` mengembalikan
  `budget − spent` tanpa koreksi saat amount invalid; baris ringkasan
  menampilkan angka mentah sebelum panah.

Dilewati dengan alasan: reversal kontribusi lama per-account lintas tipe
(edit + ganti tipe/swap) — edge sempit pada label warning-only, menuntut
redesign interface helper yang sudah dites; follow-up terpisah bila perlu.
