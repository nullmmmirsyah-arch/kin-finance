# Design: Always-Visible Edit/Delete Icons on Account Cards

**Date:** 2026-08-08
**Status:** Approved

## Problem

The edit/delete flow for accounts uses a swipe-left gesture on each card. Two UX problems:

1. Swipe is a hidden gesture — users do not know cards can be swiped.
2. When revealed, the edit icon is small and unclear; there is no text label.

Additionally, swipe requires two steps (swipe, then tap) versus the one-step affordance of an always-visible icon.

## Decision

Replace swipe entirely with **always-visible Edit and Delete icon buttons on each owner account card**. One step, fully discoverable.

## Changes

### `components/AccountCard.tsx`

- Add optional props `onEdit?: () => void` and `onDelete?: () => void`.
- When either is provided (owner case), render a column of two icon buttons at the right edge of the card:
  - **Edit**: Feather `edit-2`, `Colors.primary`, `accessibilityRole="button"`, `accessibilityLabel="Edit account"`, tap target ≥ 40×40pt.
  - **Delete**: Feather `trash-2`, `Colors.error`, `accessibilityRole="button"`, `accessibilityLabel="Delete account"`, tap target ≥ 40×40pt.
- When neither is provided (member case), card renders exactly as today (read-only, no icons).
- Balance text remains; icon buttons sit between the type label column and the balance, or wrap onto their own row as needed to avoid crowding.

### `app/(tabs)/accounts.tsx`

- Remove the `SwipeableRow` wrapper and its import.
- Owner render: `<AccountCard name={} type={} balance={} onEdit={() => router.push({ pathname: "/account-form", params: { id } })} onDelete={() => handleDelete(item)} />`.
- Member render: `<AccountCard name={} type={} balance={} />`.
- Keep the existing `handleDelete` (Alert confirm → `accounts.remove`) and error surfacing.

### Delete `components/SwipeableRow.tsx`

- Component is used only by the accounts screen; swipe is removed entirely, so the component is dead code. Delete it.

## Documentation Updates

- `docs/DESIGN.md` Screen 3: remove "Owner: swipe left → Edit | Delete"; replace with "Owner: Edit and Delete icons on every card".
- `docs/superpowers/specs/2026-08-08-accounts-design.md`: same update in the accounts list section.
- `docs/superpowers/plans/2026-08-08-accounts-implementation.md`: update Task 8 (components) and Task 10 (accounts screen) sections to reflect icons instead of swipe.
- `docs/ARCHITECTURE.md`: update any swipe references if present.

## Constraints

- Owner only: member cards stay read-only (PRD).
- Delete still requires confirmation via `Alert.alert` before calling `accounts.remove`.
- English UI text; no code comments.
- Theme tokens (`Colors`, `Radius`, `Shadow`) only; no hardcoded colors.
