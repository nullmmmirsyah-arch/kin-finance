# Add Transaction Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti `app/transaction-form.tsx` menjadi full-screen sheet ala referensi (tabs Expense/Income/Transfer, grid kategori scroll 4 kolom filtered, dual card Transfer+swap, keypad kalkulator eval + thousand live, pill akun tappable default lastTransaction, note auto-suggest same category, date Today, header X+General tema Kin).

**Architecture:** Satu route `transaction-form.tsx` dirombak total (path tetap), komponen terisolasi `components/transaction/*` (CategoryGrid, AccountPill/TransferDual, Keypad, NoteSuggest), logic pure `utils/keypadEval.ts` dan `hooks/useNoteSuggestions.ts`, reuse Convex queries `accounts.list`/`categories.list`/`transactions.list` + SecureStore lastTransaction, styling NativeWind + `useThemeColors()`.

**Tech Stack:** Expo SDK 54, React Native 0.81, Expo Router 6, Convex, NativeWind v4, `react-native-svg` CategoryIcon, `expo-secure-store`, `expo-linear-gradient` tidak perlu, `@expo/vector-icons/Feather`.

## Global Constraints

- Expo SDK 54 → `npx expo install <pkg>` bukan `npm install`, cek `https://docs.expo.dev/versions/v54.0.0/` sebelum tulis code
- Verify: `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest untuk pure utils/Convex) setiap perubahan, `npx convex codegen` setelah `convex/*.ts`
- `npx convex dev` di terminal terpisah push schema
- Styling: NativeWind `className` bukan `StyleSheet.create`, theme via `constants/theme.ts` `useThemeColors()`/`useThemeGradients()`, `Gradients.card`, `Shadow.card`, `Feather`, jangan `Colors` langsung, jangan `Pressable style={({pressed})=>...}` pakai `useState` pressed
- Path alias `@/*`, Convex `ctx.auth.getUserIdentity()` throw `ConvexError`, amounts signed (+income -expense +transfer)
- `Input amount` pakai `amount` prop atau `formatAmountInput` live thousand, jangan ad hoc

---

### Task 1: Keypad evaluator pure util

**Files:**
- Create: `utils/keypadEval.ts`
- Test: `tests/keypadEval.test.ts`

**Interfaces:**
- Consumes: nothing (pure)
- Produces: `export function evaluateKeypadExpression(expr: string): number | null` — expr contoh "12,000+5,000×2", return integer hasil atau null jika invalid; `export function sanitizeKeypadInput(raw: string): string` — filter char allowed `0-9 + - × * ÷ / .`

- [ ] **Step 1: Write failing test**

```ts
// tests/keypadEval.test.ts
import { describe,it,expect } from "vitest";
import { evaluateKeypadExpression, sanitizeKeypadInput } from "@/utils/keypadEval";
describe("keypadEval",()=>{
  it("evaluates addition",()=> expect(evaluateKeypadExpression("12,000+5,000")).toBe(17000));
  it("handles mixed ops left-to-right",()=> expect(evaluateKeypadExpression("10+5×2")).toBe(30)); // (10+5)*2 =30 left-to-right
  it("returns null on trailing operator",()=> expect(evaluateKeypadExpression("10+")).toBeNull());
  it("sanitize strips invalid chars",()=> expect(sanitizeKeypadInput("12a+5b")).toBe("12+5"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/keypadEval.test.ts -v`
Expected: FAIL "Cannot find module '@/utils/keypadEval'"

- [ ] **Step 3: Write minimal implementation**

```ts
// utils/keypadEval.ts
export function sanitizeKeypadInput(raw: string): string {
  return raw.replace(/[^0-9+\-×*÷\/.,]/g,"").replace(/,/g,"");
}
export function evaluateKeypadExpression(expr: string): number | null {
  const s = sanitizeKeypadInput(expr).replace(/×/g,"*").replace(/÷/g,"/");
  if (!s || /[+\-*/.]$/.test(s)) return null;
  if (/[^0-9+\-*/.]/.test(s)) return null;
  const tokens = s.split(/([+\-*/])/).filter(Boolean);
  let acc = Number(tokens[0]);
  if (!Number.isFinite(acc)) return null;
  for (let i=1;i<tokens.length;i+=2){
    const op = tokens[i]; const n = Number(tokens[i+1]);
    if (!Number.isFinite(n)) return null;
    if (op==="+") acc+=n;
    else if (op==="-") acc-=n;
    else if (op==="*"||op==="×") acc*=n;
    else if (op==="/"||op==="÷") { if(n===0) return null; acc=Math.trunc(acc/n); }
    else return null;
  }
  if (!Number.isSafeInteger(acc) || acc<0) return null;
  return acc;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/keypadEval.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add utils/keypadEval.ts tests/keypadEval.test.ts
