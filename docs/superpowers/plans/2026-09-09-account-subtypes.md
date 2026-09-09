# Account Sub-types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required, validated `subType` to accounts (Asset→cash/bank/ewallet/other, Debt→credit_card/other) with fixed icon per sub-type, rename Wallet→Asset, and split the Accounts list into ASSET/DEBT sections.

**Architecture:** Single source of truth in `constants/accounts.ts` (`subTypesFor` + labels); Convex validates the (`type`,`subType`) pair; icon registry re-keys from type to sub-type; UI consumes both without new behavior (balances, permissions, filters unchanged).

**Tech Stack:** Expo SDK 54, Convex (schema + functions + codegen), NativeWind v4, vitest + convex-test.

## Global Constraints

- Verify with `npx tsc --noEmit` (typecheck), `npm run lint` (expo lint), `npm test` (vitest — run when a change touches pure utils or Convex functions).
- After any change to `convex/*.ts`, run `npx convex codegen` first to regenerate `convex/_generated/` (gitignored), then typecheck.
- Install dependencies with `npx expo install <pkg>` so versions match SDK 54 — never bare `npm install`.
- Use NativeWind (`className`), not `StyleSheet.create`. Import theme from `constants/theme.ts`; dark mode via `useThemeColors()` / `dark:` variants.
- Path alias `@/*` → repo root. `convex/schema.ts` is the executable source of truth.
- Every `convex/*.ts` handler requires sign-in via `ctx.auth.getUserIdentity()` and throws `ConvexError` (keep existing guards).
- English UI copy. Money inputs use shared `Input` with `amount` prop.
- Never use `style` callback functions on `Pressable`. Use `useState` pressed + static style.
- Current branch is `feat/account-types-simplify`; PR to `review` is manual by the user. Do not merge or push unless asked.
- One-off migration files are NEVER committed: create → run against dev → verify → delete, all uncommitted.

---

## File Structure

- Modify `constants/accounts.ts` — `AccountSubType`, `subTypesFor`, `SUB_TYPE_LABELS`, asset label Wallet→Asset.
- Modify `modules/icon-registry/internal.ts` — `ACCOUNT_STREAMLINE_MAP` re-keyed by sub-type, `isAccountSubType`, `getAccountIconName`/`resolveIconName` updated.
- Modify `modules/icon-registry/index.tsx` — `AccountIcon` takes `subType` (+ legacy `type` fallback removed; all call sites updated).
- Modify `convex/schema.ts` — `accounts.subType` (required in final state).
- Modify `convex/accounts.ts` — pair validation helper, `create` requires `subType`, `update` accepts `subType` with pair check.
- Modify `app/account-form.tsx` — sub-type chips per selected type, reset-on-type-change, seed/compare/submit wiring.
- Modify `app/(tabs)/accounts.tsx` — ASSET/DEBT sections with subtotals, `HeroVault` relabel, `VaultCard` sub-type icon + subtitle.
- Modify `components/transaction/AccountPill.tsx`, `app/transaction-form.tsx`, `components/AccountCard.tsx` — pass `subType` to `AccountIcon`.
- Modify all `tests/*.test.ts` seeds — add matching `subType` to every account insert/create.
- Create (temporary, then delete): `convex/migrateAccountSubTypes.ts` — infer sub-type from name.

---

### Task 1: Constants + icon registry

**Files:**
- Modify: `constants/accounts.ts`
- Modify: `modules/icon-registry/internal.ts:3,128-172`
- Modify: `modules/icon-registry/index.tsx:44-46,56-69`
- Test: `tests/account.icons.test.ts`

**Interfaces:**
- Consumes: spec §1 pair sets and §3 icon table.
- Produces: `AccountSubType`, `subTypesFor(type)`, `SUB_TYPE_LABELS`, `ACCOUNT_STREAMLINE_MAP: Record<AccountSubType, string>`, `isAccountSubType(x)`, `AccountIcon({ subType, size? })` — consumed by Tasks 2–3.

- [ ] **Step 1: Write the failing test**

Replace the 2-type icon expectations in `tests/account.icons.test.ts` with per-sub-type expectations:

