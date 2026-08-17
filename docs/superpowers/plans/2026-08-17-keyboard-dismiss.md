# Keyboard Dismiss on Field Tap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dismiss the keyboard whenever the user taps a non-text-input field (Account/Category/From-To selectors, Date, type chips, "Repeat last") in any form, while tapping a text input keeps the keyboard open.

**Architecture:** Add a single `Keyboard.dismiss()` call to the `onPress` handlers of the shared non-text-input field components (`SelectField`, `DateField`) and the transaction-form chip/repeat handlers. `keyboardShouldPersistTaps="handled"` on every form's `ScrollView` already dismisses on blank-area taps, so no other change is needed. Because `SelectField`/`DateField` are shared, all forms that reuse them benefit automatically.

**Tech Stack:** React Native `Keyboard` API, React Native / Expo SDK 54, NativeWind (no styling changes).

## Global Constraints

- No new dependencies. No changes to `package.json`.
- `keyboardShouldPersistTaps="handled"` must remain on every `ScrollView` — do not change it.
- Tapping a `TextInput` (Amount, Note, search) must keep the keyboard open for focus transfer — do NOT add `Keyboard.dismiss()` to `components/Input.tsx`.
- `Keyboard.dismiss()` is a no-op when no keyboard is shown — safe on screens without input fields.
- Code style: no code comments. Follow existing file conventions (imports from `react-native`, `useCallback`, NativeWind `className`).
- Verify after each code task: `npx tsc --noEmit` and `npm run lint`. There is no test framework.

---

### Task 1: `SelectField` — dismiss keyboard before opening the picker

**Files:**
- Modify: `components/SelectField.tsx:4` (import) and `components/SelectField.tsx:51-55` (trigger `onPress`)

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: `SelectField`'s trigger now calls `Keyboard.dismiss()` before opening the modal. Reused by `transaction-form`, `budget-form`, `members.tsx` — no prop changes.

- [ ] **Step 1: Add `Keyboard` to the `react-native` import**

In `components/SelectField.tsx`, change line 4 from:

```tsx
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
```

to:

```tsx
import { Keyboard, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
```

- [ ] **Step 2: Call `Keyboard.dismiss()` in the trigger `onPress`**

Change the trigger `Pressable` (lines 51-55) so the first statement of `onPress` dismisses the keyboard:

```tsx
<Pressable
  onPress={() => {
    Keyboard.dismiss();
    setSearch("");
    setOpen(true);
  }}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors/warnings.

- [ ] **Step 4: Commit**

```bash
git add components/SelectField.tsx
git commit -m "feat: dismiss keyboard on SelectField tap"
```

---

### Task 2: `DateField` — dismiss keyboard before opening the date picker

**Files:**
- Modify: `components/DateField.tsx:7` (import) and `components/DateField.tsx:38-42` (trigger `onPress`)

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: `DateField`'s trigger now calls `Keyboard.dismiss()` before showing the picker. Reused by `transaction-form` (and any other form using dates) — no prop changes.

- [ ] **Step 1: Add `Keyboard` to the `react-native` import**

In `components/DateField.tsx`, change line 7 from:

```tsx
import { Modal, Platform, Pressable, Text, View } from "react-native";
```

to:

```tsx
import { Keyboard, Modal, Platform, Pressable, Text, View } from "react-native";
```

- [ ] **Step 2: Call `Keyboard.dismiss()` in the trigger `onPress`**

Change the trigger `Pressable` (lines 38-42) so the first statement of `onPress` dismisses the keyboard:

```tsx
<Pressable
  onPress={() => {
    Keyboard.dismiss();
    setDraft(value);
    setShow(true);
  }}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors/warnings.

- [ ] **Step 4: Commit**

```bash
git add components/DateField.tsx
git commit -m "feat: dismiss keyboard on DateField tap"
```

---

### Task 3: `transaction-form` — dismiss keyboard on type chips and "Repeat last"

