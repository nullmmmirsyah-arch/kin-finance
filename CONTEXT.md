# CONTEXT — kin-finance domain language

Seams are named after domain concepts here. Use these terms exactly in architecture suggestions; don't drift into generic "service/component".

## Core domain

- **Household** — the tenancy boundary. Owns timezone, periodType (monthly/weekly/yearly), balanceMode. All other modules are scoped to a householdId. See `convex/schema.ts:13` (households) + `householdMemberships:37`.

- **Period** — a calendar window [start, end) in the Household timezone. Type is monthly/weekly/yearly. All analytics, ledgers, and balances bucket by PeriodStart. See `utils/period.ts:81`, `convex/periodBalances.ts:22`.

- **PeriodBalance** — derived analytic per PeriodStart (income/expense/opening/closing). Recomputed from Transactions. See `convex/schema.ts:22`, `convex/periodBalances.ts:187`.

- **Account** — a money container within a Household (cash/bank/ewallet/credit_card). Has balance, hidden flag. See `convex/schema.ts:45`.

- **Category** — income/expense classification within a Household, has optional Icon. See `convex/schema.ts:60`.

- **Transaction** — signed amount (+income, −expense, transfer magnitude) linking Account (+ toAccount for transfer), Category, date, Household. See `convex/schema.ts:70`.

- **Budget** — monthly amount per Category per PeriodStart. See `convex/schema.ts:93`.

- **Invitation** — join code for Household. See `convex/schema.ts:108`.

## Supporting domain

- **Icon** — visual for Account type or Category. Streamline Ultimate Color via Iconify, backed by `constants/streamlineIconData.json`. Single Icon registry seam. See `components/AccountIcon.tsx:3`, `components/CategoryIcon.tsx:6`.

- **Search/Filter** — cross-Period global search (14d default) over Transactions. See `app/search.tsx:40`.

## ADRs

None yet. Use `docs/adr/` if a deepening contradicts a past decision (none currently).

## Seams

- **Period/Time seam** — wall-clock math must hide DST double-iteration (`utils/date.ts:108`) and Intl details. One seam: Period module.

- **Transaction query seam** — paginated, indexed, hidden-aware reads over Transactions. One seam: Transaction queries module.

- **Icon seam** — name → rendered SvgXml. One seam: Icon registry module.
