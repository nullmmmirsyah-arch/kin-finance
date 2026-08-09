# Categories Feature — Design

> Date: 2026-08-09
> Source PRD: `docs/Product Requirement Document/PRD_Categories`
> Status: Approved by project owner

---

## Overview

Implement the Categories feature from PRD_Categories. Categories are labels for classifying transactions. Each household has its own set; the Owner creates/edits/deletes/toggles visibility; Members can only see and use visible categories.

## Decisions

- **Navigation:** Categories live inside a new minimal **Settings tab** (Feather `settings` icon), matching the PRD user flow (`Settings → Categories`) and DESIGN.md Screen 11/7. The Settings tab is a scaffold: for now it contains only a "Categories" row; other rows (Household, Members, Profile, Sign Out, About) wait for their respective PRDs.
- **Categories list is a stack screen** (`/categories`), pushed from Settings — not a tab. The form (`/category-form`) is also a stack screen, mirroring how `/account-form` is reached from the Accounts tab.
- **Row actions:** Inline edit/delete icons per row (matching the already-shipped Accounts screen), not swipe gestures.
- **Reserved categories:** The system-managed "Initial Balance" categories (one income, one expense, auto-created with each household) are excluded from the Categories management list for everyone, and protected server-side from rename/hide/retype/delete.

## Backend — `convex/categories.ts`

Mirrors `convex/accounts.ts` conventions (shared `getUserAndMembership`, owner-role checks, `ConvexError` messages).

| Function | Args | Behavior |
|----------|------|----------|
| `list` (query) | `{}` | Returns `{ categories, isOwner }`. Owner sees all household categories; member sees only `hidden === false`. Excludes reserved "Initial Balance" categories. Returns `{ categories: null, isOwner: false }` when signed out / no household. |
| `create` (mutation) | `{ name, type, hidden? }` | Owner only. Trim name; validate 2–30 chars; reject name `"Initial Balance"` (reserved). Enforce uniqueness per `(householdId, type)` → "Category name already exists." Insert with `hidden` default `false`. |
| `update` (mutation) | `{ categoryId, name?, type?, hidden? }` | Owner only. Category must belong to caller's household. Validate name (2–30, trim) and uniqueness excluding self when renaming. Toggle `hidden`. **Reject type change if any transactions reference the category** → "Cannot change category type — existing transactions or budgets use this category." Reject renaming/retyping/hiding reserved categories. |
| `delete` (mutation) | `{ categoryId }` | Owner only. Category must belong to caller's household. **Reject if any transactions reference the category** → "Cannot delete category — existing transactions or budgets reference this category. Delete or reassign those first." Reject deleting reserved categories. |

Notes:

- The `budgets` table does not exist in the schema yet; the "existing budgets" part of the guards becomes active when PRD_Budgets lands. Transaction checks are implemented now.
- Existing `convex/transactions.ts` already rejects member-created transactions on hidden categories; no change needed.

## UI — `app/settings.tsx` (minimal Settings scaffold)

- Header: "Settings" (28px bold, text-primary).
- A single row: "Categories" with a chevron (Feather `chevron-right`) → `router.push("/categories")`.
- Scrollable `View`; other sections intentionally omitted (future PRDs).

## UI — `app/categories.tsx` (stack screen, pushed from Settings)

Mirrors `app/(tabs)/accounts.tsx`.

- Back arrow + header: "Categories" (28px bold, text-primary).
- Inline error text below header.
- Filter chips: All | Income | Expense.
- Category rows: icon block (Feather `tag`, primary on surface), name, type badge (Income = success text, Expense = error text).
  - Owner: eye / eye-off visibility toggle, edit icon, delete icon (Feather `edit-2`, `trash-2`).
  - Member: read-only, no icons.
- Delete confirmation via `Alert.alert` ("Delete Category" / `Delete "X"? This cannot be undone.`), surfaces server error on failure.
- FAB (plus) → `/category-form`, owner only.
- EmptyState: icon `tag`, title "No categories yet", description "Create categories to organize your transactions.", action "Add Category" (owner only).

## UI — `app/category-form.tsx`

Mirrors `app/account-form.tsx`.

- Create mode: header "Create Category", button "Create Category".
- Edit mode (`?id=`): pre-filled via `api.categories.list`, header "Edit Category", button "Save Changes".
- Fields:
  - `Input` label "Category name", placeholder "e.g. Food, Salary", `maxLength` 30.
  - Type toggle: `Chip` pair Income | Expense, default Expense.
  - Visibility row: "Visible to members" `Switch` + description, default on.
- Client validation: name 2–30 chars. Server errors (uniqueness, type-change guard, reserved) surface inline.
- Loading state while edit data loads; "Category not found." if the id doesn't resolve.

## Navigation

- Add a `Settings` tab to `app/(tabs)/_layout.tsx` (Feather `settings`, position after Accounts). The existing `categories` → `/categories` push lives here.
- Register `categories` and `category-form` in the root Stack in `app/_layout.tsx` (inside the signed-in `Stack.Protected`). Both are pushed screens; `categories` keeps the back-arrow + header pattern used by `account-form`.

## Consistency / Constraints

- NativeWind `className`, theme tokens (`Colors`, `Shadow`, `Radius`) only — no hardcoded colors.
- No `style={({ pressed }) => ...}` callbacks on `Pressable` (NativeWind v4 gotcha); use `useState` pressed state.
- Reuse `Button`, `Input`, `Chip`, `Fab`, `EmptyState` components.
- Type badge colors: income → `Colors.success`, expense → `Colors.error`.

## Out of Scope

- Category icons, colors, grouping/nesting, templates, reordering (PRD Future Improvements).
- Budgets integration (separate PRD).

## Success Criteria

- Owner can create, edit (name/type/visibility), delete, and toggle visibility of categories.
- Member sees only visible categories, read-only (no create/edit/delete/toggle, no FAB).
- Duplicate names within same household + type rejected.
- Reserved "Initial Balance" categories absent from management list and protected server-side.
- Type change / delete rejected when transactions reference the category, with PRD error text.
- Empty state and error handling present.
