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

# Design System: Kin Finance

## Overview

**Creative North Star: "The Family Ledger"**

Kin Finance feels like a well-worn ledger kept by the kitchen table -- warm, trustworthy, and always within reach. The design system draws from the quiet reliability of family financial tools: surfaces that feel like paper and wood, colors that evoke candlelight on amber, and typography that reads clearly without shouting. Every interaction should feel like opening a familiar notebook, not operating a financial terminal.

The personality is friendly and approachable -- money doesn't have to be intimidating. Buttons invite touch with soft warmth, cards breathe with generous spacing, and gradients add just enough depth to feel substantial without heaviness. The system rejects the cold blue-and-white corporate finance aesthetic in favor of stone and amber -- earth tones that say "this is ours, this is home."

**Key Characteristics:**
- Warm stone and amber palette grounded in earth tones
- Tactile components with generous touch targets and soft edges
- Flat surfaces with subtle ambient lift, never heavy shadows
- Gradient cards that add warmth and visual hierarchy
- Clean typography that prioritizes scannability over decoration

## Colors

The palette is earthy and warm -- stone, amber, and deep browns -- with semantic greens and reds for financial states. Every color earns its warmth from the same amber family.

### Primary
- **Warm Stone** (#92400E): The defining color. Used on primary buttons, active chips, FABs, icon tints, and budget progress bars. It carries the weight of every interactive element.
- **Warm Stone Light** (#FDE68A): A soft amber tint used on empty state icon backgrounds and the light side of gradient cards. Never used for interactive elements.

### Neutral
- **Parchment** (#FFFBF5): The light mode background. A warm off-white that feels like aged paper -- the canvas everything rests on.
- **Amber Surface** (#FEF3C7): Light amber surface used on card backgrounds in light mode, icon container backgrounds, and pressed states. Subtly warmer than the background.
- **Ink** (#1C1917): Primary text color in light mode. A near-black with warm undertones -- never cold or blue.
- **Slate** (#6E675F): Secondary text, timestamps, and muted labels. A warm gray that recedes without disappearing.
- **Stone Border** (#E7E5E4): Dividers, input borders, and card borders in light mode. A barely-there warm gray that defines edges.

### Semantic
- **Forest** (#065F46): Income amounts and success states. A deep, trustworthy green.
- **Crimson** (#991B1B): Expense amounts, error states, and delete actions. A rich, serious red.

### Named Rules
**The Amber Family Rule.** Every color in the palette traces back to the same amber lineage. Primary, surface, background -- they share the same warm undertone. Never introduce a color that breaks this family.

**The Rarity Rule.** The primary accent appears on less than or equal to 15% of any given screen. Its rarity is its power -- buttons, active chips, FABs, and budget progress bars earn it. Everything else uses neutral surfaces.

## Typography

**Display Font:** System (San Francisco on iOS, Roboto on Android)
**Body Font:** System (San Francisco on iOS, Roboto on Android)

**Character:** Clean, readable, and modern -- the system font ensures native feel on every platform. No decorative choices; the typography earns its personality through weight and spacing, not font selection.

### Hierarchy
- **Display** (600 weight, 28px, line-height 1.2): Screen titles on entry and auth screens — the brand's largest voice. Use sparingly; one per screen.
- **Heading** (600 weight, 18px, line-height 1.3): Screen titles, section headers. Bold enough to anchor a screen without shouting.
- **Body** (400 weight, 16px, line-height 1.5): Primary content, transaction descriptions, labels. The workhorse -- reads clearly at any length.
- **Label** (500 weight, 14px, line-height 1.4): Button text, input labels, chip text, navigation labels. Medium weight ensures interactive elements feel deliberate.
- **Caption** (400 weight, 12px, line-height 1.3): Timestamps, secondary metadata, over-budget warnings. Small but never invisible.

### Named Rules
**The Two-Weight Rule.** The system uses exactly two weights: 400 (body) and 600 (headings). 500 appears only on interactive elements (buttons, chips, labels). No other weights exist. This restraint keeps the hierarchy clear.

## Layout

The layout is single-column, vertically scrolling, with consistent horizontal padding. Every screen follows the same spatial rhythm: 16px horizontal padding, 16px vertical gaps between cards, 24px section spacing.

- **Horizontal padding:** 16px on all content areas
- **Card spacing:** 16px vertical gaps between sequential cards
- **Section spacing:** 24px between major screen sections
- **Touch targets:** 48px minimum on all interactive elements
- **FAB positioning:** Bottom-right, 6px inset from edges
- **Tab bar:** Bottom navigation with 5 tabs, 22px icons

Content breathes. Empty states get 24px vertical padding. Cards use 16px internal padding. No screen should feel crowded -- if it does, there is too much content.

## Elevation & Depth

The system is flat by design. Shadows exist as ambient lift -- barely visible, felt more than seen. Two tiers: card for resting surfaces (2px blur, 4% opacity) and elevated for FABs and floating elements (4px blur, 8% opacity). Shadows never compete with content; they only hint that a surface sits slightly above the canvas.

### Shadow Vocabulary
- **Card** (shadowOffset: 0 2px, shadowOpacity: 0.04, shadowRadius: 8px, elevation: 2): Resting cards, containers, and bordered surfaces. A whisper of depth.
- **Elevated** (shadowOffset: 0 4px, shadowOpacity: 0.08, shadowRadius: 16px, elevation: 4): FABs and floating action elements. The only surface allowed visible lift.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only on resting cards and floating elements -- never on pressed states, never on transitions, never as decoration. Depth is structural, not decorative.

### Plush Tokens (Bear Family)
- **BearColors** (non-breaking `constants/theme.ts`): `teddy #D9A679`, `teddyMid #DEB08A`, `teddyLight #E8B48E`, `honey #FDE68A`, `honeyDeep #F59E0B` — warm clay/honey only, aliased as `BearVaultColors`. Keeps stone/amber family and ≤15% primary rule.
- **Clay border** 2.5px white + `Shadow.card` is the plush elevation; no cold blues.

## Shapes

The form language is gently curved -- no sharp corners, no perfect circles. Three radius steps define everything: 12px for small elements (icon containers, inputs), 16px for medium elements (cards, buttons), 24px for large elements (empty state icon containers). Chips and FABs use full rounding (9999px) -- the only exception to the gentle curve language.

- **12px (sm):** Input fields, icon containers, small interactive elements
- **16px (md):** Cards, buttons, budget progress bar segments -- the default radius
- **24px (lg):** Empty state icon containers, large decorative surfaces
- **9999px (full):** Chips, FABs -- pill shapes for filters and floating actions

## Components

### Buttons
- **Shape:** 16px radius, 48px height, full width
- **Primary:** Warm Stone (#92400E) background, Parchment (#FFFBF5) text. The default action button.
- **Secondary:** Parchment (#FFFBF5) background, Ink (#1C1917) text, Stone Border (#E7E5E4) 1px border. For secondary actions.
- **Ghost:** Transparent background, Warm Stone (#92400E) text. For subtle actions that don't need visual weight.
- **Danger:** Transparent background, Crimson (#991B1B) text, Crimson border. For destructive actions only.
- **States:** Pressed state uses 0.92 opacity. Disabled state uses 0.5 opacity.
- **Badge:** optional pill to the right of the label (e.g. "Last used" on the login CTA). Surface background, Primary text, 12px/500 — adapts in dark mode via the same tokens.
- **Icon:** optional leading icon inside the label row (e.g. the Google glyph).

### Chips
- **Style:** Full-rounded pills (9999px), 48px minimum height, 16px horizontal padding
- **Active:** Warm Stone background, Parchment text. Used for selected filters.
- **Inactive:** Parchment background, Slate text, Stone Border. For unselected options.

### Inputs
- **Style:** 12px radius, 48px height, 1px Stone Border, Parchment background, 16px horizontal padding
- **Focus:** Border color shifts to Warm Stone
- **Error:** Border color shifts to Crimson, error text appears below in Crimson
- **Label:** 14px, 500 weight, Ink text, positioned above input with 6px gap
- **Label badge:** optional pill next to the label (e.g. "Last used" on the login Email field). Surface background, Primary text, 12px/500.

### Cards
- **GradientCard:** LinearGradient background (Parchment to Amber Surface), 16px radius, 16px padding, ambient card shadow. Used for hero cards and summary displays (Period Balance, onboarding hero).
- **Bordered Card:** Parchment background, Stone Border, 16px radius, 16px padding, ambient card shadow. Base for list items (AccountCard, CategoryCard, BudgetCard).

### List Items — The Ledger Rows
Signature rows reuse the bordered card shell but add their own icon + action grammar. All maintain 48×48 touch targets on icon actions and 16px inner padding.

- **AccountCard** (`components/AccountCard.tsx:22`): 44×44 icon container (12r, `C.surface`) with `AccountIcon` 32px (Streamline `SvgXml` palette:true, type-fixed: cash/bank/ewallet/credit_card) — neutral surface, never tinted circles. Right side 16px `formatNumber(balance)`. Hidden badge: pill `border + eye-off 12px`. Actions: `edit-2` Warm Stone / `trash-2` Crimson, 48×48.
- **CategoryCard** (`components/CategoryCard.tsx:42`): Same 44×44 surface container + `CategoryIcon` 32px (56-name allowlist via `modules/icon-registry`, fallback `other` → `tags-1`). Type pill `Income` Forest / `Expense` Crimson. Visibility toggle `eye/eye-off` Slate 18px, then edit/trash.
- **BudgetCard** (`components/BudgetCard.tsx:30`): Bordered card with header (CategoryIcon 24px + name + `eye-off` if hidden) → 48px edit/trash. Spending line `spent / budget` (Slate, Crimson when `overBudget`). Progress track: 8px height, 4r, `C.border` background, fill `C.primary` → `C.error` when over (width `progress*100%`, capped). When `spent === undefined` (Member redacted for hidden category) → track omitted, spent shows `—`.
- **TransactionCard** (`components/TransactionCard.tsx:70`): *Not* a card — transparent row `flex-row gap-3 px-4 py-3` 16r, pressed `C.surface`. Left: 40×40 12r `C.surface` container with `Icon 28px` (category) or `arrow-right` 18px Warm Stone for transfers. Middle: note (base Ink) + subtitle (xs Slate) `Category • Account` or `Account → ToAccount`. Right: 16px 600 amount — `+` Forest, `−` Crimson, transfer Ink, `formatNumber(Math.abs)`. No time is displayed; `date` prop is retained but not rendered.

### Icons — Streamline Offline Registry
Primary iconography is **Streamline Ultimate Color 998 via Iconify, CC BY 4.0** — offline bundle `constants/streamlineIconData.json` + `constants/streamlineIconMap.ts` → `modules/icon-registry` (`react-native-svg` `SvgXml`, 24×24 `palette:true`, `Size 24/28/32`). `CategoryIcon`/`AccountIcon` are shims to the registry. Fallback `other` → `tags-1`. Legacy PNG `assets/icons` + `getCategoryIconSource` retained only as offline fallback. Feather (`@expo/vector-icons/Feather`) handles UI chrome only (eye, edit-2, trash-2, chevrons, plus, search). Never mix Feather tints into category/account icon containers.

### SelectField & Bottom Sheet
- **SelectField** (`components/SelectField.tsx:52`): 48h 12r bordered field (`C.background`, 16px pad) showing selected `Icon 24px` + label; `chevron-down` 20 Slate. Press opens bottom-sheet `Modal` (`bg-black/40`, `rounded-2xl`  `Shadow.card`, `max-h 60%`). Header `Select {label}`, optional search input when `options>8`. Rows 48h `flex-row justify-between` with check 18 Warm Stone when selected. Footer hint `Scroll for more options` when `contentHeight > viewportHeight`.
- **FilterSheet / MonthPicker / Members sheets** share the same bottom-sheet treatment: `Pressable bg-black/40` backdrop, `Shadow.card`, 16–24r corners, `Feather chevron-down` affordances.

### Progress & Charts
- **Budget progress:** 8×4r track as above; fill uses semantic threshold (`C.success`→`C.chartAmber #D97706`→`C.error`) via `BudgetPill` in `app/(tabs)/home.tsx:88` for the 3-pill variant. Reports donut via `SpendingDonut` (`react-native-svg` `Circle` `strokeDasharray`, r15.915, selected `strokeWidth 8.5` vs 6.5, `opacity 0.35` dim).
- **Skeleton** (`components/Skeleton.tsx:10`): `Animated.loop` 700ms `0.45→0.85→0.45`, `C.border` bg, 12r, used for Period Balance / ranking loading states.

### EmptyState
- **Shape:** 88px icon container, 24px radius, Amber Surface background, Warm Stone Light border
- **Icon:** 36px Feather icon in Warm Stone
- **Text:** 18px heading (600 weight), 14px description (400 weight, Slate)
- **Action:** Full-width Primary button below text
- **Today card variant** (Home ledger): `Shadow.card` 16r per-period empty (`No record for today` + `+`  `Feather plus` on `bg #facc15`) when `today ∈ [selectedPeriodStart, periodEnd)` and no rows.

### Auth Brand Mark
- **Shape:** 96px square tile, 24px radius, GradientCard background, 1px Warm Stone Light border, card shadow
- **Icon:** 40px Feather icon in Warm Stone (home on login, users on onboarding)
- Identical across `app/index.tsx` and `app/onboarding.tsx` to anchor the brand at the top of the auth flow.

### FAB (Floating Action Button)
- **Shape:** 56px circle, full rounding, Warm Stone background (Elevated shadow)
- **Icon:** 26px Feather "plus" in Parchment (24px when extended with label `px-5 gap-2`)
- **Motion:** `react-native-reanimated` spring `scale 0.92→1` (damping 15, stiffness 400) on pressIn/pressOut (`components/Fab.tsx:26`). Never stack FABs; one primary action per screen.
- **Extended:** 56px height, pill with label 16/600 text, same elevated lift.

### Tab Bar
- **Style:** Bottom navigation, Parchment background, 5 tabs (`home`, `reports`, `transactions`→`search`, `accounts`, `settings`)
- **Icons:** 22px Feather icons
- **Active:** Warm Stone tint
- **Inactive:** Slate tint
- **Android note:** Navigation bar 3–5 destinations on compact width per `reference/android.md`; `edgeToEdgeEnabled true` + window insets so bar never hides behind system bars/IME.

### Bear (Plush Primitive)
- **Bear** (`components/Bear.tsx:10`): Faceless — head + ears + body only, no eyes/nose/mouth. Sizes `small 34×28 / mid 40×32 / normal 46×38`, variants `papa|mama|cub` map to `BearColors` teddy family, 2.5px white border, `Shadow.card`, NativeWind `className` for layout. Pure view, no logic.
- **BearRow** (`components/Bear.tsx:80`): `count` or `bears: BearProps[]` row, `flex-row items-end gap-8` — used for vault hero / empty states.

## Do's and Don'ts

### Do:
- **Do** use Warm Stone (#92400E) as the primary interactive color -- it carries every action
- **Do** maintain 48px minimum touch targets on all interactive elements
- **Do** use GradientCard for hero/summary displays that need visual warmth
- **Do** keep card spacing at 16px vertical gaps
- **Do** use semantic colors (Forest for income, Crimson for expense) consistently
- **Do** let screens breathe -- generous padding and spacing

### Don't:
- **Don't** introduce cold blues or corporate gradients -- the palette is warm stone and amber
- **Don't** stack shadows or use heavy elevation -- flat is the default
- **Don't** use the primary accent on more than 15% of any screen
- **Don't** crowd screens with too much content -- if it feels tight, there is too much
- **Don't** use decorative typography weights -- 400, 500, and 600 are the only options
- **Don't** mix sharp corners with the gentle curve language -- radius follows the 12/16/24 scale
