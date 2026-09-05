---
name: Kin Finance
description: Warm, family-focused household finance tracker with role-based visibility
colors:
  primary: "#92400E"
  primary-light: "#FDE68A"
  primary-dark: "#F59E0B"
  primary-light-dark: "#78350F"
  background: "#FFFBF5"
  background-dark: "#1C1917"
  surface: "#FEF3C7"
  surface-dark: "#292524"
  text-primary: "#1C1917"
  text-primary-dark: "#FAF9F7"
  text-secondary: "#6E675F"
  text-secondary-dark: "#A8A29E"
  success: "#065F46"
  success-dark: "#34D399"
  error: "#991B1B"
  error-dark: "#F87171"
  border: "#E7E5E4"
  border-dark: "#44403C"
typography:
  body:
    fontFamily: "System"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "System"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "System"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.3
  heading:
    fontFamily: "System"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
  display:
    fontFamily: "System"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  sm: "12px"
  md: "16px"
  lg: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "48px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.error}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "48px"
  chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    rounded: "{rounded.full}"
    padding: "0 16px"
  chip-inactive:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.full}"
    padding: "0 16px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    height: "48px"
  card:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.md}"
    padding: "16px"
  gradient-card:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.md}"
    padding: "16px"
  list-card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "16px"
  transaction-row:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  select-field:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "48px"
  progress-track:
    backgroundColor: "{colors.border}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    height: "8px"
  fab:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    rounded: "{rounded.full}"
    height: "56px"
---

# Design System: Kin Finance — Plush Ledger v2.1 (Bear Family)

## Overview

**Creative North Star: "Plush Ledger — The Bear Family Vault & Honey Jars"**

Kin Finance is now a **plush claymorphism** household ledger guarded by a **faceless bear family** (Papa, Mama, and cubs). The world is tactile and edible: **honey/butter/peach/terra** on a warm parchment canvas. Every surface feels squeezable — **2.5px white clay borders + `Shadow.card`** give plush elevation without cold shadows, **22–28px radii** keep everything soft, **52–56px touch targets** keep it chunky and kid-friendly. The bear never shows a face (head + ears + body only); its silence keeps the brand calm and universal.

The previous "Family Ledger" warmth remains, but the visual weight has shifted from flat paper to **floating clay islands**: `SearchIsland` on Home, `Vault` grid on Accounts, `HoneyJar` on Budgets, `BearRegister` for amounts, and `HouseholdHero` for the family header. All financial invariants are preserved — only presentation changed.

**Key Characteristics:**
- Faceless bear family as the only mascot (no eyes/nose/mouth, teddy palette)
- Honey/butter/peach/terra warm family — no cold blues ever
- Clay: 2.5px white border + `Shadow.card` is the plush elevation system
- Chunky: 52–56px touch (pill/chip 44–52h), 22–28px radii, 2.5px borders
- Floating islands: SearchIsland (26r), VaultCard (24r), HoneyJar (24r), HouseholdHero (26r), AmountRegister display (20r)
- Primary Warm Stone ≤15% per screen — rarity is its power
- NativeWind `className` only; never `Pressable` `style` callbacks (v4 gotcha)

## Colors

The palette stays earthy-stone/amber, extended with **honey/butter/peach** for the plush world. Everything still traces back to the amber family.