```ts
import { ACCOUNT_STREAMLINE_MAP, getAccountIconName } from "@/constants/accountIcons";
import { ACCOUNT_TYPES, subTypesFor, SUB_TYPE_LABELS } from "@/constants/accounts";
import { getAccountIconXml } from "@/components/AccountIcon";

it("maps every sub-type to an Iconify name with an SVG body", () => {
  const icons = (streamlineData as { icons: Record<string, { body: string }> }).icons;
  for (const t of ["cash", "bank", "ewallet", "credit_card", "other"] as const) {
    const iconName = ACCOUNT_STREAMLINE_MAP[t];
    expect(iconName, `missing mapping for ${t}`).toBeTruthy();
    expect(icons[iconName]?.body, `missing body for ${iconName}`).toBeTruthy();
  }
  expect(ACCOUNT_STREAMLINE_MAP.cash).toBe("cash-payment-bill");
  expect(ACCOUNT_STREAMLINE_MAP.bank).toBe("saving-bank-1");
  expect(ACCOUNT_STREAMLINE_MAP.ewallet).toBe("wireless-payment-credit-card-dollar");
  expect(ACCOUNT_STREAMLINE_MAP.credit_card).toBe("credit-card-1");
  expect(ACCOUNT_STREAMLINE_MAP.other).toBe("tags-1");
});
it("pairs sub-types to parent types", () => {
  expect(subTypesFor("asset")).toEqual(["cash", "bank", "ewallet", "other"]);
  expect(subTypesFor("debt")).toEqual(["credit_card", "other"]);
  expect(SUB_TYPE_LABELS.bank).toBe("Bank");
});
it("falls back to tags-1 for invalid/undefined", () => {
  expect(getAccountIconName("invalid" as any)).toBe("tags-1");
  expect(getAccountIconName(undefined)).toBe("tags-1");
  expect(getAccountIconName("bank")).toBe("saving-bank-1");
});
it("AccountIcon xml contains svg wrapper + body", () => {
  expect(getAccountIconXml("ewallet")).toContain("<svg");
  expect(getAccountIconXml("ewallet")).toContain("wireless-payment-credit-card-dollar");
  expect(getAccountIconXml("invalid" as any)).toContain("tags-1");
});
```

