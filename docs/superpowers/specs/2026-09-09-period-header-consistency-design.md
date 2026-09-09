# Period Header Consistency — Design

Date: 2026-09-09. Scope: `app/(tabs)/home.tsx`, `app/(tabs)/reports.tsx`, `app/(tabs)/budgets.tsx`.

## Goal
Samakan header period ketiga page: simple, rapat, gaya Home (bold 18px), label monthly 3 huruf tanpa tahun, panah compact, next hilang saat mentok. Hybrid bertahap: UI konsisten sekarang, siap dinamis (`weekly`/`yearly`) saat backend dibuka (backend saat ini mengunci `periodType=monthly`: `convex/households.ts:updatePeriodType` throw "Weekly/yearly coming soon", `convex/budgets.ts:list` max 32 hari).

## Design
1. **Komponen baru `components/PeriodHeader.tsx`** (UI murni, tanpa logika query):
   Props: `label: string`, `a11yLabel: string`, `onPrev`, `onNext`, `isPrevDisabled`, `isNextDisabled`, `onOpenPicker`, `pickerA11yLabel?`.
   Layout: `[prev] label [next]`, label tengah `text-[18px] font-bold tracking-[-0.02em]`, tappable → picker. **Tanpa dots** (per revisi user).
2. **Panah compact**: 40×40, `Radius.md`, border 1 `C.border`, chevron 18 `C.textSecondary`. Disabled → `opacity: 0`, `disabled={true}`, `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`, layout dipertahankan (label tidak bergeser). Prev hilang di ujung window tertua, next hilang di bulan berjalan.
3. **Label**: util baru `formatPeriodShortLabel(start, tz, type)` di `utils/periodTime.ts` (re-export via `utils/period.ts`, `utils/date.ts`): `monthly` → Intl `month: short` saja (`Sep`, tanpa tahun); `weekly`/`yearly` → fallback `formatPeriodLabel` lama (terkunci, siap dinamis). Visual `Sep`, a11y `September 2026` (tidak ambigu untuk screen reader). Aman tanpa tahun karena window 12 bulan berurutan memuat tiap nama bulan tepat sekali.
4. **Per page**:
   - Home: ganti blok chevron 48px + dots dengan `PeriodHeader`; logic `selectedPeriodStart/pagerPeriods/prev/next/picker` tetap.
   - Reports: sama; tetap `monthly` eksplisit (siap `periodType` dinamis nanti).
   - Budgets: hapus kartu `PERIOD` box, ganti `PeriodHeader` + **tambahkan `MonthPicker`** (satu-satunya page tanpa picker); query `budgets.list` tidak berubah.
5. **Tidak berubah**: `buildPeriodWindow(12)`, guard `isPrevDisabled` (mentok window) / `isNextDisabled` (`next > curStart`), `PagerView` swipe, timezone via `resolveTimezone`, backend/Convex.

## Trade-off vs alternatif
Dipilih shared component (bukan edit per-file) agar tidak drift lagi; ditolak full PeriodPicker week/year karena backend masih terkunci (scope berlebih).

## Verifikasi
`npx tsc --noEmit`, `npm run lint`, manual `expo start`: 3 page — label `Sep` dkk, next hilang di bulan kini, prev hilang di ujung, picker terbuka dari label, swipe sinkron. `npm test` hanya jika util tersentuh (vitest utils).
