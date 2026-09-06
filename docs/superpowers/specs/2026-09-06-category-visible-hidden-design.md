# Category Visible/Hidden Sections + Responsive IconPicker

> Date: 2026-09-06
> Status: Approved design (approach A+C — Section Split + Responsive Grid)
> Related: `app/categories.tsx:1`, `app/category-form.tsx:1`, `modules/icon-registry/index.tsx:78`, `convex/categories.ts:1`, `convex/schema.ts:60`, `components/CategoryCard.tsx:1`, `docs/Product Requirement Document/PRD.md` §3.5 Categories, `docs/superpowers/specs/2026-09-03-category-icons-design.md`

## 1. Overview

Mimic reference app's **In Use / Not Used** but mapped to existing `hidden` boolean: **Visible** (`hidden=false`) and **Hidden** (`hidden=true`). Keep current filter chips `All | Income | Expense` — filtered list is partitioned into two vertical sections. Improve `IconPicker` from fixed `numColumns=4` (56px circle, gap 8, looks stretched on wide phones — screenshot `Create Category` 4-col wasted right padding) to **responsive columns** that keeps 56px touch target and computes `numColumns` from `useWindowDimensions().width`.

Phase 1 (this spec): section split + badge actions + bulk delete link + responsive picker. No schema migration, no drag reorder (Phase 2 optional via `order` field). JS-only, no native rebuild.

## 2. Architecture

- No schema change. `categories.hidden` remains source of truth (`convex/schema.ts:65` `hidden: v.boolean()`). `convex/categories.ts:list` already partitions visibility for member (`!hidden` filter). Owner sees both.
- Partition is client-side derived: `filtered = filter==="all" ? categories : categories.filter(c=>c.type===filter)` → `visible = filtered.filter(c=>!c.hidden)`, `hidden = filtered.filter(c=>c.hidden)` via `useMemo` in `app/categories.tsx:91`. No new Convex query.
- `app/categories.tsx` owns grouping and section headers. No new table, no `npx convex codegen`.
- `modules/icon-registry/index.tsx:IconPicker` owns responsive column calc. No dependency on `categories.tsx`. Keeps `FlatList` virtualization.
- Badge actions reuse existing mutations: `api.categories.update` (toggle `hidden`) and `api.categories.remove` (delete). Bulk delete iterates `hidden` ids sequentially with error aggregation (skip budget/tx-guarded failures).
- Future Phase 2 drag would add `order?: number` to `categories` + `reorder` mutation + `react-native-reanimated` + `gesture-handler` long-press — explicitly out of scope here.

## 3. Components & Files

### Modified

- `app/categories.tsx`
  - Keep `FILTERS` Chips (`All/Income/Expense`) + Add button.
  - After `visibleCategories` derivation, compute `{visible, hidden}` partitions (guard `null`).
  - Replace single `FlatList` grid with `ScrollView` containing two sections stacked vertically (`gap 24`):
    - **Header Visible**: `Text "Visible"` `14px 800 C.textPrimary` + `Text "(Long press to reorder)"` `12px 600 C.textSecondary` (placeholder — no drag yet, copy matches reference) + count badge `Visible (12)`. FlatList `numColumns={numColumns}` same as today (2 / 3 tablet) for `visible` data. `renderItem` uses new `CategoryCircle` or existing `PlushCategoryCard` with badge overlay.
    - **Header Hidden**: `Text "Hidden"` + right-aligned `Pressable "Delete hidden categories"` `12px 700 underline C.primary` — only when `hidden.length>0 && isOwner`. Tap → `Alert` confirm `Delete 4 hidden categories?` → loop `removeCategory` (or new bulk mutation if added) → `Snackbar` result. FlatList for `hidden` data below.
  - New badge overlays on each card/circle: Visible cards top-left `-` (Feather `minus` 10px, yellow `bg #FACC15` circle 18px, `borderWidth 2 C.cardBorder`); Hidden cards top-left `+` (Feather `plus`) yellow + top-right `x` (Feather `x` 10px, red `bg #FCA5A5`) — both 18px absolute, `hitSlop 6`. Tap `-`/`+` → `handleToggleVisibility`; tap `x` → `handleDelete` with existing Alert.
  - Empty handling: if `filtered.length===0` → existing EmptyState + ReservedFooter; else if `visible.length===0 && hidden.length>0` → Visible section shows subtle empty `Text "No visible categories"` dashed placeholder; similarly Hidden empty not rendered (no header) to reduce noise. Access to `ReservedFooter` stays at bottom.
  - Keep `numColumns` logic `width>=700?3:2` for category grid (Plush). No change there.

- `components/CategoryCard.tsx`
  - Optionally add `CategoryCircle` presentational component for circular icon style matching reference (56px circle, white 2.5px border, icon 32px, label 12px 600). Or enhance `PlushCategoryCard` to support `variant="circle"` — keep decision to implementer, but spec recommends new `CategoryCircle` to avoid breaking existing Plush 2-col card width calc. Export `CategoryCircle`.
  - Shared badge component `CategoryBadge` (`type: "minus"|"plus"|"close"`, `size 18`, colors `minus/plus: #FACC15`, `close: #FCA5A5`, border `C.cardBorder` 2, Feather icon).

