# Period Header Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Samakan header period Home, Reports, Budgets ke satu komponen shared yang simple (label monthly 3 huruf tanpa tahun, panah compact 40px, next/prev hilang saat disabled, tanpa dots).

**Architecture:** Tambah util murni `formatPeriodShortLabel` di `utils/periodTime.ts` + komponen UI murni `components/PeriodHeader.tsx`; tiga page hanya mengganti blok header (logic period, query, PagerView tidak berubah); Budgets дополнительно dapat `MonthPicker` seperti Home/Reports.

**Tech Stack:** Expo SDK 54, React Native, NativeWind v4 (`className`), `expo-router`, Convex queries (read-only di task ini), vitest.

## Global Constraints

- Styling pakai NativeWind `className`, bukan `StyleSheet.create`.
- JANGAN pakai `style` callback di `Pressable` (`style={({pressed}) => ...}` merusak NativeWind v4) — pakai `useState` pressed + `style` statis.
- Warna via `useThemeColors()` / `constants/theme.ts`, bukan hardcode; ikon `@expo/vector-icons/Feather`.
- Setelah ubah `convex/*.ts`: TIDAK ADA perubahan convex di plan ini (dilarang menyentuh backend).
- Verifikasi: `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest, wajib karena sentuh pure utils).
- Path alias `@/*` → repo root.

---

### Task 1: Util `formatPeriodShortLabel` + test

**Files:**
- Modify: `utils/periodTime.ts` (tambah fungsi, re-export eksplisit di daftar export bawah)
- Modify: `utils/period.ts` (tambah ke re-export list)
- Modify: `utils/date.ts` (tambah ke re-export list)
- Test: `tests/period.shortLabel.test.ts` (baru)

**Interfaces:**
- Consumes: `formatPeriodLabelInternal(start, tz, type)` (sudah ada, private di `periodTime.ts`), `PeriodType` (`"monthly" | "weekly" | "yearly"`).
- Produces: `formatPeriodShortLabel(start: number, tz: string, type: PeriodType): string` — `monthly` → `"Sep"` (Intl `month: short`, tanpa tahun); `weekly`/`yearly` → fallback `formatPeriodLabelInternal(start, tz, type)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { formatPeriodShortLabel } from "../utils/period";
import { getPeriodBounds } from "../utils/period";

describe("formatPeriodShortLabel", () => {
  const tz = "Asia/Jakarta";
  it("monthly Sep 2026 renders Sep without year", () => {
    const start = getPeriodBounds(Date.UTC(2026, 8, 15), tz, "monthly").start;
    expect(formatPeriodShortLabel(start, tz, "monthly")).toBe("Sep");
  });
  it("monthly Jan renders Jan", () => {
    const start = getPeriodBounds(Date.UTC(2026, 0, 10), tz, "monthly").start;
    expect(formatPeriodShortLabel(start, tz, "monthly")).toBe("Jan");
  });
  it("weekly/yearly fall back to full label", () => {
    const mStart = getPeriodBounds(Date.UTC(2026, 8, 15), tz, "monthly").start;
    expect(formatPeriodShortLabel(mStart, tz, "yearly")).toBe("2026");
    const w = formatPeriodShortLabel(mStart, tz, "weekly");
    expect(w).toContain("–");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/period.shortLabel.test.ts`
Expected: FAIL with "formatPeriodShortLabel is not a function" / "does not provide export".

- [ ] **Step 3: Write minimal implementation**

Di `utils/periodTime.ts`, dekat `formatPeriodLabel` (~line 151), tambah:

```ts
export function formatPeriodShortLabel(start: number, tz: string, type: PeriodType): string {
  assertValidTz(tz);
  assertValidType(type);
  if (type === "monthly") {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short" }).format(new Date(start));
  }
  return formatPeriodLabelInternal(start, tz, type);
}
```

Tambah `formatPeriodShortLabel` ke export list di `utils/period.ts` dan `utils/date.ts` (ikuti pola `formatPeriodLabel` yang sudah ada di kedua file).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/period.shortLabel.test.ts tests/period.test.ts`
Expected: PASS semua.

- [ ] **Step 5: Commit**

```bash
git add utils/periodTime.ts utils/period.ts utils/date.ts tests/period.shortLabel.test.ts
git commit -m "feat: add formatPeriodShortLabel for compact period headers"
```

### Task 2: Komponen shared `PeriodHeader`

**Files:**
- Create: `components/PeriodHeader.tsx`
- Test: manual via tsc/lint (komponen UI, tanpa unit test; verifikasi visual di Task 6)

**Interfaces:**
- Consumes: `Radius`, `useThemeColors` dari `@/constants/theme`; `Feather` dari `@expo/vector-icons/Feather`.
- Produces: `PeriodHeader(props: { label: string; a11yLabel: string; onPrev: () => void; onNext: () => void; isPrevDisabled: boolean; isNextDisabled: boolean; onOpenPicker: () => void; pickerA11yLabel?: string })`.

- [ ] **Step 1: Create component file**

```tsx
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { Radius, useThemeColors } from "@/constants/theme";

type Props = {
  label: string;
  a11yLabel: string;
  onPrev: () => void;
  onNext: () => void;
  isPrevDisabled: boolean;
  isNextDisabled: boolean;
  onOpenPicker: () => void;
  pickerA11yLabel?: string;
};

export function PeriodHeader({ label, a11yLabel, onPrev, onNext, isPrevDisabled, isNextDisabled, onOpenPicker, pickerA11yLabel = "Open month picker" }: Props) {
  const C = useThemeColors();
  const [prevPressed, setPrevPressed] = useState(false);
  const [nextPressed, setNextPressed] = useState(false);
  const [headerPressed, setHeaderPressed] = useState(false);
  const arrow = (disabled: boolean, pressed: boolean) => ({
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: pressed ? C.surface : C.background,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    opacity: disabled ? 0 : 1,
  });
  return (
    <View className="flex-row items-center justify-between">
      <Pressable
        onPress={onPrev}
        onPressIn={() => setPrevPressed(true)}
        onPressOut={() => setPrevPressed(false)}
        disabled={isPrevDisabled}
        accessibilityRole="button"
        accessibilityLabel="Previous period"
        accessibilityElementsHidden={isPrevDisabled}
        importantForAccessibility={isPrevDisabled ? "no-hide-descendants" : "auto"}
        style={arrow(isPrevDisabled, prevPressed)}
      >
        <Feather name="chevron-left" size={18} color={C.textSecondary} />
      </Pressable>
      <Pressable
        onPress={onOpenPicker}
        onPressIn={() => setHeaderPressed(true)}
        onPressOut={() => setHeaderPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={pickerA11yLabel}
        style={{ flex: 1, alignItems: "center", opacity: headerPressed ? 0.7 : 1 }}
      >
        <Text accessibilityLabel={a11yLabel} className="text-[18px] font-bold leading-6 tracking-[-0.02em] text-text-primary dark:text-text-primary-dark">
          {label} ▼
        </Text>
      </Pressable>
      <Pressable
        onPress={onNext}
        onPressIn={() => setNextPressed(true)}
        onPressOut={() => setNextPressed(false)}
        disabled={isNextDisabled}
        accessibilityRole="button"
        accessibilityLabel="Next period"
        accessibilityElementsHidden={isNextDisabled}
        importantForAccessibility={isNextDisabled ? "no-hide-descendants" : "auto"}
        style={arrow(isNextDisabled, nextPressed)}
      >
        <Feather name="chevron-right" size={18} color={C.textSecondary} />
      </Pressable>
    </View>
  );
}
```

Catatan: `▼` dipertahankan sebagai affordance picker (seperti Home/Reports sekarang); label visual pendek, `a11yLabel` lengkap (`September 2026`).

- [ ] **Step 2: Typecheck + lint file baru**

Run: `npx tsc --noEmit`
Expected: PASS (tidak ada error TS di `components/PeriodHeader.tsx`).

- [ ] **Step 3: Commit**

```bash
git add components/PeriodHeader.tsx
git commit -m "feat: add shared PeriodHeader (compact arrows, short label, no dots)"
```

### Task 3: Home pakai `PeriodHeader`

**Files:**
- Modify: `app/(tabs)/home.tsx` (blok header ~line 647-724; hapus dots `pagerPeriods.map`; hapus state `prevPressed/nextPressed/headerPressed` lokal bila tak terpakai lagi; import `PeriodHeader`, `formatPeriodShortLabel`)

**Interfaces:**
- Consumes: `PeriodHeader` (Task 2), `formatPeriodShortLabel` (Task 1), state/logic existing (`currentLabel` → ganti sumber label; `handlePrev/handleNext/isPrevDisabled/isNextDisabled/setPickerOpen` tetap).
- Produces: tidak ada interface baru; visual header berubah saja.

- [ ] **Step 1: Ganti blok header dengan PeriodHeader**

Pola edit (nama variabel menyesuaikan file aktual):

```tsx
import { PeriodHeader } from "@/components/PeriodHeader";
import { formatPeriodShortLabel } from "@/utils/period";

// label pendek visual + label lengkap a11y:
const shortLabel = useMemo(() => {
  if (selectedPeriodStart === null) return "";
  return formatPeriodShortLabel(selectedPeriodStart, timezone, periodType);
}, [selectedPeriodStart, timezone, periodType]);

// di JSX, ganti seluruh <View className="flex-row items-center justify-between"> header dengan:
<PeriodHeader
  label={shortLabel}
  a11yLabel={currentLabel}
  onPrev={handlePrev}
  onNext={handleNext}
  isPrevDisabled={isPrevDisabled}
  isNextDisabled={isNextDisabled}
  onOpenPicker={() => setPickerOpen(true)}
/>
```

Hapus render dots (`pagerPeriods.map((p, idx) => ...`) di header dan state pressed lokal yang hanya dipakai header lama. Pertahankan memo `currentLabel` yang sudah ada (dipakai sebagai `a11yLabel` dan di kartu balance). Jangan ubah `PagerView`, query, atau `MonthPicker`.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit`
Run: `npm run lint -- app/\(tabs\)/home.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/home.tsx"
git commit -m "refactor: home header uses shared PeriodHeader"
```

### Task 4: Reports pakai `PeriodHeader`

**Files:**
- Modify: `app/(tabs)/reports.tsx` (blok header ~line 231-302; hapus dots; import `PeriodHeader`, `formatPeriodShortLabel`)

**Interfaces:**
- Consumes: `PeriodHeader`, `formatPeriodShortLabel`, logic existing (`handlePrev/handleNext/isPrevDisabled/isNextDisabled/setPickerOpen`, `currentLabel` sebagai a11y).
- Produces: tidak ada interface baru.

- [ ] **Step 1: Ganti blok header dengan PeriodHeader**

```tsx
import { PeriodHeader } from "@/components/PeriodHeader";
import { formatPeriodShortLabel } from "@/utils/period";

const shortLabel = useMemo(() => {
  if (selectedPeriodStart === null) return "";
  return formatPeriodShortLabel(selectedPeriodStart, timezone, "monthly");
}, [selectedPeriodStart, timezone]);

// di JSX ganti header lama dengan:
<PeriodHeader
  label={shortLabel}
  a11yLabel={currentLabel}
  onPrev={handlePrev}
  onNext={handleNext}
  isPrevDisabled={isPrevDisabled}
  isNextDisabled={isNextDisabled}
  onOpenPicker={() => setPickerOpen(true)}
/>
```

Hapus dots + state pressed lokal header lama. Jangan ubah `PagerView`, query, `DeltaCard`, `MonthPicker`.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit`
Run: `npm run lint -- app/\(tabs\)/reports.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/reports.tsx"
git commit -m "refactor: reports header uses shared PeriodHeader"
```

### Task 5: Budgets pakai `PeriodHeader` + tambah `MonthPicker`

**Files:**
- Modify: `app/(tabs)/budgets.tsx` (hapus kartu `PERIOD` box ~line 250-324 termasuk dots; tambah `MonthPicker` modal + state `pickerOpen`; import `PeriodHeader`, `MonthPicker`, `formatPeriodShortLabel`)

**Interfaces:**
- Consumes: `PeriodHeader`, `MonthPicker` (`visible/selectedPeriodStart/tz/onSelect/onClose` — pola sama seperti Reports), `formatPeriodShortLabel`, logic existing (`handlePrevMonth/handleNextMonth/isPrevDisabled/isNextDisabled/selectedMonthStart/pagerRef/pagerPeriods`).
- Produces: tidak ada interface baru.

- [ ] **Step 1: Ganti kartu PERIOD dengan PeriodHeader + MonthPicker**

```tsx
import { PeriodHeader } from "@/components/PeriodHeader";
import { MonthPicker } from "@/components/MonthPicker";
import { formatPeriodShortLabel } from "@/utils/period";

const [pickerOpen, setPickerOpen] = useState(false);
const shortLabel = formatPeriodShortLabel(periodStart, timezone, "monthly");
const fullLabel = formatMonthLabel(periodStart, timezone);

// ganti <View className="mt-5 flex-row items-center justify-between gap-3"> kartu PERIOD dengan:
<PeriodHeader
  label={shortLabel}
  a11yLabel={fullLabel}
  onPrev={handlePrevMonth}
  onNext={handleNextMonth}
  isPrevDisabled={isPrevDisabled}
  isNextDisabled={isNextDisabled}
  onOpenPicker={() => setPickerOpen(true)}
/>

// setelah header (sebelum PagerView), tambah:
<MonthPicker
  visible={pickerOpen}
  selectedPeriodStart={selectedMonthStart ?? periodStart}
  tz={timezone}
  onSelect={(ps) => {
    setSelectedMonthStart(ps);
    const idx = pagerPeriods.findIndex((p) => p.periodStart === ps);
    if (idx >= 0) pagerRef.current?.setPage(idx);
  }}
  onClose={() => setPickerOpen(false)}
/>
```

`periodStart`/`fullLabel` yang sudah ada dipakai ulang; jangan ubah query `budgets.list` dan `PagerView`.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit`
Run: `npm run lint -- app/\(tabs\)/budgets.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/budgets.tsx"
git commit -m "refactor: budgets header uses shared PeriodHeader with picker"
```

### Task 6: Verifikasi akhir + dokumentasi

**Files:**
- Modify: `docs/superpowers/specs/2026-09-09-period-header-consistency-design.md` (tambah bagian "Changelog: dots dihapus per revisi 2026-09-09" bila belum ada — sudah ada di spec; langkah ini hanya memastikan).

**Interfaces:** tidak ada.

- [ ] **Step 1: Jalankan full verifikasi**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Run: `npm test`
Expected: PASS semua (bila `lint`/`test` ada failure pre-existing yang tak terkait, catat di ringkasan, jangan perbaiki di luar scope).

- [ ] **Step 2: Manual check `expo start`**

Buka Home, Reports, Budgets: label tampil `Sep` dkk (tanpa tahun), panah rapat 40px, next hilang di bulan berjalan, prev hilang di ujung tertua, tap label membuka MonthPicker (termasuk Budgets yang baru), swipe PagerView sinkron. Catat hasil di ringkasan akhir.

- [ ] **Step 3: Commit dokumentasi bila berubah**

```bash
git add docs/superpowers/specs/2026-09-09-period-header-consistency-design.md
git commit -m "docs: changelog period header no-dots revision" || echo "nothing to commit"
```
