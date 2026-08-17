# Day Net Totals per Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a net total per day group on the Transactions page and make Home's Recent Transactions day total exclude transfers.

**Architecture:** A single shared pure helper `sumNetExcludingTransfers` in `utils/format.ts` computes income − expense (transfers excluded). Both the Transactions page section header and the Home dashboard day-group header render the result with sign-colored styling (green +, red −, neutral 0).

**Tech Stack:** TypeScript 5.9, React Native / Expo (NativeWind 4), no test framework.

## Global Constraints

- **Verification:** run `npx tsc --noEmit` and `npm run lint` (there is NO test framework in this repo).
- Path alias `@/*` → repo root. Use it for imports.
- Styling: NativeWind `className`, not `StyleSheet.create`; theme via `useThemeColors()` hook, never hardcoded colors.
- NativeWind v4 gotcha: never use `style={({ pressed }) => [...]}` on `Pressable`.
- Money display uses `formatNumber` from `@/utils/format`; positive values get a `+` prefix only when explicitly shown as signed.
- UI copy is English. Keep the day total label implied (amount only, like Home).

---

### Task 1: Add shared `sumNetExcludingTransfers` helper

**Files:**
- Modify: `utils/format.ts`

**Interfaces:**
- Produces: `sumNetExcludingTransfers(txs: { type: string; amount: number }[]): number`

- [ ] **Step 1: Add the helper to `utils/format.ts`**

Append to `utils/format.ts`:

```ts
export function sumNetExcludingTransfers(
  txs: { type: string; amount: number }[],
): number {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (tx.type === "income") income += tx.amount;
    else if (tx.type === "expense") expense += Math.abs(tx.amount);
  }
  return income - expense;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add utils/format.ts
git commit -m "feat: add sumNetExcludingTransfers helper"
```

---

### Task 2: Transactions page — day net total in section header

**Files:**
- Modify: `app/(tabs)/transactions.tsx`

**Interfaces:**
- Consumes: `sumNetExcludingTransfers` from `@/utils/format` (Task 1)
- Produces: each `sections` entry gains `total: number`; section header renders it

- [ ] **Step 1: Import the helper**

In `app/(tabs)/transactions.tsx`, extend the existing `@/utils/format` import (line 19):

```ts
import { formatNumber, sumNetExcludingTransfers } from "@/utils/format";
```

- [ ] **Step 2: Add `total` per section**

In the `sections` useMemo (lines 72-89), change the map to include the total:

```ts
    return Array.from(groups.entries()).map(([title, data]) => ({
      title,
      data,
      total: sumNetExcludingTransfers(data),
    }));
```

- [ ] **Step 3: Render the total in the section header**

Replace `renderSectionHeader` (lines 229-235):

```tsx
          renderSectionHeader={({ section }) => (
            <View className="flex-row items-center justify-between bg-background px-5 pb-1 pt-4 dark:bg-background-dark">
              <Text className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                {section.title}
              </Text>
              <Text
                className="text-sm font-semibold"
                style={{
                  color:
                    section.total > 0
                      ? C.success
                      : section.total < 0
                        ? C.error
                        : C.textSecondary,
                }}
              >
                {section.total > 0 ? "+" : ""}
                {formatNumber(section.total)}
              </Text>
            </View>
          )}
```

`C` (from `useThemeColors()`, line 38) is already in scope. `section.total` is inferred from the `sections` array produced in Step 2.

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/transactions.tsx
git commit -m "feat: show net total per day on Transactions page"
```

---

### Task 3: Home dashboard — exclude transfers from day total

**Files:**
- Modify: `app/(tabs)/home.tsx`

**Interfaces:**
- Consumes: `sumNetExcludingTransfers` from `@/utils/format` (Task 1)

- [ ] **Step 1: Import the helper**

In `app/(tabs)/home.tsx`, extend the existing `@/utils/format` import (line 25):

```ts
import { formatNumber, sumNetExcludingTransfers } from "@/utils/format";
```

- [ ] **Step 2: Replace the day total computation**

In `recentGroups` (line 160), replace:

```ts
      total: data.reduce((sum, tx) => sum + tx.amount, 0),
```

with:

```ts
      total: sumNetExcludingTransfers(data),
```

Rendering logic (lines 552-562) is unchanged — it already handles `+`/`-` prefixes and sign colors.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/home.tsx
git commit -m "fix: exclude transfers from Home day net totals"
```

---

### Task 4: Update PRD documentation

**Files:**
- Modify: `docs/Product Requirement Document/PRD.md`

- [ ] **Step 1: Update §3.6 Transactions**

In §3.6 (around line 252), add a bullet after the "Form UX" bullet:

```text
- **Day-grouped net totals:** the Transactions list shows a net total per day
  header (income − expense; transfers excluded because they move money between
  owned accounts and do not change household net worth), colored by sign.
```

- [ ] **Step 2: Update §3.8 Home Dashboard**

In §3.8, the "Recent Transactions" bullet (line 288) currently reads "grouped by
day with day net total". Append the transfer-exclusion note:

```text
- **Recent Transactions**: latest 5 (paginated via cursor), grouped by day with
  day net total (income − expense; transfers excluded), "See All" link to the
  Transactions tab. Transaction icons map category names to relevant Feather
  icons (shopping-cart, coffee, car, home, briefcase, etc.) with semantic colors
  (green for income, red for expense).
```

- [ ] **Step 3: Update §5.2 responsibilities**

Update the `app/(tabs)/transactions.tsx` row (line 451) to mention day net
totals:

```text
| `app/(tabs)/transactions.tsx` | Transactions list (date filters, summary, day-grouped with net totals) |
```

- [ ] **Step 4: Update header "Last updated" date**

Change line 4 `> Last updated: 2026-08-16` → `> Last updated: 2026-08-17`.

- [ ] **Step 5: Add Change Log entry**

Insert a new row at the top of the table in §8 (above line 730):

```text
| 2026-08-17 | UX | Day net totals on the Transactions page: each day-group section header now shows the day's net (income − expense) in sign color (+ green / − red / 0 neutral), mirroring the Home dashboard pattern; the shared helper `sumNetExcludingTransfers` (`utils/format.ts`) computes it with transfers excluded, and Home's Recent Transactions day total was switched to the same helper so transfers no longer inflate the day's net. Updates §3.6, §3.8, §5.2 |
```

- [ ] **Step 6: Commit**

```bash
git add "docs/Product Requirement Document/PRD.md"
git commit -m "docs: PRD changelog + sections for day net totals"
```

---
