# Multi-Household per User (Server-Side Active) — Design

> Date: 2026-09-10
> Status: Approved (Opsi B — server-side active)
> Request: satu user dapat berada di lebih dari satu household (Pribadi / Keluarga / Usaha, ledger terpisah)
> Source: `convex/schema.ts:37`, `convex/households.ts:14`, `convex/helpers.ts:48`, `convex/invitations.ts:111`

## 1. Overview

Hilangkan batasan satu-household-per-user. User bebas memiliki / mengikuti banyak
household tanpa batas (role independen per household: Owner di satu tempat,
Member di tempat lain). Satu household aktif dalam satu waktu; pilihan aktif
tersimpan di server sehingga ikut saat ganti HP / login baru.

Switcher tersedia di **Home (tap nama household di header)** dan
**Settings → Households**. Setiap create / join household baru menampilkan dialog
"Pindah sekarang atau tetap di sini" (tidak ada auto-switch diam-diam).

## 2. Architecture

- **Satu-satunya perubahan schema:** `users` tambah
  `activeHouseholdId?: v.id("households")`. Tanpa migrasi data massal —
  user lama bernilai `null` dan di-resolve secara lazy saat dibaca.
- `householdMemberships` tidak berubah; tetap sumber kebenaran keanggotaan.
  `activeHouseholdId` hanya penunjuk dan selalu divalidasi terhadap membership.
- **Resolusi aktif (`households.getActive`, read-only, tanpa auto-write):**
  1. `activeHouseholdId` valid (membership masih ada) → pakai itu.
  2. `null` / invalid → fallback: 1 household = itu; N household = yang tertua
     (`createdAt` terkecil); 0 = `null`.
- **Helper eksplisit:** `getUserAndMembership(ctx, householdId)` dan
  `findUserAndMembership(ctx, householdId?)` wajib menerima `householdId`
  (tidak ada lagi `.first()` / `.unique()` ambigu). Semua handler yang
  household-scoped memvalidasi membership terhadap `householdId` argumen.
- Pengunci lama yang dihapus: guard `households.create:48-50`
  ("You already have a household") dan `invitations.redeem:135-137`
  ("already a member of a household"). Pengganti: `redeem` menolak hanya jika
  user sudah member di household **yang di-invite itu** (idempotent-safe).

## 3. Components & Files

### Backend (`convex/`)

- `schema.ts` — tambah `activeHouseholdId` opsional di `users`.
  Tidak perlu index baru (keanggotaan tetap di-lookup via `by_userId`).
- `households.ts`
  - `listMine` (query baru) → `[{ household, role }]` milik caller,
    diurut `createdAt` menaik, sertakan flag `isActive`.
  - `getActive` → resolusi §2 (fallback read-only).
  - `switchActive({ householdId })` (mutasi baru) — validasi caller member
    di household target → patch `users.activeHouseholdId`.
  - `create` — hapus guard tunggal; jika ini household pertama user,
    set sebagai aktif; jika bukan, kembalikan household tanpa mengubah aktif
    (frontend menampilkan dialog pindah/tetap → panggil `switchActive` bila Ya).
  - `leaveHousehold` / `deleteHousehold` — jika household yang ditinggal/dihapus
    adalah yang aktif, pindahkan aktif ke household tertua yang tersisa
    (atau `null` bila tidak sisa) dalam mutasi yang sama.
- `invitations.ts` — `redeem`: hapus guard "sudah punya household"; tolak hanya
  jika sudah member di `invitation.householdId`; kembalikan `{ householdId }`
  agar frontend bisa tawarkan dialog pindah/tetap.
- `helpers.ts` — ubah signature `getUserAndMembership` /
  `findUserAndMembership` menerima `householdId`; perbarui seluruh pemanggil
  (`accounts`, `categories`, `transactions`, `budgets`, `periodBalances`,
  `transactionQueries`, `transactionAnalytics`, `invitations.listActive`).
- Out of scope backend: limit jumlah household, merge/pindah data antar household.

