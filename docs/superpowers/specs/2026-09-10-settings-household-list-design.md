# Settings Household List + Detail — Design

> Date: 2026-09-10
> Status: Approved (dengan revisi §3: inline set-active di list)
> Request: gabung kartu Households baru ke bagian Household di Settings;
>   flow Settings → Household List (aktif + role terlihat) → tap masuk menu
>   household (nama, timezone, member, danger zone); UX switch diserahkan ke desainer
> Source: `app/(tabs)/settings.tsx:418`, `app/members.tsx:33`, `convex/invitations.ts:create`, spec `2026-09-10-multi-household-design.md`

## 1. Overview

Settings punya satu kartu "Household" berisi daftar semua household user
(nama, role Owner/Member, badge Active). Tap baris → layar detail household
itu (reuse `app/members.tsx` via `?householdId=`): nama, timezone, list member,
invite, danger zone. Switch active bisa langsung dari list (kontrol inline)
atau dari detail — tanpa harus lewat Home.

## 2. Architecture

- Layar detail yang diminta sudah ada (`app/members.tsx`: rename, timezone,
  member, invite, danger zone). Semua mutasinya sudah menerima `householdId`
  eksplisit (Task 2 multi-household) — kecuali `invitations.create` yang masih
  implisit active household.
- Satu-satunya perubahan backend: `invitations.create` terima
  `householdId?` opsional (bila ada, validasi membership via
  `getUserAndMembership(ctx, householdId)`; bila tidak, perilaku sekarang).
- Members screen baca `useLocalSearchParams<{ householdId?: Id }>`; target =
  entri `listMine` yang cocok, fallback active bila param tak valid/hilang.
  Semua query (`listMembers`, `listActive`) dan mutasi pakai id target.
  Param milik household yang sudah di-leave → fallback active (fail-closed;
  server tetap validasi membership, tidak ada leak).

## 3. Components & Files

### Frontend

- `app/(tabs)/settings.tsx` — hapus kartu "Household" tunggal (lama); kartu
  "Households" menjadi satu-satunya kartu "Household": list + badge Active +
  tombol New/Join (tetap). Tap baris → `router.push("/members?householdId=X")`.
  Tiap baris non-aktif punya kontrol inline "Set active" (tombol kecil teks +
  ikon, area terpisah dari tap navigasi; saat proses tampil spinner).
- `app/members.tsx` — dukung `?householdId=`; header detail tampil badge Active
  atau tombol secondary "Set as Active" (konsisten dengan inline list).
  Setelah delete/leave dari detail → `router.replace("/home")` (efek
  null→onboarding yang ada mengurus kasus tidak ada household tersisa).
- Switcher cepat header Home tetap ada (tidak berubah).

### Backend (`convex/`)

- `invitations.ts` `create({ householdId? })` — seperti §2. Return `{ code }`
  tidak berubah.

### Out of scope

- Switch inline selain set-active (tidak ada hapus/leave dari list).
- Penghapusan `HouseholdSwitcher` sheet (tetap dipakai di Home).

## 4. Data Flow

```
Settings list (listMine) → tap baris → /members?householdId=X → detail target
  → Set as Active (inline list ATAU tombol detail) → switchActive → badge pindah
Detail target: rename/timezone/member/invite (create pakai householdId target)
  / danger zone → /home (atau /onboarding bila tidak tersisa)
Param basi (sudah leave) → fallback active, tanpa crash
```

## 5. Error Handling & Edge Cases

- Switch gagal (hak hilang di tengah jalan) → snackbar error, badge tetap.
- `switchActive` ke id bukan member → `ConvexError` (tidak ada perubahan).
- Invite di detail non-aktif memakai `householdId` target (bukan active).
- Single-household: list satu baris + badge, tanpa tombol (tidak ada yang bisa di-switch).

## 6. Testing

- `tests/invitations.household.test.ts` (convex-test): create dengan
  `householdId` target (owner OK), non-member ditolak
  ("You are not a member of this household."), tanpa param = active (perilaku lama).
- Regresi: suite multi-household tetap hijau.
- Verifikasi: `npx convex codegen` → `npx tsc --noEmit` → `npm run lint` →
  `npm test` + manual flow list→detail→set active (list & detail).

## 7. PRD Impact

Perbarui §2.1 Household/Invitations (list gabungan, detail param,
`invitations.create` opsional `householdId`), §3.x user flow (Settings list →
detail → set active inline), dan entri Change Log bertanggal.
