# Amount Input Formatting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic thousand-separator formatting to the opening balance field and establish a reusable `amount` mode on the shared `Input` component so all future money inputs format consistently.

**Architecture:** A pure formatter `formatAmountInput` in `utils/format.ts` is the single source of truth. The shared `components/Input.tsx` gains an `amount` boolean prop that intercepts `onChangeText` and applies the formatter. `app/account-form.tsx` opts the opening balance field into the standard. Docs (AGENTS.md, DESIGN.md, accounts design spec + plan snippets) document the convention.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript 5.9, NativeWind. No test framework exists in this repo — verification is `npx tsc --noEmit`, `npx eslint <files>`, and on-device testing.

## Global Constraints

- Money inputs use `<Input amount />` for thousand-separator formatting — the app-wide standard.
- No hardcoded colors; theme tokens from `constants/theme.ts` only.
- Never use `style` callback functions on `Pressable` (NativeWind v4 bug #847).
- Whole numbers only (no decimals) for amount input formatting; leading `-` allowed.
- Commit after every task.

---

### Task 1: Add `formatAmountInput` to utils/format.ts

**Files:**
- Modify: `utils/format.ts`

**Interfaces:**
- Produces: `formatAmountInput(value: string): string` — strips non-digit chars except a leading `-`, inserts `,` every 3 digits from the right. Empty digits → `""` (or `"-"` if negative).

- [ ] **Step 1: Add the formatter to the end of `utils/format.ts`**

```ts
const formatter = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return formatter.format(value);
}

export function formatAmountInput(value: string): string {
  const isNegative = value.startsWith("-");
  const digits = value.replace(/[^0-9]/g, "");
  if (digits === "") return isNegative ? "-" : "";
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return isNegative ? `-${formatted}` : formatted;
}
```

- [ ] **Step 2: Verify lint and types**

Run: `npx eslint utils/format.ts` then `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Sanity-check behavior** (mental or in a scratch file)
  - `formatAmountInput("1000")` → `"1,000"`
  - `formatAmountInput("1000000")` → `"1,000,000"`
  - `formatAmountInput("-500000")` → `"-500,000"`
  - `formatAmountInput("-")` → `"-"`
  - `formatAmountInput("12.5")` → `"125"` (decimal point stripped)

- [ ] **Step 4: Commit**

```bash
git add utils/format.ts
git commit -m "feat: add formatAmountInput utility for amount inputs"
```

---

### Task 2: Add `amount` prop to the shared Input component

**Files:**
- Modify: `components/Input.tsx`

**Interfaces:**
- Consumes: `formatAmountInput(value: string): string` from `utils/format.ts` (Task 1).
- Produces: `<Input amount />` — when `amount` is set, `onChangeText` receives the formatted text. `amount` defaults to `false`; all existing Input usages are unaffected.

- [ ] **Step 1: Replace `components/Input.tsx` with the amount-aware version**

```tsx
import { useCallback } from "react";
import { Colors, Radius } from "@/constants/theme";
import { Text, TextInput, TextInputProps, View } from "react-native";
import { formatAmountInput } from "@/utils/format";

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  amount?: boolean;
};

