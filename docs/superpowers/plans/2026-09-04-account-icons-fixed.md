# Account Fixed Icons — Streamline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render 4 account types with fixed Streamline Ultimate Color vectors (bank→saving-bank-1, cash→cash-payment-bill, ewallet→wireless-payment-credit-card-dollar, credit_card→credit-card-1) via offline SvgXml, no DB change.

**Architecture:** Derive icon at render from `type` via `ACCOUNT_STREAMLINE_MAP` + offline `streamlineIconData.json` (extend 2 icons) + `AccountIcon` SvgXml, OTA-only. Keep `ACCOUNT_TYPES` labels, replace Feather.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript 5.9, react-native-svg 15.12.1, Convex 1.43, Vitest, NativeWind 4

## Global Constraints

- Expo SDK 54 version floor — never `npm install`, use `npx expo install <pkg>` if needed.
- `npx tsc --noEmit` must pass before commit.
- `npm run lint` (expo lint) must pass.
- `npm test` (vitest) must pass — run when touching pure utils or Convex functions.
- After any `convex/*.ts` change → `npx convex codegen` then typecheck — not needed here (no schema change).
- Use NativeWind `className`, not `StyleSheet.create`; import theme via `constants/theme.ts`, not hardcoded colors; use `useThemeColors()`/`useThemeGradients()` + `dark:` variants.
- NativeWind v4 gotcha: never `style={({pressed})=>[...]}` on Pressable — use `useState` + static style.
- Path alias `@/*` → repo root.
- Amounts signed (+income/−expense/+transfer), Owner vs Member matrix, hidden visibility rules — every Convex handler requires `ctx.auth.getUserIdentity()` (not needed here, client-only).
- Spec location: `docs/superpowers/specs/2026-09-04-account-icons-streamline-design.md`

---

### Task 1: Account icon registry + offline bundle extension

**Files:**
- Create: `constants/accountIcons.ts`
- Modify: `constants/streamlineIconData.json` (add 2 bodies)
- Test: `tests/account.icons.test.ts`

**Interfaces:**
- Consumes: `constants/streamlineIconData.json` (icons map `Record<string,{body:string}>`), `AccountType` from `constants/accounts.ts`
- Produces: `ACCOUNT_STREAMLINE_MAP: Record<AccountType,string>`, `getAccountIconName(type?: string): string`, `isAccountType(x:string): x is AccountType` — consumed by Task 2 `AccountIcon`

- [ ] **Step 1: Write the failing test**

```ts
// tests/account.icons.test.ts:1
import { describe, it, expect } from "vitest";
import streamlineData from "@/constants/streamlineIconData.json";
import { ACCOUNT_STREAMLINE_MAP, getAccountIconName } from "@/constants/accountIcons";
import { ACCOUNT_TYPES } from "@/constants/accounts";

describe("accountIcons", () => {
  it("maps all 4 AccountType to Iconify names with SVG bodies", () => {
    const icons = (streamlineData as { icons: Record<string,{body:string}> }).icons;
    for (const t of ACCOUNT_TYPES) {
      const iconName = ACCOUNT_STREAMLINE_MAP[t.id];
      expect(iconName, `missing mapping for ${t.id}`).toBeTruthy();
      expect(icons[iconName]?.body, `missing body for ${iconName}`).toBeTruthy();
    }
    expect(ACCOUNT_STREAMLINE_MAP.bank).toBe("saving-bank-1");
    expect(ACCOUNT_STREAMLINE_MAP.cash).toBe("cash-payment-bill");
    expect(ACCOUNT_STREAMLINE_MAP.ewallet).toBe("wireless-payment-credit-card-dollar");
    expect(ACCOUNT_STREAMLINE_MAP.credit_card).toBe("credit-card-1");
  });
  it("fallback to saving-bank-1 for invalid/undefined", () => {
    expect(getAccountIconName("invalid" as any)).toBe("saving-bank-1");
    expect(getAccountIconName(undefined)).toBe("saving-bank-1");
    expect(getAccountIconName("cash")).toBe("cash-payment-bill");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/account.icons.test.ts`
