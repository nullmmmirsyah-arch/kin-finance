# Category Custom Icons — Design

> Date: 2026-09-03
> Source: `assets/icons` (56 PNG + manifest.json), existing Categories feature
> Status: Approved

---

## Overview

Enable per-category icon selection from the existing `assets/icons` set (56 PNG, 56x56, icon_area_target 32x32). Currently `convex/schema.ts:60` categories has no icon field; `components/CategoryCard.tsx:48` renders static Feather `tag`; `components/TransactionCard.tsx:7` uses hardcoded Feather mapping. This design adds an optional `icon` string field, a central registry with static `require()` map (Expo requirement), validation, a 4-column grid picker in `app/category-form.tsx`, and PNG rendering in every category surface with `other.png` fallback for legacy rows.

Decisions below reflect brainstorming approvals: icon required with default `other`, legacy fallback `other.png`, plain 4-col grid, display in all category surfaces.

## Decisions

- **Registry is single source of truth:** `constants/categoryIcons.ts` mirrors `assets/icons/manifest.json` — `ALL_CATEGORY_ICONS` (56 names), `CATEGORY_ICON_MAP` (static `require`), `DEFAULT_CATEGORY_ICON = "other"`, `isValidCategoryIcon()` allowlist, `getCategoryIconSource(name?: string)` fallback.
- **Schema is optional string, not strict enum:** `icon: v.optional(v.string())` in `convex/schema.ts:60`. Allows zero-migration for existing households; new categories default to `other` on client. Strict `v.union(v.literal(...))` rejected (56 literals, schema churn per icon add).
- **Picker is plain grid:** 4 columns, 56 items (14 rows) scrollable inside `KeyboardAwareScrollView`, no search/grouping per user choice. Selected cell: `borderWidth 2`, `borderColor C.primary`, `backgroundColor C.surface`; unselected: `borderWidth 1`, `borderColor C.border`.
- **Fallback is `other.png`, not Feather:** Any `undefined`/invalid icon resolves via `getCategoryIconSource` to `other.png`. Transfer rows keep `arrow-right` Feather; all other category displays use PNG.
- **Display everywhere:** `CategoryCard`, `TransactionCard`, `transaction-form` category selector, `budgets` pills, `reports` ranking cards — all use `getCategoryIconSource(c.icon)`. Consistent PNG treatment.

## Architecture

```
assets/icons/*.png + manifest.json
        ↓
constants/categoryIcons.ts (registry, require map)
        ↓
convex/schema.ts (icon?: string) ←→ convex/categories.ts (validate allowlist)
        ↓
app/category-form.tsx (picker grid, icon state)
        ↓
app/categories.tsx → components/CategoryCard.tsx (PNG 32px in 44px circle)
                     components/TransactionCard.tsx (PNG 28px in 40px circle)
                     app/transaction-form.tsx (selector row PNG 24px)
                     reports/budgets (ranking/card PNGs)
```

- **Follow existing patterns:** Convex handlers use `getUserAndMembership` + `requireOwner` + `ConvexError`; UI uses NativeWind `className`, `useThemeColors()`, `expo-image` `<Image>`; no `Pressable style={({pressed})=>...}` callback; path alias `@/*`.

## Backend — `convex/categories.ts`

| Function | Args added | Behavior |
|----------|------------|----------|
| `list` (query) | – | Already returns full `categories` docs; now includes `icon` field automatically. `isOwner` + hidden filtering unchanged; reserved "Initial Balance" exclusion unchanged. |
| `create` (mutation) | `icon?: string` (`v.optional(v.string())`) | Owner only. After `validateCategoryName`, if `icon !== undefined && icon !== ""` then `isValidCategoryIcon(icon)` else throw `ConvexError("Invalid category icon.")`. Insert with `icon: args.icon ?? DEFAULT_CATEGORY_ICON` (client sends default `other`; server stores whatever is passed; if undefined, store undefined and let client fallback — but create path will receive `other` from form). |
| `update` (mutation) | `icon?: string` | Owner only. If `args.icon !== undefined`: if `isValidCategoryIcon(args.icon)` then `patch.icon = args.icon`; if `args.icon === ""` treat as clear → `patch.icon = undefined`; else throw. Patch type extended with `icon?: string`. `updatedAt` bump. |

- Validation shares `constants/categoryIcons.ts:isValidCategoryIcon` (imported in Convex). No new index needed.
- Existing `getScopedDoc` household scoping unchanged.

## UI — `constants/categoryIcons.ts` (new)

- `ALL_CATEGORY_ICONS: readonly string[]` — 56 entries from manifest in same order.
- `CATEGORY_ICON_MAP: Record<CategoryIconName, number>` — each `require("@/assets/icons/<name>.png")` static.
- `isValidCategoryIcon(name: string): name is CategoryIconName` — `ALL_CATEGORY_ICONS.includes(name)`.
- `getCategoryIconSource(name?: string): number` — valid → map entry; otherwise `map["other"]`.
- Export `CategoryIconName` type.

- `constants/categories.ts:1` re-exports `DEFAULT_CATEGORY_ICON`, `ALL_CATEGORY_ICONS`, `CategoryIconName`, `isValidCategoryIcon`, `getCategoryIconSource` for convenience.

