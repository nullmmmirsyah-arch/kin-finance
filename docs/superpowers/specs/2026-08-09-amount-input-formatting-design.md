# Amount Input Formatting — Standard

> Date: 2026-08-09
> Status: Approved (design)

---

## Goal

Add automatic thousand-separator formatting to the opening balance field in the account form, and establish a **reusable app-wide standard** so every future money input (transaction amount, budget amount) gets the same formatting by convention.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Formatting timing | As you type (on every `onChangeText`) | Chosen by user; most responsive UX |
| Decimal support | Whole numbers only | Chosen by user; opening balance is a whole amount |
| Negative support | Allowed (leading `-`) | Matches DESIGN.md "allows negative" and signed balance model |
| Formatting mechanism | Comma insertion on the digit string (regex) | No `Intl.NumberFormat` float precision loss; trivial; works for any magnitude |
| Standard entry point | `amount` boolean prop on the shared `Input` component | Single shared component; future money fields opt in with one prop, no layout duplication |

## Behavior

- As the user types, non-digit characters are stripped and commas are inserted every 3 digits from the right.
- A leading `-` is preserved; a lone `-` shows while typing and is treated as an invalid amount on submit.
- Submitting strips commas before parsing (`Number(value.replace(/,/g, ""))`), so existing parsing and validation are unchanged.
- Examples: `1000` → `1,000`; `1000000` → `1,000,000`; `-500000` → `-500,000`.

## Changes

### 1. `utils/format.ts` — single source of truth

Add:

```ts
export function formatAmountInput(value: string): string {
  const isNegative = value.startsWith("-");
  const digits = value.replace(/[^0-9]/g, "");
  if (digits === "") return isNegative ? "-" : "";
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return isNegative ? `-${formatted}` : formatted;
}
```

### 2. `components/Input.tsx` — standard entry point

Add `amount?: boolean` to `Props`. When `amount` is true, intercept `onChangeText` and forward `formatAmountInput(text)` to the caller. `keyboardType` remains the caller's responsibility (e.g. `"numbers-and-punctuation"` for negative support).

### 3. `app/account-form.tsx` — apply the standard

Opening balance `Input` gets `amount` and keeps `keyboardType="numbers-and-punctuation"`. Submit parsing already strips commas — no change needed.

### 4. Documentation

- `AGENTS.md` — add a convention rule: money inputs use `<Input amount />` for thousand-separator formatting.
- `docs/DESIGN.md` — clarify the opening-balance field spec (whole-number input, thousand separators as you type, allows negative).
- `docs/superpowers/specs/2026-08-08-accounts-design.md` — note the formatting behavior in the account-form spec.
- `docs/superpowers/plans/2026-08-08-accounts-implementation.md` — update the account-form snippet to use `amount`.

## Out of Scope

- Decimal amount support (future Transaction/Budget forms may add a decimal mode to `formatAmountInput` if needed).
- Currency symbols or locale-aware separators beyond `,`.