Expected: FAIL `Cannot find module @/constants/accountIcons` or `missing body for wireless-payment-credit-card-dollar` (not yet in json)

- [ ] **Step 3: Fetch missing SVG bodies and extend bundle**

Run (PowerShell):
```powershell
curl.exe -s "https://api.iconify.design/streamline-ultimate-color.json?icons=wireless-payment-credit-card-dollar,credit-card-1" | python3 -c "import sys,json,pathlib; d=json.load(sys.stdin); j=pathlib.Path('constants/streamlineIconData.json'); cur=json.loads(j.read_text()); cur['icons'].update(d['icons']); j.write_text(json.dumps(cur,indent=2)); print('added', list(d['icons'].keys()))"
```
Verify: `python3 -c "import json; print(list(json.load(open('constants/streamlineIconData.json'))['icons'].keys())[-2:])"` shows 2 new keys.

- [ ] **Step 4: Write minimal implementation**

```ts
// constants/accountIcons.ts:1
import type { AccountType } from "./accounts";
export const ACCOUNT_STREAMLINE_MAP: Record<AccountType, string> = {
  bank: "saving-bank-1",
  cash: "cash-payment-bill",
  ewallet: "wireless-payment-credit-card-dollar",
  credit_card: "credit-card-1",
};
export function isAccountType(x: string): x is AccountType {
  return (["bank","cash","ewallet","credit_card"] as string[]).includes(x);
}
export function getAccountIconName(type?: string): string {
  if (type && isAccountType(type)) return ACCOUNT_STREAMLINE_MAP[type];
  return ACCOUNT_STREAMLINE_MAP.bank;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/account.icons.test.ts`
Expected: PASS 2/2

- [ ] **Step 6: Typecheck & lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: PASS no errors

- [ ] **Step 7: Commit**

```bash
git add constants/accountIcons.ts constants/streamlineIconData.json tests/account.icons.test.ts
git commit -m "feat(icons): add account fixed mapping + offline SVG bodies (saving-bank-1, cash-payment-bill, wireless-payment-credit-card-dollar, credit-card-1)"
```

---

### Task 2: AccountIcon SvgXml component

**Files:**
- Create: `components/AccountIcon.tsx`
- Test: `tests/account.icons.test.ts` (extend with render smoke, or keep as pure unit — no RN render needed)

**Interfaces:**
- Consumes: `constants/accountIcons.ts` `getAccountIconName`, `constants/streamlineIconData.json` bodies, `react-native-svg` `SvgXml`
- Produces: `AccountIcon({type, size?:number}): JSX.Element` — consumed by Tasks 3-4

- [ ] **Step 1: Write failing test (pure, no RN mount)**

Extend `tests/account.icons.test.ts`:
```ts
import { getAccountIconXml } from "@/components/AccountIcon";
it("AccountIcon xml contains svg wrapper + body", () => {
  expect(getAccountIconXml("bank")).toContain("<svg");
  expect(getAccountIconXml("cash")).toContain("cash-payment-bill");
  expect(getAccountIconXml("invalid" as any)).toContain("saving-bank-1");
});
```
Add export in component file before exists — test will FAIL `Cannot find module`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/account.icons.test.ts`
Expected: FAIL `getAccountIconXml is not a function`

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/AccountIcon.tsx:1
import { SvgXml } from "react-native-svg";
import { getAccountIconName } from "@/constants/accountIcons";
import streamlineData from "@/constants/streamlineIconData.json";

const W = (streamlineData as {width:number}).width ?? 24;
const H = (streamlineData as {height:number}).height ?? 24;
const ICONS = (streamlineData as {icons: Record<string,{body:string}>}).icons;

function getBody(name:string){ return ICONS[name]?.body; }

function resolve(type?:string|null){
  return getAccountIconName(type ?? undefined);
}

export function AccountIcon({type, size=32}:{type?:string|null; size?:number}){
  const name = resolve(type);
  const body = getBody(name) ?? getBody("saving-bank-1");
  if(!body) return null;
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} />;
}
export function getAccountIconXml(type?:string|null){
  const name = resolve(type);
  const body = getBody(name) ?? getBody("saving-bank-1") ?? "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/account.icons.test.ts`
Expected: PASS 4/4

