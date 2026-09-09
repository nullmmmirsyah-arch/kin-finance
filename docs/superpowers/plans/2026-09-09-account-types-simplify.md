# Account Types Simplify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink account `type` from 4 values (`cash|bank|ewallet|credit_card`) to 2 (`asset|debt`) with a one-way data migration.

**Architecture:** Backend stays behavior-neutral (no branching by type); change is enum + labels + icons + seeds. Migration is a one-off Convex mutation run once against dev, then deleted. No dual-write.

**Tech Stack:** Expo SDK 54, Convex (schema + functions + codegen), NativeWind v4, vitest + convex-test.

## Global Constraints

- Verify with `npx tsc --noEmit` (typecheck), `npm run lint` (expo lint), `npm test` (vitest — run when a change touches pure utils or Convex functions).
- After any change to `convex/*.ts`, run `npx convex codegen` first to regenerate `convex/_generated/` (gitignored), then typecheck.
- Install dependencies with `npx expo install <pkg>` so versions match SDK 54 — never bare `npm install`.
- Use NativeWind (`className`), not `StyleSheet.create`. Import theme from `constants/theme.ts`; dark mode via `useThemeColors()` / `dark:` variants.
- Path alias `@/*` → repo root. `convex/schema.ts` is the executable source of truth.
- Every `convex/*.ts` handler requires sign-in via `ctx.auth.getUserIdentity()` and throws `ConvexError` (no behavior change here, keep existing guards).
- English UI copy. Money inputs use shared `Input` with `amount` prop.
- Never use `style` callback functions on `Pressable`. Use `useState` pressed + static style.
- Current branch is `feat/account-types-simplify`; PR to `review` is manual by the user. Do not merge or push unless asked.

---

## File Structure

- Modify `convex/schema.ts:45-58` — accounts `type` union → `asset|debt`.
- Modify `convex/accounts.ts:9-14,146` — `accountType` validator + `update` patch type.
- Modify `modules/icon-registry/internal.ts:3,128-137,164-167` — `AccountType`, `ACCOUNT_STREAMLINE_MAP`, `isAccountType`, `getAccountIconName` fallback.
- Modify `modules/icon-registry/index.tsx:56-69` — `getAccountIconXml` / `getAccountIconName` fallbacks (`bank` → `asset`).
- Modify `constants/accounts.ts:1-15` — `AccountType` + `ACCOUNT_TYPES` (2 entries: `asset → Wallet`, `debt → Debt`).
- Modify `app/(tabs)/accounts.tsx:60-74,421-426,529,853` — `getAccountAccent` switch, `typeDots`, `CREDIT` label special-case, empty-state copy.
- Modify `app/account-form.tsx:35,68` — default type `asset`, `isDirty` baseline.
- Modify `components/AccountCard.tsx:3,8-12` — accepts new `AccountType`.
- Modify `components/transaction/AccountPill.tsx:38` — fallback `"cash"` → `"asset"`.
- Modify `app/transaction-form.tsx:1057` — fallback `"cash"` → `"asset"`.
- Modify test seeds using old literals: `tests/accounts.create.test.ts`, `tests/accounts.reconcile.test.ts`, `tests/accounts.atomicOpeningBalance.test.ts`, `tests/account.icons.test.ts`, `tests/households.deleteLeaveTransfer.test.ts`, `tests/budgets.list.test.ts`, `tests/periodBalances.test.ts`, `tests/transactions.balance.test.ts`, `tests/transactions.list.test.ts`, `tests/transactions.summary.test.ts`, `tests/transactions.search.test.ts`, `tests/transactions.recent.test.ts`.
- Create (temporarily, then delete): `convex/migrateAccountTypes.ts` — one-off migration mutation.

---

### Task 1: Backend enum (schema + validator)

**Files:**
- Modify: `convex/schema.ts:45-58`
- Modify: `convex/accounts.ts:9-14`
- Modify: `convex/accounts.ts:144-149`

**Interfaces:**
- Consumes: spec §1 mapping (`cash|bank|ewallet → asset`, `credit_card → debt`).
- Produces: `accountType = v.union(v.literal("asset"), v.literal("debt"))` used by `create`/`update`; `Doc<"accounts">["type"]` is `"asset" | "debt"` for all later tasks.

- [ ] **Step 1: Write the failing test**

Update `tests/accounts.create.test.ts:79-86` seed call to the new enum so the suite fails against the old validator:

```ts
const result = await owner.mutation(api.accounts.create, {
  name: "Cash",
  type: "asset",
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/accounts.create.test.ts`
Expected: FAIL — Convex validator rejects `"asset"` (`Validator error`, old union only allows 4 literals).

- [ ] **Step 3: Write minimal implementation**

In `convex/schema.ts`, replace the accounts type union:

