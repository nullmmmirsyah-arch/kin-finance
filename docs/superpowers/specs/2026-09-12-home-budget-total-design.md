# Home Budget Total Jar + Breakdown Sheet — Design

> Date: 2026-09-12
> Status: Approved (approach A, sections 1–4)
> Scope: Home budgets section only. No `convex/` changes, no schema/permission changes.

## 1. Background & Goal

Home (`app/(tabs)/home.tsx`) currently shows up to 3 individual `BudgetPill`s
(`budgets.slice(0, 3)`), each with a mini jar (40×50), name, spent/budgeted,
and a honey bar. Every pill does the same thing: `router.push("/budgets")`.

Goal (user request, Indonesian):
- Replace the 3 pills with a single total card: total budget with remaining
  (sisa) and percentage, keeping the jar-with-honey style.
- Tapping the jar or the total info opens a non-intrusive popup showing the
  detail breakdown: scrollable, ordered exactly like the Budgets page.

Decisions from brainstorming:
- Scope: replace 3 pills with 1 total card (not additive).
- Interaction: bottom sheet (not tooltip/popover/navigation-only).
- Content: card shows total budgeted + sisa + % honey; sheet rows are
  info-only (tap closes), plus a "View all budgets" button.

## 2. UX Research Note (why bottom sheet)

- Tooltip/popover: suited for 1–2 line hints. Fails for scrollable lists —
  narrow area, hard to tap, obscures the jar, not thumb-friendly on Android,
  accessibility problems.
- Centered dialog: blocks context, poor fit for long lists.
- Bottom sheet: the standard Material/iOS pattern for detail breakdowns —
  slides from the bottom (thumb reach), `max-h 80%` + internal scroll,
  backdrop tap / X / back-button to dismiss without losing Home scroll
  position, non-disruptive. Already established in this codebase
  (`components/FilterSheet.tsx`: `Modal transparent + fade`, backdrop
  `bg-black/40`, bottom panel `max-h-[80%] rounded-2xl`, internal
  `ScrollView`). Reuse that pattern for consistency.

Approaches considered:
- A (chosen): single total jar card + bottom-sheet breakdown.
- B (rejected): slim total header + keep 3 pills + tooltip popover — keeps
  clutter, tooltip cannot scroll for >3 budgets.
- C (rejected): total card navigates straight to Budgets tab, no popup —
  simplest but loses the quick-look-without-navigation goal.

## 3. Architecture & Components

New/changed UI in `app/(tabs)/home.tsx` (or small extracted components
co-located if the file grows; follow existing `BudgetPill` precedent):

- `BudgetTotalCard` (replaces `BudgetPill` list):
  - Single `Pressable` — jar and info share one large hit-area (min 48px).
  - Left: large jar reusing the `BudgetCard`/`BudgetPill` visual language
    (screw cap + glass + honey `LinearGradient` + highlight + `% left` /
    `EMPTY` / `—` caption). Size closer to `BudgetCard` (48×64) rather than
    the small pill jar, since it now represents the aggregate.
  - Right: `TOTAL • N jars` kicker, large total-budgeted number, honey bar,
    `Sisa X • Y% left` line (or `X over` / `Empty • overflow` / frosted `—`
    variant), status chip `ON TRACK / ALMOST EMPTY / OVER / SOME PRIVATE`
    with the same thresholds as the Budgets page (`>1 OVER`, `>0.8 ALMOST
    EMPTY`).
  - Uses `useThemeColors()`, `Shadow.card`, `Radius.md`, NativeWind
    `className`; no `StyleSheet.create`; no `style` callback on `Pressable`
    (NativeWind v4 gotcha — use pressed-state + static style).
- `BudgetBreakdownSheet` (new, modeled on `FilterSheet`):
  - `Modal visible transparent animationType="fade" onRequestClose`.
  - Backdrop `Pressable bg-black/40` tap-to-close; inner `Pressable`
    `stopPropagation`, `max-h-[80%] rounded-2xl` + `Shadow.card`, themed
    `bg-background`.
  - Header: `Budget breakdown • {shortLabel}` + X close button.
  - Body: scrollable list of ALL budgets (no slice), same array order as
    `monthBudgets.budgets` (identical to `budgets.tsx` `FlatList`
    `data={budgets}` — `api.budgets.list` index order, no extra sort).
    Each row: mini jar + category name (+ hidden eye icon) + spent/budgeted
    + remaining + % left; frosted dashed variant when `spent === undefined`.
    Tap row closes the sheet only (no edit navigation, per user choice).
  - Footer: `View all budgets` button → close sheet + `router.push("/budgets")`.
  - Accessibility: sheet `accessibilityLabel`, per-row labels
    (`{name}: {spent} of {budgeted}` or `details unavailable`), X and
    backdrop dismissible, back-button via `onRequestClose`.