- [ ] **Step 5: Typecheck & lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/AccountIcon.tsx tests/account.icons.test.ts
git commit -m "feat(icons): add AccountIcon SvgXml component with offline bundle"
```

---

### Task 3: Migrate AccountCard + Home My Accounts to AccountIcon

**Files:**
- Modify: `components/AccountCard.tsx:1-18` (replace Feather with AccountIcon)
- Modify: `app/(tabs)/home.tsx:956` (My Accounts horizontal cards)
- Test: manual + `npm test` regression

**Interfaces:**
- Consumes: `components/AccountIcon.tsx` `AccountIcon`, `AccountType`
- Produces: visual change — no API change

- [ ] **Step 1: Write failing visual check (optional — verify current uses Feather)**

Grep: `grep -n "Feather.*meta.icon" components/AccountCard.tsx` should exist before fix. After fix should not.

- [ ] **Step 2: Implement AccountCard**

```tsx
// components/AccountCard.tsx:1
import { AccountIcon } from "@/components/AccountIcon";
// replace:
// const meta = ACCOUNT_TYPES.find(...)
// <Feather name={meta.icon} ... />
// with:
// <AccountIcon type={type} size={32} />
// keep ACCOUNT_TYPES for label only: ACCOUNT_TYPES.find(t=>t.id===type)?.label
```

Keep container 44×44 `Radius.sm` `C.surface` `items-center justify-center`. Remove tinted bg logic if any.

- [ ] **Step 3: Implement Home My Accounts**

In `app/(tabs)/home.tsx:956` where `meta = ACCOUNT_TYPES.find(t=>t.id===item.type)` and `Feather` tinted circles `green/amber/blue/red` per type:
```tsx
import { AccountIcon } from "@/components/AccountIcon";
// <View style={{width:40,height:40,borderRadius:Radius.sm,backgroundColor:C.surface}}>
//   <AccountIcon type={item.type} size={28} />
// </View>
```

- [ ] **Step 4: Verify typecheck + lint + tests**

Run: `npx tsc --noEmit` → PASS; `npm run lint` → PASS; `npm test` → PASS (no regression)

- [ ] **Step 5: Commit**

```bash
git add components/AccountCard.tsx app/\(tabs\)/home.tsx
git commit -m "feat(icons): migrate AccountCard + Home My Accounts to AccountIcon vectors"
```

---

### Task 4: Migrate SelectField + account-form

**Files:**
- Modify: `components/SelectField.tsx:64-70,138` (account option icon)
- Modify: `app/account-form.tsx:191` (type Chip preview row)
- Test: manual picker + `npm test`

**Interfaces:**
- Consumes: `components/AccountIcon.tsx` `AccountIcon`, `ACCOUNT_TYPES`

- [ ] **Step 1: Verify current SelectField uses Feather for accounts**

Check `components/SelectField.tsx` `getCategoryIconSource` — used for category options. For account options (transfer selector), it may still fallback Feather. After fix, branch by `isAccountType`.

Simpler: since `SelectOption.icon` is generic string, detect if `option.icon` is AccountType? Instead add prop `isAccount` or check via `isAccountType`. Implement.

- [ ] **Step 2: Implement SelectField**

```tsx
// components/SelectField.tsx:1
import { AccountIcon } from "@/components/AccountIcon";
import { isAccountType } from "@/constants/accountIcons";
// replace:
// {selectedOption?.icon ? <Image source={getCategoryIconSource(...)} ... /> : null}
// with:
// {selectedOption?.icon ? (isAccountType(selectedOption.icon) ? <AccountIcon type={selectedOption.icon} size={24} /> : <CategoryIcon ... />) : null}
// same for option map
```

If only account selectors pass account type as icon, this works. If `transaction-form` passes account type string, it will auto-resolve.

- [ ] **Step 3: Implement account-form chip preview**

In `app/account-form.tsx:191` after `ACCOUNT_TYPES.map` Chip list, add preview row:
```tsx
import { AccountIcon } from "@/components/AccountIcon";
// below chip row, show <View className="flex-row items-center gap-2"><AccountIcon type={type} size={24} /><Text>{ACCOUNT_TYPES.find(...).label} preview</Text></View>
```
Or replace Chip icon — keep Chip as is, just add preview. Minimal.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → PASS; `npm run lint` → PASS; `npm test` → PASS

- [ ] **Step 5: Commit**

```bash
git add components/SelectField.tsx app/account-form.tsx
git commit -m "feat(icons): migrate SelectField account options + account-form preview to AccountIcon"
```

---

### Task 5: PRD & final verification

**Files:**
- Modify: `docs/Product Requirement Document/PRD.md` (Last updated header, §2.1 Accounts, §2.2 no icon field note, §3.4 Accounts, §3.9 Icons, §7 Tech Stack, §8 Change Log)
- Test: `npm test` full, `npx tsc --noEmit`, `npm run lint`

**Interfaces:**
- Consumes: spec at `docs/superpowers/specs/2026-09-04-account-icons-streamline-design.md`
- Produces: PRD accurate to live code

- [ ] **Step 1: Update PRD header**

From: `Last updated: 2026-09-04 (Streamline Ultimate Color 998 via Iconify CC BY 4.0 menggantikan PNG — SVG offline via react-native-svg)`
To: `Last updated: 2026-09-04 (Account fixed icons Streamline 4 via Iconify CC BY 4.0 + Category 56 vectors)`

- [ ] **Step 2: Update §2.1 Accounts row**

Add: `Icon fixed per type via Streamline Ultimate Color (CC BY 4.0) — bank saving-bank-1, cash cash-payment-bill, ewallet wireless-payment-credit-card-dollar, credit_card credit-card-1 — rendered offline via AccountIcon SvgXml 24x24 palette:true, derive at render (no DB field).`

- [ ] **Step 3: Update §3.4 Accounts**

Paragraph after opening balances: `Icons are fixed per type via ACCOUNT_STREAMLINE_MAP + AccountIcon (SvgXml offline streamlineIconData.json), displayed in AccountCard 44/32, Home 40/28, SelectField 24, account-form 20 — no Feather tinted circles, neutral C.surface container.`

- [ ] **Step 4: Update §3.9 Icons & §7 Tech Stack**

Icons row: Add `+ AccountIcon 4 fixed` to existing Streamline line. Tech Stack Icons: note `AccountIcon` shares same bundle.

- [ ] **Step 5: Add §8 Change Log entry (newest first)**

`| 2026-09-04 | Feature | **Account fixed icons Streamline** — same as Task 1-4 — Updates §2.1/§3.4/§3.9/§7/§8 |`

- [ ] **Step 6: Final verification**

Run: `npx tsc --noEmit` → PASS
Run: `npm run lint` → PASS
Run: `npm test` → `26/26` (?) with new `account.icons.test.ts` — expect `27/27` or `144/144`
Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add "docs/Product Requirement Document/PRD.md"
git commit -m "docs(prd): update accounts to fixed Streamline icons (bank/cash/ewallet/credit_card) via AccountIcon"
```

---

## Self-Review

**Spec coverage:** Each spec section maps to a task:
- §1-2 Architecture/Scope → Task 1-2 (registry+component, no DB)
- §3 Components → Tasks 1-4 (files listed verbatim)
- §4 Data Flow → Tasks 2-4 (derive at render)
- §5 Visual → Tasks 3-4 (sizes)
- §6 Error Handling → Tasks 1-2 (fallback saving-bank-1)
- §7 Testing → Tasks 1-2 + 5 (account.icons.test)
- §8 PRD → Task 5
- §9 Attribution → Task 5 (no code change, existing)
No gaps.

**Placeholder scan:** No TBD/TODO, all file paths exact, all code blocks concrete with Iconify names + SvgXml, run commands exact (`npm test -- tests/account.icons.test.ts`), commit messages concrete.

**Type consistency:** `AccountType` = `bank|cash|ewallet|credit_card` consistent across `accountIcons.ts` map keys, `getAccountIconName(type?:string)`, `AccountIcon({type?:string|null})`, `SelectField` `isAccountType` guard — no mismatched names. `streamlineIconData.json` shape `{width,height,icons:Record<string,{body:string}>}` consistent between Tasks 1-2.