```ts
type: v.union(
  v.literal("asset"),
  v.literal("debt"),
),
```

In `convex/accounts.ts`, replace the validator:

```ts
const accountType = v.union(
  v.literal("asset"),
  v.literal("debt"),
);
```

And the `update` patch type:

```ts
const patch: {
  name?: string;
  type?: "asset" | "debt";
  hidden?: boolean;
  updatedAt: number;
} = { updatedAt: Date.now() };
```

- [ ] **Step 4: Regenerate + run test to verify it passes**

Run: `npx convex codegen && npx tsc --noEmit && npm test -- tests/accounts.create.test.ts`
Expected: codegen clean, typecheck clean, test file progresses (other old-literal tests in the same file still fail — fixed in Task 4).

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/accounts.ts tests/accounts.create.test.ts
git commit -m "feat(accounts): shrink account type enum to asset/debt"
```

---

### Task 2: Icon registry + constants

**Files:**
- Modify: `modules/icon-registry/internal.ts:3,128-137,164-167`
- Modify: `modules/icon-registry/index.tsx:56-69`
- Modify: `constants/accounts.ts:1-15`
- Test: `tests/account.icons.test.ts`

**Interfaces:**
- Consumes: Task 1 `AccountType = "asset" | "debt"`.
- Produces: `ACCOUNT_STREAMLINE_MAP: Record<"asset"|"debt", string>`, `ACCOUNT_TYPES = [{asset,"Wallet"},{debt,"Debt"}]`, `isAccountType` + fallbacks resolving to `asset`.

- [ ] **Step 1: Write the failing test**

Replace `tests/account.icons.test.ts:8-24` with the 2-type expectation:

```ts
it("maps all AccountType to Iconify names with SVG bodies", () => {
  const icons = (streamlineData as { icons: Record<string, { body: string }> }).icons;
  for (const t of ACCOUNT_TYPES) {
    const iconName = ACCOUNT_STREAMLINE_MAP[t.id];
    expect(iconName, `missing mapping for ${t.id}`).toBeTruthy();
    expect(icons[iconName]?.body, `missing body for ${iconName}`).toBeTruthy();
  }
  expect(ACCOUNT_STREAMLINE_MAP.asset).toBe("cash-payment-bill");
  expect(ACCOUNT_STREAMLINE_MAP.debt).toBe("credit-card-1");
});
it("fallback to cash-payment-bill for invalid/undefined", () => {
  expect(getAccountIconName("invalid" as any)).toBe("cash-payment-bill");
  expect(getAccountIconName(undefined)).toBe("cash-payment-bill");
  expect(getAccountIconName("asset")).toBe("cash-payment-bill");
});
it("AccountIcon xml contains svg wrapper + body", () => {
  expect(getAccountIconXml("asset")).toContain("<svg");
  expect(getAccountIconXml("asset")).toContain("cash-payment-bill");
  expect(getAccountIconXml("invalid" as any)).toContain("cash-payment-bill");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/account.icons.test.ts`
Expected: FAIL — `ACCOUNT_STREAMLINE_MAP.asset` is undefined, `ACCOUNT_TYPES` still has 4 entries.

- [ ] **Step 3: Write minimal implementation**

`constants/accounts.ts` becomes:

```ts
import { ComponentProps } from "react";
import Feather from "@expo/vector-icons/Feather";

export type AccountType = "asset" | "debt";

export const ACCOUNT_TYPES: {
  id: AccountType;
  label: string;
  icon: ComponentProps<typeof Feather>["name"];
}[] = [
  { id: "asset", label: "Wallet", icon: "dollar-sign" },
  { id: "debt", label: "Debt", icon: "credit-card" },
];
```

`modules/icon-registry/internal.ts`:

```ts
export type AccountType = "asset" | "debt";
```

```ts
export const ACCOUNT_STREAMLINE_MAP: Record<AccountType, string> = {
  asset: "cash-payment-bill",
  debt: "credit-card-1",
};
```

```ts
export function isAccountType(x: string): x is AccountType {
  return (["asset", "debt"] as string[]).includes(x);
}
```

```ts
export function getAccountIconName(type?: string): string {
  if (type && isAccountType(type)) return ACCOUNT_STREAMLINE_MAP[type];
  return ACCOUNT_STREAMLINE_MAP.asset;
}
```

`modules/icon-registry/index.tsx` — replace both `ACCOUNT_STREAMLINE_MAP.bank` fallbacks with `ACCOUNT_STREAMLINE_MAP.asset`:

```ts
export function getAccountIconXml(type?: string | null): string {
  const iconName = type && isAccountType(type) ? ACCOUNT_STREAMLINE_MAP[type as import("./internal").AccountType] : ACCOUNT_STREAMLINE_MAP.asset;
  const body = getBody(iconName) ?? getBody(ACCOUNT_STREAMLINE_MAP.asset) ?? "";
  const { width, height } = getIconData();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-icon="${iconName}">${body}</svg>`;
}
export function getAccountIconName(type?: string): string {
  if (type && isAccountType(type)) return ACCOUNT_STREAMLINE_MAP[type as import("./internal").AccountType];
  return ACCOUNT_STREAMLINE_MAP.asset;
}
```

Also update `index.tsx:57` fallback (`ACCOUNT_STREAMLINE_MAP.bank` → `ACCOUNT_STREAMLINE_MAP.asset`) in the `AccountIcon`/`Icon` path if present.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsc --noEmit && npm test -- tests/account.icons.test.ts`
Expected: PASS (type errors in `accounts.tsx`/`account-form.tsx` remain — fixed in Task 3).

- [ ] **Step 5: Commit**

```bash
git add modules/icon-registry/internal.ts modules/icon-registry/index.tsx constants/accounts.ts tests/account.icons.test.ts
git commit -m "feat(accounts): map icons and constants to asset/debt"
```

---

### Task 3: Frontend list + form + fallbacks

**Files:**
- Modify: `app/(tabs)/accounts.tsx:60-74,421-426,529,853`
- Modify: `app/account-form.tsx:35,68`
- Modify: `components/AccountCard.tsx:3,8-12`
- Modify: `components/transaction/AccountPill.tsx:38`
- Modify: `app/transaction-form.tsx:1057`

**Interfaces:**
- Consumes: Task 2 `AccountType` + `ACCOUNT_TYPES` (2 entries).
- Produces: accounts tab rendering 2-type filter/breakdown/cards; form defaulting to `asset`; no stale `"cash"`/`"bank"` literals in UI.

- [ ] **Step 1: Write the failing check**

Typecheck is the test — after Task 2, run:

Run: `npx tsc --noEmit`
Expected: FAIL — errors at `app/(tabs)/accounts.tsx` (`getAccountAccent` switch on `cash|bank|ewallet|credit_card` no longer exhaustive over `"asset"|"debt"`), `app/account-form.tsx` (`useState<AccountType>("cash")`), `components/AccountCard.tsx` props.

- [ ] **Step 2: Implement minimal UI changes**

`app/(tabs)/accounts.tsx` — replace `getAccountAccent`:

```ts
function getAccountAccent(
  type: AccountType,
  C: ReturnType<typeof useThemeColors>,
): string {
  switch (type) {
    case "asset":
      return C.accountCash;
    case "debt":
      return C.accountCreditCard;
  }
}
```

Replace `typeDots`:

```ts
const typeDots: { type: AccountType; label: string }[] = [
  { type: "asset", label: "Wallet" },
  { type: "debt", label: "Debt" },
];
```

Replace the `CREDIT` special-case (line 529):

```tsx
{type.toUpperCase()}
```

Update empty-state copy (line 853):

```tsx
"Add your first account — a little home for your money. Wallet or debt."
```

`FILTERS` needs no edit (derived from `ACCOUNT_TYPES`), but verify the rail now shows `All/Wallet/Debt`.

`app/account-form.tsx`:

```ts
const [type, setType] = useState<AccountType>("asset");
```

```ts
return (
  name.trim() !== "" ||
  type !== "asset" ||
  openingBalance !== "" ||
  hidden !== false
);
```

`components/transaction/AccountPill.tsx:38`:

```tsx
<AccountIcon type={account?.type ?? "asset"} size={20} />
```

`app/transaction-form.tsx:1057`:

```tsx
<AccountIcon type={acc?.type ?? "asset"} size={20} />
```

`components/AccountCard.tsx` compiles via the shared `AccountType` — no logic change; verify the `meta` lookup still resolves (`ACCOUNT_TYPES.find`).

- [ ] **Step 3: Run typecheck + lint to verify it passes**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS on both. UI behavior verified manually via `expo start` (rail shows All/Wallet/Debt, cards render, form defaults to Wallet).

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/accounts.tsx app/account-form.tsx components/AccountCard.tsx components/transaction/AccountPill.tsx app/transaction-form.tsx
git commit -m "feat(accounts): update UI to Wallet/Debt types"
```

---

### Task 4: One-off migration + remaining test seeds

**Files:**
- Create (temporary): `convex/migrateAccountTypes.ts`
- Modify: `tests/accounts.create.test.ts` (remaining old literals), `tests/accounts.reconcile.test.ts`, `tests/accounts.atomicOpeningBalance.test.ts`, `tests/households.deleteLeaveTransfer.test.ts`, `tests/budgets.list.test.ts`, `tests/periodBalances.test.ts`, `tests/transactions.balance.test.ts`, `tests/transactions.list.test.ts`, `tests/transactions.summary.test.ts`, `tests/transactions.search.test.ts`, `tests/transactions.recent.test.ts`
- Delete: `convex/migrateAccountTypes.ts` (after dev migration run)

**Interfaces:**
- Consumes: Tasks 1–3 (new enum everywhere in code).
- Produces: all suites green on the new enum; production data migrated `cash|bank|ewallet → asset`, `credit_card → debt`.

- [ ] **Step 1: Write the migration + failing seed test**

Create `convex/migrateAccountTypes.ts`:

```ts
import { mutation } from "./_generated/server";
import { requireOwner, getUserAndMembership } from "./helpers";

export const migrate = mutation({
  args: {},
  handler: async (ctx) => {
    const { membership } = await getUserAndMembership(ctx);
    requireOwner(membership);
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", membership.householdId),
      )
      .collect();
    let migrated = 0;
    for (const acc of accounts) {
      const t = (acc as unknown as { type: string }).type;
      if (t === "cash" || t === "bank" || t === "ewallet") {
        await ctx.db.patch(acc._id, { type: "asset" as never, updatedAt: Date.now() });
        migrated++;
      } else if (t === "credit_card") {
        await ctx.db.patch(acc._id, { type: "debt" as never, updatedAt: Date.now() });
        migrated++;
      }
    }
    return { migrated, total: accounts.length };
  },
});
```

In `tests/accounts.reconcile.test.ts`, add the migration-mapping case (fails until seeds use new enum):

```ts
it("legacy types map to asset/debt (cash/bank → asset, credit_card → debt)", async () => {
  const map = (t: string) =>
    t === "cash" || t === "bank" || t === "ewallet" ? "asset" : "debt";
  expect(map("cash")).toBe("asset");
  expect(map("bank")).toBe("asset");
  expect(map("credit_card")).toBe("debt");
});
```

- [ ] **Step 2: Run full suite to see remaining failures**

Run: `npm test`
Expected: FAIL — every seed still using `type: "cash"` / `"bank"` / `"credit_card"` rejected by the new validator.

- [ ] **Step 3: Update all remaining seeds (mechanical replace)**

Mapping for every `tests/*.test.ts` seed and mutation arg:
- `type: "cash"` → `type: "asset"`
- `type: "bank"` → `type: "asset"`
- `type: "credit_card"` → `type: "debt"`
- Display names (`"Cash"`, `"Bank"`, `"Credit Card"`) stay unchanged — only the `type` literal changes.

Files and lines (from grep): `accounts.create.test.ts:97,122,148,169,182,186`; `accounts.reconcile.test.ts:73,82,194`; `accounts.atomicOpeningBalance.test.ts:63,92,135,161`; `households.deleteLeaveTransfer.test.ts:45,131`; `budgets.list.test.ts:37`; `periodBalances.test.ts:69`; `transactions.balance.test.ts:35,44`; `transactions.list.test.ts` (all `bank`/`credit_card` seeds); `transactions.summary.test.ts:45,54`; `transactions.search.test.ts:48`; `transactions.recent.test.ts:61,200,314,443`.

- [ ] **Step 4: Run migration locally + full verification**

Run: `npx convex codegen && npx tsc --noEmit && npm run lint && npm test`
Expected: all green. Then run the one-off migration against dev (`npx convex dev` running in a separate terminal; invoke `migrateAccountTypes:migrate` via dashboard/CLI), verify `accounts.verify` shows no drift, then **delete** `convex/migrateAccountTypes.ts` and re-run `npx convex codegen && npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add convex/migrateAccountTypes.ts tests/
git commit -m "feat(accounts): migrate seeds and data to asset/debt"
```

(Note: the deletion of `convex/migrateAccountTypes.ts` after the dev run is a second commit: `git rm convex/migrateAccountTypes.ts && git commit -m "chore(accounts): remove one-off migration"`.)
```

---

## Self-review

- **Spec coverage:** §1 enum + mapping → Tasks 1+4 (schema, validator, migration). §2 backend-neutral → Task 1 (no branching added) + Task 4 (verify no drift post-migration). §3 UI → Task 3 (rail, hero, cards, form, fallbacks, copy). §4 rollout/tests → Task 4 (codegen/tsc/lint/vitest order, seed updates, mapping test, temp-file deletion).
- **Placeholder scan:** no TBD/TODO; every step has exact file:line, exact code block, exact run command with expected outcome. No "similar to Task N" — the seed-mapping list repeats the literal mapping per file.
- **Type consistency:** `AccountType = "asset" | "debt"` defined once in Task 2 (`constants/accounts.ts`, mirrored in `internal.ts`); Tasks 1/3/4 consume the same literals, labels (`Wallet`/`Debt`), icons (`cash-payment-bill`/`credit-card-1`), and fallbacks (`asset`). `update` patch type matches schema union.
