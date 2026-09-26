# Sisa Amount Live di Form Transaksi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tampilkan proyeksi live sisa balance account dan sisa budget di form transaksi.

**Architecture:** Fungsi murni di `utils/remaining.ts` menghitung proyeksi (saldo/budget − amount, dengan koreksi delta edit-mode); `app/transaction-form.tsx` menambah satu subscription `budgets.list` berperiode tanggal transaksi (expense only) dan mengumpan string sisa ke `AccountPill`, `TransferDual`, `CategoryGrid`, dan baris sheet account. Tanpa perubahan backend.

**Tech Stack:** Expo SDK 54, React Native, Convex (`useQuery`), NativeWind 4 (`className`), vitest (`npm test`).

## Global Constraints

- Styling: NativeWind `className`, never `style` callback functions on `Pressable` (NativeWind v4 gotcha, GitHub #847).
- Runtime colors via `useThemeColors()`; never hardcode colors; never `Colors` directly.
- Amounts display via `formatNumber` from `@/utils/format`.
- Path alias `@/*` maps to repo root.
- Verify with `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest).
- No new dependencies; no `convex/*.ts` changes (no codegen needed).
- Warning-only UI: never change `canSubmit`, validation, duplicate-check, or submit flow.

---

### Task 1: Pure projection helpers + unit tests (TDD)

**Files:**
- Create: `utils/remaining.ts`
- Create: `tests/remaining.test.ts`

**Interfaces:**
- Consumes: `TransactionType` (type-only) from `@/constants/transactions` (`"income" | "expense" | "transfer"`).
- Produces: `AccountSide`, `ProjectAccountInput`, `projectAccountBalance`, `ProjectBudgetInput`, `projectBudgetRemaining` — exact signatures below. Tasks 3–4 import these names verbatim.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { projectAccountBalance, projectBudgetRemaining } from "../utils/remaining";

describe("projectAccountBalance", () => {
  it("projects expense as balance minus amount", () => {
    expect(
      projectAccountBalance({ balance: 12000, type: "expense", side: "single", amount: 3000 }),
    ).toBe(9000);
  });
  it("projects income as balance plus amount", () => {
    expect(
      projectAccountBalance({ balance: 12000, type: "income", side: "single", amount: 3000 }),
    ).toBe(15000);
  });
  it("projects transfer from-minus and to-plus", () => {
    expect(
      projectAccountBalance({ balance: 12000, type: "transfer", side: "from", amount: 3000 }),
    ).toBe(9000);
    expect(
      projectAccountBalance({ balance: 5000, type: "transfer", side: "to", amount: 3000 }),
    ).toBe(8000);
  });
  it("returns raw balance when amount is null, zero, or non-finite", () => {
    expect(
      projectAccountBalance({ balance: 12000, type: "expense", side: "single", amount: null }),
    ).toBe(12000);
    expect(
      projectAccountBalance({ balance: 12000, type: "expense", side: "single", amount: 0 }),
    ).toBe(12000);
    expect(
      projectAccountBalance({ balance: 12000, type: "expense", side: "single", amount: NaN }),
    ).toBe(12000);
  });
  it("corrects for the old transaction when editing the same account", () => {
    expect(
      projectAccountBalance({
        balance: 9000,
        type: "expense",
        side: "single",
        amount: 15000,
        oldAbsAmount: 10000,
        isSameAccount: true,
      }),
    ).toBe(4000);
  });
  it("ignores old amount when the account changed", () => {
    expect(
      projectAccountBalance({
        balance: 20000,
        type: "expense",
        side: "single",
        amount: 15000,
        oldAbsAmount: 10000,
        isSameAccount: false,
      }),
    ).toBe(5000);
  });
});

describe("projectBudgetRemaining", () => {
  it("projects remaining as budget minus spent minus amount", () => {
    expect(
      projectBudgetRemaining({ budgetAmount: 50000, spent: 45000, amount: 3000 }),
    ).toBe(2000);
  });
  it("returns current remaining when amount is null", () => {
    expect(
      projectBudgetRemaining({ budgetAmount: 50000, spent: 45000, amount: null }),
    ).toBe(5000);
  });
  it("adds back the old amount when editing the same category", () => {
    expect(
      projectBudgetRemaining({
        budgetAmount: 50000,
        spent: 45000,
        amount: 8000,
        oldAbsAmount: 5000,
        isSameCategory: true,
      }),
    ).toBe(2000);
  });
  it("keeps over-budget projections negative", () => {
    expect(
      projectBudgetRemaining({ budgetAmount: 50000, spent: 48000, amount: 5000 }),
    ).toBe(-3000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/remaining.test.ts`
Expected: FAIL with "Failed to resolve import ../utils/remaining"

- [ ] **Step 3: Write minimal implementation**

```ts
import type { TransactionType } from "@/constants/transactions";

export type AccountSide = "single" | "from" | "to";

export interface ProjectAccountInput {
  balance: number;
  type: TransactionType;
  side: AccountSide;
  /** Absolute typed amount; null/zero/non-finite means "no projection, show raw balance". */
  amount: number | null;
  /** Absolute old amount (|editingTx.amount|); only used when isSameAccount is true. */
  oldAbsAmount?: number;
  /** Selected account is the old transaction's account for this side. */
  isSameAccount?: boolean;
}

