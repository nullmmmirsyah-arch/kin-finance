# Note Suggestion Chips (reference-style) — Design

> Status: approved sections §1–§4 by owner, 2026-09-20
> Scope: `app/transaction-form.tsx`, `hooks/useNoteSuggestions.ts` (unchanged),
> new `lib/dismissed-notes.ts` + `components/transaction/NoteSuggestChips.tsx`,
> new `tests/dismissed-notes.test.ts`
> Non-goals: no Convex schema/query change, no restore-UI, no cross-device sync,
> no suggestion ranking change, no transfer-mode suggestions.

## 0. Background (why this shape)

Note suggestions are computed, never stored: max 20 newest transactions of the
same category → max 5 unique recent notes when the draft is empty, substring
filter as the user types (`hooks/useNoteSuggestions.ts`). Data was proven
intact end-to-end (Convex char-code dump: clean ASCII, tap fills the full
string), yet on the owner's device auto-width pill chips render short
(`pekanan`→`pekana`, `kelapa`→`kelap`, `kebutuhan seharian`→`kebutuhan`) while
full-width rows (Home list) render the same strings perfectly. Reference app
screenshots define the target: horizontal-scroll chips with a per-chip × and a
per-chip max width with honest `…` for long notes.

Decisions already taken with owner: × = hide permanently per device;
filter follows typing (current behavior kept); layout = horizontal + ×
(accepted with the measuring risk below, mitigated in §3).

## 1. UI & behavior

- Row: horizontal scroll under the note input inside the bottom card, shown
  only when the note is focused and at least one suggestion remains (unchanged
  gating).
- Chip: outline pill (border `C.border`, bg `C.surface`), inner row of Text
  with `flex: 1` + × button (Feather `x`, ~14px, `hitSlop={8}`).
  Text keeps `text-xs` + `C.textPrimary`.
- Width rule (from reference): chip `maxWidth: 220`, Text
  `numberOfLines={1}` + `ellipsizeMode="tail"`. Short notes render fully;
  long notes honestly become `…`. Tapping the text area always fills the
  FULL note string — ellipsis is display-only.
- Tap ×: suggestion disappears immediately, note is NOT filled
  (`stopPropagation`, same pattern as the account-sheet modal).
- Empty: when every suggestion is dismissed or filtered out, the row hides
  completely (unchanged).
- Deliberately absent: no dismiss animation, no "bring back dismissed"
  button, no count badge.

## 2. Data & dismissal storage

- Suggestion source unchanged: per-category history query, max 5, filter
  follows typing. Dismissal is a client-side filter on top.
- Dismissed notes persist in SecureStore (same pattern as
  `lib/last-transaction.ts`), keyed by `householdId + categoryId`, capped at
  50 entries per category (oldest trimmed). Matching is case-insensitive,
  consistent with the existing dedup rule.
- Never in Convex: dismissal is a per-device display preference, not shared
  household data. No new table/query/mutation, no owner/member permission
  questions, no cross-household leakage, no way for one member to hide
  another member's suggestions.
- Tap × writes through async with no loading state; the underlying
  transaction is never touched. No cross-device sync, no undo in v1.

## 3. Measuring-bug mitigation & verification

- The chip interior changes from bare Text to a [flexible Text | ×] row —
  a different Yoga measurement path from the one that demonstrably failed.
- `flexShrink: 0` on chips; transparent runway via inter-chip `marginRight`
  plus breathing room in the pill's right padding, so any fractional overflow
  lands on visible transparent area instead of under the next opaque chip.
- `maxWidth`/`numberOfLines` apply ONLY to genuinely long notes.
- Final proof is on-device OTA with an explicit checklist: `pekanan`,
  `kelapa`, `kebutuhan seharian` render fully; a >220-wide note renders `…`;
  tap fills the full string; × survives form close + app restart; typing
  still filters; transfer mode still shows no suggestions. If short notes
  still clip, the follow-up uses the new screenshot evidence — not new
  guesses.

## 4. Testing

- Unit (vitest, same pattern as `tests/useNoteSuggestions.test.ts`): pure
  helpers for excluding dismissed notes (case-insensitive), trimming to 50
  (oldest first), storage-key building per household+category, and fail-soft
  load (corrupt/empty storage → no dismissals, suggestions render fully —
  a read error must never hide all suggestions).
- No Convex tests (backend untouched).
- Gates: `npx tsc --noEmit` + `npm run lint` green before push to `review`;
  owner verifies via OTA (device-only bug, cannot be reproduced in CI).
