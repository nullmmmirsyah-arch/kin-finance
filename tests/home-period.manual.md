# Home Period Pager — Manual Verification Checklist



Task 5 — swipeable Home via PagerView



## Preconditions

- Household has at least 2 periods of transactions (current and previous monthly)

- Run `npx convex dev` and `npx expo start` (or emulator)

- Logged in as Owner



## Checklist



- [ ] Home shows period navigation header outside PagerView: `<` `>` buttons + `formatPeriodLabel` + dots

- [ ] Initial period is current monthly period (formatPeriodLabel matches `getPeriodBounds(Date.now(), tz, monthly)`)

- [ ] Swipe left/right changes period label and dot active state with haptic

- [ ] Tap `<` / `>` buttons navigates period, updates PagerView page, triggers haptic, disables `>` when future beyond current period

- [ ] PERIOD BALANCE card: shows `currentClosing` (closingBalance) 28 bold + `currentLabel • Opening` caption, plus `Income +`/`Expense -` tinted circles (`trending-up`/`trending-down` with `${C.success}14`/`error14`); skeleton when `balances === undefined`, `0` when `null`

- [ ] Period net text matches snapshot `closingBalance` for that period (`fresh` closing=net, `carryOver` cumulative) without requiring `+` prefix for positive values

- [ ] Budgets section binds to `selectedPeriodStart` / `periodEnd` (`budgets.list` per period): shows 3 pills with spent/budgeted, changes when period changes, skeleton while loading, empty state when none




- [ ] My Accounts: horizontal list keeps live balances (`account.balance` sum), not snapshot filtered; shows `Add Account` for Owner; skeleton while loading

- [ ] ConnectivityBanner: visible instantly when offline (`isConnected===false`), fallback >3s otherwise; Retry clears stale and triggers haptic; RefreshControl per page (pull to refresh) shows spinner 600ms, clears stale, haptic

- [ ] Skeleton per PagerView page while any period query undefined

- [ ] No `Pressable` `style={({pressed})=>...}` callback; uses `useState` pressed + static `style`

- [ ] `npx tsc --noEmit` passes (0 errors)

- [ ] `npm run lint` passes (0 errors)

- [ ] Greeting, household card, FAB, haptics, stale handling preserved from original Home



## Steps to Run

1. `npx tsc --noEmit && npm run lint`

2. Launch emulator, navigate Home, verify each item above

3. Change Balance Mode Owner toggle in Settings (carryOver vs fresh) → Home closingBalance reflects mode

4. Change period forward/back via swipe and via buttons → all sections update consistently


## Home ledger after (Task 3 — 2026-09-03)
- [ ] Full Sep period shows all tx grouped Sep 1 Tue with total arrow right
- [ ] Paging loadMore on scroll loads next 30 without dup
- [ ] MonthPicker shows Jan-Dec, Oct greyed disabled when now Sep
- [ ] Search bar + Filter pill Filter·N works within period only (not global)
- [ ] Today No record card shows when today within period and empty + + button
- [ ] No time in rows, subtitle Fruit • BCA