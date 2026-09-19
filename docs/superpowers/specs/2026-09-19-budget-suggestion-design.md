# Budget Suggestion (Quick Fill) — Design

> Date: 2026-09-19
> Status: Approved
> Source: user request "saat user create budget user mendapatkan info last period, last period spent, average spent dan bisa memilih dari ketiga itu dan otomatis akan mengisi amount"

---

## Overview

Saat create budget (`app/budget-form.tsx`, mode create), setelah user memilih kategori, tampilkan box "Saran cepat" berisi 3 nilai tappable:

1. **Budget bulan lalu** — `budgets.amount` kategori itu pada bulan kalender sebelum `periodStart` form (null jika tidak ada).
2. **Spent bulan lalu** — total expense aktual kategori itu pada bulan lalu.
3. **Rata-rata spent 3 bulan** — rata-rata expense aktual 3 bulan kalender sebelum `periodStart`, dengan penyebut adaptif: hanya bulan yang ada expense (> 0) yang dihitung; tanpa data sama sekali → 0.

Tap salah satu → `Amount` terisi otomatis (tetap bisa diedit manual).

Scope: **create saja**. Mode edit tidak menampilkan saran. Jika kategori belum punya riwayat apa pun, box disembunyikan.

---

## Backend

### Query baru `budgets.suggestion` (`convex/budgets.ts`)

Args:

```typescript
{ categoryId: Id<"categories">, periodStart: number, timezone: string }
```

Behavior:

- Auth via `findUserAndMembership(ctx)` (sama seperti `list`); return `null` jika tidak login. Tidak ada role check — owner & member sama (konsisten dengan PRD budgets; member memang boleh lihat agregat `spent` kategori hidden).
- Validasi: kategori harus ada di household (via `getScopedDoc`, pesan "Category" sama seperti `create`); `periodStart` harus awal bulan yang valid (asumsi dari client via `getMonthBounds`); `timezone` harus valid (invalid timezone throws `ConvexError` (fail-fast); client selalu kirim `resolveTimezone(household?.timezone)`).
- Hitung 3 bulan kalender sebelum `periodStart`, tz-aware via `utils/periodTime` (boleh diimport di Convex — pure, tanpa expo-localization):
  - `m1 = getPrevPeriod(periodStart, tz, "monthly")`
  - `m2 = getPrevPeriod(m1, tz, "monthly")`
  - `m3 = getPrevPeriod(m2, tz, "monthly")`
  - bounds tiap bulan via `getPeriodBounds` / `getMonthBounds`.
- `prevBudget`: `query budgets withIndex by_category_period (categoryId, m1)` → `amount ?? null`.
- `prevSpent`: sum `transactions` expense kategori itu dengan `date in [m1start, m1end)`, `Math.abs(amount)`. Index: `by_household_category_date (householdId, categoryId, date)` jika tersedia, else `by_household_date` + filter kategori.
- `avgSpent`: sum spent m1+m2+m3 dengan cara sama, dibagi jumlah bulan yang ada expense-nya (penyebut adaptif, 0 jika tanpa data), dibulatkan ke integer (`Math.round`) karena amount whole-number.
- `prevLabel`: `formatPeriodLabel(m1, tz, "monthly")` (e.g. "Agustus 2026").
- `hasHistory = prevBudget !== null || prevSpent > 0 || avgSpent > 0`.

Return:

```typescript
{ prevPeriodStart: number, prevLabel: string, prevBudget: number | null, prevSpent: number, avgSpent: number, hasHistory: boolean } | null
```

Tanpa perubahan `convex/schema.ts` (tanpa tabel/index baru). Index yang dipakai sudah ada (`by_category_period`, `by_household_category_date` / `by_household_date`).

### Alternatif yang ditolak

- **B: client panggil `budgets.list` 3x** — tanpa backend baru tapi 3 roundtrip, logika tanggal di client, lebih lambat.
- **C: `categoryOptions` preload saran semua kategori** — 1 query tapi payload berat untuk kategori yang tidak dipilih.

---

## UI

### `app/budget-form.tsx` — create mode saja

- Query reaktif (skip jika belum pilih kategori atau mode edit):
  ```tsx
  const suggestion = useQuery(
    api.budgets.suggestion,
    !isEdit && selectedCategoryId ? { categoryId: selectedCategoryId as Id<"categories">, periodStart, timezone } : "skip",
  );
  ```
- Posisi: di bawah `SelectField Category`, di atas `Input Amount`.
- Komponen: box dengan judul "Saran cepat" + 3 chip (`Pressable`, tanpa style-callback — pakai `useState` pressed jika perlu, sesuai gotcha NativeWind v4):
  - `Budget {prevLabel}: Rp X` — hanya jika `prevBudget !== null`.
  - `Spent {prevLabel}: Rp Y`.
  - `Rata-rata 3 bln: Rp Z`.
  - Format angka via `formatNumber` / `formatAmountInput`.
- Tap chip → `setAmount(formatAmountInput(String(nilai)))` + haptic ringan (`hapticSuccess` atau `selection` yang ada di `lib/haptics`). User tetap bisa edit manual setelahnya (tidak ada lock).
- States:
  - `suggestion === undefined` → teks kecil "Memuat saran…".
  - `suggestion === null || !hasHistory` → box disembunyikan total.
  - kategori belum dipilih → box disembunyikan.
- Styling: NativeWind `className` + `useThemeColors()` / `Radius` / `Shadow` dari `constants/theme.ts`; tidak ada `StyleSheet.create`; tidak ada warna hardcode.

---

## Data Flow

```text
Create: pilih kategori → budgets.suggestion(categoryId, periodStart, timezone) → box 3 chip → tap → setAmount → submit create (flow lama)
Edit: tidak ada query suggestion, form tidak berubah
```

---

## Edge Cases

- Kategori baru / tanpa riwayat → `hasHistory=false` → box hidden, form identik seperti sekarang.
- `prevBudget` null (ada spent tapi tak pernah budget) → chip budget disembunyikan, 2 chip lain tetap tampil.
- Bulan form adalah future month (planning ahead) → saran tetap relatif ke `periodStart` form, bukan `Date.now()`.
- Hidden category + member → saran tetap tampil (agregat saja, konsisten dengan visibility exception budgets; tidak ada breakdown transaksi).
- Desimal: nilai dari server integer; `formatAmountInput` jaga thousand-separator; validasi `validateBudgetAmount` tetap jalan saat submit.
- Timezone invalid → invalid timezone throws `ConvexError` (fail-fast); client selalu kirim `resolveTimezone(household?.timezone)`.

---

## Verification

- `npx convex codegen` (setelah tambah query), `npx tsc --noEmit`, `npm run lint`.
- `npm test` — tambah/extend `tests/budgets.suggestion.test.ts` (convex-test): prevBudget null vs ada, prevSpent sum, avg 3 bulan dengan bulan kosong = 0, household isolation, unauthenticated → null.
- Manual di Expo Go: create budget → pilih kategori bersejarah → 3 chip muncul → tap masing-masing mengisi amount → submit sukses; kategori baru → box hidden; edit mode → tidak ada box.
