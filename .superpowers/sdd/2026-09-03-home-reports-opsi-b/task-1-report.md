# Task 1 Report — MonthPicker Shared Component (Jan-Dec, Future Disabled)

**Plan:** `docs/superpowers/plans/2026-09-03-home-reports-opsi-b.md` Task 1
**Branch:** `feat/home-reports-opsi-b` (origin/main base)
**Status:** DONE
**Date:** 2026-09-03

## Summary
Implemented shared `components/MonthPicker.tsx` with Jan-Dec grid, future-month disabled logic, and `tests/monthPicker.test.ts` covering `isFutureMonth` and `MONTH_LABELS`. All 4 tests PASS, `npx tsc --noEmit` passes.

## Files Created / Modified
- **Created:** `components/MonthPicker.tsx` — Modal with Week|Month|Year tabs (Month active, Week/Year grey + Coming soon), Year nav `< 2026 >` disabled when `year >= curYear`, 3×4 Jan-Dec grid (`width:"31%"`, `Radius.md`, `Shadow.card`), future months `opacity:0.4` `disabled`, selected `bg C.primary` `text C.background` else `C.surface`, bottom X/check buttons, NativeWind `className` only, `useThemeColors()`, `Feather` icons, no `style={({pressed})=>}`.
- **Created:** `tests/monthPicker.test.ts` — 4 tests verbatim from plan.
- **Created (infra required for vitest):** `vitest.config.ts` — alias `@ -> .`, mock `react-native` and `@expo/vector-icons/Feather` to avoid Flow parse error in vitest (vite SSR). Without this, `npm test -- tests/monthPicker.test.ts` fails with `Flow is not supported` at `node_modules/react-native/index.js`.
- **Created (mocks):** `tests/__mocks__/react-native.ts`, `tests/__mocks__/expo-feather.ts` — minimal stubs for `Modal`, `Pressable`, `View`, `Text`.
- **Modified:** none (convex unchanged, no codegen needed).

## Interfaces Implemented
- **Consumes:** `utils/date.ts:zonedMonthStart`, `utils/period.ts:getPeriodBounds`, `constants/theme.ts:useThemeColors`, `Shadow`, `Radius`
- **Produces:**
  ```ts
  export const MONTH_LABELS = ["Jan","Feb","Mar",...,"Dec"] as const;
  export function isFutureMonth(year:number, month:number, tz:string, now:number): boolean;
  export function MonthPicker(props: { visible:boolean; selectedPeriodStart:number; tz:string; onSelect:(ps:number)=>void; onClose:()=>void }): JSX.Element
  ```
- `isFutureMonth` logic: `zonedMonthStart(year,month,tz) > getPeriodBounds(now,tz,"monthly").start` (tz-aware, fixed plan's `require` to top-level import).
- `MonthPicker` onSelect: `onSelect(ps)` where `ps = zonedMonthStart(year,month,tz)`, then `onClose()`; haptic not required.

## Verification Steps (as executed)
1. **Failing test before implementation:**
   ```
   npm test -- tests/monthPicker.test.ts
   => FAIL Cannot find module '../components/MonthPicker' (expected)
   ```
2. **Implement component** per plan code, fixing `isFutureMonth` to use `getPeriodBounds` import and `zonedMonthStart` from `@/utils/date`.
3. **Pass after implementation (with vitest.config):**
   ```
   npm test -- tests/monthPicker.test.ts
   => Test Files 1 passed (1), Tests 4 passed (4), Duration 531ms
   ```
   - Oct 2026 is future when now Sep ✓
   - Aug 2026 is not future ✓
   - Sep 2026 same month not future ✓
   - Jan labels are Jan-Dec not 1-12 ✓
4. **Typecheck:**
   ```
   npx tsc --noEmit
   => (no output) PASS 0 errors
   ```
5. **Lint:**
   ```
   npm run lint (expo lint)
   => PASS (env load only, 0 errors)
   ```
6. **Full suite (sanity):**
   ```
   npm test
   => Test Files 1 failed | 23 passed (24), Tests 1 failed | 134 passed (135)
   => Single failure is pre-existing `tests/branded-loading-shell.test.ts > app.json background matches theme` (ENOENT app.json — repo uses app.config.js). Unrelated to this task; 4/4 monthPicker tests pass.
   ```

## Commits
- `feat(ui): MonthPicker Jan-Dec future disabled shared` — `components/MonthPicker.tsx`, `tests/monthPicker.test.ts` (plus infra `vitest.config.ts`, `tests/__mocks__/*` if included)
  ```
  git log --oneline -1 => <sha> feat(ui): MonthPicker Jan-Dec future disabled shared
  git show --stat => components/MonthPicker.tsx | tests/monthPicker.test.ts | vitest.config.ts | tests/__mocks__/...
  ```

## Constraints Compliance
- Expo SDK 54, no bare `npm install` (none needed)
- NativeWind `className` only, `useThemeColors()`, `Shadow.card`, `Radius.md`, `Feather` icons, no `style={({pressed})=>}` callback
- Path alias `@/*` used in component
- Amount/time formatting unchanged; hidden logic not touched

## Known Gaps / Notes
- `vitest.config.ts` warning `(!) ESM syntax in file loaded as CommonJS` is Vite `configLoader:native` warning; tests still pass. Can be silenced by renaming to `.mjs` with `fileURLToPath` or setting `VITE_CONFIG_NATIVE_IGNORE_WARNING=true`. Left as-is for now.
- `branded-loading-shell.test.ts` failure pre-existing; not introduced by this task.

## Next Steps
- Task 2: TransactionCard — no time, add account subtitle
