# Always-Visible Edit/Delete Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the swipe-left gesture on owner account cards with always-visible Edit and Delete icon buttons so edit/delete is a single, discoverable step.

**Architecture:** `AccountCard` gains optional `onEdit`/`onDelete` props; when provided it renders two icon buttons (Feather `edit-2`, `trash-2`) on the right edge of the card. The Accounts screen passes these only for owner rows and drops the `SwipeableRow` wrapper. `components/SwipeableRow.tsx` is deleted as dead code. Documentation (DESIGN.md, accounts-design spec, accounts-implementation plan) is updated to describe icons instead of swipe.

**Tech Stack:** Expo SDK 54, React Native 0.81, expo-router 6, Convex 1.43, NativeWind, `@expo/vector-icons/Feather`, theme tokens from `@/constants/theme`.

## Global Constraints

- All user-facing text in English; no code comments.
- Theme tokens only (`Colors`, `Radius`, `Shadow`) — no hardcoded colors.
- Owner rows get Edit + Delete icons; member rows stay read-only (no icons) per PRD.
- Delete must still go through `Alert.alert` confirmation before calling `api.accounts.remove`.
- Icon buttons: tap target ≥ 40×40pt, `accessibilityRole="button"`, `accessibilityLabel` ("Edit account" / "Delete account").
- Verification is `npx tsc --noEmit` and `npm run lint` — there is no test framework in this repo.
- Do not commit changes under `convex/_generated/` or `.expo/`.

---

### Task 1: Add Edit/Delete icons to AccountCard

**Files:**
- Modify: `components/AccountCard.tsx`

**Interfaces:**
- Produces: `AccountCard({ name: string, type: AccountType, balance: number, onEdit?: () => void, onDelete?: () => void })` — when `onEdit`/`onDelete` are provided, renders Edit + Delete icon buttons; when omitted, renders the read-only card exactly as today.

- [ ] **Step 1: Add props and Pressable imports**

In `components/AccountCard.tsx`, change the react-native import to include `Pressable` and add `onEdit?: () => void; onDelete?: () => void;` to the `Props` type and function signature:

```tsx
import { Pressable, Text, View } from "react-native";

type Props = {
  name: string;
  type: AccountType;
  balance: number;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function AccountCard({ name, type, balance, onEdit, onDelete }: Props) {
```

- [ ] **Step 2: Render icon buttons when handlers are provided**

Replace the balance `Text` (currently the last child, lines 44-46) so the card's right edge holds the icon column plus the balance. The balance must stay `flex-1`-independent; give the icon column fixed width. New right-edge block:

```tsx
      {onEdit !== undefined || onDelete !== undefined ? (
        <View className="flex-row items-center gap-1">
          {onEdit !== undefined ? (
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit account"
              style={{ width: 40, height: 40 }}
              className="items-center justify-center"
            >
              <Feather name="edit-2" size={18} color={Colors.primary} />
            </Pressable>
          ) : null}
          {onDelete !== undefined ? (
            <Pressable
              onPress={onDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
              style={{ width: 40, height: 40 }}
              className="items-center justify-center"
            >
              <Feather name="trash-2" size={18} color={Colors.error} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Text className="text-base font-semibold text-text-primary">
        {formatNumber(balance)}
      </Text>
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add components/AccountCard.tsx
git commit -m "feat: add edit and delete icons to account cards"
```

---

### Task 2: Wire icons into Accounts screen and drop swipe

**Files:**
- Modify: `app/(tabs)/accounts.tsx`

**Interfaces:**
- Consumes: `AccountCard` with `onEdit`/`onDelete` (Task 1); existing `handleDelete`, `router`, `Filter`, `FILTERS`, `Chip`, `Fab`, `EmptyState`, `api.accounts.list`, `api.accounts.remove` (all already present in the file).
- Produces: owner rows rendered as `<AccountCard onEdit onDelete>`, member rows as plain `<AccountCard>`. `SwipeableRow` import removed.

- [ ] **Step 1: Remove SwipeableRow import**

Delete this import line from `app/(tabs)/accounts.tsx`:

```tsx
import { SwipeableRow } from "@/components/SwipeableRow";
```

- [ ] **Step 2: Rewrite renderItem to use AccountCard icons**

Replace the whole `renderItem={({ item }) => ...}` block (currently the ternary with `SwipeableRow` wrapping) with:

```tsx
          renderItem={({ item }) =>
            isOwner ? (
              <AccountCard
                name={item.name}
                type={item.type}
                balance={item.balance}
                onEdit={() =>
                  router.push({
                    pathname: "/account-form",
                    params: { id: item._id },
                  })
                }
                onDelete={() => handleDelete(item)}
              />
            ) : (
              <AccountCard
                name={item.name}
                type={item.type}
                balance={item.balance}
              />
            )
          }
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/accounts.tsx"
git commit -m "feat: show edit and delete icons on owner account rows"
```

---

### Task 3: Delete SwipeableRow component

**Files:**
- Delete: `components/SwipeableRow.tsx`

