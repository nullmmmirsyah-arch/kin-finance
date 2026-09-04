# Account Fixed Icons — Streamline Ultimate Color via Iconify

> Date: 2026-09-04
> Status: Approved design (approach A — fix derive at render)
> Source icons: https://icon-sets.iconify.design/streamline-ultimate-color/ — Streamline Ultimate Color 998, palette:true 24x24, author Streamline (webalys-hq/streamline-vectors), CC BY 4.0 (commercial allowed, attribution required). Verified via `api.iconify.design/collection?prefix=streamline-ultimate-color` (4/4 True for mapping) + offline bundle via `https://api.iconify.design/streamline-ultimate-color.json?icons=...`
> Related: `docs/superpowers/specs/2026-09-03-category-icons-design.md` (Category 56 SvgXml pattern), `convex/schema.ts:45` accounts

## 1. Overview

Migrate Accounts from Feather tinted circles to fixed Streamline vectors per `type`. No DB change. Mapping fix:
- `bank` → `saving-bank-1`
- `cash` → `cash-payment-bill`
- `ewallet` → `wireless-payment-credit-card-dollar`
- `credit_card` → `credit-card-1`

All verified exist in Iconify collection. Render offline via `react-native-svg` `SvgXml` (already `15.12.1`), same pattern as `CategoryIcon`. OTA-only, no native build.

## 2. Architecture

- No schema migration. `accounts.type` is source of truth (`convex/schema.ts:45` union 4). Icon is derived client-side, not persisted.
- Shared icon infrastructure: extend `constants/streamlineIconData.json` (add 2 missing: `wireless-payment-credit-card-dollar`, `credit-card-1`; 2 already present). Keep `account` and `category` SVG bodies in single JSON to avoid duplicate bundle.
- Isolated mapping: `constants/accountIcons.ts` owns `ACCOUNT_STREAMLINE_MAP: Record<AccountType, string>` + `getAccountIconName(type)` + `isAccountType` guard. No coupling to `category` logic except shared JSON loader.
- Single renderer: `components/AccountIcon.tsx` (parallels `components/CategoryIcon.tsx:1`) — resolves name, loads body, wraps `SvgXml` with `viewBox 0 0 24 24`, `size` prop.

## 3. Components & Files

### New
- `constants/accountIcons.ts` — map 4 + helper `getAccountIconName(type?: string): string` (fallback `saving-bank-1`), `AccountIconName` type.
- `components/AccountIcon.tsx` — `AccountIcon({type, size=32})`, uses `streamlineIconData.json` icons map, builds `xml = <svg ...>body</svg>`, returns `SvgXml`. Also exports `getAccountIconXml(type)` for tests.

### Modified (JS-only, no native config)
- `constants/streamlineIconData.json` — add 2 icons via Iconify API fetch (keep existing 55).
- `components/AccountCard.tsx:18` — replace `Feather` (`ACCOUNT_TYPES.find(...).icon`) 44/32 tinted circle with `AccountIcon` 32. Keep `C.surface` background, remove tinted `green/amber/blue/red` per-type bg (vector has own palette).
- `app/(tabs)/home.tsx:956` — My Accounts horizontal cards: same `AccountIcon` 28/40.
- `components/SelectField.tsx` — account `SelectOption` icon rendering (transfer/transaction forms): if `option.id` is account, show `AccountIcon` 24 instead of Feather fallback.
- `app/account-form.tsx:191` — Chip preview + type selector: show `AccountIcon` next to active type (optional preview row, 20-24).
- No change to `constants/accounts.ts:6` labels (keep `ACCOUNT_TYPES` for label), no change to `convex/schema.ts`, no `app.config.js` version bump.

### Out of scope
- Custom per-account icon picker (categories already have). Hide this until needed.
- Removing `assets/icons` PNGs (separate PR, keep legacy fallback).

## 4. Data Flow

`useQuery(api.accounts.list)` → `Doc<accounts>` with `type` → `getAccountIconName(type)` → `streamlineIconData.json.icons[iconName].body` → `SvgXml`. No Convex extra fetch, no network at runtime, no `ctx.db.get` per icon.

## 5. Rendering & Visual

- Size tokens: `AccountCard` container 44, icon 32; `Home` horizontal card 40/28; `SelectField` 24; `account-form` chip preview 20. All centered `items-center justify-center overflow-hidden` `Radius.sm`.
- Color: Streamline palette:true vectors carry own colors (amber/blue/green), no `C.primary` tint. Container retains `C.surface` neutral.
- Fallback: invalid `type` → `saving-bank-1`.

## 6. Error Handling & Fallback

- `getAccountIconName` validates `AccountType` union; else fallback `saving-bank-1`.
- `getBody` missing → fallback `saving-bank-1` body; if still missing → render `null` (no crash).
- Offline: no Iconify API call at runtime; bundle is offline JSON.

## 7. Testing & Validation

- New `tests/account.icons.test.ts` — 4 mappings exist, each body truthy, `getAccountIconName` fallback for invalid/undefined, `ACCOUNT_STREAMLINE_MAP` covers all `ACCOUNT_TYPES` ids.
- Keep existing `tests/accounts.*` suites.
- Validation commands (per AGENTS.md): `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest) — all must pass. No `npx convex codegen` needed (no schema change).
- Manual smoke: create 4 accounts (one per type), verify icons in Accounts tab, Home My Accounts, transaction-form account selector, transfer selector, account-form chip.

## 8. PRD & Docs Impact

- Header Last updated: `2026-09-04 (Account fixed icons Streamline)`
- §2.1 Accounts row — note fixed mapping + renderer `AccountIcon` offline.
- §2.2 Validation — Account type remains 4 literal, no `icon` field; note icon is derived.
- §3.4 Accounts — describe fixed mapping + surfaces.
- §3.9 Design System Icons — add Account mapping table.
- §7 Tech Stack Icons — note `AccountIcon` `SvgXml` share with CategoryIcon.
- §8 Change Log — dated entry with files + verification.

## 9. Attribution

CC BY 4.0 requires attribution to Streamline (https://icon-sets.iconify.design/streamline-ultimate-color/, https://github.com/webalys-hq/streamline-vectors). Credit already in PRD + About/Settings; account icons share same attribution, no extra requirement.

## 10. Alternatives Considered

- B: Persist `icon` in `accounts` schema — flexible for custom override but adds validation, Convex mutation, picker UI, migration; rejected YAGNI for "fix" req.
- C: Stay Feather — quickest but not Streamline brief, inconsistent with categories.
