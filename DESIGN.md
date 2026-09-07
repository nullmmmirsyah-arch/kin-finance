---
name: Kin Finance
description: A warm, family-focused household finance tracker for Android.
colors:
  primary: "#92400E"
  primary-light: "#FDE68A"
  primary-dark: "#F59E0B"
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
  chart-amber: "#D97706"
  chart-emerald: "#059669"
typography:
  display:
    fontFamily: "System, -apple-system, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.0
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "System, -apple-system, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: "-0.02em"
  subheading:
    fontFamily: "System, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "-0.01em"
  body:
    fontFamily: "System, -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  label:
    fontFamily: "System, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.02em"
  detail:
    fontFamily: "System, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: "0.04em"
  caption:
    fontFamily: "System, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.33
  micro:
    fontFamily: "System, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.0
    letterSpacing: "0.08em"
rounded:
  sm: "12px"
  md: "16px"
  lg: "24px"
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
    padding: "0 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
  button-secondary:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0 24px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
---

# Design System: Kin Finance

## Overview

**Creative North Star: "The Warm Ledger"**

Kin Finance is a family ledger rendered as a warm editorial sanctuary. Paper-soft stone and amber surfaces, grounded ink text, and a single toasted-amber accent create calm authority — the feeling of opening a well-kept household book together at the kitchen table, not a cold corporate dashboard.

Density is comfortable and breathable: generous 16–24px rhythm, 48px touch targets, and card stacks that group by day with air between them. Material honesty matters — subtle tonal layering (background → surface) does the work of depth, shadows stay whisper-soft, and gradients (paper to wheat) mark only the hero household card. Motion is restrained: splash fade, gentle HMR-safe state opacity shifts.

**Key Characteristics:**
- Paper-warm minimalism — stone/amber only, no corporate blues
- Tonal layering over heavy shadow — depth through surface shifts
- Editorial hierarchy — display 28px / heading 18px / body 16px with generous line-height
- 48px-first controls — every interactive element meets the minimum
- Gradient reserve — `Gradients.card` only on the household hero, nowhere else

## Colors