export function Input({
  label,
  error,
  style,
  amount = false,
  onChangeText,
  ...props
}: Props) {
  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText?.(amount ? formatAmountInput(text) : text);
    },
    [amount, onChangeText],
  );

  return (
    <View className="w-full gap-1.5">
      {label ? (
        <Text className="text-sm font-medium text-text-primary">{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={Colors.textSecondary}
        style={[
          {
            borderRadius: Radius.sm,
            borderWidth: 1,
            borderColor: error ? Colors.error : Colors.border,
            backgroundColor: Colors.background,
            height: 48,
            paddingHorizontal: 16,
          },
          style,
        ]}
        className="w-full text-base text-text-primary"
        onChangeText={handleChangeText}
        {...props}
      />
      {error ? (
        <Text className="text-sm text-error">{error}</Text>
      ) : null}
    </View>
  );
}
```

Note: `onChangeText` is destructured out so `{...props}` cannot override `handleChangeText`.

- [ ] **Step 2: Verify lint and types**

Run: `npx eslint components/Input.tsx` then `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/Input.tsx
git commit -m "feat: add amount mode to Input for thousand-separator formatting"
```

---

### Task 3: Apply `amount` to the opening balance field

**Files:**
- Modify: `app/account-form.tsx` (opening balance `Input` at ~line 179-187)

**Interfaces:**
- Consumes: `<Input amount />` from Task 2.
- Preserves: submit parsing already strips commas via `Number(openingBalance.replace(/,/g, ""))` — no submit-logic change.

- [ ] **Step 1: Add the `amount` prop to the opening balance Input**

```tsx
          {!isEdit ? (
            <Input
              label="Opening balance (optional)"
              placeholder="0"
              value={openingBalance}
              onChangeText={setOpeningBalance}
              keyboardType="numbers-and-punctuation"
              amount
            />
          ) : null}
```

- [ ] **Step 2: Verify lint and types**

Run: `npx eslint "app/(tabs)/home.tsx"` is not needed — run `npx eslint app/account-form.tsx` then `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: On-device test**

Run: `npx expo start --clear`, open Create Account, type `1000000` into Opening balance.
Expected: field shows `1,000,000` as you type; negative `-500000` shows `-500,000`; typing only `-` and submitting shows "Opening balance must be a valid number.".

- [ ] **Step 4: Commit**

```bash
git add app/account-form.tsx
git commit -m "feat: apply amount formatting to opening balance field"
```

---

### Task 4: Document the convention

**Files:**
- Modify: `AGENTS.md` (Styling Rules section)
- Modify: `docs/DESIGN.md:164`
- Modify: `docs/superpowers/specs/2026-08-08-accounts-design.md:246` and `:284`
- Modify: `docs/superpowers/plans/2026-08-08-accounts-implementation.md` (account-form snippet, ~line 1400)

- [ ] **Step 1: Add the convention to `AGENTS.md` styling rules**

Add after the NativeWind gotcha bullet:

```markdown
- Money/amount inputs: use the shared `Input` component with the `amount` prop (e.g. `<Input amount />`) for automatic thousand-separator formatting. Never format amount inputs ad hoc.
```

- [ ] **Step 2: Update `docs/DESIGN.md:164`**

Change:
```markdown
4. TextInput: placeholder "Opening balance (optional)" (number input, thousand separator, allows negative)
```
To:
```markdown
4. TextInput: placeholder "Opening balance (optional)" (whole-number input, thousand separators as you type, allows negative)
```

- [ ] **Step 3: Update `docs/superpowers/specs/2026-08-08-accounts-design.md`**

At line 246, change:
```markdown
- Input: Opening balance (optional), number, allows leading `-`
```
To:
```markdown
- Input: Opening balance (optional), whole number with thousand separators as you type, allows leading `-`
```

At line 284, change:
```markdown
| Opening balance | Optional number; `0` default; no sign requirement (treated as starting value) |
```
To:
```markdown
| Opening balance | Optional whole number; `0` default; thousand separators in the field; no sign requirement (treated as starting value) |
```

- [ ] **Step 4: Update the account-form snippet in `docs/superpowers/plans/2026-08-08-accounts-implementation.md`**

Find the opening balance `Input` snippet (~line 1402) and add the `amount` prop:

```tsx
              label="Opening balance (optional)"
              placeholder="0"
              value={openingBalance}
              onChangeText={setOpeningBalance}
              keyboardType="numbers-and-punctuation"
              amount
```

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md docs/DESIGN.md docs/superpowers/specs/2026-08-08-accounts-design.md docs/superpowers/plans/2026-08-08-accounts-implementation.md
git commit -m "docs: document amount input formatting standard"
```

---

## Self-Review

- **Spec coverage:** `formatAmountInput` (Task 1), `Input amount` prop (Task 2), opening balance wiring (Task 3), all four doc updates (Task 4) — every section of the spec is covered.
- **Placeholder scan:** All steps contain concrete code and commands. No TBD/TODO.
- **Type consistency:** `formatAmountInput(value: string): string` is defined once in Task 1 and consumed identically in Task 2. `amount?: boolean` prop matches usage `<Input amount />`.