- `modules/icon-registry/index.tsx:IconPicker`
  - Replace `numColumns={4}` fix with responsive calc:
    ```ts
    const { width } = useWindowDimensions();
    const H_PADDING = 40; // px-5 *2 = 40
    const GAP = 8;
    const ITEM = 56;
    const cols = Math.max(4, Math.min(6, Math.floor((width - H_PADDING + GAP) / (ITEM + GAP))));
    // 360→5, 390→6, 412→6, tablet≥700→6
    ```
  - Pass `numColumns={cols}` to `FlatList`, `columnWrapperStyle={{gap: GAP}}`, `contentContainerStyle={{gap: GAP}}`.
  - Update `getItemLayout` to use `cols`: `offset: 64 * Math.floor(index / cols)`, length 64 (56+8).
  - Keep `size=32`, circle `width/height 56`, `border` logic. Ensure `removeClippedSubviews` and `initialNumToRender` unchanged.
  - Alternative: if `cols>4` reduce `GAP` to 6 on small widths — not needed for MVP, keep 8.

### Out of scope

- Drag reorder persistence (`order` field, `categories.reorder` mutation).
- Pagination or virtualized SectionList with pinned headers.
- Changing Plush theme to black background like reference — keep `C.background #FFFBF5` / `C.card` warm.
- Icon search/filter.

## 4. Data Flow

```
useQuery(api.categories.list) → {categories, isOwner}
filter state ("all"|"expense"|"income")
filtered = filter==="all" ? categories : categories.filter(type)
visible = filtered.filter(!hidden)
hidden  = filtered.filter(hidden)
→ Section Visible: FlatList data=visible
→ Section Hidden:  FlatList data=hidden + bulk delete
IconPicker: useWindowDimensions().width → cols → FlatList numColumns
badge tap → updateCategory({categoryId, hidden: !hidden}) → Snackbar
x tap → removeCategory({categoryId}) → Alert → Snackbar
bulk delete tap → Alert confirm → Promise.allSettled(hidden.map(r=>remove)) → Snackbar summary
```

No new Convex functions; all via existing `api.categories.update/remove`. Member: `isOwner false` → `categories` already filtered hidden, so hidden section not rendered and bulk delete hidden.

## 5. Rendering & Visual

- Headers: `Visible` 16px 800, subtitle 12px 600 `C.textSecondary`, count optional. `Hidden` 16px 800. Spacing `gap 8` between header and grid, `gap 24` between sections.
- Grids: reuse existing `numColumns` 2/3 for categories (Plush). IconPicker responsive 4-6 cols as above. All cards keep `Shadow.card`, `border 2.5 C.cardBorder` (Plush) or `C.border` (Picker).
- Badges: 18px circle, absolute `-4` offset from icon container, `border 2`, `Feather` 10px centered. Colors match reference: `plus/minus` `#FACC15` (Tailwind yellow-300), `x` `#FCA5A5` (red-300). Hidden `+` left, `x` right to avoid overlap.
- Bulk delete link: `Text "Delete hidden categories"` 12px 700 `C.error` or `C.primary`, `underline`, `hitSlop 8`, right-aligned in Hidden header row.
- Dark mode: `C.card`/`C.background` aware, badge border `C.cardBorder` dark variant `#292524`.
- A11y: `accessibilityLabel` per badge ("Hide category Dining", "Show category Digital", "Delete category Digital"), `accessibilityRole="button"`.

## 6. Error Handling & Fallback

- Toggle/delete errors → `getConvexErrorMessage(e, fallback)` → `Snackbar` (existing pattern).
- Budget/tx-guarded delete failure (`Cannot delete category — existing budgets/transactions...`) → `Snackbar` with message, item remains in Hidden.
- Bulk delete: iterate sequentially, collect failures, show `Snackbar "4 deleted, 1 failed: ..."`; partial success still reflects remaining items due to live query.
- Member visibility: Hidden section not rendered for Member; toggle/delete buttons not rendered (guard `isOwner`).
- IconPicker: if `width` undefined (SSR) fallback `cols=4`.
- Reserved "Initial Balance" categories filtered out by `convex/categories.ts:list` `manageable` already, not shown in either section.

## 7. Testing & Validation

- New `tests/categories.visibleHidden.test.ts` — partition logic: filter All→counts, filter expense/income→correct visible/hidden per hidden flag.
- Existing `convex-test` suites for categories remain green (no schema change).
- Manual smoke: categories.tsx filter All→see two sections, tap - on Visible → moves to Hidden (live), tap + on Hidden → moves to Visible, tap x → Alert → delete, bulk delete → confirm → clear Hidden, IconPicker on 360/390/412 widths shows 5/6 cols without horizontal scroll, getItemLayout offset correct.
- Validation commands (per AGENTS.md): `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest) — all must pass. No `npx convex codegen` needed (no schema change).

## 8. PRD & Docs Impact

- Header Last updated: `2026-09-06 (Category Visible/Hidden sections + responsive IconPicker)`
- §2.1 Categories row — note Visible/Hidden sections filtered by `hidden`, badge actions, bulk delete, IconPicker responsive 4-6 cols.
- §3.5 Categories — describe Visible/Hidden grouping, badge -/+/x, bulk delete, IconPicker calc, reference to `modules/icon-registry`.
- §3.9 Design System Icons — note IconPicker responsive columns.
- §8 Change Log — dated entry with files + verification.

## 9. Attribution

No new attribution. Streamline CC BY 4.0 credit retained for icons (unchanged).

## 10. Alternatives Considered

- B: Full drag reorder with `order` field — richer but requires migration + `npx convex codegen` + OCC handling; deferred to Phase 2.
- C: Fixed 6-col IconPicker without calc — would overflow on 360dp (screenshot issue remains), rejected.
- D: Replace Plush 2-col with 4-col circular grid like reference — breaks existing warm theme and would require redesigning all cards; rejected.
