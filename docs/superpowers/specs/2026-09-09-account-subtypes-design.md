# Account Sub-types — Design

> Date: 2026-09-09
> Status: Approved (§1–§4 agreed; approach A)
> Context: follow-up of asset/debt simplification. Type stays `asset|debt`;
> naming fixed (`Asset`, not `Wallet`); display detail moves to a validated
> `subType` with fixed icon per sub-type.

## §1 — Data model (approved)

- `accounts.type`: `"asset" | "debt"` (unchanged).
- New `accounts.subType`:
  - asset → `"cash" | "bank" | "ewallet" | "other"`
  - debt → `"credit_card" | "other"`
- Server validates the (`type`, `subType`) pair on create and update (when
  both change, the new pair is validated, not each against the old row).
- Labels: `asset → "Asset"`, `debt → "Debt"`.
- Dev migration (4 asset rows): infer from name —
  `bca|bank|bsi → bank`, `dompet|cash|tunai → cash`,
  `gopay|ovo|dana|shopeepay → ewallet`, `credit|kartu → credit_card`,
  else `other`. Misses are user-fixable (sub-type is editable).

## §2 — Backend (approved)

- `create`: `subType` required; reject values outside the type's set via
  `ConvexError` (e.g. "Sub-type is not valid for this account type.").
- `update`: `subType` optional; pair-validation against the new `type`
  when both change.
- No other new logic: balances, `verify`/`reconcile`, `hidden`,
  owner-only management — all unchanged. Sub-type is display-only.

## §3 — Frontend (approved)

- `constants/accounts.ts`: `ASSET_SUB_TYPES`, `DEBT_SUB_TYPES`, per-sub-type
  label/icon; `ACCOUNT_TYPES` asset label becomes `"Asset"`.
- Fixed icon per sub-type via extended `ACCOUNT_STREAMLINE_MAP`:
  `cash → cash-payment-bill`, `bank → saving-bank-1`,
  `ewallet → wireless-payment-credit-card-dollar`,
  `credit_card → credit-card-1`, `other → tags-1`.
  `AccountIcon` takes `subType` (falls back to legacy `type` when absent).
- `account-form`: sub-type chips follow selected `type` (switching type
  resets sub-type to first option); submit disabled until chosen.
- `accounts.tsx`: list split into `ASSET` + `DEBT` sections, each with a
  subtotal; `HeroVault` keeps grand total + Asset/Debt breakdown; filter
  rail unchanged (All/Asset/Debt); HIDDEN/VIEW ONLY badges unchanged.

## §4 — Migration, testing & rollout (approved)

- Dev migration is one-off (shim → migrate → narrow → delete file, same
  pattern as the asset/debt migration); never committed.
- Tests: update all seeds with new `subType`; add pair-validation cases
  (reject cash-on-debt, accept valid pairs, joint type+subType update);
  add infer-migration cases; update icon tests to per-sub-type map.
- Rollout: `npx convex codegen` → `npx tsc --noEmit` → `npm run lint` →
  full vitest green → push dev (`--once`) → verify data + logs →
  delete migration file. Work stays on `feat/account-types-simplify`.

## Self-review

- No TBD/TODO placeholders.
- Consistent: pair sets, labels, icons, and inference keywords match across
  all sections; sub-type never drives balance/permission logic anywhere.
- Scope: single field + display wiring; debt behavior (limits, due dates),
  provider-specific wallets, and filter/group-by-sub-type explicitly out.
- Unambiguous: required-at-create + editable-later; joint-update pair rule
  stated; `other` is the explicit fallback (never null).