### Frontend (`app/`, `hooks/`)

- Hook baru `useActiveHousehold()` (`hooks/`) — bungkus
  `useQuery(api.households.getActive)` + `useQuery(api.households.listMine)`;
  sediakan `{ active, mine, isSwitching, switchTo }`.
- **Home header** (`app/(tabs)/home.tsx`) — nama household aktif dapat di-tap →
  bottom sheet daftar household (nama, role Owner/Member, badge Aktif);
  pilih → `switchActive` → seluruh tab reload dalam konteks baru
  (semua query sudah household-scoped via id aktif).
- **Settings → Households** — daftar yang sama + tombol Buat baru / Join via kode
  + Danger Zone per household (reuse flow delete/leave/transfer yang ada).
- **Dialog pindah/tetap** setelah create/join sukses: "Pindah ke X sekarang?"
  [Pindah] → `switchActive` + `router` ke Home; [Tetap di sini] → tetap,
  household baru terlihat di switcher.
- Onboarding (`app/_layout.tsx` gate): `getActive === null` (0 household) →
  Onboarding seperti sekarang; user lama 1 household tanpa nilai aktif →
  fallback otomatis, tanpa interupsi.

### Out of scope

- Switcher di luar Home/Settings (tab lain hanya menampilkan konteks aktif).
- Transfer data / saldo antar household.
- Notifikasi lintas household.

## 4. Data Flow

```
Launch → getActive (resolusi §2) → null? Onboarding : Home(id aktif)
Home header tap → sheet(listMine) → switchActive(id) → patch users
  → getActive berubah → semua tab re-query konteks baru
Create baru → create() → { household } → dialog Pindah/Tetap
  → Ya: switchActive → Home baru (kosong) | Tidak: tetap, muncul di sheet
Join kode → redeem() → { householdId } → dialog Pindah/Tetap (sama)
Leave/Delete aktif → membership dihapus (+ cascade bila delete)
  → aktif dipindah ke tertua/null → Home pengganti / Onboarding
Login HP baru → getActive dari server → langsung di household terakhir
```

## 5. Error Handling & Edge Cases

- `switchActive` ke household yang bukan member → `ConvexError`
  ("You are not a member of this household"), snackbar + tetap di lama.
- `activeHouseholdId` menunjuk ke household yang sudah hilang (dikeluarkan /
  dihapus dari device lain) → fallback tertua, tanpa crash.
- Switch saat offline / Convex loading → sheet tampilkan skeleton, opsi
  di-disable; tidak ada state setengah (patch atomik per mutasi).
- `redeem` kode untuk household yang sudah diikuti → error jelas
  ("You are already a member of this household"), tanpa duplikat membership.
- Race dua device switch bersamaan → last-write-wins di satu field;
  dapat diterima untuk MVP (tidak ada data finansial yang tercampur karena
  semua tabel finansial tetap scoped `householdId`).

## 6. Testing

- `tests/households.multi.test.ts` (convex-test): resolusi aktif
  (null → fallback 1 / tertua / invalid), `switchActive` valid/invalid,
  `create` kedua tanpa ubah aktif, `redeem` kedua sukses + dobel di household
  sama ditolak, leave/delete aktif pindah fallback atau null.
- Regresi: suite household/invite yang ada tetap hijau
  (guard lama yang dihapus diperbarui ekspektasinya).
- Verifikasi: `npx convex codegen` → `npx tsc --noEmit` → `npm run lint` →
  `npm test` (skenario pure + Convex).

## 7. PRD Impact

Setelah implementasi, perbarui PRD §1 (hapus "exactly one Household per user
(MVP)" + constraint "One Household per user"), §2.1 Household/Invitations,
§2.3 Permission Matrix (role per-household), §3.x user flow (switcher Home +
Settings, dialog pindah/tetap), §6 schema (`users.activeHouseholdId` +
`households.listMine`/`switchActive`), dan tambah entri Change Log bertanggal.
