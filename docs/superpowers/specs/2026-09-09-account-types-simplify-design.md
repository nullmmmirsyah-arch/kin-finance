# Account Types Simplify — Design

> Date: 2026-09-09
> Status: Approved (sections §1–§4 agreed)
> Context: `cash/bank/ewallet` have no behavioral difference — pure naming. Simplify to 2 types.

## §1 — Data model (approved)

- New enum: `type = "asset" | "debt"`.
- Labels: `asset → "Wallet"`, `debt → "Debt"`.
- Migration mapping:
  - `cash`, `bank`, `ewallet` → `asset`
  - `credit_card` → `debt`
- One-way migration via one-off Convex mutation, then removed. No dual-write, no partial downgrade. Rollback via backup only.
- No balance logic change. `balance` stays signed number. `verify/reconcile` unchanged.
- Debt-specific fields (`creditLimit`, `statementDay`, `dueDate`, `interestRate`) explicitly out-of-scope.

Files: `convex/schema.ts`, `convex/accounts.ts`, `modules/icon-registry/internal.ts`, `constants/accounts.ts`.

## §2 — Backend (approved)

- `convex/accounts.ts` (`list/create/update/remove/verify/reconcile`): no new branching by type. Only existing `hidden` + `requireOwner` checks remain.
- `convex/transactions.ts`: no type checks. Balance deltas unchanged.
- `list` return shape unchanged: `{ accounts, isOwner }`.
- `create/update` validation unchanged except enum shrinks to 2.

## §3 — Frontend (approved)

- `constants/accounts.ts`: `ACCOUNT_TYPES` shrinks to 2 entries (asset/Wallet, debt/Debt).
- `app/(tabs)/accounts.tsx`: filter rail `All/Wallet/Debt`; `HeroVault` breakdown per 2 types; `VaultCard` 2 accents + Streamline icons (`asset → cash-payment-bill`, `debt → credit-card-1`); `HIDDEN` / `VIEW ONLY` badges unchanged.
- `app/account-form.tsx`: 2 type chips, default `asset`; visible-switch, opening balance, discard guard unchanged.
- No new form fields, no limit warnings.

## §4 — Validation, rollout & testing (approved)

- `validateAccountName` unchanged. No per-type balance validation.
- Rollout: schema change → one-off migration → `npx convex codegen` → `npx tsc --noEmit` → `npm run lint` → `npm test`.
- Tests: update seeds (`cash/bank → asset`, `credit_card → debt`) in `accounts.create/reconcile/atomicOpeningBalance`, `account.icons`, `households.deleteLeaveTransfer`, `budgets/periodBalances/transactions` seeds; add 1 migration mapping test. No new behavior tests.

## Self-review

- No TBD/TODO placeholders.
- Consistent: 2-type enum used across schema, backend, registry, constants, UI, tests. No section reintroduces 4 types or debt behavior.
- Scope: single migration + enum shrink. Debt behavior, provider-specific wallets, investment/crypto explicitly excluded.
- Unambiguous: mapping old→new is total (covers all 4 old values); migration is one-way; backend stays neutral.