**Files:**
- Modify: `app/transaction-form.tsx:4-12` (import), `app/transaction-form.tsx:96-106` (`handleRepeatLast`), `app/transaction-form.tsx:144-162` (`handleTypeChange`)

**Interfaces:**
- Consumes: `Keyboard` from `react-native` (used identically to Tasks 1-2).
- Produces: `handleTypeChange` and `handleRepeatLast` dismiss the keyboard before mutating form state. No function signatures change.

- [ ] **Step 1: Add `Keyboard` to the `react-native` import**

In `app/transaction-form.tsx`, change lines 4-12 so `Keyboard` is included (alphabetical order within the list, matching the existing style):

```tsx
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
```

- [ ] **Step 2: Dismiss keyboard in `handleRepeatLast`**

In `app/transaction-form.tsx`, make `Keyboard.dismiss()` the first statement inside `handleRepeatLast` (line 96), before the existing guard:

```tsx
const handleRepeatLast = () => {
  Keyboard.dismiss();
  if (!lastTransaction.current) return;
  // ...existing body unchanged
};
```

- [ ] **Step 3: Dismiss keyboard in `handleTypeChange`**

In `app/transaction-form.tsx`, make `Keyboard.dismiss()` the first statement inside the `handleTypeChange` callback body (line 145), before `setType(t)`:

```tsx
const handleTypeChange = useCallback(
  (t: TransactionType) => {
    Keyboard.dismiss();
    setType(t);
    // ...existing body unchanged
  },
  [categoryId, show],
);
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors/warnings.

- [ ] **Step 5: Commit**

```bash
git add app/transaction-form.tsx
git commit -m "feat: dismiss keyboard on type chip and repeat-last tap"
```

---

### Task 4: Update the PRD

**Files:**
- Modify: `docs/Product Requirement Document/PRD.md` (changelog table at lines 724-750, and the Form UX bullet list under §4.4 at lines 355-382)

**Interfaces:**
- Consumes: the behaviors implemented in Tasks 1-3 (no code changes here).

- [ ] **Step 1: Add a changelog entry**

Insert a new row at the **top** of the Change Log table (line 726, above the `2026-08-16` entries). Use the exact row:

```markdown
| 2026-08-17 | UX | Keyboard auto-dismiss on field tap: `SelectField` and `DateField` triggers call `Keyboard.dismiss()` before opening their picker/modal, and the transaction form dismisses on type-chip and "Repeat last" taps — so tapping any non-text-input field closes the keyboard while the field action proceeds (blank-area taps already dismiss via `keyboardShouldPersistTaps="handled"`); tapping a text input (Amount, Note) keeps the keyboard open for focus transfer; applies to every form reusing `SelectField`/`DateField` (transaction, budget, account, category, members) |
```

- [ ] **Step 2: Add a bullet to the §4.4 Form UX list**

In the `**Form UX (as of 2026-08-15):**` bullet list (lines 355-382), append this bullet at the end of the list (after the "Three-section layout" bullet, which ends at line 382):

```markdown
- **Keyboard behavior:** tapping any non-text-input field (Account/Category/
  From-To selector, Date, type chip, "Repeat last") dismisses the keyboard
  before the field action runs; tapping a text input (Amount, Note) keeps the
  keyboard open so focus transfers.
```

- [ ] **Step 3: Commit**

```bash
git add docs/Product Requirement Document/PRD.md
git commit -m "docs: PRD changelog for keyboard dismiss on field tap"
```

---

### Task 5: Final verification

**Files:** none.

- [ ] **Step 1: Full typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors/warnings.

- [ ] **Step 2: Manual smoke test**

On a device/simulator, verify in the transaction form:
1. Type the amount (keyboard opens).
2. Tap **Account** → keyboard closes and the picker opens.
3. Tap **Category** / **Date** / a type chip / **Repeat last** (if shown) → keyboard closes and the action proceeds.
4. Tap blank space below the fields → keyboard closes.
5. Tap **Amount** then **Note** → keyboard stays open, focus moves between inputs.
6. Repeat step 2 in `budget-form` (Account `SelectField`) to confirm the shared-component behavior.