## UI — `app/category-form.tsx`

- State: `const [icon, setIcon] = useState<CategoryIconName>(DEFAULT_CATEGORY_ICON)`
- Seed on edit: `useEffect` when `editingCategory` loaded → `setIcon(isValidCategoryIcon(editingCategory.icon ?? "") ? editingCategory.icon as CategoryIconName : DEFAULT_CATEGORY_ICON)`
- Dirty: include `icon !== (editingCategory?.icon ?? DEFAULT_CATEGORY_ICON)` for edit; `icon !== DEFAULT_CATEGORY_ICON` for create (in addition to name/type/hidden).
- canSubmit: add `isValidCategoryIcon(icon)` check.
- Picker UI: inserted after Category type chips, before Visible toggle:
  ```
  <View className="gap-1.5">
    <Text>Icon</Text>
    <View className="flex-row flex-wrap gap-2">
      56× Pressable 56x56 borderRadius 12, selected 2px primary else 1px border
        → <Image source={CATEGORY_ICON_MAP[n]} style 32x32 contentFit contain />
    </View>
  </View>
  ```
- Submit: `createCategory({name, type, hidden, icon})` and `updateCategory({categoryId, name, type, hidden, icon})`.

## UI — `components/CategoryCard.tsx`

- Props: add `icon?: string`.
- Replace icon block:
  ```tsx
  <View style={{width:44,height:44,borderRadius:Radius.sm,backgroundColor:C.surface}} className="items-center justify-center overflow-hidden">
    <Image source={getCategoryIconSource(icon)} style={{width:32,height:32}} contentFit="contain" />
  </View>
  ```
- No Feather fallback needed; `getCategoryIconSource` already falls back to `other.png`. Keep `Feather` import for action buttons only.

## UI — `components/TransactionCard.tsx`

- Props: add `categoryIcon?: string | null`.
- Icon block:
  ```tsx
  {isTransfer ? <Feather name="arrow-right".../> : <Image source={getCategoryIconSource(categoryIcon ?? undefined)} style={{width:28,height:28}} contentFit="contain" />}
  ```
- Keep `getCategoryIcon` Feather fallback only if we decide to support legacy without registry — but with spec we use PNG fallback, so `getCategoryIcon` becomes dead code (keep for now, or remove).
- Background remains `C.surface`, size 40→ PNG 28.

## UI — Other surfaces

- `app/categories.tsx:182` passes `icon={item.icon}` to `CategoryCard`.
- `app/transaction-form.tsx` category selector rows: prepend `<Image source={getCategoryIconSource(c.icon)} style 24x24 />`.
- `app/(tabs)/budgets.tsx` / `components/BudgetCard` etc.: where category name shown, add PNG 24px.
- `app/(tabs)/reports.tsx` ranking cards: `CategoryRankingCard` / `BillRankingCard` rows prepend PNG.

## Data Flow

1. User opens `/category-form` → sees grid, default `other` selected (create) or existing icon (edit).
2. Taps icon → `setIcon` updates selected border.
3. Submit → Convex `create`/`update` with `icon` string → validation → stored.
4. `api.categories.list` reactive query returns categories with `icon`.
5. Every consumer (`CategoryCard`, `TransactionCard`, selectors) calls `getCategoryIconSource(category.icon)` → static `require` number → `expo-image` renders PNG.

## Error Handling

- Invalid icon string (client tamper or old DB value): `isValidCategoryIcon` false → `getCategoryIconSource` returns `other.png` (render safe); `create`/`update` throw `ConvexError("Invalid category icon.")` which surfaces via `getConvexErrorMessage` inline `error` state in form.
- Legacy categories (`icon === undefined`): same fallback `other.png`, no crash.
- Member cannot change icon (form guarded `isOwner === false` shows read-only screen, same as today).
- Expo `require` is static — no dynamic path; registry guarantees bundling. Adding new PNG requires adding entry to `ALL_CATEGORY_ICONS` + `CATEGORY_ICON_MAP` + `manifest.json`.

## Testing

- Unit: `tests/categories.icons.test.ts` — `isValidCategoryIcon` accepts valid/rejects invalid, `getCategoryIconSource` fallback to `other`.
- Convex: `convex-test` for `categories.create` with valid icon succeeds, invalid throws, `update` changes icon.
- UI: manual — create with `coffee`, edit to `groceries`, verify list and transaction row update; legacy row shows `other.png`; dark mode contrast check.
- Verification commands (per AGENTS.md): `npx convex codegen`, `npx tsc --noEmit`, `npm run lint`, `npm test`.

## Out of Scope

- Category colors, grouping/nesting, templates, reordering.
- Icon tinting per theme (PNGs assumed neutral; no runtime tint).
- Search/filter inside picker (plain grid per approval).
- Budgets/reports icon addition is follow-up if scope grows — spec covers wiring but plan may phase it.

## Success Criteria

- Owner can pick icon from 56 PNGs in form; `other` default works without interaction.
- `CategoryCard` and `TransactionCard` render selected PNG; legacy shows `other.png`.
- Invalid icon rejected server-side.
- All verification passes: codegen, tsc, lint, vitest.
- No regression on hidden/owner permission or existing validation (2–30 chars, unique per type).