### Primary
- **Warm Stone (Terra)** (#92400E): Primary interactive — buttons, active chips, FAB, terra caps, invite Copy. Light mode; dark is #F59E0B. ≤15% per screen.
- **Warm Stone Light** (#FDE68A): Empty icon bg, gradient-card light end, honey gradient start. Also `BearColors.honey`.

### Plush Extensions — `BearColors` / `BearVaultColors` (`constants/theme.ts:54`)
- **Teddy** (#D9A679): Papa bear, main teddy fill.
- **TeddyMid** (#DEB08A): Mama bear.
- **TeddyLight** (#E8B48E): Cub bear + inner ear.
- **Honey** (#FDE68A): Honey gradient start / butter pill / type label bg.
- **HoneyDeep** (#F59E0B): Honey gradient end / terra dark / primary-dark.

All three teddies stay inside the stone/amber lineage — warm clay only, never cool.

### Accent — Butter / Peach / Cream
- **Butter** (#FEF3C7 / #FFF6D6 / #FFF8EC): Surfaces, pressed states, card gradients (white→#FFF6D6), drawer cream (#FFF8EC), peach chip bg (#FFE9C9). Dark surfaces use #292524 / #3A3224 instead.
- **Peach2** (#FFE9C9): Category icon container, Vacant avatar, small bear footer.
- **Cream Border** (#F3E6CD): Plush card inner strokes (icon containers, tracks, input focus unfocused). White 2.5px is the outer clay border; #F3E6CD is the inner detail stroke.
- **White Clay Border** (#FFFFFF) 2.5px: The defining plush edge on every island/card/jar/hero — paired with `Shadow.card`.

### Type Top Bars & Semantic
- **Cash** (#10B981 emerald): Vault top 8px bar for `cash`.
- **Bank** (Terra #92400E / #F59E0B dark): Vault top bar for `bank`.
- **E-Wallet** (#3B82F6 blue — warm-muted, no cold bias): Vault top bar for `ewallet`.
- **Credit/Cherry** (#991B1B / #F87171 dark): Vault top bar for `credit_card`, expense/crimson, over-budget fill.
- **Forest** (#065F46 / #34D399 dark): Income, success.
- **Chart Amber** (#D97706): Budget threshold 80–100% fill.

### Neutral
- **Parchment** (#FFFBF5) / **Ink** (#1C1917) — background/text light; dark is #1C1917 bg / #FAF9F7 text.
- **Amber Surface** (#FEF3C7 / #292524) — light card bg.
- **Slate** (#6E675F / #A8A29E) — secondary text.
- **Stone Border** (#E7E5E4 / #44403C) — neutral border; plush inner uses #F3E6CD instead.

### Named Rules
**The Amber Family Rule.** Every color traces to the same amber lineage (stone→honey→peach→terra). Never introduce a cold blue; even ewallet blue is muted and paired with terra/honey.

**The Rarity Rule (≤15%).** Primary terra appears on <15% of any screen — active chips, primary buttons, FAB, top-bar for bank, invite Copy, cap on honey jar. Everything else is white/cream/butter/peach with terra as accent only.

**The Clay Rule.** Any plush surface must have **2.5px white border + `Shadow.card`** (or `Shadow.elevated` for FAB only). Unbordered flat cards are legacy only; plush islands always use clay.

## Typography

**Display/Body:** System (San Francisco / Roboto). Weight vocabulary 400/500/600/800 — 800 used only for plush hero numbers & card titles (16–34px) to feel extra-bold clay.

### Hierarchy
- **Display** (600, 28px): Screen titles (`Accounts`→`Bear Vault`, `Budgets`→`Honey Jars` hero). One per screen.
- **Hero Numbers**: **26px 800** (`VaultHero` total, `HoneyHero` labels) and **34px 800** (`AmountRegister` input) — Baloo-style extra-bold, `letterSpacing 1.5` for invite code `KIN-8A2F`.
- **Heading** (600, 18px): Section headers (`Budgets`, `My Accounts`, `Transactions`).
- **Body** (400, 16px): Descriptions.
- **Label** (500→800 in plush, 14px): Chips, buttons — plush elevates to 800 for tactile feel (chip 12–13px 800).
- **Caption** (400, 12px): Timestamps, `Whole number ≥1` hints, `hidden` pills.

### Named Rules
**Two-Weight → Plush Extra-Bold.** Legacy 400/600 + 500 on interactive; plush adds **800** for hero numbers, card names (14px 800), and chip pills (12–13px 800). No other weights.

## Layout

Single-column, vertically scrolling, 16px horizontal padding (20px for vault grid). Plush islands stack with **10–12px gaps** (grid gap 10px on vault 2-col).

- **Horizontal padding:** 16px default; 20px for Vault grid (`paddingHorizontal: 20`), 16px inner for SearchIsland/HouseholdHero.
- **Card spacing:** 10–16px vertical gaps (10px grid, 12px heroes, 16px sections).
- **Section spacing:** 24px between major blocks (budgets, accounts, transactions on Home).
- **Touch targets:** **52–56px** plush standard (Numpad 52px, Pill 44–52h, mini-btn 44px, Vault icon 54px); enforce **≥48px** minimum everywhere.
- **FAB:** Bottom-right, 6px inset, 56px circle, `Shadow.elevated`.
- **Tab bar:** 5 tabs (`home`, `reports`, `transactions→search`, `accounts`, `settings`), 22px Feather. Plush note: visual is floating clay (white border + shadow) when applicable; keep `edgeToEdgeEnabled true` so bar never hides behind system bars/IME.
- **Grids:** Accounts vault **2-col gap 10px** `FlatList numColumns=2`; Categories **2-col gap 8px**; Budgets honey list single-column 10px gap.

## Elevation & Depth

Flat-by-default with **plush clay lift**: `Shadow.card` (2px/4%/8r) for resting islands, `Shadow.elevated` (4px/8%/16r) for FAB only. The **2.5px white border** is what makes clay read as plush — shadow alone is not enough.

### Shadow Vocabulary
- **Card** (`shadowOffset 0 2, opacity 0.04, radius 8, elevation 2`): SearchIsland, VaultCard, HoneyJar/Hero, HouseholdHero, AmountRegister display, PlushCategoryCard, BudgetPill, white pills.
- **Elevated** (`0 4, 0.08, 16, 4`): FAB, Search CTA.

### Named Rules
**Flat-By-Default → Clay-By-Default for Plush.** Legacy surfaces flat; plush islands always clay (2.5px white + card shadow). Pressed uses `0.92 opacity` or `#FFF8EC` bg, never extra shadow.

**No Cold Shadows.** Shadow color is `#000` at 4–8% only — no colored shadows, no stacking.

### Plush Tokens (Bear Family)
- **BearColors** (`constants/theme.ts:54`): `teddy #D9A679`, `teddyMid #DEB08A`, `teddyLight #E8B48E`, `honey #FDE68A`, `honeyDeep #F59E0B` — aliased as `BearVaultColors`. Warm clay/honey only.
- **Cream** `#F3E6CD` / `#FFE9C9` / `#FFF8EC` / `#FFF6D6`: Detail strokes, honey track, chip peach.
- **Clay border** 2.5px white + `Shadow.card` is the plush elevation; no cold blues.

## Shapes

Gently curved clay — no sharp corners, no perfect circles except FAB (56r). Plush radius scale is **18–28px**.

- **12px (sm):** Legacy inputs, icon containers (40–44px). Plush uses 14–16r for jar track/details.
- **16px (md):** Legacy cards/buttons. Plush inner: icon 12–16r.
- **18px:** PlushCategoryCard (plush grid chip), category icon container is 12r inside.
- **20px:** AmountRegister display (reg-display), Household Member row.
- **22–24px:** Plush card default — VaultCard 24r, HoneyJar 24r, VaultAdd 24r, empty states 16r.
- **26px:** Island heroes — SearchIsland 26r, VaultHero 26r, HoneyHero 26r, HouseholdHero 26r.
- **28px:** Display numbers (optional hero extra). Chips/pills/FAB use **9999px** (full).

## Components

### Bear — Plush Primitive (`components/Bear.tsx:37`)

- **Bear** (`size small 34×28 / mid 40×32 / normal 46×38`, `variant papa|mama|cub` → teddy family, inner ear `teddyLight`). Structure: head `borderRadius headH` + ears absolute `top -0.38*ear` left/right `-2` with inner ear `0.55*ear` centered, body `borderRadius bodyW/2.2` overlapping head `marginTop -6`. **Faceless** — no eyes/nose/mouth. **2.5px white border + `Shadow.card`**, NativeWind `className` for layout, `testID bear-{size}`.
- **BearRow** (`components/Bear.tsx:147`): `count` or `bears: BearProps[]` row, `flex-row items-end gap-8/6`, centered. Used for vault hero / empty states / household family (5 bears: papa normal, mama mid, 3 cubs small).

### SearchIsland — Home Clay Island (`components/SearchIsland.tsx:33`)

- **Outer:** White 2.5px border, **26r**, `Shadow.card`, bear ears absolute `top -10 left 18/38` (white 2.5px border), padding 10. `testID search-island`.
- **Top row:** Bear peek 34×34 12r `#FFE9C9` + ears 8r terra, field **46h cream `#FFF8EC` 2.5px `#F3E6CD` → focus terra** with `search` 16 Slate + `TextInput` 14 700 Ink `placeholder "Cari catatan, nominal, akun…"` + clear `x` 26r, search CTA **terra 36h** `search` + `Cari` 13 800.
- **Quick filters:** Horizontal `ScrollView` gap 8, pills `Semua/Expense/Income/Transfer` + `Filter` badge — **2.5px border** active terra/Ink vs inactive white/Slate, 7/12 pad, dots 8r for expense/income.
- **Drawer:** When `Filter` pressed, inner **cream `#FFF8EC` 2.5px `#F3E6CD` 20r** with `ACCOUNT`/`CATEGORY` headers 11 800 Slate, horizontal chip scrolls (selected terra), `Reset` 44h white vs `Terapkan` 44h terra, footer **Bear small** + `"Bear family bantu pilah transaksi"`.
- **Props:** `searchDraft, onSearchDraft, onCommit, onClear, typeFilter, onTypeChange, accountIds, categoryIds, onAccountToggle, onCategoryToggle, activeCount, accounts, categories, onReset`. Wired in `app/(tabs)/home.tsx:839` replacing legacy search-row. No `Pressable` style callback — `useState` pressed for terra depth.

### Vault — Accounts as Bear Vault (`components/VaultCard.tsx:51`, `app/(tabs)/accounts.tsx:112`)

- **VaultCard:** White 2.5px border **24r**, `Shadow.card`, `overflow hidden`, **top 8h bar** color per type `testID top-bar-{cash|bank|ewallet|credit_card}` (`cash #10B981, bank terra, ewallet #3B82F6, credit cherry`), icon **54×54 16r** cream/dark `AccountIcon 30`, name **14 800** centered, type label **11 700** muted, hidden pill `eye-off` 10, balance **17 800**, mini-btns **44×44 999r 2px cream** `edit-2` terra / `trash-2` cherry (useState pressed `#FFF8EC`). `testID vault-card`. Grid **2-col gap 10** via `numColumns=2`.
- **VaultHero** (`components/VaultCard.tsx:196`): Gradient **white→#FFF6D6** (dark `surface→#3A3224`), 2.5px white **26r**, `Bear mid+normal` row, `BEAR VAULT` 11 800 Slate, total **26 800** Ink `vault-hero-total`, count muted 12 600, `archive` 18 terra in 44r white circle. `testID vault-hero`.
- **VaultAdd** (`components/VaultCard.tsx:269`): Dashed 2.5px `C.border` **24r** `minH 168`, `plus` 22 terra in 54r cream, `Add Vault` 14 800 + `Create new account` 11 600 + Bear small. Owner only. `testID vault-add`.
- **Page:** `Bear Vault` title + `Your accounts, guarded by bears`, reconcile banner, filter `All/Cash/Bank/E-Wallet/Credit`, empty via Bear mid+normal + `VaultAdd` for Owner. Preserves `api.accounts.list/verify/reconcile`, `isOwner` matrix, hidden visibility.

### HoneyJar — Budgets as Honey Jars (`components/HoneyJar.tsx:19`, `app/(tabs)/budgets.tsx:191`)

- **HoneyJar:** White 2.5px border **24r** `Shadow.card`, row 14 pad gap 12. Left **jar-jar 64×72**: cap **64×14 6r terra 2.5px white** `jar-cap`, body **64×72 16r** `#FFFBF5`/dark + `jar-body`, fill `testID fill` **height `progress*100%`** honey `LinearGradient #FDE68A→#F59E0B` (over → cherry `#991B1B`), emoji **22 centered** `CategoryIcon 22` or `🍯`. Right meta: name **14 800** + edit/delete **36 999r cream**, spent/amount **12 600** (cherry when over, `—` when `spent undefined`), track **6h 3r** `C.border` + fill `honey-track-fill` honey gradient or cherry, width `progress*100%`.
- **HoneyHero** (`components/HoneyJar.tsx:253`): White→#FFF6D6 gradient 2.5px white **26r**, bear header `small+mid` + `Honey Jars` 11 800 + `Budget overview` 13 700 + `droplet` 16 terra in 40r white, stats 2-col white cards **Budgeted/Spent 16 800** (Spent `—` when `hasRedacted`), progress **10h 5r cream** honey/cherry fill `progress*100%`. `testID honey-hero`.
- **Page:** Month nav `< >` + `formatMonthLabel`, `hasRedacted` (any `spent===undefined` → Member redacted) hides tracks/fills and shows `—`. Preserves `api.budgets.list`, summary `budgeted/spent/hasRedacted`, `getMonthBounds`.

### Household — Bear Family Home (`components/HouseholdHero.tsx:17`, `app/members.tsx:430`, `app/household.tsx:1`)

- **HouseholdHero:** Gradient white→#FFF6D6 2.5px white **26r** `Shadow.card`, top row house **56×56 18r `#FFE9C9`** terra `home` 26 + name **16 800** + subtitle 12 600 + `bears` count 11 700 + edit **44 12r** if Owner, `BearRow` **5 bears** `papa normal + mama mid + 3 cubs small` gap 6 + caption `Faceless bear family — Papa, Mama & 3 cubs` 11 700. `testID household-hero`.
- **HouseholdInviteCard:** White dashed 2.5px `C.border` **20r** 14 pad, `Invite code` 13 800 + `7-day • single-use • auto-revoke` 11 700 + code pill `testID invite-code` `#FFFBF5` 12r with **18 800 Baloo 1.5 ls** `KIN-8A2F` style, `Copy` terra pill + `Revoke` white pill. Uses `expo-clipboard`.
- **HouseholdMemberRow:** White 2.5px **20r** 12 pad, avatar **44×44 14r `#FFE9C9`** `shield/user` 20 terra, name 13 800, email 11 600, role pill `owner terra white / member #FDE68A terra` 999r, remove `x-circle` 18 cherry if Owner. `testID household-member`.
- **HouseholdBalanceMode:** Owner segment **Fresh/Carry** 999r 2.5px border, selected terra; Member readonly `Owner only` banner.
- **Page `app/members.tsx` (also `/household` alias):** Lists `HouseholdHero` → rename inline → rank `InviteCard` → `BalanceMode` → `Timezone` → `Members` → rename `timezonePickerOptions`, danger zone, pending invites, single-member empty. Settings `Household` row and Home household-pill both push `/household`.

### AmountRegister — Bear Register (`components/AmountRegister.tsx:115`, `app/transaction-form.tsx:659`)

Replaces amount `Input` with a clay register.

- **Top:** 2 small bears `mama+cub` row + type badge **Expense − `#FEE2E2/#991B1B` / Income + `#DCFCE7/#065F46` / Transfer ⇄ `#FEF3C7/terra`** 999r 2px white `testID type-badge`.
- **Display:** White 2.5px **20r** row 12 pad, sign pill **46×52 14r** badge bg + **22 extra-bold** sign (`−`/`+`/`⇄`) `testID sign-pill`, `TextInput` **34 800** Ink `amount-input` (physical keyboard) with `formatAmountInput` (thousands `,`), `x` clear `#FEF3C7` when filled, sub `Rp • Whole number ≥1` 11 700. `testID amount-register`, `Shadow.card`.
- **Presets:** Row `+50k/+100k/+500k/+1jt` pills **36h 999r 2px** white 12 800 (`preset-{value}`).
- **Numpad:** **3×4 grid gap 8**: `1–9, 000, 0, ⌫` each **52h 2px** `C.border` **16r** (backspace `#FFF8EC` with `delete` 20). `numpad-{1-9,0,000,backspace}`. Helpers `pressDigit/backspace/clear/addPreset` update `amountText` via `formatNumber/formatAmountInput` and preserve `checkDuplicate`, `handleAmountBlur` validation, `validateTransactionAmount(signedAmount, type)`. Signed logic intact: `expense → −abs`, others `+abs`.
- **Hints:** `Whole number ≥1` 11 600; error 14 `C.error` `testID amount-error`.
- **Preserved:** Type `Chip`, Repeat last `pressable`, `SelectField` Account/Category, `DateField`, `Note`, duplicate 24h window `Alert`, `canSubmit` + `hasInteracted` guards, submit haptics. No Pressable style callback.

### Categories — Plush Grid (`components/CategoryCard.tsx:123`, `app/categories.tsx:141`)

- **PlushCategoryCard:** White 2.5px **18r** 10 pad row gap 8 `testID plush-category-card`, icon **36×36 12r `#FFE9C9` 2px white** `CategoryIcon 22`, name **13 800** + type **11 700** (`hidden • hidden`), hidden `eye-off` 28r cream when hidden `testID plush-hidden`, owner mini pills **32 999r 2px cream** `eye/edit-2/trash-2` 12 (pressed `#FFF8EC`). Hidden Bear reference for token coverage.
- **Page:** **2-col gap 8** 16 horiz, chips `All/Income/Expense` + `Add` terra `plus` 14 (Owner only), `56 icons` butter pill, reserved footer **12 gap** `#FFE9C9` 2.5px white **18r** `Bear small` + `2 reserved "Initial Balance"` 12 800 / `Tidak bisa dihapus` 11 700 `testID reserved-footer`. Legacy `CategoryCard` (44×44 surface) kept for compat; plush grid uses new variant.

### Buttons (Plush-aware)
- **Shape:** 16r default, **48h** min (plush 52–56h for register/hero). **2–2.5px** border where clay demands (primary terra 2.5, dashed invite 2.5).
- **Primary:** Terra #92400E bg, Parchment #FFFBF5 text, 16r. Pressed `0.92` or `#7A3410`.
- **Secondary:** Parchment bg, Ink text, Stone 1px.
- **Ghost/Danger:** Transparent + terra/cherry text.
- **States:** Pressed via `useState` + static style/className — never `style={({pressed})=>}`.
- **Register preset/numpad:** White 2px border cream, 36–52h, 999/16r.

### Chips
- **Style:** 999r, **44–48h**, 16h pad, 2.5px border when plush. Active terra+white, inactive white+slate+Stone/Cream.

### Inputs
- **Legacy Input:** 12r, 48h, 1px Stone, Parchment, 16 pad, focus terra, error cherry.
- **Plush fields:** SearchIsland 46h cream 2.5px → terra focus, AmountRegister 52h register trio, SelectField 48h 12r + bottom-sheet `Modal bg-black/40 24r Shadow.card`.

### Cards & Gradients
- **GradientCard:** `LinearGradient` white→#FEF3C7 (plush hero white→#FFF6D6), 16r (hero 26r), 16 pad, card shadow. Used for Period Balance, onboarding hero, Household/Vault/Honey heroes.
- **Bordered Card:** Legacy `AccountCard/CategoryCard/BudgetCard` bases; plush replaces with Vault/Honey/Plush variants.

### List Items — Ledger Rows (Legacy shells; plush uses new cards)
- **TransactionCard** (`components/TransactionCard.tsx:70`): Transparent row `flex-row gap-3 px-4 py-3` 16r, pressed `C.surface`, 40×40 12r surface + `CategoryIcon 28` or `arrow-right` 18 terra, note + `Category • Account` subtitle, amount 16 600 `+` Forest/`−` Cherry/transfer Ink.

### Icons — Streamline Offline Registry
Primary **Streamline Ultimate Color 998 via Iconify, CC BY 4.0** — `constants/streamlineIconData.json` + `streamlineIconMap.ts` → `modules/icon-registry` (`SvgXml` 24×24 `palette:true`, Size 24/28/32). `CategoryIcon`/`AccountIcon` shims. Feather handles chrome only (`eye`, `edit-2`, `trash-2`, `chevrons`, `plus`, `search`, `filter`, `copy`, `home`, `shield`, `delete`, `droplet`, `archive`). Never mix Feather tints into category/account icon containers.

### SelectField & Bottom Sheet
- **SelectField** (`components/SelectField.tsx:52`): 48h 12r field showing `Icon 24` + label; `chevron-down` 20 Slate → bottom-sheet `Modal bg-black/40 24r Shadow.card max-h 60%` with search when >8 options, rows 48h `check` 18 terra, footer hint `Scroll for more options`.

### Progress & Charts
- **Honey progress:** 6–10h, `#F3E6CD`/`C.border` track, fill honey gradient or cherry (over). Reports donut `SpendingDonut` (`Circle strokeDasharray r15.915`, selected 8.5 vs 6.5, `opacity 0.35` dim).
- **Skeleton** (`components/Skeleton.tsx:10`): `Animated.loop` 700ms `0.45→0.85`, `C.border` bg, 12r.

### EmptyState & Brand Mark
- **EmptyState:** 88px 24r Amber Surface + Warm Light border, 36 Feather terra, 18 600 heading + 14 Slate desc, full-width Primary button. Today variant: `Shadow.card` 16r `No record for today` + `+` on `#facc15`.
- **Brand Mark:** 96sq 24r GradientCard 1px Warm Light, card shadow, 40 Feather terra (`home`/`users`) — identical on `app/index.tsx` and `app/onboarding.tsx`.

### FAB
- **Shape:** 56r circle (elevated), `plus` 26 Parchment (24 when extended `px-5 gap-2`). Spring `scale 0.92→1` (damping 15, stiffness 400) on press (`components/Fab.tsx:26`). One per screen.

### Tab Bar
- **Style:** Bottom 5 tabs, Parchment, 22 Feather. Active terra, inactive Slate. **Plush floating variant:** when clay islands are used, tab container is white clay (2.5px + card shadow) with 999r inset — visual only, layout unchanged. `edgeToEdgeEnabled true` + insets so bar never under system bars/IME.

### Bear (Plush Primitive) — Summary
Already detailed above; the single source of faceless plush identity. Every bear is **head+ears+body, 2.5px white, `Shadow.card`, teddy palette, no face**.

## Do's and Don'ts

### Do:
- **Do** use Bear `papa/mama/cub` with teddy `D9A679/DEB08A/E8B48E` + honey `FDE68A/F59E0B` + cream `#F3E6CD/#FFE9C9` — all amber family
- **Do** apply **2.5px white clay border + `Shadow.card`** on every plush island/card/jar/hero
- **Do** keep **22–28r** for plush islands (18r category chip, 20r register display, 24r cards, 26r heroes)
- **Do** maintain **52–56h** chunky touch (Numpad 52h, mini 44h, icon 54h, pills 44–52h) — never <48h
- **Do** keep **Primary ≤15%** — terra for active states and a few accents only; rest is white/cream/butter
- **Do** reuse `useThemeColors()` / `useThemeGradients()` and `BearColors` — never hardcode outside `constants/theme.ts`
- **Do** use `useState` pressed + static `style`/`className` for Pressable — never `style={({pressed})=>}`
- **Do** let Home/Accounts/Budgets/Household breathe with generous padding and bear family accents

### Don't:
- **Don't** give the bear a face — faceless is the identity (head+ears+body only)
- **Don't** introduce cold blues/corporate gradients — warm stone/honey/peach only
- **Don't** drop the clay border — unbordered flat is legacy, plush must have 2.5px white + shadow
- **Don't** use radius outside 12/16/18/20/24/26 or 999r — the gentle scale is deliberate
- **Don't** stack shadows or heavy elevation — card vs elevated only, never pressed shadows
- **Don't** break signed amount, hidden visibility, or owner/member matrix — presentation only, invariants intact
- **Don't** use tiny 32h controls — chunky clay demands 44h minimum, 52–56h preferred
- **Don't** mix Feather tints into category/account icon containers — Streamline palette only