git commit -m "feat: add keypad evaluator pure util"
```

### Task 2: Note auto-suggest helper

**Files:**
- Create: `hooks/useNoteSuggestions.ts`
- Test: `tests/useNoteSuggestions.test.ts` (pure filter part)

**Interfaces:**
- Consumes: `api.transactions.list` result, `categoryId`
- Produces: `export function filterNoteSuggestions(notes: string[], draft: string, limit?: number): string[]` + hook `useNoteSuggestions(categoryId: string|null, draft: string)`

- [ ] **Step 1: Write failing test**

```ts
import { filterNoteSuggestions } from "@/hooks/useNoteSuggestions";
import { describe,it,expect } from "vitest";
describe("filterNoteSuggestions",()=>{
  it("filters by substring case-insensitive",()=> expect(filterNoteSuggestions(["Pisang goreng","Test future","Rajal"],"pisang")).toEqual(["Pisang goreng"]));
  it("limits results",()=> expect(filterNoteSuggestions(["a1","a2","a3","a4"],"a",2)).toHaveLength(2));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/useNoteSuggestions.test.ts -v`
Expected: FAIL module missing

- [ ] **Step 3: Write minimal implementation**

```ts
// hooks/useNoteSuggestions.ts
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMemo } from "react";
export function filterNoteSuggestions(notes: string[], draft: string, limit=5): string[] {
  if (!draft.trim()) return [];
  const q = draft.toLowerCase();
  const uniq = Array.from(new Set(notes.filter(n=>n && n.toLowerCase().includes(q))));
  return uniq.slice(0,limit);
}
export function useNoteSuggestions(categoryId: string|null, draft: string){
  // As-built: endDate memoized per category (no per-render resubscribe),
  // categoryId cast at the typed Id<"categories"> boundary — no `as any`.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional refresh per category
  const endDate = useMemo(() => Date.now(), [categoryId]);
  const res = useQuery(api.transactions.list, categoryId ? { startDate:0, endDate, limit:20, categoryIds: [categoryId as Id<"categories">] } : "skip");
  const notes = useMemo(()=> (res?.transactions ?? []).map(t=>t.note).filter(Boolean) as string[], [res]);
  return useMemo(()=> filterNoteSuggestions(notes, draft, 5), [notes,draft]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/useNoteSuggestions.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/useNoteSuggestions.ts tests/useNoteSuggestions.test.ts
git commit -m "feat: add note suggest helper"
```

### Task 3: Isolated UI pieces — CategoryGrid + Account sheets + Keypad

**Files:**
- Create: `components/transaction/CategoryGrid.tsx`
- Create: `components/transaction/AccountPill.tsx`
- Create: `components/transaction/TransferDual.tsx`
- Create: `components/transaction/Keypad.tsx`

**Interfaces:**
- Consumes: `CategoryIcon`, `AccountIcon`, `useThemeColors()`, `Shadow`, `Radius`
- Produces: `CategoryGrid({options, value, onSelect, isOwner})`, `AccountPill({account, onPress})`, `TransferDual({fromId,toId, options, onSwap, onSelect})`, `Keypad({expr,onChange,onSubmit,onToday})`
- As-built (coderabbit re-review): `TransferDual({fromAcc, toAcc, onSelectFrom, onSelectTo, onSwap})`, `Keypad({onKey})` — plan draft names diverged during implementation; final fix wave also removed dead `from`/`to`/`options` props.

- [ ] **Step 1: Create CategoryGrid**

```tsx
// components/transaction/CategoryGrid.tsx
import { FlatList, Pressable, Text, View } from "react-native";
import { CategoryIcon } from "@/components/CategoryIcon";
import { useThemeColors, Shadow, Radius } from "@/constants/theme";
import { useState } from "react";
export function CategoryGrid({options,value,onSelect,isOwner,onAdd}:{options:{id:string;label:string;icon?:string}[],value:string|null,onSelect:(id:string)=>void,isOwner:boolean,onAdd:()=>void}){
  const C=useThemeColors();
  if(options.length===0) return isOwner ? <Pressable onPress={onAdd} className="items-center py-4"><Text className="text-sm text-primary">Create category</Text></Pressable> : <Text>No categories</Text>;
  return <FlatList data={options} numColumns={4} keyExtractor={o=>o.id} contentContainerStyle={{gap:10,padding:12}} columnWrapperStyle={{gap:10}} renderItem={({item})=>{
    const active=item.id===value;
    return <Pressable onPress={()=>onSelect(item.id)} style={[Shadow.card,{flex:1,aspectRatio:1,borderRadius:Radius.md,backgroundColor:C.background,borderWidth:active?2:1,borderColor:active?C.primary:C.border,alignItems:"center",justifyContent:"center",gap:6}]} className="p-2"><CategoryIcon name={item.icon ?? "other"} size={32} /><Text numberOfLines={1} className="text-[11px] text-center">{item.label}</Text></Pressable>
  }} />
}
```

- [ ] **Step 2: Create AccountPill & TransferDual**

```tsx
// components/transaction/AccountPill.tsx
import { Pressable, Text,View } from "react-native";
import { AccountIcon } from "@/components/AccountIcon";
import { useThemeColors, Shadow, Radius } from "@/constants/theme";
export function AccountPill({label,account,onPress}:{label:string;account:{name:string;type:any}|null;onPress:()=>void}){
  const C=useThemeColors();
  return <Pressable onPress={onPress} style={[Shadow.card,{borderRadius:999,borderWidth:1,borderColor:C.border,backgroundColor:C.background,paddingHorizontal:16,paddingVertical:8,flexDirection:"row",gap:8,alignItems:"center"}]}><AccountIcon type={account?.type ?? "cash"} size={20} /><Text className="text-sm font-medium">{account?.name ?? label}</Text></Pressable>
}
// components/transaction/TransferDual.tsx
import { Pressable,View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { AccountPill } from "./AccountPill";
import { useThemeColors } from "@/constants/theme";
export function TransferDual({from,to,fromAcc,toAcc,options,onSelectFrom,onSelectTo,onSwap}:{from:string|null;to:string|null;fromAcc:any;toAcc:any;options:any[];onSelectFrom:()=>void;onSelectTo:()=>void;onSwap:()=>void}){
  const C=useThemeColors();
  return <View className="flex-row items-center justify-between gap-3 px-4 py-3"><AccountPill label="Payment account" account={fromAcc} onPress={onSelectFrom} /><Pressable onPress={onSwap} style={{width:40,height:40,borderRadius:999,backgroundColor:C.surface,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:C.border}}><Feather name="repeat" size={18} color={C.primary} /></Pressable><AccountPill label="Receive account" account={toAcc} onPress={onSelectTo} /></View>
}
```

- [ ] **Step 3: Create Keypad**

```tsx
// components/transaction/Keypad.tsx
import { Pressable,Text,View } from "react-native";
import { useThemeColors, Shadow, Radius } from "@/constants/theme";
import { useState } from "react";
// As-built rev2 (uji user): 4 rows × 4 cols penuh, tanpa Today/✓;
// kolom operator dipisah visual (spacer + tone). KeyButton extracted so
// pressed-state useState is NOT called inside the map loop.
const KEYS=[["1","2","3","⌫"],["4","5","6","+"],["7","8","9","-"],[".","0","×","÷"]];
const OP_KEYS=["+","-","×","÷"];
function KeyButton({label,onKey}:{label:string;onKey:(k:string)=>void}){
  const C=useThemeColors();
  const [pressed,setPressed]=useState(false);
  const isOp=OP_KEYS.includes(label);
  return <Pressable onPress={()=>onKey(label)} onPressIn={()=>setPressed(true)} onPressOut={()=>setPressed(false)} accessibilityRole="button" accessibilityLabel={label} style={{flex:1,height:52,borderRadius:Radius.md,backgroundColor:pressed||isOp?C.surface:C.background,borderWidth:1,borderColor:C.border,alignItems:"center",justifyContent:"center"}}><Text style={{color:isOp?C.primary:C.textPrimary,fontWeight:"700",fontSize:16}}>{label}</Text></Pressable>
}
export function Keypad({onKey}:{onKey:(k:string)=>void}){
  const C=useThemeColors();
  return <View className="gap-1.5 p-3 bg-background dark:bg-background-dark" style={{borderTopWidth:1,borderColor:C.border}}>{KEYS.map((row,i)=><View key={i} className="flex-row gap-1.5">{row.slice(0,3).map(k=><KeyButton key={k} label={k} onKey={onKey}/>)}<View style={{width:8}}/><KeyButton label={row[3]} onKey={onKey}/></View>)}</View>
}
```

- [ ] **Step 4: Manual verify (no unit test, visual)**

Run: `npx tsc --noEmit` Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/transaction/*
git commit -m "feat: add transaction sheet isolated UI pieces"
```

### Task 4: Rewrite transaction-form.tsx to sheet

**Files:**
- Modify: `app/transaction-form.tsx:1-759` → full rewrite (keep imports + logic, replace JSX)
- Modify: `app/_layout.tsx` if need modal presentation (optional)

**Interfaces:**
- Consumes: Task 1-3, `api.*`, `lib/last-transaction`, `utils/format`, `hooks/useNoteSuggestions`, `hooks/useDiscardGuard`, `constants/theme`
- Produces: Screen renders sheet, handles create/update/delete

- [ ] **Step 1: Write sheet JSX (keep all handlers)**

Replace return JSX di `transaction-form.tsx:539` dengan:
Header: `SafeAreaView` → top bar `X` + tabs `Expenses/Income/Transfer` (underline `C.primary` h 3px) + pill `household?.name ?? "General"`
Body: `CategoryGrid` jika `type!==transfer` else `TransferDual` + `FlatList` accounts sheet modal
Bottom: amount row (`formatNumber` live, no currency symbol per PRD §1), `NoteField` (`TextInput` + `filterNoteSuggestions` chips), keypad area (show `Keypad` when !noteFocused else system keyboard), `Today` sets today without opening the picker (as-built per review; date pill opens the `DateField` modal timezone-aware), Save `Button` + Delete if edit.

Preserve: `handleTypeChange`, `handleAmountChange` via `evaluateKeypadExpression` + `formatAmountInput`/`wasDecimalTruncated`, `handleAccountSelect`, `handleToAccountSelect`, `handleCategorySelect`, `handleSubmit` duplicate Alert, `handleDelete`, `canSubmit`, `hasInteracted` → `useDiscardGuard`.

Default account: `useEffect` setelah `accountResult` & `lastTransaction` loaded → if !isEdit && !accountId && lastTransaction → `setAccountId(lastTransaction.accountId)` bila masih visible.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit` Expected: PASS (fix imports)

- [ ] **Step 3: Run lint**

Run: `npm run lint` Expected: PASS

- [ ] **Step 4: Manual smoke via expo**

Run: `npx expo start` check light/dark, grid scroll, transfer swap, keypad Today→date, note suggest, save

- [ ] **Step 5: Commit**

```bash
git add app/transaction-form.tsx
git commit -m "feat: rewrite transaction-form to sheet (grid scroll, keypad eval, pill)"
```

### Task 5: Wiring validation parity

**Files:**
- Modify: `app/transaction-form.tsx` (add duplicate, hidden, discard, Repeat last UI as pill)

**Interfaces:**
- Consumes: `validateTransactionAmount`, `validateNote`, `validateTransactionDate`
- Produces: parity dengan PRD

- [ ] **Step 1: Re-add Repeat last as secondary pill below tabs**

```tsx
{!isEdit && lastTransaction ? <Pressable onPress={handleRepeatLast} className="mx-4 mt-2 flex-row items-center gap-2 rounded-xl border border-border bg-background px-4 py-3"><Feather name="repeat" size={16} color={C.primary} /><Text>Repeat last • {lastTransaction.type} {formatNumber(lastTransaction.amount)}</Text></Pressable> : null}
```

- [ ] **Step 2: Ensure hidden guards + duplicate Alert + haptics + Snackbar remain**

No new code, verify `handleSubmit` early returns masih ada.

- [ ] **Step 3: Test**

Run: `npm test` + manual Member login hidden category tidak muncul

- [ ] **Step 4: Commit**

```bash
git add app/transaction-form.tsx
git commit -m "feat: retain validation parity for sheet"
```

### Task 6: Docs & verification

**Files:**
- Modify: `docs/Product Requirement Document/PRD.md:100-104, 269-289, 8`
- Modify: `docs/gathering-requirement-add-transaction.html` (keep) + `docs/kin-gathering-add-transaction.json` (keep)
- Test: `npx convex codegen && npx tsc --noEmit && npm run lint && npm test`

**Interfaces:**
- Consumes: Task 4
- Produces: PRD updated

- [ ] **Step 1: Update PRD §3.6 Transactions Form UX**

Ganti paragraf "Form UX: contextual subtitle/type icon..." dengan:
"Sheet UX: header X + tabs Expenses/Income/Transfer (underline `C.primary`), grid kategori scroll 4 kolom filtered by type (hidden-aware, add category CTA), Transfer dual card + swap, pill akun tappable default lastTransaction, amount bare whole number no currency symbol, keypad custom 4×4 (+ - × ÷ live thousand `formatAmountInput`, kolom ops terpisah, tanpa Today/✓ — Save bar satu-satunya submit; date pill→picker household timezone), Note 200 + auto-suggest same category (5 chips) di atas keyboard via `KeyboardAwareScrollView`, grid sel tetap + tile Add, duplicate 24h Alert, discard guard (auto account defaults never dirty)."

- [ ] **Step 2: Add Change Log entry**

`## 8. Change Log` tambah `| 2026-09-07 | Add Transaction Sheet (gathering Q1A Q2B Q3A Q4A Q6A Q7C Q8B) — rewrite transaction-form to sheet, keypad eval, pill, note suggest |`

- [ ] **Step 3: Run verification**

Run: `npx convex codegen && npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/Product\ Requirement\ Document/PRD.md
git commit -m "docs: update PRD for add transaction sheet"
```