**Interfaces:**
- Consumes: nothing (Task 2 removed the only usage).
- Produces: none — `SwipeableRow` no longer exists; no file imports it.

- [ ] **Step 1: Delete the file**

Run: `git rm components/SwipeableRow.tsx`

- [ ] **Step 2: Verify nothing references it**

Run: `Select-String -Path "app\**\*.tsx","components\**\*.tsx" -Pattern "SwipeableRow" -SimpleMatch`
Expected: No matches (or run `npx tsc --noEmit` which fails if any dangling import remains).

Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor: remove unused SwipeableRow component"
```

---

### Task 4: Update documentation

**Files:**
- Modify: `docs/DESIGN.md:143-144` (Screen 3)
- Modify: `docs/superpowers/specs/2026-08-08-accounts-design.md` (lines 24, 211, 227, 235, 237, 303, 322)
- Modify: `docs/superpowers/plans/2026-08-08-accounts-implementation.md` (lines 7, 9, 38, 306, 719-900, 916, 1035-1036, 1059, 1164-1198, 1228, 1230, 1238, 1474, 1612, 1641)

**Interfaces:**
- Consumes: nothing (docs only).
- Produces: docs describing Edit/Delete icons instead of swipe-left for the Accounts feature.

- [ ] **Step 1: Update DESIGN.md Screen 3**

In `docs/DESIGN.md`, change lines 143-144 from:

```markdown
   - Owner: swipe left → Edit | Delete
   - Member: no swipe actions (read-only)
```

to:

```markdown
   - Owner: Edit and Delete icons on every card
   - Member: read-only, no icons (read-only)
```

- [ ] **Step 2: Update the accounts-design spec**

In `docs/superpowers/specs/2026-08-08-accounts-design.md`:
- Line 24: change the "Row actions" row value from "Real swipe gesture (`ReanimatedSwipeable`)" to "Always-visible Edit and Delete icons on owner cards".
- Line 211: change the `SwipeableRow.tsx` file-table entry from "Create" to "Remove" with description "dead code — replaced by AccountCard icons".
- Line 227: replace "Owner rows are `SwipeableRow` (swipe left → Edit | Delete)" with "Owner rows show Edit and Delete icon buttons".
- Line 235: replace "Edit: swipe Edit → `/account-form?id=<accountId>`" with "Edit: tap Edit icon → `/account-form?id=<accountId>`".
- Line 237: replace "No FAB, no swipe actions" with "No FAB, no edit/delete icons".
- Line 303: change the `SwipeableRow.tsx` row from "Create" to "Remove".
- Line 322: replace "Swipe-left Edit/Delete works for Owner rows" with "Owner rows show Edit and Delete icons that navigate to edit and confirm-delete".

- [ ] **Step 3: Update the accounts-implementation plan**

In `docs/superpowers/plans/2026-08-08-accounts-implementation.md`:
- Line 7 (Architecture): replace "swipe actions" with "edit/delete icons".
- Line 9 (Tech Stack): remove the `ReanimatedSwipeable` / `react-native-gesture-handler 2.28 (ReanimatedSwipeable)` reference; keep the other deps.
- Line 38: change the `SwipeableRow.tsx` file-table entry to "Remove" with description "dead code — replaced by AccountCard icons".
- Line 306: replace "drives UI (FAB, swipe)" with "drives UI (FAB, edit/delete icons)".
- Lines 719-900 (Task 8): replace the `SwipeableRow` step (Step 3 and its commit line 900) with a note that AccountCard carries `onEdit`/`onDelete`; adjust Task 8's title and `git add` list to drop `components/SwipeableRow.tsx`.
- Line 916: remove the "so `SwipeableRow` gestures work" clause from the Task 9 Produces text.
- Lines 1035-1036 (Task 10 Interfaces): replace `SwipeableRow` with `AccountCard` in the Consumes list; update the Produces line to say "owner rows with edit/delete icons".
- Line 1059: remove the `SwipeableRow` import line.
- Lines 1164-1198: replace the `SwipeableRow` wrapper JSX with the `AccountCard onEdit/onDelete` JSX from Task 2.
- Line 1228: replace "swipe left on a row reveals Edit (primary) and Delete (error) actions" with "each owner row shows Edit and Delete icon buttons".
- Line 1230: replace "no FAB, no swipe actions" with "no FAB, no edit/delete icons".
- Line 1238: change the commit message from "...swipe actions, and FAB" to "...edit/delete icons, and FAB".
- Line 1474: replace "Edit: swipe left → Edit → pre-filled..." with "Edit: tap the Edit icon → pre-filled...".
- Line 1612: replace "no FAB, no swipe actions" with "no FAB, no edit/delete icons".
- Line 1641: replace "Swipe-left Edit/Delete works for Owner rows" with "Edit and Delete icons work for Owner rows".

- [ ] **Step 4: Commit**

```bash
git add docs/DESIGN.md docs/superpowers/specs/2026-08-08-accounts-design.md docs/superpowers/plans/2026-08-08-accounts-implementation.md
git commit -m "docs: describe edit/delete icons instead of swipe for accounts"
```

---
