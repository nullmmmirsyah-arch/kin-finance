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
- [ ] Total Balance card: live sum `accountData.accounts[].balance` visible, period net (`balances.income - expense`) colored success/error under it; skeleton when loading
- [ ] Period net text shows `+` prefix for positive, matches snapshot closing net for that period
- [ ] Budgets section binds to `selectedPeriodStart` / `periodEnd` (`buds.list` per period): shows 3 pills with spent/budgeted, changes when period changes, skeleton while loading, empty state when none
- [ ] Analytics DeltaCard: `currentNet` = period income-expense, `prevNet` = previous period income-expense, labels via `formatPeriodLabel`; skeleton while loading
- [ ] Analytics CashflowBarChart: data from `periodBalances.listWindow` (6 periods window) mapped to `income/expense/net`, label via `formatPeriodLabel`; skeleton while loading
- [ ] Analytics SpendingDonut: data from `transactions.spendingByCategory` filtered by `selectedPeriodStart`/`periodEnd`; skeleton while loading; hidden categories excluded for Member
- [ ] Recent Transactions: query `transactions.list` filtered by `startDate=selectedPeriodStart`, `endDate=periodEnd`, `limit=5`; grouped by `formatDateHeaderTz` with per-day net; skeleton 5 rows while loading; empty state when none; not global recent
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