function sideSign(type: TransactionType, side: AccountSide): number {
  if (type === "expense") return -1;
  if (type === "income") return 1;
  return side === "from" ? -1 : 1;
}

export function projectAccountBalance(input: ProjectAccountInput): number {
  const { balance, type, side, amount } = input;
  if (amount === null || !Number.isFinite(amount) || amount <= 0) return balance;
  const sign = sideSign(type, side);
  if (input.isSameAccount === true && input.oldAbsAmount !== undefined) {
    return balance + sign * (amount - input.oldAbsAmount);
  }
  return balance + sign * amount;
}

export interface ProjectBudgetInput {
  budgetAmount: number;
  spent: number;
  /** Absolute typed amount; null/zero/non-finite means "show current remaining". */
  amount: number | null;
  /** Absolute old amount (|editingTx.amount|); only used when isSameCategory is true. */
  oldAbsAmount?: number;
  /** Selected category is the old transaction's expense category. */
  isSameCategory?: boolean;
}

export function projectBudgetRemaining(input: ProjectBudgetInput): number {
  const { budgetAmount, spent, amount } = input;
  const effectiveSpent =
    input.isSameCategory === true && input.oldAbsAmount !== undefined
      ? spent - input.oldAbsAmount
      : spent;
  const current = budgetAmount - effectiveSpent;
  if (amount === null || !Number.isFinite(amount) || amount <= 0) return current;
  return current - amount;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/remaining.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add utils/remaining.ts tests/remaining.test.ts
git commit -m "feat: add pure projection helpers for account and budget remaining"
```

---

### Task 2: `subLabel` support in `AccountPill` + `TransferDual` passthrough

**Files:**
- Modify: `components/transaction/AccountPill.tsx`
- Modify: `components/transaction/TransferDual.tsx`

**Interfaces:**
- Consumes: nothing new (existing `Shadow`, `useThemeColors`, `AccountIcon`).
- Produces: `AccountPill` props `{ label: string; account: AccountRef; onPress: () => void; subLabel?: string | null; subLabelDanger?: boolean }`; `TransferDual` props add `{ fromSubLabel?: string | null; fromSubLabelDanger?: boolean; toSubLabel?: string | null; toSubLabelDanger?: boolean }`. Task 3 passes these verbatim.

- [ ] **Step 1: Extend `AccountPill` with second-line `subLabel`**

Replace the file content with:

```tsx
import { Pressable, Text, View } from "react-native";
import { AccountIcon } from "@/components/AccountIcon";
import { Shadow, useThemeColors } from "@/constants/theme";

type AccountRef = {
  name: string;
  type: string;
  subType: string;
} | null;

type Props = {
  label: string;
  account: AccountRef;
  onPress: () => void;
  subLabel?: string | null;
  subLabelDanger?: boolean;
};

export function AccountPill({ label, account, onPress, subLabel, subLabelDanger }: Props) {
  const C = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        Shadow.card,
        {
          flex: 1,
          minWidth: 0,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: C.border,
          backgroundColor: C.background,
          paddingHorizontal: 16,
          paddingVertical: 8,
          flexDirection: "row",
          gap: 8,
          alignItems: "center",
        },
      ]}
    >
      <AccountIcon subType={account?.subType ?? "other"} size={20} />
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text
          numberOfLines={1}
          className="text-sm font-medium"
          style={{ color: C.textPrimary }}
        >
          {account?.name ?? label}
        </Text>
        {subLabel ? (
          <Text
            numberOfLines={1}
            className="text-xs tabular-nums"
            style={{ color: subLabelDanger ? C.error : C.textSecondary }}
          >
            {subLabel}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 2: Pass sub-labels through `TransferDual`**

Replace the file content with:

```tsx
import { Pressable, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useThemeColors } from "@/constants/theme";
import { AccountPill } from "./AccountPill";

type Props = {
  fromAcc: { name: string; type: string; subType: string } | null;
  toAcc: { name: string; type: string; subType: string } | null;
  onSelectFrom: () => void;
  onSelectTo: () => void;
  onSwap: () => void;
  fromSubLabel?: string | null;
  fromSubLabelDanger?: boolean;
  toSubLabel?: string | null;
  toSubLabelDanger?: boolean;
};

export function TransferDual({
  fromAcc,
  toAcc,
  onSelectFrom,
  onSelectTo,
  onSwap,
  fromSubLabel,
  fromSubLabelDanger,
  toSubLabel,
  toSubLabelDanger,
}: Props) {
  const C = useThemeColors();
  return (
    <View className="flex-row items-center justify-between gap-3 px-4 py-3">
      <AccountPill
        label="Payment account"
        account={fromAcc}
        onPress={onSelectFrom}
        subLabel={fromSubLabel}
        subLabelDanger={fromSubLabelDanger}
      />
      <Pressable
        onPress={onSwap}
        accessibilityRole="button"
        accessibilityLabel="Swap payment and receive accounts"
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          backgroundColor: C.surface,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: C.border,
        }}
      >
        <Feather name="repeat" size={18} color={C.primary} />
      </Pressable>
      <AccountPill
        label="Receive account"
        account={toAcc}
        onPress={onSelectTo}
        subLabel={toSubLabel}
        subLabelDanger={toSubLabelDanger}
      />
    </View>
  );
}
```

- [ ] **Step 3: Typecheck the two components**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors; existing callers omit the optional props)

- [ ] **Step 4: Commit**

```bash
git add components/transaction/AccountPill.tsx components/transaction/TransferDual.tsx
git commit -m "feat: add subLabel projection line to AccountPill and TransferDual"
```

---

### Task 3: Account projections in `transaction-form.tsx` (sheet rows + pills)

**Files:**
- Modify: `app/transaction-form.tsx`

**Interfaces:**
- Consumes: `projectAccountBalance` from `@/utils/remaining` (Task 1); `formatNumber` from `@/utils/format` (existing import); `subLabel` props from Task 2.
- Produces: account `subLabel` strings and sheet-row captions consumed by no later task (Task 4 adds budget parts independently).

Conventions used below (must match existing file):
- `amountValue` is the existing keypad-derived absolute number or `null` (`transaction-form.tsx:327-334`).
- `editingTx` is the existing `isEdit ? getResult?.transaction : undefined` memo.
- `hasAmount = amountValue !== null && Number.isFinite(amountValue) && amountValue > 0`.
- Same-account comparisons: single mode `accountId === editingTx?.accountId`; transfer from `accountId === editingTx?.accountId`, to `toAccountId === editingTx?.toAccountId`; only when `isEdit && editingTx?.type === type`. Old absolute: `Math.abs(editingTx.amount)`.
- Archived sheet rows show no caption.

- [ ] **Step 1: Add helpers and pill sub-labels for single (income/expense) mode**

Add to the imports:

```tsx
import { projectAccountBalance } from "@/utils/remaining";
```

After the existing `toAcc` memo (~line 741), add:

```tsx
const hasAmount =
  amountValue !== null && Number.isFinite(amountValue) && amountValue > 0;
const oldAbsAmount = editingTx ? Math.abs(editingTx.amount) : undefined;
const isSameType = isEdit && editingTx !== undefined && editingTx.type === type;

const singleProjected =
  selectedAccount !== null
    ? projectAccountBalance({
        balance: selectedAccount.balance,
        type,
        side: "single",
        amount: amountValue,
        oldAbsAmount,
        isSameAccount: isSameType && accountId === editingTx?.accountId,
      })
    : null;
const singleSubLabel =
  selectedAccount !== null
    ? hasAmount
      ? `${formatNumber(selectedAccount.balance)} → ${formatNumber(singleProjected ?? selectedAccount.balance)}`
      : formatNumber(selectedAccount.balance)
    : null;
```

Pass `subLabel={singleSubLabel}` and `subLabelDanger={(singleProjected ?? 0) < 0}` to the existing single-mode `AccountPill` (~line 896).

- [ ] **Step 2: Add transfer From/To projections and pass to `TransferDual`**

After the Step 1 block, add:

```tsx
const fromProjected =
  selectedAccount !== null && type === "transfer"
    ? projectAccountBalance({
        balance: selectedAccount.balance,
        type,
        side: "from",
        amount: amountValue,
        oldAbsAmount,
        isSameAccount: isSameType && accountId === editingTx?.accountId,
      })
    : null;
const toProjected =
  toAcc !== null && type === "transfer"
    ? projectAccountBalance({
        balance: toAcc.balance,
        type,
        side: "to",
        amount: amountValue,
        oldAbsAmount,
        isSameAccount: isSameType && toAccountId === editingTx?.toAccountId,
      })
    : null;
const formatProjection = (balance: number, projected: number | null) =>
  hasAmount && projected !== null
    ? `${formatNumber(balance)} → ${formatNumber(projected)}`
    : formatNumber(balance);
```

Pass to the existing `TransferDual` (~line 869):

```tsx
fromSubLabel={selectedAccount ? formatProjection(selectedAccount.balance, fromProjected) : null}
fromSubLabelDanger={(fromProjected ?? 0) < 0}
toSubLabel={toAcc ? formatProjection(toAcc.balance, toProjected) : null}
toSubLabelDanger={(toProjected ?? 0) < 0}
```

- [ ] **Step 3: Show balance caption in account sheet rows**

In the sheet `FlatList` `renderItem` (~line 1099), the row already resolves `acc` (active or archived, or `null`). Inside the row's `Pressable`, after the name `Text` and before the archived badge, insert:

```tsx
{item.archived || acc === null ? null : (
  <Text
    numberOfLines={1}
    className="text-xs tabular-nums"
    style={{
      color:
        hasAmount &&
        projectAccountBalance({
          balance: acc.balance,
          type,
          side: accountSheetTarget === "to" ? "to" : accountSheetTarget === "from" ? "from" : "single",
          amount: amountValue,
          oldAbsAmount,
          isSameAccount:
            isSameType &&
            (accountSheetTarget === "to"
              ? item.id === editingTx?.toAccountId
              : item.id === editingTx?.accountId),
        }) < 0
          ? C.error
          : C.textSecondary,
    }}
  >
    {(() => {
      const projected = projectAccountBalance({
        balance: acc.balance,
        type,
        side: accountSheetTarget === "to" ? "to" : accountSheetTarget === "from" ? "from" : "single",
        amount: amountValue,
        oldAbsAmount,
        isSameAccount:
          isSameType &&
          (accountSheetTarget === "to"
            ? item.id === editingTx?.toAccountId
            : item.id === editingTx?.accountId),
      });
      return hasAmount
        ? `${formatNumber(acc.balance)} → ${formatNumber(projected)}`
        : formatNumber(acc.balance);
    })()}
  </Text>
)}
```

Note: `side` for sheet rows follows `accountSheetTarget` (`"single" | "from" | "to"` maps directly to `AccountSide`).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/transaction-form.tsx
git commit -m "feat: show live account balance projections in transaction form"
```

---

### Task 4: Budget query + category captions + selected summary

**Files:**
- Modify: `app/transaction-form.tsx` (same file as Task 3 — implement after Task 3 is committed)
- Modify: `components/transaction/CategoryGrid.tsx`

**Interfaces:**
- Consumes: `projectBudgetRemaining` from `@/utils/remaining` (Task 1); `getPeriodBounds` from `@/utils/period` (same import used by `app/(tabs)/budgets.tsx:25`); `api.budgets.list` args `{ periodStart: number; periodEnd: number }`.
- Produces: nothing downstream (terminal UI task).

- [ ] **Step 1: Add `remainingText` caption to `CategoryGrid` tiles**

Extend the option type and render a caption under the label:

```tsx
type CategoryOption = {
  id: string;
  label: string;
  icon?: string;
  remainingText?: string | null;
  remainingDanger?: boolean;
};
```

In `renderItem`, after the label `Text` (`{item.option.label}`), insert:

```tsx
{item.kind === "category" && item.option.remainingText ? (
  <Text
    numberOfLines={1}
    ellipsizeMode="tail"
    className="text-center text-[11px] tabular-nums"
    style={{ color: item.option.remainingDanger ? C.error : C.textSecondary }}
  >
    {item.option.remainingText}
  </Text>
) : null}
```

- [ ] **Step 2: Subscribe to budgets for the transaction date period (expense only)**

Add to the imports of `app/transaction-form.tsx`:

```tsx
import { getPeriodBounds } from "@/utils/period";
import { projectBudgetRemaining } from "@/utils/remaining";
```

(`projectAccountBalance` was already imported in Task 3; extend that import line instead of duplicating.)

Next to the existing queries (~line 69), add:

```tsx
const budgetPeriod = useMemo(
  () => getPeriodBounds(date.getTime(), tz, "monthly"),
  [date, tz],
);
const budgetResult = useQuery(
  api.budgets.list,
  type === "expense"
    ? { periodStart: budgetPeriod.start, periodEnd: budgetPeriod.end }
    : "skip",
);
const remainingByCategory = useMemo(() => {
  const map = new Map<string, { amount: number; spent: number | undefined }>();
  for (const b of budgetResult?.budgets ?? []) {
    map.set(b.categoryId, { amount: b.amount, spent: b.spent });
  }
  return map;
}, [budgetResult]);
```

`budgetResult?.budgets` is `null` when not a member — `?? []` covers it, so no captions render.

- [ ] **Step 3: Feed per-tile captions into `categoryOptions`**

In the existing `categoryOptions` memo (~line 221), extend each option with:

```tsx
const info = remainingByCategory.get(c._id);
const projected =
  info !== undefined && info.spent !== undefined
    ? projectBudgetRemaining({
        budgetAmount: info.amount,
        spent: info.spent,
        amount: amountValue,
        oldAbsAmount,
        isSameCategory: isSameType && c._id === editingTx?.categoryId && editingTx?.type === "expense",
      })
    : null;
```

where `oldAbsAmount` and `isSameType` are the Task 3 helpers. Each option becomes:

```tsx
{
  id: c._id,
  label: c.name,
  icon: c.icon,
  archived: false,
  remainingText:
    info !== undefined && info.spent !== undefined && projected !== null
      ? hasAmount
        ? `sisa ${formatNumber(projected)}`
        : `sisa ${formatNumber(info.amount - info.spent)}`
      : null,
  remainingDanger: projected !== null && projected < 0,
}
```

Archived legacy options pushed by `addIfMissing` get `remainingText: null`. Add `remainingByCategory`, `amountValue`, `hasAmount`, `oldAbsAmount`, `isSameType`, `editingTx` to that memo's dependency array.

- [ ] **Step 4: Render the selected-category summary bar below the grid**

After the `CategoryGrid` element (~line 866) and before the `categoryError` text, insert:

```tsx
{type === "expense" && categoryId !== null
  ? (() => {
      const info = remainingByCategory.get(categoryId);
      if (info === undefined || info.spent === undefined) return null;
      const projected = projectBudgetRemaining({
        budgetAmount: info.amount,
        spent: info.spent,
        amount: amountValue,
        oldAbsAmount,
        isSameCategory:
          isSameType && categoryId === editingTx?.categoryId && editingTx?.type === "expense",
      });
      return (
        <Text className="px-4 pt-1 text-xs tabular-nums text-text-secondary dark:text-text-secondary-dark">
          Budget {formatNumber(info.amount)} • Terpakai {formatNumber(info.spent)} • Sisa{" "}
          <Text style={{ color: projected < 0 ? C.error : C.textPrimary }}>
            {formatNumber(info.amount - (isSameType && categoryId === editingTx?.categoryId && editingTx?.type === "expense" && oldAbsAmount !== undefined ? info.spent - oldAbsAmount : info.spent))}
            {hasAmount ? ` → ${formatNumber(projected)}` : ""}
          </Text>
        </Text>
      );
    })()
  : null}
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npm run lint`
Expected: PASS (no new warnings)

- [ ] **Step 6: Commit**

```bash
git add app/transaction-form.tsx components/transaction/CategoryGrid.tsx
git commit -m "feat: show live budget remaining in transaction category picker"
```

---

### Task 5: Full verification + manual checklist

**Files:** none (verification only).

- [ ] **Step 1: Run the full check suite**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npm run lint`
Expected: PASS

Run: `npm test`
Expected: PASS (all suites, including `tests/remaining.test.ts`)

- [ ] **Step 2: Manual verification via `expo start`**

1. Open the transaction form (FAB from Transactions tab), mode Expenses.
2. Type an amount on the keypad → open the account sheet → each active row shows `balance → projected`; the row that would go negative shows red.
3. Select an account → the pill shows the same projection as a second line.
4. Each category tile with a budget shows `sisa X`; tiles without budgets and redacted (member + hidden) tiles show no caption.
5. Select a budgeted category → summary bar `Budget • Terpakai • Sisa → proyeksi` appears below the grid; over-budget projection renders red.
6. Switch to Transfer → From pill shows `balance → minus`, To pill shows `balance → plus`.
7. Change the transaction date to another month → budget captions follow the new month's budgets.
8. Edit an existing transaction → projections account for the old amount (e.g. editing a 10.000 expense to 15.000 on a 9.000-balance account shows `9.000 → 4.000`).
9. Save still works; validation, duplicate-check, and discard guard unchanged.