A tight, warm-analogous palette centered on toasted amber (#92400E) set against paper (#FFFBF5) and wheat surface (#FEF3C7). Text is stone ink (#1C1917); supporting roles are muted stone secondaries. Semantic greens/reds are desaturated ledger tones.

### Primary
- **Toasted Amber** (#92400E): Primary accent for CTAs, progress, active states. Light mode #92400E / dark #F59E0B. Used ≤15% per screen.
- **Pale Amber Wash** (#FDE68A): Light tint for primary-light role, badge backgrounds, subtle highlights.

### Neutral
- **Paper** (#FFFBF5 light / #1C1917 dark): App background. Light is warm off-white; dark is stone ink.
- **Wheat Surface** (#FEF3C7 light / #292524 dark): Elevated surface for cards, sheets, gradient stop.
- **Ink** (#1C1917 light / #FAF9F7 dark): Primary text.
- **Stone Secondary** (#6E675F light / #A8A29E dark): Secondary text, labels, captions.
- **Stone Border** (#E7E5E4 light / #44403C dark): Hairline borders, dividers, chart grids.

### Semantic
- **Ledger Green** (#065F46 light / #34D399 dark): Success, delta positive, cash account.
- **Ledger Red** (#991B1B light / #F87171 dark): Error, danger, delta negative, credit card account.
- **E-Wallet Blue** (#1D4ED8 light / #60A5FA dark): E-wallet account (functional, not brand).
- **Chart Amber/Emerald** (#D97706 / #059669 light, #F59E0B / #34D399 dark): Donut and bar accents.

### Named Rules
**The One Warm Voice Rule.** The primary amber appears on at most 15% of any screen — one CTA, one progress bar, one selected chip. Its rarity is its authority. Never flood a screen with amber solids.
**The Paper First Rule.** Background stays paper (#FFFBF5); surface (#FEF3C7) marks only grouped cards and sheets. Do not use surface as a full-page wash.

## Typography

**Display Font:** System sans (San Francisco / Roboto) — no custom webfont; relies on OS rendering with NativeWind class sizing.
**Body Font:** System sans, same stack — hierarchy is weight and size, not family contrast.

**Character:** Confident but soft — semibold display for household and section titles, regular body for ledger rows, medium labels for chips and buttons. Uppercase is never used for body; only for compact badges.

### Hierarchy
- **Display** (700, 28px, 1.0, −0.02em): Household name, period balance hero, onboarding headlines. Tabular-nums for amounts.
- **Heading** (700, 18px, 1.33, −0.02em): Section titles (Transactions, Budgets, My Accounts, Reports headings), screen titles. Leading-6.
- **Subheading** (500, 15px, 1.33, −0.01em): Date group headers (Today Sep 6 Sun), period label (September 2026), secondary card titles. Weight steps from heading via 700→500.
- **Body** (500/600, 16px, 1.25, −0.01 to −0.015em): Ledger rows — title 500, amount 600 tabular-nums. Max ~60ch on phone. This is the Money Manager match point (16px is the dominant size).
- **Label** (600, 14px, 1.4, 0.02em): Button text, chip text, field labels. Filter pills 13px variant tracking-wide, not caps.
- **Detail** (400, 13px, 1.33, 0.04em): Subtitles (BCA • Bills), helper text, spent/budgeted line. Tracking-wide for secondary tone.
- **Caption** (400, 12-13px, 1.33): Timestamps (unused in ledger), helper text, day totals. Detail 13 is preferred for secondary metadata.
- **Micro** (600, 11px, 1.0, 0.08em): Kicker badges (PERIOD BALANCE, VAULT TOTAL, TOTAL • 3 JARS). Uppercase only for micro.
- **Nav** (600, 11px, 0.2): Tab bar labels, icon 24px. Height 68 with 8dp vertical inset.

### Named Rules
**The Weight Not Family Rule.** Hierarchy is built with weight (400 → 600 → 700) and size steps, never by swapping font families. Keep the stack system-only.

## Layout

Phone-portrait, single-column stack with 20px horizontal gutters (px-5) and 14–28px vertical rhythm (gap-3.5/5, mt-7/8, pt-6). Content max is constrained by screen; where a wider canvas exists (tablets) the same column centers. Sections are card stacks or SectionList groups with 2px intra-section + 12px inter-section gaps (SectionSeparator 12, ItemSeparator 2) and 24–32px between major sections (Transactions ↔ My Accounts).

Grid is 4px base: spacing scale 4 / 8 / 12 / 16 / 20 / 24 / 32. Cards pad 16–20px internal (TransactionCard 20, GradientCard 20 hero, VaultCard 12/16); sheets pad 16–24px. List rows are 48–60px tall (icon 48, py-4). No multi-column grid on phones; Reports charts stack vertically with gap-4. Bottom tab bar 68px high (8dp inset) and top app bar frame the scroll; FAB 60px pill sits bottom-right where a primary action exists (60×60 in earlier iterations, now 60h pill + tabBar 68 to match Money Manager feel).

Responsive: compact width = bottom navigation bar; expanded width = same stack centered (no rail needed at MVP). Edge-to-edge with SafeArea insets and keyboard insets via `react-native-keyboard-controller`.

## Elevation & Depth

Flat-by-default with tonal layering as the primary depth signal. Shadows are ambient and feathered, never hard drop shadows. Background (paper) → Surface (wheat) step conveys card elevation at rest; shadows appear only at 4dp+ for sheets or pressed states.

### Shadow Vocabulary
- **Card** (`shadowColor #000, offset 0/2, opacity 0.04, radius 8, elevation 2`): Default card lift — household card, transaction rows, account cards.
- **Elevated** (`shadowColor #000, offset 0/4, opacity 0.08, radius 16, elevation 4`): Sheets, modals, FAB, active filter sheets.
- **Gradient Card** (`LinearGradient #FFFBF5 → #FEF3C7`): Hero household/balance card — tonal depth without shadow reliance.

### Named Rules
**The Tonal Before Shadow Rule.** Try the paper→surface tonal step before adding a shadow. Shadows are the second voice, not the first.

## Shapes

Gently rounded, never pill-tight. Corners are 12px (sm) for chips and inner elements, 16px (md) for buttons, inputs, and cards, and 24px (lg) for hero/gradient cards and sheets. Borders are hairline 1px stone (#E7E5E4 / #44403C) only where tonal contrast alone is ambiguous — e.g., secondary buttons, selected filter chips. No large geometric clipping; no squared brutalism.

Buttons are h-12 (48px) with md radius. Inputs match the same radius and border language. Category/account icon containers are 24×24 with palette.true color, nested in rounded surface tiles.

## Components

### Buttons
- **Shape:** 16px radius (md), 48px height, full-width by default, centered label.
- **Primary:** Toasted amber solid (primary / primary-dark), paper text, `Shadow.card`, opacity 0.92 on press. `ActivityIndicator` replaces label when loading.
- **Hover / Focus:** Opacity shift only (no color shift) — pressed 0.92, disabled 0.5. No scale. `variantStyles` maps four variants.
- **Secondary:** Paper surface with stone border, ink text, same radius/shadow.
- **Ghost:** Transparent, amber text, no border/shadow.
- **Danger:** Transparent with ledger-red border and text.

### Chips
- **Style:** Rounded-full or 12px sm, surface or paper background, stone border when unselected, amber solid when selected.
- **State:** Selected = amber bg + paper text; unselected = paper bg + ink text + stone border.

### Cards / Containers
- **Corner Style:** 16px md (24px lg for hero gradient).
- **Background:** Wheat surface (#FEF3C7) or paper with gradient hero (`Gradients.card`); dark maps to #292524 / #3A3224.
- **Shadow Strategy:** `Shadow.card` at rest, `Shadow.elevated` when sheet/modal.
- **Border:** None at rest; 1px stone only when secondary distinction needed.
- **Internal Padding:** 16px; hero 20–24px; gap-2/ gap-3 between child rows.

### Inputs / Fields
- **Style:** 16px radius, paper background, 1px stone border, 48px min height, label 14px semibold above field.
- **Focus:** Border shifts to primary amber; no glow — clean stroke change.
- **Error:** Ledger-red border + caption text.
- **Amount variant:** `Input amount` prop — thousand-separator formatting, `number-pad`, amber warning on decimal truncation.

### Navigation
- **Tabs:** Expo Router bottom tabs, stone ink inactive, amber active, 48px hit area, Feather icons, labels 12px medium.
- **Top bar:** Screen title heading (18px semibold), back affordance honors system Back gesture.
- **Sheets/Modals:** Elevated shadow, 24px top radius, drag handle, tonal surface.

### Gradient Hero Card (Signature)
Household/Balance hero: `expo-linear-gradient` using `Gradients.card` (light #FFFBF5→#FEF3C7, dark #292524→#3A3224) via `cssInterop(LinearGradient, { className: "style" })` + `dark:` variants. Rounded lg, Shadow.card, internal 20px padding, display + body type stack.

## Do's and Don'ts

### Do:
- **Do** keep amber ≤15% of the viewport — one primary CTA, one progress, selected state only.
- **Do** use `useThemeColors()` / `useThemeGradients()` and `dark:` class variants for every color decision — never raw `Colors` hex at call sites.
- **Do** use NativeWind `className` and 48px min targets on every interactive element.
- **Do** apply `Gradient.card` only to the household/balance hero; other cards stay flat surface.
- **Do** format amounts with thousand separators only, no currency symbol, via `Input amount`.
- **Do** honor safe-area and IME insets edge-to-edge.

### Don't:
- **Don't** introduce cold corporate blues — the palette is stone/amber only; blue is reserved solely for the e-wallet functional account.
- **Don't** use `style={({ pressed }) => ...}` callback on Pressable — it breaks NativeWind v4 rendering; use `useState` + static style.
- **Don't** use `StyleSheet.create` — use NativeWind `className`.
- **Don't** hardcode hex colors outside `constants/theme.ts`; all color truth lives there and in `tailwind.config.js`.
- **Don't** future-date transactions or show currency symbols — amounts are signed whole numbers, dates capped at today.
- **Don't** leak hidden account/category detail to Members — follow the PRD visibility matrix.