No backend changes. No new queries, no new tables, no permission changes.

## 4. Data Flow

- Source stays `api.budgets.list({ periodStart, periodEnd })` for the active
  `selectedPeriodStart` in Home. The sheet is presentation-only over the same
  `monthBudgets.budgets` array the card aggregates.
- Aggregation reuses the exact `budgets.tsx` summary logic:
  `budgeted = Σ amount`; `spent = Σ spent` skipping redacted;
  `hasRedacted = any spent === undefined`;
  `overallProgress = hasRedacted ? 0 : budgeted > 0 ? spent / budgeted : 0`;
  `overallHoneyLevel = hasRedacted ? 0 : max(1 - overallProgress, 0)`;
  `remainingOverall = budgeted - spent`.
- Ordering guarantee: pass the array through untouched (no `.sort()`), so the
  sheet order always matches the Budgets tab for the same period. Any future
  server-side ordering change applies to both automatically.

## 5. States & Error Handling

- Loading (`monthBudgets === undefined`): keep existing skeleton block for
  the budgets section; sheet cannot be opened.
- Not a member (`budgets === null`): section hidden (current behavior —
  Home gates on household; no new state).
- Empty (`budgets.length === 0`): keep existing empty state
  (`EmptyState` + `Set Budget → /budget-form`).
- Private (`hasRedacted`): card spent shows `—`, caption
  `— left • some jars private`, bar becomes dashed `FROSTED` (same as Budgets
  total header); private rows show frosted jar + `Private • frosted`, no
  amounts (server already redacts `spent`/`progress` for members on hidden
  categories — PRD §2.4).
- Over budget (`overallProgress > 1`): error colors, `OVER` / `Empty •
  overflow` / `X over` copy, same as Budgets page.
- Offline/stale: follow Home's existing `ConnectivityBanner` + stale pattern;
  no sheet-specific error path. Sheet actions never mutate, so no
  `ConvexError` handling needed beyond what Home already does.

## 6. Visual & Theming Signals

- Theme via `useThemeColors()` / `dark:` variants; honey gradient
  `[C.primaryLight, C.primary]`, over-budget `[C.error, C.overBudgetDeep]`;
  glass `C.jarGlass`, borders `C.border`. No hardcoded colors.
- Copy stays English in UI (per PRD); amounts via `formatNumber` (bare whole
  numbers with thousand separators, no currency symbol).
- Motion/haptics: keep existing `hapticSuccess` on open/close/navigation;
  no new animation library (use the `Modal fade` already proven in
  `FilterSheet`).

## 7. Testing & Verification

- `npx tsc --noEmit`, `npm run lint`. `npm test` (vitest) only if a pure util
  is touched — not expected (UI-only change).
- Manual matrix: light/dark; 0 / 1 / many budgets; long list scrolls inside
  sheet; over-budget; member-viewing-hidden (frosted); period switch updates
  card + sheet; backdrop / X / back-button close; row tap closes;
  `View all budgets` navigates; card + jar both open the sheet; empty state
  CTA still routes to `/budget-form`.

## 8. Out of Scope (YAGNI)

- No sort/filter/search inside the sheet.
- No edit/delete actions inside the sheet (tap row only closes).
- No new Convex functions, no PagerView changes, no changes to the Budgets
  tab itself or to `BudgetCard`.
- No currency, rollover, or weekly/yearly budget logic.

## Self-review

- No TBD/TODO placeholders; requirements explicit.
- Internally consistent: single data source, same thresholds/copy as Budgets
  page, ordering defined as pass-through (matches both surfaces by
  construction).
- Single-plan scope: one Home section + one sheet component.
- Ambiguities resolved: full-list (not top-3) in sheet; row tap = close;
  footer navigates; private handled via existing redaction.