(`getAccountIconXml`/`getAccountIconName` take the sub-type string; signatures change in Step 3.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/account.icons.test.ts`
Expected: FAIL — `ACCOUNT_STREAMLINE_MAP.cash` undefined, `subTypesFor` not defined.

- [ ] **Step 3: Write minimal implementation**

`constants/accounts.ts` becomes:

```ts
import { ComponentProps } from "react";
import Feather from "@expo/vector-icons/Feather";

export type AccountType = "asset" | "debt";
export type AccountSubType = "cash" | "bank" | "ewallet" | "credit_card" | "other";

export const ACCOUNT_TYPES: {
  id: AccountType;
  label: string;
  icon: ComponentProps<typeof Feather>["name"];
}[] = [
  { id: "asset", label: "Asset", icon: "dollar-sign" },
  { id: "debt", label: "Debt", icon: "credit-card" },
];

export function subTypesFor(type: AccountType): AccountSubType[] {
  return type === "asset"
    ? ["cash", "bank", "ewallet", "other"]
    : ["credit_card", "other"];
}

export const SUB_TYPE_LABELS: Record<AccountSubType, string> = {
  cash: "Cash",
  bank: "Bank",
  ewallet: "E-Wallet",
  credit_card: "Credit Card",
  other: "Other",
};
```

`modules/icon-registry/internal.ts`:

```ts
export type AccountType = "asset" | "debt";
export type AccountSubType = "cash" | "bank" | "ewallet" | "credit_card" | "other";
```

```ts
export const ACCOUNT_STREAMLINE_MAP: Record<AccountSubType, string> = {
  cash: "cash-payment-bill",
  bank: "saving-bank-1",
  ewallet: "wireless-payment-credit-card-dollar",
  credit_card: "credit-card-1",
  other: "tags-1",
};
```

```ts
export function isAccountSubType(x: string): x is AccountSubType {
  return (["cash", "bank", "ewallet", "credit_card", "other"] as string[]).includes(x);
}
```

```ts
export function getAccountIconName(subType?: string): string {
  if (subType && isAccountSubType(subType)) return ACCOUNT_STREAMLINE_MAP[subType];
  return ACCOUNT_STREAMLINE_MAP.other;
}
```

In `resolveIconName`, replace the `isAccountType(ref)` branch with the sub-type check (keep the category branch; note `bank` exists in both maps with the same target `saving-bank-1`, so order is harmless — check sub-type first):

```ts
export function resolveIconName(ref?: string | null): string {
  if (!ref) return CATEGORY_STREAMLINE_MAP.other;
  if (isAccountSubType(ref)) return ACCOUNT_STREAMLINE_MAP[ref];
  if ((ref as CategoryIconName) in CATEGORY_STREAMLINE_MAP) return CATEGORY_STREAMLINE_MAP[ref as CategoryIconName];
  return getStreamlineIconName(ref);
}
```

Remove `isAccountType` (or keep as deprecated shim only if something outside this plan still imports it — grep first; delete if unused). Update `modules/icon-registry/index.tsx`:

```ts
export function AccountIcon({ subType, size = 32 }: { subType?: string | null; size?: number }) {
  return <Icon ref={subType} size={size} />;
}
```

```ts
export function getAccountIconXml(subType?: string | null): string {
  const iconName = subType && isAccountSubType(subType) ? ACCOUNT_STREAMLINE_MAP[subType] : ACCOUNT_STREAMLINE_MAP.other;
  const body = getBody(iconName) ?? getBody(ACCOUNT_STREAMLINE_MAP.other) ?? "";
  const { width, height } = getIconData();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-icon="${iconName}">${body}</svg>`;
}
export function getAccountIconName(subType?: string): string {
  if (subType && isAccountSubType(subType)) return ACCOUNT_STREAMLINE_MAP[subType];
  return ACCOUNT_STREAMLINE_MAP.other;
}
```

Fix all imports/exports of `isAccountType`/`AccountType` in `index.tsx` to the sub-type names.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsc --noEmit && npm test -- tests/account.icons.test.ts`
Expected: icons test PASS. Typecheck still fails on Task 2–3 files (backend `subType` missing, UI call sites) — expected.

- [ ] **Step 5: Commit**

```bash
git add constants/accounts.ts modules/icon-registry/internal.ts modules/icon-registry/index.tsx tests/account.icons.test.ts
git commit -m "feat(accounts): sub-type constants and per-sub-type icons"
```

---

### Task 2: Backend schema + pair validation

**Files:**
- Modify: `convex/schema.ts` (accounts table)
- Modify: `convex/accounts.ts` (validator, helper, `create`, `update`)
- Test: `tests/accounts.create.test.ts`, `tests/accounts.reconcile.test.ts` (mapping case only; full seed updates are Task 4)

**Interfaces:**
- Consumes: Task 1 `subTypesFor`, `AccountSubType`.
- Produces: `Doc<"accounts">` gains required `subType`; `create`/`update` enforce pair validity. Task 3 sends `subType` from the form.

- [ ] **Step 1: Write the failing tests**

In `tests/accounts.create.test.ts`, change the zero-balance create call to include a valid sub-type and add rejection cases:

```ts
const result = await owner.mutation(api.accounts.create, {
  name: "Cash",
  type: "asset",
  subType: "cash",
});
```

```ts
it("rejects sub-type outside the parent type set", async () => {
  const owner = t.withIdentity({ tokenIdentifier: OWNER_TOKEN, subject: "owner" });
  await t.run(async (ctx) => seed(ctx));
  await expect(
    owner.mutation(api.accounts.create, { name: "Bad", type: "debt", subType: "cash" as any }),
  ).rejects.toThrow("Sub-type is not valid for this account type.");
  await expect(
    owner.mutation(api.accounts.create, { name: "Bad2", type: "asset", subType: "credit_card" as any }),
  ).rejects.toThrow("Sub-type is not valid for this account type.");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/accounts.create.test.ts`
Expected: FAIL — `subType` unknown argument / validator rejects.

- [ ] **Step 3: Write minimal implementation**

`convex/schema.ts` accounts table — add required field:

```ts
type: v.union(
  v.literal("asset"),
  v.literal("debt"),
),
subType: v.union(
  v.literal("cash"),
  v.literal("bank"),
  v.literal("ewallet"),
  v.literal("credit_card"),
  v.literal("other"),
),
```

`convex/accounts.ts` — import + helper + wiring:

```ts
import { subTypesFor, AccountSubType } from "../constants/accounts";

function assertValidSubType(type: "asset" | "debt", subType: string): asserts subType is AccountSubType {
  if (!(subTypesFor(type) as string[]).includes(subType)) {
    throw new ConvexError("Sub-type is not valid for this account type.");
  }
}
```

`create` args add `subType: v.string()`, then after name validation:

```ts
assertValidSubType(args.type, args.subType);
const subType = args.subType as AccountSubType;
```

and include `subType` in the `ctx.db.insert("accounts", {...})` object.

`update` args add `subType: v.optional(v.string())`; patch type gains `subType?: AccountSubType`; after loading the account:

```ts
const nextType = args.type ?? account.type;
if (args.subType !== undefined) {
  assertValidSubType(nextType, args.subType);
  patch.subType = args.subType as AccountSubType;
} else if (args.type !== undefined) {
  assertValidSubType(args.type, account.subType);
}
```

(the `else if` keeps joint type-changes valid against the stored sub-type).

- [ ] **Step 4: Regenerate + run tests**

Run: `npx convex codegen && npx tsc --noEmit && npm test -- tests/accounts.create.test.ts`
Expected: new tests PASS; other old seeds in the file fail (no `subType` — Task 4).

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/accounts.ts tests/accounts.create.test.ts
git commit -m "feat(accounts): required sub-type with pair validation"
```

---

### Task 3: Form + list sections + call sites

**Files:**
- Modify: `app/account-form.tsx`
- Modify: `app/(tabs)/accounts.tsx`
- Modify: `components/transaction/AccountPill.tsx`, `app/transaction-form.tsx`, `components/AccountCard.tsx`

**Interfaces:**
- Consumes: Task 1 constants/icons, Task 2 `create`/`update` `subType` args.
- Produces: sub-type selectable in form, sections + sub-type icons in list, all `AccountIcon` call sites on `subType`.

- [ ] **Step 1: Write the failing check**

Run: `npx tsc --noEmit`
Expected: FAIL — `create`/`update` now require/accept `subType` which the form never sends; `AccountIcon type=` prop no longer exists.

- [ ] **Step 2: Implement the form (`app/account-form.tsx`)**

```tsx
import { ACCOUNT_TYPES, AccountType, subTypesFor, AccountSubType, SUB_TYPE_LABELS } from "@/constants/accounts";
```

State + reset-on-type-change + seed:

```ts
const [subType, setSubType] = useState<AccountSubType>("cash");
const subTypeOptions = useMemo(() => subTypesFor(type), [type]);
```

```ts
useEffect(() => {
  if (editingAccount && !seeded.current) {
    seeded.current = true;
    setName(editingAccount.name);
    setType(editingAccount.type);
    setSubType(editingAccount.subType);
    setHidden(editingAccount.hidden);
  }
}, [editingAccount]);
```

Type chips call a handler that also resets the sub-type:

```tsx
onPress={() => {
  setType(t.id);
  setSubType(subTypesFor(t.id)[0]);
}}
```

`canSubmit` gains `subTypeOptions.includes(subType)`; `isDirty` compares `subType !== editingAccount.subType` (edit) and `subType !== "cash"` (create, alongside the `type !== "asset"` baseline); `handleSubmit` passes `subType` to both `updateAccount` and `createAccount`. Sub-type chip block (below the type chips, same `Chip` component):

```tsx
<View className="gap-1.5">
  <Text className="text-[14px] font-semibold tracking-[0.02em] leading-5 text-text-primary dark:text-text-primary-dark">
    Sub-type
  </Text>
  <View className="flex-row flex-wrap gap-2">
    {subTypeOptions.map((s) => (
      <Chip key={s} label={SUB_TYPE_LABELS[s]} active={subType === s} onPress={() => setSubType(s)} />
    ))}
  </View>
  <View className="flex-row items-center gap-2">
    <AccountIcon subType={subType} size={24} />
    <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
      {SUB_TYPE_LABELS[subType]} preview
    </Text>
  </View>
</View>
```

Replace the old type-preview `AccountIcon type={type}` with the block above (type chips keep no preview; preview moves to sub-type).

- [ ] **Step 3: Implement the list (`app/(tabs)/accounts.tsx`)**

`VaultCard` item type gains `subType: AccountSubType`; icon + subtitle:

```tsx
<AccountIcon subType={item.subType} size={32} />
```

```tsx
<Text className="text-xs font-medium tracking-wide text-text-secondary dark:text-text-secondary-dark">
  {SUB_TYPE_LABELS[item.subType].toUpperCase()}
</Text>
```

(replaces `{meta.label.toUpperCase()}`; drop the now-unused `meta` lookup or keep it for the accessibility label only — keep it for the accessibility label, remove other uses.)

`HeroVault` `typeDots` relabel (labels now come from `ACCOUNT_TYPES`):

```ts
const typeDots = ACCOUNT_TYPES.map((t) => ({ type: t.id, label: t.label }));
```

(the rendered `label.toUpperCase()` then shows ASSET/DEBT automatically.)

Replace the flat `visibleAccounts` list with two sections. Build (next to `visibleAccounts`):

```ts
const sections = useMemo(() => {
  if (accounts === null) return null;
  const inFilter = (t: AccountType) => filter === "all" || filter === t;
  const rows = (t: AccountType) =>
    (filter === "all" || filter === t ? accounts : accounts.filter((a) => a.type === filter)).filter(
      (a) => a.type === t,
    );
  return (["asset", "debt"] as AccountType[])
    .filter(inFilter)
    .map((t) => ({
      type: t,
      label: ACCOUNT_TYPES.find((x) => x.id === t)?.label ?? t,
      total: rows(t).reduce((s, a) => s + a.balance, 0),
      data: rows(t),
    }));
}, [accounts, filter]);
```

Render: replace the single `FlatList` `data`/`renderItem` with per-section blocks — simplest within the existing `FlatList` is `ListHeaderComponent` + section headers injected via data markers; cleaner is `SectionList`. Use `SectionList` with the same props (refreshControl, contentContainerClassName, keyExtractor) plus:

```tsx
renderSectionHeader={({ section }) => (
  <View className="flex-row items-center justify-between pt-2">
    <Text className="text-[13px] font-semibold tracking-wide text-text-secondary dark:text-text-secondary-dark">
      {section.label.toUpperCase()} • {section.data.length} • {formatNumber(section.total)}
    </Text>
  </View>
)}
```

Empty sections (length 0) render header + `EmptyState`-less hint row only when `filter === "all"`; when filtered to one type, only that section appears. `ListEmptyComponent` stays for zero accounts overall (update copy "Wallet or debt." → "Asset or debt.").

`components/transaction/AccountPill.tsx` + `app/transaction-form.tsx`: change `AccountIcon type={... ?? "asset"}` to `AccountIcon subType={...subType}` (account objects come from `api.accounts.list`, which now includes `subType`; `AccountRef` type gains `subType: string`). `components/AccountCard.tsx`: props gain `subType: AccountSubType`, icon + subtitle use it.

- [ ] **Step 4: Run typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS except Task 4 test seeds (missing `subType`).

- [ ] **Step 5: Commit**

```bash
git add app/account-form.tsx "app/(tabs)/accounts.tsx" components/transaction/AccountPill.tsx app/transaction-form.tsx components/AccountCard.tsx
git commit -m "feat(accounts): sub-type form, sections, and icons in UI"
```

---

### Task 4: Seeds + infer-migration + rollout

**Files:**
- Modify: every `tests/*.test.ts` account seed/create call — add matching `subType`.
- Modify: `tests/accounts.reconcile.test.ts` — add infer-mapping unit test.
- Create (temporary): `convex/migrateAccountSubTypes.ts` — infer + fill `subType`, then delete.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: full suite green; dev data backfilled; final tree has no migration file.

- [ ] **Step 1: Run full suite to see remaining failures**

Run: `npm test`
Expected: FAIL — every seed missing required `subType`.

- [ ] **Step 2: Update all seeds (mechanical + matching)**

For every account insert/create in `tests/`: add the `subType` matching its `type`:
- `type: "asset"` → `subType: "cash"` (keep display names as-is; any asset sub-type is valid — use `"cash"` unless the test name implies otherwise, e.g. a `"Bank"` account gets `"bank"`, `"GoPay"` gets `"ewallet"`).
- `type: "debt"` → `subType: "credit_card"`.

Files (from prior grep + Task 2): `accounts.create.test.ts`, `accounts.reconcile.test.ts`, `accounts.atomicOpeningBalance.test.ts`, `households.deleteLeaveTransfer.test.ts`, `budgets.list.test.ts`, `periodBalances.test.ts`, `transactions.balance.test.ts`, `transactions.list.test.ts`, `transactions.summary.test.ts`, `transactions.search.test.ts`, `transactions.recent.test.ts`, `account.icons.test.ts` (done in Task 1).

Add the infer-mapping unit test to `tests/accounts.reconcile.test.ts`:

```ts
function inferSubType(name: string, type: "asset" | "debt"): string {
  const n = name.toLowerCase();
  if (type === "debt") return n.includes("credit") || n.includes("kartu") ? "credit_card" : "other";
  if (/(bca|bank|bsi|mandiri|bri|bni)/.test(n)) return "bank";
  if (/(dompet|cash|tunai)/.test(n)) return "cash";
  if (/(gopay|ovo|dana|shopeepay|emoney|e-money)/.test(n)) return "ewallet";
  return "other";
}

it("infers sub-type from account name", () => {
  expect(inferSubType("BCA", "asset")).toBe("bank");
  expect(inferSubType("Dompet", "asset")).toBe("cash");
  expect(inferSubType("GoPay", "asset")).toBe("ewallet");
  expect(inferSubType("BSI", "asset")).toBe("bank");
  expect(inferSubType("Random", "asset")).toBe("other");
  expect(inferSubType("My Card", "debt")).toBe("credit_card");
});
```

(The migration function in Step 3 must use this exact keyword logic — copy it verbatim.)

- [ ] **Step 3: Migrate dev data (uncommitted, same shim pattern as the asset/debt migration)**

Why a shim: pushing a required `subType` fails schema validation while old rows lack the field. Steps:
1. Create `convex/migrateAccountSubTypes.ts` (admin, no auth — temporary, never committed):

```ts
import { mutation } from "./_generated/server";

function inferSubType(name: string, type: string): string {
  const n = name.toLowerCase();
  if (type === "debt") return n.includes("credit") || n.includes("kartu") ? "credit_card" : "other";
  if (/(bca|bank|bsi|mandiri|bri|bni)/.test(n)) return "bank";
  if (/(dompet|cash|tunai)/.test(n)) return "cash";
  if (/(gopay|ovo|dana|shopeepay|emoney|e-money)/.test(n)) return "ewallet";
  return "other";
}

export const migrate = mutation({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("accounts").collect();
    let migrated = 0;
    for (const acc of accounts) {
      const row = acc as unknown as { name: string; type: string; subType?: string };
      if (row.subType === undefined) {
        await ctx.db.patch(acc._id, { subType: inferSubType(row.name, row.type) as never, updatedAt: Date.now() });
        migrated++;
      }
    }
    return { migrated, total: accounts.length };
  },
});
```

2. Temporarily make schema `subType: v.optional(...)` (same union), `npx convex dev --once` (passes validation, deploys migration fn).
3. Run `migrateAccountSubTypes:migrate` against dev; expect `{ migrated: <rows lacking subType>, total: <all> }`.
4. Verify via data read: every account has a valid `subType` for its `type`.
5. Revert schema to required, delete the migration file, `npx convex codegen`, `npx convex dev --once` (final push, validation passes).
6. Check dev failure logs are clean.

- [ ] **Step 4: Full verification**

Run: `npx convex codegen && npx tsc --noEmit && npm run lint && npm test`
Expected: all green (31+ files). Confirm `git status --short` shows no `convex/migrateAccountSubTypes.ts`.

- [ ] **Step 5: Commit**

```bash
git add tests/
git commit -m "feat(accounts): backfill sub-type in test seeds"
```

(No second commit needed — the migration file was never added.)

---

## Self-review

- **Spec coverage:** §1 model+migration → Tasks 2 (schema/validators) + 4 (infer + shim rollout, keyword logic identical in test and migration). §2 backend → Task 2 (required-on-create, pair check incl. joint updates). §3 UI → Task 3 (Asset label, chips+reset, sections+subtotals, per-sub-type icons, all call sites). §4 rollout/tests → Task 4 (seeds, infer test, uncommitted migration, full verify).
- **Placeholder scan:** no TBD/TODO; every step has exact files, code, commands, expected outputs. Seed-mapping rule repeats literals per file rather than "similar to Task N".
- **Type consistency:** `AccountSubType` + `subTypesFor` + `SUB_TYPE_LABELS` defined once (Task 1); backend `assertValidSubType` + schema union (Task 2), form/list (Task 3), seeds/migration (Task 4) use the same five literals and the same two pair sets. `AccountIcon` takes `subType` everywhere after Task 3.
