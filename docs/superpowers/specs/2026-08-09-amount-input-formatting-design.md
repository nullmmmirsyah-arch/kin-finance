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
| Decimal support | Whole numbers only; decimals shown as typed but rejected on submit | Chosen by user; opening balance is a whole amount. Decimals are surfaced (never silently converted — `12.5` stays `12.5`) and rejected by submit validation with a clear error |
| Negative support | Allowed (leading `-`), platform-specific keyboard | Matches DESIGN.md "allows negative" and signed balance model. iOS: `numbers-and-punctuation`; Android: signed `numeric` keyboard (`TYPE_NUMBER_FLAG_SIGNED` exposes `-`) |
| Formatting mechanism | Comma insertion on the digit string (regex) | No `Intl.NumberFormat` float precision loss; trivial; works for any magnitude |
| Standard entry point | `amount` boolean prop on the shared `Input` component | Single shared component; future money fields opt in with one prop, no layout duplication |

## Behavior

- As the user types, non-digit characters are stripped and commas are inserted every 3 digits from the right in the integer part.
- A leading `-` is preserved; a lone `-` shows while typing and is treated as an invalid amount on submit.
- Decimals are preserved as typed (never silently converted — `12.5` stays `12.5`), and submit validation rejects any value containing `.` with "Opening balance must be a whole number."
- Submitting strips commas before parsing (`Number(value.replace(/,/g, ""))`), so integer parsing and validation are unchanged.
- Keyboard: `keyboardType="numbers-and-punctuation"` (iOS-only) on iOS; the signed `numeric` keyboard on Android so the `-` key is available. On-device verification is required on both platforms.
- Examples: `1000` → `1,000`; `1000000` → `1,000,000`; `-500000` → `-500,000`; `12.5` → `12.5` (rejected on submit).

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

Add `amount?: boolean` to `Props`. When `amount` is true, intercept `onChangeText` and forward `formatAmountInput(text)` to the caller. `keyboardType` remains the caller's responsibility — use `Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"` so the `-` key is available on both platforms (`numbers-and-punctuation` is iOS-only and is ignored on Android).

### 3. `app/account-form.tsx` — apply the standard

Opening balance `Input` gets `amount` and the platform `keyboardType` above. Submit parsing strips commas; validation rejects any value containing `.` ("Opening balance must be a whole number.") before the `Number` parse.

### 4. Documentation

- `AGENTS.md` — add a convention rule: money inputs use `<Input amount />` for thousand-separator formatting.
- `docs/DESIGN.md` — clarify the opening-balance field spec (whole-number input, thousand separators as you type, allows negative).
- `docs/superpowers/specs/2026-08-08-accounts-design.md` — note the formatting behavior in the account-form spec.
- `docs/superpowers/plans/2026-08-08-accounts-implementation.md` — update the account-form snippet to use `amount`.

## Out of Scope

- Decimal amount *acceptance*: decimals are surfaced as typed but rejected on submit (whole numbers only). Future Transaction/Budget forms may add a decimal mode to `formatAmountInput` if decimals become supported.
- Currency symbols or locale-aware separators beyond `,`.
