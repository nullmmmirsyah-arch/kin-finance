# Task 3 Report — Categories Page Visible/Hidden Sections + Badge Actions + Bulk Delete

**Branch:** fix/new-category-page
**Commit:** c67a7be feat(category): Visible/Hidden sections with badge -/+/x and bulk delete hidden
**Date:** 2026-09-06

## Steps Executed

- [x] **Step 1:** Created `tests/categories.visibleHidden.test.ts` with exact partition function from brief:
  ```ts
  function partition<T extends {hidden:boolean; type:string}>(cats:T[], filter:string) {
    const filtered = filter==="all"?cats:cats.filter(c=>c.type===filter);
    return { visible: filtered.filter(c=>!c.hidden), hidden: filtered.filter(c=>c.hidden) };
  }
  // asserts: partition(all).visible.length 2, partition(expense).hidden.length 1
  ```
- [x] **Step 2:** Ran `npm test -- tests/categories.visibleHidden.test.ts` → PASS 1/1, then full suite PASS 35/35 203 tests.
- [x] **Step 3:** Modified `app/categories.tsx:99-105` — added `useMemo` partition `{visible, hidden}` from `visibleCategories` with null guard `as any`.
- [x] **Step 4:** Added `handleBulkDeleteHidden` `useCallback` in `app/categories.tsx:148-163` — Alert confirm `Delete N hidden categories?`, `Promise.allSettled` over `hidden.map(removeCategory)`, Snackbar summary `ok deleted, fail failed (in use)` or `${ok} hidden categories deleted`.
- [x] **Step 5:** Replaced `FlatList` render (`~292-334`) with `ScrollView` containing:
  - Visible section: header `Visible` (14/800 C.textPrimary) + `(Long press to reorder)` (12/600 C.textSecondary) + count, FlatList `key=v-numColumns` for `visible` with `CategoryCircle hidden=false onToggleVisibility/onDelete` (isOwner guard), placeholder `<Text>No visible categories</Text>` italic when empty.
  - Hidden section conditional `hidden && hidden.length>0`: header `Hidden` + count + Pressable `Delete hidden categories` (12/700 C.error underline) `accessibilityLabel="Delete hidden categories"` with `isOwner` guard, FlatList `key=h-numColumns` for `hidden` with `CategoryCircle hidden=true onToggleVisibility/onDelete`.
  - `ReservedFooter` at bottom of ScrollView.
  - Imports: added `ScrollView` from `react-native`, added `CategoryCircle` from `components/CategoryCard` (removed unused `PlushCategoryCard` import to pass lint). `PlushCategoryCard` still available via `CategoryCard.tsx:122` but not used in this page after switch to `CategoryCircle` for badge overlays (minus/plus/close via `CategoryBadge` 18px #FACC15/#FCA5A5).
  - Preserved EmptyState for `visibleCategories.length===0` (filtered empty) per brief; when Visible empty but Hidden non-empty shows placeholder inside Visible section.
- [x] **Step 6:** Verified `npx tsc --noEmit` → 0 errors (fixed implicit any on `hidden.map((c:any))`), `npm run lint` → 0 errors (expo lint), `npm test` → 35 passed 203 passed.
- [x] **Step 7:** Committed `git add app/categories.tsx tests/categories.visibleHidden.test.ts` → `c67a7be`.

## Interfaces Verified

- Consumes: `result.categories`, `filter`, new `CategoryCircle` (56px circle, CategoryIcon 32, CategoryBadge minus/plus/close 18px), mutations `updateCategory`/`removeCategory` + `useSnackbar`/`getConvexErrorMessage` — all wired.
- Produces: Two FlatList sections inside ScrollView (Visible/Hidden) with correct partition and bulk delete; member view hides bulk link and badges via `isOwner` guard (Hidden section empty for member due to server filtering).

## Constraints

- Expo SDK 54, NativeWind className, theme via `useThemeColors` (C.textPrimary, C.textSecondary, C.error, C.cardBorder), no Pressable `style` callback (uses static style), 56px touch target via CategoryCircle 56+ hitSlop 6 on badges.
- File was 336 lines → 390 lines after modification; numColumns 2/3 preserved.

## Verification Output

```
npx tsc --noEmit → (no output) ok
npm run lint → expo lint ok
npm test → Test Files 35 passed, Tests 203 passed, Duration 5.69s
npm test -- tests/categories.visibleHidden.test.ts → 1 passed
```

## Next

Task 4 final verification + PR (push `fix/new-category-page` → PR feat→review).

---
## Fix Round 1/5 — 2026-09-06

**Base:** c67a7be
**Fix commit:** (next)
**Findings addressed:** 3/3

### Findings Fixed

1. **Critical functional — onEdit missing (`app/categories.tsx:335-344 + 372-381`, `components/CategoryCard.tsx:338`):**
   - `components/CategoryCard.tsx:338-379` `CategoryCircle` Props already declared `onEdit` but destructured only `name,icon,hidden,onToggleVisibility,onDelete` — `type` and `onEdit` dead. Fixed: destructure `type` as `_type` (void) + `onEdit`, make circle pressable when `onEdit` present: `<Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel="Edit category {name}" style={circleStyle}>` wrapping `CategoryIcon 32`, else plain `View`. Keeps badge overlays (`minus/plus/close` 18px absolute) as siblings in `position:relative` 56x56 container.
   - `app/categories.tsx:335-344` Visible section now passes `onEdit={isOwner ? () => router.push({pathname:"/category-form", params:{id:item._id}}) : undefined}` (brief Step 5:73). Hidden section also wired same `onEdit` (reviewer: "if hidden edit needed, also wire") — `app/categories.tsx:372-381`.
   - `useRouter` already imported at `app/categories.tsx:12` — no new import needed.

2. **Type safety — `app/categories.tsx:156 hidden.map((c:any))`:**
   - Removed `any`: `hidden.map((c) => removeCategory(...))`.
   - Fixed implicit-any TS7006 by typing null guard `as any` → `as typeof visibleCategories` (`visible: null as typeof visibleCategories, hidden: null as typeof visibleCategories`) at `app/categories.tsx:100`, so `hidden` narrows to `Doc[] | null` and `c` inferred correctly. `npx tsc --noEmit` now 0 errors.

3. **Minor a11y — `app/categories.tsx:359` Delete hidden Pressable:**
   - Added `accessibilityRole="button"` and `hitSlop={{top:8,bottom:8,left:8,right:8}}` to `<Pressable onPress={handleBulkDeleteHidden}>` (was only `accessibilityLabel`).

### Verification

```
npx tsc --noEmit → (no output) ok
npm run lint → expo lint ok
npm test -- tests/categories.visibleHidden.test.ts → 1 passed
npm test → Test Files 35 passed, Tests 203 passed
```

### Files Changed

- `components/CategoryCard.tsx` — CategoryCircle now supports `onEdit` via pressable circle
- `app/categories.tsx` — removed `any`, typed null guard, wired `onEdit` both sections, a11y hitSlop+role on bulk delete
