# Category Custom Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable per-category icon selection from `assets/icons` (56 PNGs) via schema field + picker UI, rendering PNG in CategoryCard/TransactionCard with fallback.

**Architecture:** Create `constants/categoryIcons.ts` registry that mirrors `assets/icons/manifest.json` with static `require()` map (Expo requires static). Add optional `icon?: string` to `convex/schema.ts` categories table. Validate against allowed set in Convex mutations. Add grid picker to `app/category-form.tsx`. Update `components/CategoryCard.tsx` and `components/TransactionCard.tsx` to render `<Image>` PNG instead of Feather fallback, with `other.png` fallback for legacy categories.

**Tech Stack:** Expo SDK 54, Convex 1.43, NativeWind v4, expo-image, TypeScript 5.9, Vitest 4.1

## Global Constraints

- Use NativeWind `className`, not `StyleSheet.create`; import theme from `constants/theme.ts`; dark mode via `useThemeColors()`/`useThemeGradients()` + `dark:` variants — do not use `Colors` directly.
- Never use `style` callback on `Pressable` (use `useState` pressed + static style) — NativeWind v4 breaks with callback (see GH #847).
- Gradient cards: `expo-linear-gradient` + `Gradients.card`; shadows `Shadow.card`/`Shadow.elevated`; icons `@expo/vector-icons/Feather` (keep for action buttons); money inputs use `<Input amount />`.
- Path alias `@/*` → repo root; `app/` is expo-router with `Stack.Protected guard={...}`; Convex schema is source of truth; every Convex handler requires `ctx.auth.getUserIdentity()` and throws `ConvexError`.
- Verify with `npx convex codegen` after schema change, then `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest).
- Amounts are signed integers (+income/-expense), no decimals — category work must not break amount handling.

---

## File Structure

- **Create:** `constants/categoryIcons.ts` — icon registry: `ALL_CATEGORY_ICONS` list, `CATEGORY_ICON_MAP` require map, `isValidCategoryIcon()`, `getCategoryIconSource()`, `DEFAULT_CATEGORY_ICON`.
- **Modify:** `convex/schema.ts:60-67` — add `icon: v.optional(v.string())` to categories table.
- **Modify:** `convex/categories.ts:1-78` — import validator, add `icon` arg to create/update, validate, patch.
- **Modify:** `constants/categories.ts:1-8` — re-export icon constants for convenience.
- **Modify:** `components/CategoryCard.tsx:1-111` — accept `icon?: string`, render PNG `<Image>` fallback to Feather `tag` if invalid.
- **Modify:** `components/TransactionCard.tsx:1-138` — accept optional categoryIcon, render PNG with type-tinted background fallback.
- **Modify:** `app/category-form.tsx:1-229` — add `icon` state, picker grid, seeded from editingCategory, submit with icon, dirty check.
- **Modify:** `app/categories.tsx:1-214` — pass `icon` prop to CategoryCard.
- **Modify:** `convex/households.ts` — no change (verify default categories seeding if any; currently no seeding — check).
- **Test:** `tests/categories.icons.test.ts` — unit tests for `isValidCategoryIcon`, `getCategoryIconSource`, fallback behavior.

---

### Task 1: Create Icon Registry

**Files:**
- Create: `constants/categoryIcons.ts`
- Modify: `constants/categories.ts:1-8`

**Interfaces:**
- Consumes: `assets/icons/manifest.json` (56 entries), `assets/icons/*.png`
- Produces: `ALL_CATEGORY_ICONS: string[]`, `CATEGORY_ICON_MAP: Record<string, number>` (require result), `DEFAULT_CATEGORY_ICON = "other"`, `isValidCategoryIcon(name: string): boolean`, `getCategoryIconSource(name?: string): number` (returns require for Image source)

- [ ] **Step 1: Create `constants/categoryIcons.ts` with static require map**

```ts
// constants/categoryIcons.ts
export const DEFAULT_CATEGORY_ICON = "other" as const;

export const ALL_CATEGORY_ICONS = [
  "shopping_bag","groceries","serving_dish","coffee","bubble_tea","cutlery","pizza","burger","milk_fruit","bread","birthday_cake","donut","household_goods","clothing","shoes","shopping_cart","home","electricity","water","gas","internet","phone","entertainment","insurance","car","motorcycle","fuel","train","bus","flight","parking","taxi","health","medicine","doctor","fitness","education","graduation","work","laptop","wallet","savings","piggy_bank","income","investment","gift","travel_ticket","vacation","mosque","charity","cash_wallet","bank","family","pet","plant","other",
] as const;

export type CategoryIconName = typeof ALL_CATEGORY_ICONS[number];

export const CATEGORY_ICON_MAP: Record<CategoryIconName, number> = {
  shopping_bag: require("@/assets/icons/shopping_bag.png"),
  groceries: require("@/assets/icons/groceries.png"),
  serving_dish: require("@/assets/icons/serving_dish.png"),
  coffee: require("@/assets/icons/coffee.png"),
  bubble_tea: require("@/assets/icons/bubble_tea.png"),
  cutlery: require("@/assets/icons/cutlery.png"),
  pizza: require("@/assets/icons/pizza.png"),
  burger: require("@/assets/icons/burger.png"),
  milk_fruit: require("@/assets/icons/milk_fruit.png"),
  bread: require("@/assets/icons/bread.png"),
  birthday_cake: require("@/assets/icons/birthday_cake.png"),
  donut: require("@/assets/icons/donut.png"),
  household_goods: require("@/assets/icons/household_goods.png"),
  clothing: require("@/assets/icons/clothing.png"),
  shoes: require("@/assets/icons/shoes.png"),
  shopping_cart: require("@/assets/icons/shopping_cart.png"),
  home: require("@/assets/icons/home.png"),
  electricity: require("@/assets/icons/electricity.png"),
  water: require("@/assets/icons/water.png"),
  gas: require("@/assets/icons/gas.png"),
  internet: require("@/assets/icons/internet.png"),
  phone: require("@/assets/icons/phone.png"),
  entertainment: require("@/assets/icons/entertainment.png"),
  insurance: require("@/assets/icons/insurance.png"),
  car: require("@/assets/icons/car.png"),
  motorcycle: require("@/assets/icons/motorcycle.png"),
  fuel: require("@/assets/icons/fuel.png"),
  train: require("@/assets/icons/train.png"),
  bus: require("@/assets/icons/bus.png"),
  flight: require("@/assets/icons/flight.png"),
  parking: require("@/assets/icons/parking.png"),
  taxi: require("@/assets/icons/taxi.png"),
  health: require("@/assets/icons/health.png"),
  medicine: require("@/assets/icons/medicine.png"),
  doctor: require("@/assets/icons/doctor.png"),
  fitness: require("@/assets/icons/fitness.png"),
  education: require("@/assets/icons/education.png"),
  graduation: require("@/assets/icons/graduation.png"),
  work: require("@/assets/icons/work.png"),
  laptop: require("@/assets/icons/laptop.png"),
  wallet: require("@/assets/icons/wallet.png"),
  savings: require("@/assets/icons/savings.png"),
  piggy_bank: require("@/assets/icons/piggy_bank.png"),
  income: require("@/assets/icons/income.png"),
  investment: require("@/assets/icons/investment.png"),
  gift: require("@/assets/icons/gift.png"),
  travel_ticket: require("@/assets/icons/travel_ticket.png"),
  vacation: require("@/assets/icons/vacation.png"),
  mosque: require("@/assets/icons/mosque.png"),
  charity: require("@/assets/icons/charity.png"),
  cash_wallet: require("@/assets/icons/cash_wallet.png"),
  bank: require("@/assets/icons/bank.png"),
  family: require("@/assets/icons/family.png"),
  pet: require("@/assets/icons/pet.png"),
  plant: require("@/assets/icons/plant.png"),
  other: require("@/assets/icons/other.png"),
};

export function isValidCategoryIcon(name: string): name is CategoryIconName {
  return (ALL_CATEGORY_ICONS as readonly string[]).includes(name);
}

export function getCategoryIconSource(name?: string): number {
  if (name && isValidCategoryIcon(name)) return CATEGORY_ICON_MAP[name];
  return CATEGORY_ICON_MAP[DEFAULT_CATEGORY_ICON];
}
```

- [ ] **Step 2: Update `constants/categories.ts` to re-export for convenience**

```ts
// constants/categories.ts:1-8 - APPEND (keep existing)
export { DEFAULT_CATEGORY_ICON, ALL_CATEGORY_ICONS, CATEGORY_ICON_MAP, isValidCategoryIcon, getCategoryIconSource } from "./categoryIcons";
export type { CategoryIconName } from "./categoryIcons";
```

- [ ] **Step 3: Run typecheck on new file**

Run: `npx tsc --noEmit`
Expected: PASS (no errors; requires correct relative requires)

- [ ] **Step 4: Commit**

```bash
git add constants/categoryIcons.ts constants/categories.ts
git commit -m "feat: add category icon registry with 56 PNG require map"
```

---

### Task 2: Convex Schema + Backend Validation

**Files:**
- Modify: `convex/schema.ts:60-67`
- Modify: `convex/categories.ts:1-206`
- Test: `tests/categories.icons.test.ts` (new)

**Interfaces:**
- Consumes: `constants/categoryIcons.ts: isValidCategoryIcon`
- Produces: categories table now has `icon?: string`; `create({name, type, hidden, icon})` and `update({categoryId, name, type, hidden, icon})` validate icon against allowlist

- [ ] **Step 1: Update schema**

```ts
// convex/schema.ts:60
  categories: defineTable({
    householdId: v.id("households"),
    name: v.string(),
    type: v.union(v.literal("income"), v.literal("expense")),
    icon: v.optional(v.string()),
    hidden: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_householdId", ["householdId"]),
```

- [ ] **Step 2: Write failing test for icon validation**

Create `tests/categories.icons.test.ts`:
```ts
import { isValidCategoryIcon, getCategoryIconSource, DEFAULT_CATEGORY_ICON, CATEGORY_ICON_MAP } from "@/constants/categoryIcons";
import { describe, it, expect } from "vitest";

describe("categoryIcons", () => {
  it("accepts valid icons", () => {
    expect(isValidCategoryIcon("groceries")).toBe(true);
    expect(isValidCategoryIcon("other")).toBe(true);
  });
  it("rejects invalid icons", () => {
    expect(isValidCategoryIcon("invalid")).toBe(false);
    expect(isValidCategoryIcon("")).toBe(false);
  });
  it("getCategoryIconSource falls back to other", () => {
    expect(getCategoryIconSource("invalid")).toBe(CATEGORY_ICON_MAP[DEFAULT_CATEGORY_ICON]);
    expect(getCategoryIconSource(undefined)).toBe(CATEGORY_ICON_MAP[DEFAULT_CATEGORY_ICON]);
    expect(getCategoryIconSource("groceries")).toBe(CATEGORY_ICON_MAP["groceries"]);
  });
});
```

- [ ] **Step 3: Run test to verify it passes (it should, registry is pure)**

Run: `npm test -- tests/categories.icons.test.ts`
Expected: PASS

- [ ] **Step 4: Update `convex/categories.ts` imports + add icon validation**

```ts
// top of convex/categories.ts
import { isValidCategoryIcon } from "../constants/categoryIcons";

// in create args:
  args: { name: v.string(), type: categoryType, hidden: v.optional(v.boolean()), icon: v.optional(v.string()) },

// in create handler after trimming name:
    if (args.icon !== undefined && args.icon !== null) {
      if (!isValidCategoryIcon(args.icon)) throw new ConvexError("Invalid category icon.");
    }

// add to insert:
      icon: args.icon,

// in update args:
    icon: v.optional(v.string()),

// in update patch type add icon?: string
// in update handler after patch init:
    if (args.icon !== undefined) {
      if (args.icon !== "" && !isValidCategoryIcon(args.icon)) throw new ConvexError("Invalid category icon.");
      patch.icon = args.icon || undefined;
    }

// also need patch type: { name?: string; type?: ...; icon?: string; hidden?: boolean; updatedAt: number }
```

Note: Allow `undefined` to clear icon? But we treat empty string as clear. Better to allow `v.optional(v.string())` and set `patch.icon = args.icon` if provided.

- [ ] **Step 5: Run codegen then typecheck**

Run: `npx convex codegen`
Run: `npx tsc --noEmit`
Expected: PASS — `_generated/dataModel` now has `icon?: string` on categories

- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts convex/categories.ts tests/categories.icons.test.ts
git commit -m "feat: add icon field to categories schema and validate against registry"
```

---

### Task 3: Render PNG in CategoryCard + TransactionCard

**Files:**
- Modify: `components/CategoryCard.tsx:1-111`
- Modify: `components/TransactionCard.tsx:1-138`
- Modify: `app/categories.tsx:1-214`

**Interfaces:**
- Consumes: `getCategoryIconSource`, `CategoryIconName` from registry
- Produces: `CategoryCard` now takes `icon?: string`; renders PNG Image 32x32 inside 44 circle; fallback feather `tag` if invalid/missing

- [ ] **Step 1: Update `components/CategoryCard.tsx`**

```tsx
import { Image } from "react-native";
import { getCategoryIconSource, isValidCategoryIcon } from "@/constants/categoryIcons";
// props add icon?: string
type Props = { name: string; type: CategoryType; icon?: string; hidden: boolean; onToggle... }

// inside render, replace <View><Feather name="tag"...> with:
        <View style={{ width: 44, height: 44, borderRadius: Radius.sm, backgroundColor: C.surface }} className="items-center justify-center overflow-hidden">
          {icon && isValidCategoryIcon(icon) ? (
            <Image source={getCategoryIconSource(icon)} style={{ width: 32, height: 32 }} contentFit="contain" />
          ) : (
            <Feather name="tag" size={20} color={C.primary} />
          )}
        </View>
```

Use `expo-image` Image (already in deps) not RN Image? Check project uses `expo-image` in package.json. Use `import { Image } from "expo-image"` for better. Keep fallback Feather.

- [ ] **Step 2: Update `components/TransactionCard.tsx`**

Props add `categoryIcon?: string | null` or derive from categoryName+icon mapping? Better: add `categoryIcon?: string | null` prop.

```tsx
import { Image } from "expo-image";
import { getCategoryIconSource, isValidCategoryIcon } from "@/constants/categoryIcons";

// props: categoryIcon?: string | null
// inside:
        <View style={{ width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: C.surface }} className="items-center justify-center overflow-hidden">
          {isTransfer ? (
            <Feather name="arrow-right" size={18} color={C.primary} />
          ) : categoryIcon && isValidCategoryIcon(categoryIcon) ? (
            <Image source={getCategoryIconSource(categoryIcon)} style={{ width: 28, height: 28 }} contentFit="contain" />
          ) : (
            <Feather name={getCategoryIcon(categoryName) as any} size={18} color={type==="income"?C.success:C.error} />
          )}
        </View>
```

Keep existing `getCategoryIcon` as fallback for legacy categories without icon.

- [ ] **Step 3: Update `app/categories.tsx` to pass icon**

Modify renderItem:
```tsx
<CategoryCard name={item.name} type={item.type} icon={item.icon} hidden={item.hidden} ... />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/CategoryCard.tsx components/TransactionCard.tsx app/categories.tsx
git commit -m "feat: render PNG icons in CategoryCard and TransactionCard with fallback"
```

---

### Task 4: Category Form Icon Picker

**Files:**
- Modify: `app/category-form.tsx:1-229`

**Interfaces:**
- Consumes: `ALL_CATEGORY_ICONS`, `CATEGORY_ICON_MAP`, `getCategoryIconSource`
- Produces: form state `icon: CategoryIconName` with default "other" or existing value; dirty check includes icon; submit passes icon; grid picker UI

- [ ] **Step 1: Add icon state and picker UI**

```tsx
import { ALL_CATEGORY_ICONS, CATEGORY_ICON_MAP, DEFAULT_CATEGORY_ICON, CategoryIconName, isValidCategoryIcon } from "@/constants/categoryIcons";
import { Image } from "expo-image";
import { FlatList } from "react-native";

// state:
const [icon, setIcon] = useState<CategoryIconName>(DEFAULT_CATEGORY_ICON);

// seeded:
if (editingCategory) {
  // ...
  setHidden(editingCategory.hidden);
  setIcon(isValidCategoryIcon(editingCategory.icon ?? "") ? (editingCategory.icon as CategoryIconName) : DEFAULT_CATEGORY_ICON);
}

// dirty:
hidden !== false || icon !== DEFAULT_CATEGORY_ICON  // create
icon !== (editingCategory.icon ?? DEFAULT_CATEGORY_ICON) // edit

// canSubmit also check isValidCategoryIcon(icon)

// UI after Category type section, before Visible toggle:
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">Icon</Text>
            <View className="flex-row flex-wrap gap-2">
              {ALL_CATEGORY_ICONS.map((n) => {
                const selected = icon === n;
                return (
                  <Pressable key={n} onPress={() => setIcon(n)} style={{ width: 56, height: 56, borderRadius: 12, borderWidth: selected ? 2 : 1, borderColor: selected ? C.primary : C.border, backgroundColor: selected ? C.surface : C.background }} className="items-center justify-center">
                    <Image source={CATEGORY_ICON_MAP[n]} style={{ width: 32, height: 32 }} contentFit="contain" />
                  </Pressable>
                );
              })}
            </View>
          </View>

// handleSubmit:
await createCategory({ name: trimmedName, type, hidden, icon });
await updateCategory({ categoryId: ..., name: ..., type, hidden, icon });
```

Ensure Pressable uses `useState` if pressed styling needed, but here border is based on selected not pressed — safe per NativeWind gotcha (no style callback).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/category-form.tsx
git commit -m "feat: add icon picker grid to category form"
```

---

### Task 5: Wiring Transactions + Data Flow Verification

**Files:**
- Modify: `convex/transactions.ts` (verify no change needed — already joins category via categoryId)
- Modify: `app/transaction-form.tsx` (if category picker shows icons — enhance)
- Modify: `app/(tabs)/home.tsx` and any list that renders TransactionCard (check props)

**Interfaces:**
- Consumes: categories query includes `icon`
- Produces: TransactionCard passed `categoryIcon` from fetched category

- [ ] **Step 1: Check `app/transaction-form.tsx` category picker**

If it lists categories via `useQuery(api.categories.list)`, update chips/dropdown to show PNG next to name.

Add icon preview in category selector row:
```tsx
{categories.map(c => (
  <Pressable ...>
    <Image source={getCategoryIconSource(c.icon)} style={{width: 24, height: 24}} />
    <Text>{c.name}</Text>
  </Pressable>
))}
```

If file doesn't have category picker, skip.

- [ ] **Step 2: Update any TransactionCard call sites to pass icon**

Search `grep -rn "TransactionCard"`. For each, ensure `categoryIcon={category?.icon}` is passed. Update `app/(tabs)/home.tsx:1001` and `app/search.tsx` etc.

- [ ] **Step 3: Test legacy categories still show fallback**

Verify `getCategoryIconSource(undefined)` → `other.png` displayed, not crash. Manual check: create category without icon (old data) → shows tag fallback or other.png per Task 3 logic (currently shows tag for missing icon — decide: better to show other.png for consistency). Choose fallback = other.png for missing? But spec says legacy fallback = tag OR other.png — pick other.png for better UX. Update Task 3 to prefer getCategoryIconSource if missing? We now have dual: if icon invalid/missing, show `other.png` via getCategoryIconSource instead of Feather tag. Adjust decision: show PNG other fallback, not tag. Update CategoryCard to always show PNG via getCategoryIconSource(icon) — remove Feather fallback except for transfer? Simpler: always PNG. Confirm with user maybe. For now keep tag fallback for undefined but consider switching.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/transaction-form.tsx app/\(tabs\)/home.tsx app/search.tsx
git commit -m "feat: wire category icon through transaction lists"
```

---

### Task 6: Final Verification

**Files:**
- All modified files
- Run: `npx convex codegen`, `npx tsc --noEmit`, `npm run lint`, `npm test`

- [ ] **Step 1: Codegen**

Run: `npx convex codegen`
Expected: no errors, `_generated/` gitignored but updated

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS (fix any expo lint errors — e.g., missing deps in useEffect)

- [ ] **Step 4: Tests**

Run: `npm test`
Expected: PASS — at least `tests/categories.icons.test.ts` plus existing 20+ tests (accounts, budgets, etc.) still pass

- [ ] **Step 5: Manual smoke checklist**

- Create category → pick icon coffee → save → list shows coffee PNG
- Edit category → change icon → save → updates
- Transaction with that category → TransactionCard shows same PNG
- Legacy category (no icon field) → shows fallback `other.png` or tag, no crash
- Dark mode → PNG contrast OK (PNGs are assumed transparent with dark/light neutral colors — verify visually)
- Owner vs member visibility still works

---

### Task 7: Update Documentation (PRD)

**Files:**
- Modify: `docs/Product Requirement Document/PRD.md:98, 2.2, 2.3, 3.5, 8`
- Modify: `docs/superpowers/specs/2026-09-03-category-icons-design.md` (if needed)

**Interfaces:**
- Consumes: all previous tasks
- Produces: PRD sections updated to reflect icon feature

- [ ] **Step 1: Update PRD `§2.1 Categories` row**

Change from `Create, edit (name/type/hidden; type change guarded), delete (guarded ...)` to `Create, edit (name/type/icon/hidden; type change guarded), delete (guarded ...). Icon chosen from 56 PNGs in `assets/icons` (default `other`, fallback `other.png` for legacy).`

- [ ] **Step 2: Update `§2.2 Validation Rules` — add Category icon row**

Add: `| Category icon | Optional; must be one of 56 allowlist names in assets/icons/manifest.json (validated via isValidCategoryIcon); defaults to "other"; legacy missing → other.png |`

- [ ] **Step 3: Update `§3.5 Categories` section**

Add paragraph: `Each category stores an optional icon key (see constants/categoryIcons.ts). The picker in category-form shows a 4-column grid of 56 PNGs; CategoryCard/TransactionCard and all category surfaces render the PNG via getCategoryIconSource with other.png fallback.`

- [ ] **Step 4: Add Change Log entry `§8`**

Add dated entry: `2026-09-03 — Category icons: add optional icon field, 56-PNG registry, picker grid, PNG rendering in CategoryCard/TransactionCard/other surfaces, PRD updated.`

- [ ] **Step 5: Typecheck/lint not needed, commit**

```bash
git add docs/Product\ Requirement\ Document/PRD.md
git commit -m "docs(prd): update categories with icon field and 56 PNG mapping"
```

---

## Self-Review

**Spec coverage:** Icon registry, schema, backend validation, form picker, card rendering, transaction wiring, fallback — all covered.

**Placeholder scan:** No TBD/TODO; each step has concrete code.

**Type consistency:** `CategoryIconName` from `ALL_CATEGORY_ICONS`, `icon?: string` in schema, `isValidCategoryIcon` guard used everywhere, `getCategoryIconSource` returns `number` (require) for `expo-image`.
