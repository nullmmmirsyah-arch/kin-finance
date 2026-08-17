# Design: Keyboard Dismiss on Field Tap

> Date: 2026-08-17
> Status: Approved
> Product: Kin Finance

## Problem

After typing the amount in the transaction form, tapping a non-text-input
field (e.g. the **Account** `SelectField` trigger, the **Date** `DateField`
trigger, or a transaction-type `Chip`) does not dismiss the keyboard. The
picker/modal opens while the keyboard stays visible, forcing the user to
close it manually.

Root cause: every form's `ScrollView` uses
`keyboardShouldPersistTaps="handled"` (e.g. `app/transaction-form.tsx:511`).
With `"handled"`, taps on blank space already dismiss the keyboard, but taps
on **interactive children** (Pressable-based fields like `SelectField` and
`DateField`) are delivered to the child and the keyboard is left open.

## Goal

Tapping any non-text-input field in a form dismisses the keyboard, then the
field action proceeds (picker/modal opens, chip selection applies). Tapping a
text input still keeps the keyboard open so the user can continue typing.

## Decision

**Approach A — explicit `Keyboard.dismiss()` calls on non-text-input fields.**
No new dependency, no native rebuild, works in Expo Go. Approach D
(`react-native-keyboard-controller`) was considered and rejected: it does not
remove the need for explicit dismiss calls, adds a native dependency
(incompatible with Expo Go without a rebuild), and requires migrating
ScrollView/KeyboardAvoidingView across all forms — all for animation polish
that is irrelevant to this form layout.

## Design

Call `Keyboard.dismiss()` at the start of the `onPress` of each non-text-input
field:

### 1. `components/SelectField.tsx`

- Import `Keyboard` from `react-native`.
- In the trigger `Pressable` `onPress` (line 52), call `Keyboard.dismiss()`
  before `setSearch("")` / `setOpen(true)`.

### 2. `components/DateField.tsx`

- Import `Keyboard` from `react-native`.
- In the trigger `Pressable` `onPress` (line 39), call `Keyboard.dismiss()`
  before `setDraft(value)` / `setShow(true)`.

### 3. `app/transaction-form.tsx`

- Import `Keyboard` from `react-native`.
- Add `Keyboard.dismiss()` in `handleTypeChange` (type `Chip`s) and
  `handleRepeatLast`.
- Keep `keyboardShouldPersistTaps="handled"` on the `ScrollView` (line 511) —
  blank-area taps already dismiss the keyboard.

### Not changed

- `Input` (TextInput): tapping a text input must keep the keyboard open to
  transfer focus. This is the correct behavior.
- All `keyboardShouldPersistTaps="handled"` props stay as-is.

## Reuse

`SelectField` and `DateField` are shared components, so `account-form`,
`budget-form`, `category-form`, and `members.tsx` automatically get the same
behavior. `Keyboard.dismiss()` is a no-op when no keyboard is shown, so this
is safe on screens without a keyboard.

## Non-goals

- Swipe-to-dismiss / interactive dismissal gestures (would require a native
  library; out of scope).
- Changing the text-input behavior — tapping an input still keeps the keyboard.

## Risks

- None material. `Keyboard.dismiss()` is a no-op when the keyboard is already
  hidden; the only observable change is that non-input fields now dismiss the
  keyboard.

## Test/verify

- `npx tsc --noEmit`
- `npm run lint`
- Manual: open transaction form, type amount, tap Account → keyboard closes and
  picker opens; tap blank area → keyboard closes; tap Note → keyboard stays.