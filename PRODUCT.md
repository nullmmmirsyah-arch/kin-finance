# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Family members managing money together inside one shared Household, using Kin Finance on Android phones. The Owner (the user who creates the Household) controls Accounts, Categories, and member access; Members collaborate on Transactions and Budgets within visibility rules. MVP supports one Household per user.

## Product Purpose

Kin Finance is a shared household finance tracker. It lets a family record income and expenses, organize them by Accounts and Categories, and plan monthly Budgets — with clear owner/member permission boundaries so everyone contributes but the Owner keeps control. Success means the family can see, together, what is coming in and going out.

## Positioning

One shared Household as the root of all financial data, with role-based visibility as the organizing idea: an Owner runs Accounts, Categories, and membership, while Members participate in day-to-day Transactions and Budgets. The distinguishing behavior is that hiding an Account or Category from Members still surfaces the financial picture (e.g. Budgets for hidden Categories stay visible) without exposing transaction detail.

## Operating Context

- Android-first native app (Expo SDK 54, React Native 0.81, Expo Router 6), running in portrait on phones.
- Auth via Clerk (email/password, email-code verification, Google SSO); real-time data via Convex.
- English UI copy (screens, errors, and empty states are in English).
- All financial data is scoped to exactly one Household per user in MVP.

## Capabilities and Constraints

Implemented (backend + screens):
- Clerk auth: sign in, sign up, email verification, MFA email code, Google SSO.
- Household: create (first user becomes Owner), get active household, rename (Owner only), list members, remove member (Owner only; owner cannot be removed).

Designed in the PRDs but not yet built:
- Accounts, Categories, Transactions, Budgets, and invite-code member joining (`docs/Product Requirement Document/`).
- Planned data model for these features is in `docs/ARCHITECTURE.md`.

Constraints:
- One Household per user in MVP; no household switching or multiple households yet.
- Transaction dates cannot be in the future; amounts are signed (+income / −expense).
- Data can only be accessed by Household members.

## Brand Commitments

- Product name: **Kin Finance**.
- English UI copy.
- Warm, family-focused design language (see `docs/DESIGN.md` and `constants/theme.ts`): stone/amber palette, gradient cards, Feather icons, 48px controls.

## Evidence on Hand

- Approved PRDs: Household, MultiMember, Accounts, Categories, Transactions, Budgets (`docs/Product Requirement Document/`).
- Approved design system and screen descriptions (`docs/DESIGN.md`).
- Architecture and data model (`docs/ARCHITECTURE.md`).
- Convex schema (`convex/schema.ts`) — ground truth for what exists today.
- No real user testimonials, financial data, or production imagery; nothing to fabricate.

## Product Principles

1. Every fact belongs to a Household; nothing financial lives outside one.
2. Roles are enforced at the data layer, and the UI reflects them (Owner controls, Member collaborates).
3. Financial truth stays legible: sign, date, and visibility rules are consistent everywhere.
4. One primary action per screen; create/edit flows stay small and focused.
5. Real-time, optimistic-feeling interactions over ceremony: no technical errors shown, plain-language messages instead.

## Accessibility & Inclusion

- Minimum 48×48dp touch targets and Material 3 interaction patterns per the Android platform reference.
- Follows the system font-size setting and dark theme expectations (design system currently light-only; dark theme is future work).
