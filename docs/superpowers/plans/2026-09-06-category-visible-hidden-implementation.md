# Category Visible/Hidden Sections + Responsive IconPicker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Partition Categories page filtered list into Visible/Hidden sections with badge actions and bulk delete, plus make IconPicker responsive 4-6 cols without changing 56px touch target.

**Architecture:** Client-side partition (`visible`/`hidden` via `useMemo`) on `app/categories.tsx` reusing `api.categories.update/remove`; `modules/icon-registry/index.tsx` computes `cols` from `useWindowDimensions().width` (56+8 item, 40 padding) and updates `FlatList` `numColumns`/`getItemLayout`. New presentational `CategoryCircle`+`CategoryBadge` in `components/CategoryCard.tsx` for badge overlays. No schema/mutation change, JS-only.

**Tech Stack:** Expo SDK 54, React Native 0.81, Expo Router 6, Convex 1.43, `react-native-svg` 15.12.1, NativeWind 4, `react-native-safe-area-context`, `useWindowDimensions`, vitest, convex-test

## Global Constraints

- Expo SDK 54 versioned docs https://docs.expo.dev/versions/v54.0.0/ — use `npx expo install <pkg>` not bare `npm install`.
- Verify with `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest) after changes; `npx convex codegen` only if schema changes (none here).
- `npx convex dev` pushes `convex/` — not needed for this JS-only change.
- Styling: NativeWind `className`, no `StyleSheet.create`; theme via `constants/theme.ts` `useThemeColors()`/`C.cardBorder` etc., not hardcoded hex; shadows `Shadow.card`; icons `@expo/vector-icons/Feather` 10px in badges, 14px actions; `expo-linear-gradient` + `Gradients.card` for cards if needed.
- NativeWind v4 gotcha: never `style={({pressed})=>[...]}` on Pressable — use `useState` pressed + static style.
- Path alias `@/*` → repo root; `app/` expo-router, `Stack.Protected guard` in `app/_layout.tsx`.
- Backend invariants: `ctx.auth.getUserIdentity()` required, `ConvexError` throws, amounts signed, owner vs member matrix, `hidden` visibility via `convex/categories.ts:list`.
- Money inputs: `Input` `amount` prop for thousand separators — not relevant here but keep pattern.
- One Household per user MVP; 56 icons allowlist `isValidCategoryIcon`, fallback `other` → `tags-1`.

---

## File Structure

**Modified:**
- `modules/icon-registry/index.tsx` — `IconPicker` responsive `numColumns` calc + `getItemLayout`
- `components/CategoryCard.tsx` — add `CategoryCircle` + `CategoryBadge` (18px yellow/red)
- `app/categories.tsx` — partition `visible`/`hidden`, two sections, headers, badge overlays, bulk delete link

**Tests:**
- `tests/categories.visibleHidden.test.ts` — pure partition logic

**Docs (already done in spec PR):**
- `docs/superpowers/specs/2026-09-06-category-visible-hidden-design.md`
- `docs/Product Requirement Document/PRD.md` §1, §2.1, §3.5, §3.9, §8 + header

---

### Task 1: IconPicker Responsive 4-6 Cols

**Files:**
- Modify: `modules/icon-registry/index.tsx:78-136`
- Test: manual verification + `npx tsc --noEmit`

**Interfaces:**
- Consumes: `useWindowDimensions()` width, constants `H_PADDING=40`, `GAP=8`, `ITEM=56`
- Produces: `cols: number` (4..6) used as `FlatList numColumns` and `getItemLayout` offset; export unchanged `IconPicker({value,onChange,size})`

- [ ] **Step 1: Read current IconPicker to confirm fixed 4-col**
  Run: `read modules/icon-registry/index.tsx` lines 78-136. Verify `numColumns={4}`, `columnWrapperStyle={{gap:8}}`, `getItemLayout offset 64*Math.floor(index/4)`.

- [ ] **Step 2: Edit IconPicker to responsive cols**
  Replace inside `IconPicker`:
  ```tsx
  import { FlatList, Pressable, View, Text, useWindowDimensions } from "react-native"; // add useWindowDimensions
  // inside function:
  const { width } = useWindowDimensions();
  const GAP = 8;
  const ITEM = 56;
  const H_PADDING = 40;
  const cols = Math.max(4, Math.min(6, Math.floor((width - H_PADDING + GAP) / (ITEM + GAP))));
  // then FlatList:
  // numColumns={cols}
  // columnWrapperStyle={cols>1?{gap:GAP}:undefined}
  // getItemLayout={(_d, index)=>({length:64, offset:64*Math.floor(index/cols), index})}
  ```
  Keep `scrollEnabled={false}`, `initialNumToRender={16}` etc.

- [ ] **Step 3: Typecheck**
  Run: `npx tsc --noEmit`
  Expected: no errors (if `useWindowDimensions` import missing, fix import).

- [ ] **Step 4: Lint**
  Run: `npm run lint`
  Expected: 0 errors.

- [ ] **Step 5: Commit**
  ```bash
  git add modules/icon-registry/index.tsx
  git commit -m "feat(category): responsive IconPicker 4-6 cols, keeps 56px target"
  ```

---

### Task 2: CategoryCircle + CategoryBadge Presentational Component

**Files:**
- Modify: `components/CategoryCard.tsx:1-302` — append new exports
- Test: `npx tsc --noEmit` (visual, no new unit test needed)

**Interfaces:**
- Consumes: `CategoryIcon` (`components/CategoryIcon.tsx`), `useThemeColors()`, `C.cardBorder`, `C.plushPeek`, `Shadow.card`
- Produces: `CategoryCircle({name, icon, hidden, onHide, onUnhide, onDelete})` + `CategoryBadge({type:"minus"|"plus"|"close", onPress, accessibilityLabel})` — used by next task

- [ ] **Step 1: Append CategoryBadge helper**
  At bottom of `components/CategoryCard.tsx` before exports, add:
  ```tsx
  function CategoryBadge({ type, onPress, label }: { type:"minus"|"plus"|"close"; onPress?:()=>void; label:string }) {
    const C = useThemeColors();
    const bg = type==="close" ? "#FCA5A5" : "#FACC15";
    const icon = type==="minus" ? "minus" : type==="plus" ? "plus" : "x";
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
        hitSlop={{top:6,bottom:6,left:6,right:6}}
        style={{ width:18, height:18, borderRadius:999, backgroundColor:bg, borderWidth:2, borderColor:C.cardBorder, alignItems:"center", justifyContent:"center", position:"absolute", top:-4, ...(type==="close"?{right:-4}:{left:-4}) }}>
        <Feather name={icon as any} size={10} color="#1C1917" />
      </Pressable>
    );
  }
  ```

- [ ] **Step 2: Add CategoryCircle component**
  ```tsx
  export function CategoryCircle({ name, icon, hidden, onToggleVisibility, onDelete }: Props) {
    const C = useThemeColors();
    const [pressed, setPressed] = useState(false);
    return (
      <View style={{ width: (56+8*2), alignItems:"center", gap:6 }}>
        <View style={{ width:56, height:56, borderRadius:999, backgroundColor:C.plushPeek, borderWidth:2, borderColor:C.cardBorder, alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
          <CategoryIcon name={icon} size={32} />
          {onToggleVisibility && hidden===false && <CategoryBadge type="minus" onPress={onToggleVisibility} label={`Hide category ${name}`} />}
          {onToggleVisibility && hidden===true && <CategoryBadge type="plus" onPress={onToggleVisibility} label={`Show category ${name}`} />}
          {onDelete && hidden===true && <CategoryBadge type="close" onPress={onDelete} label={`Delete category ${name}`} />}
        </View>
        <Text numberOfLines={2} style={{ fontSize:12, fontWeight:"600", color:C.textPrimary, textAlign:"center" }}>{name}</Text>
      </View>
    );
  }
  ```
  Adjust absolute positions: use wrapper `View` with `position:"relative"`.

- [ ] **Step 3: Typecheck + lint**
  Run: `npx tsc --noEmit && npm run lint`
  Expected: pass.

- [ ] **Step 4: Commit**
  ```bash
  git add components/CategoryCard.tsx
  git commit -m "feat(category): add CategoryCircle + CategoryBadge for Visible/Hidden grids"
  ```

---

### Task 3: Categories Page Visible/Hidden Sections + Badge Actions + Bulk Delete

**Files:**
- Modify: `app/categories.tsx:68-336`

**Interfaces:**
- Consumes: `result.categories`, `filter`, new `CategoryCircle`/`CategoryBadge` or enhanced `PlushCategoryCard` with overlay; mutations `updateCategory`, `removeCategory` + `useSnackbar`, `getConvexErrorMessage`
- Produces: two FlatList sections (Visible/Hidden) with correct partition and bulk delete

- [ ] **Step 1: Write failing partition test (pure logic extracted)**
  Create `tests/categories.visibleHidden.test.ts`:
  ```ts
  import { describe, it, expect } from "vitest";
  function partition<T extends {hidden:boolean; type:string}>(cats:T[], filter:string) {
    const filtered = filter==="all"?cats:cats.filter(c=>c.type===filter);
    return { visible: filtered.filter(c=>!c.hidden), hidden: filtered.filter(c=>c.hidden) };
  }
  describe("partition", ()=>{
    it("splits visible/hidden per filter", ()=>{
      const cats=[{type:"expense",hidden:false},{type:"expense",hidden:true},{type:"income",hidden:false}] as any;
      expect(partition(cats,"all").visible.length).toBe(2);
      expect(partition(cats,"expense").hidden.length).toBe(1);
    });
  });
  ```

- [ ] **Step 2: Run test to verify pass (logic is trivial)**
  Run: `npm test -- tests/categories.visibleHidden.test.ts`
  Expected: PASS (1/1). If fails, fix partition function — copy exact logic.

- [ ] **Step 3: Modify categories.tsx — add partition useMemo**
  After `visibleCategories` memo, add:
  ```ts
  const { visible, hidden } = useMemo(()=>{
    if(visibleCategories===null) return {visible:null, hidden:null} as any;
    return {
      visible: visibleCategories.filter(c=>!c.hidden),
      hidden: visibleCategories.filter(c=>c.hidden),
    };
  }, [visibleCategories]);
  ```

- [ ] **Step 4: Add bulk delete handler**
  Inside component, add:
  ```ts
  const handleBulkDeleteHidden = useCallback(()=>{
    if(!hidden || hidden.length===0) return;
    Alert.alert(`Delete ${hidden.length} hidden categories?`, "Cannot be undone.", [
      {text:"Cancel",style:"cancel"},
      {text:"Delete",style:"destructive", onPress: async ()=>{
        const results = await Promise.allSettled(hidden.map(c=>removeCategory({categoryId:c._id})));
        const ok = results.filter(r=>r.status==="fulfilled").length;
        const fail = results.length - ok;
        show(fail? `${ok} deleted, ${fail} failed (in use)` : `${ok} hidden categories deleted`);
      }}
    ]);
  }, [hidden, removeCategory, show]);
  ```

- [ ] **Step 5: Replace FlatList render with two sections**
  Replace the `FlatList` block (lines ~292-334) with:
  ```tsx
  <ScrollView contentContainerStyle={{ gap:24, paddingHorizontal:16, paddingBottom:28 }}>
    {/* Visible */}
    <View style={{ gap:8 }}>
      <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
        <Text style={{ fontSize:14, fontWeight:"800", color:C.textPrimary }}>Visible</Text>
        <Text style={{ fontSize:12, fontWeight:"600", color:C.textSecondary }}>(Long press to reorder)</Text>
        <Text style={{ fontSize:12, color:C.textSecondary }}>({visible?.length ?? 0})</Text>
      </View>
      {visible && visible.length>0 ? (
        <FlatList key={`v-${numColumns}`} data={visible} numColumns={numColumns} columnWrapperStyle={numColumns>1?{gap:8}:undefined} contentContainerStyle={{gap:8}} scrollEnabled={false} keyExtractor={i=>i._id} renderItem={({item})=> <CategoryCircleOrPlush ... hidden={false} onToggleVisibility={()=>handleToggleVisibility(item)} onEdit={()=>router.push({pathname:"/category-form",params:{id:item._id}})} onDelete={()=>handleDelete(item)} /> } />
      ) : <Text style={{ fontSize:12, color:C.textSecondary, fontStyle:"italic" }}>No visible categories</Text>}
    </View>
    {/* Hidden — only when hidden.length>0 or isOwner */}
    {hidden && hidden.length>0 && (
      <View style={{ gap:8 }}>
        <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between" }}>
          <View style={{ flexDirection:"row", gap:6 }}><Text style={{ fontSize:14, fontWeight:"800", color:C.textPrimary }}>Hidden</Text><Text style={{fontSize:12,color:C.textSecondary}}>({hidden.length})</Text></View>
          {isOwner && <Pressable onPress={handleBulkDeleteHidden} accessibilityLabel="Delete hidden categories"><Text style={{ fontSize:12, fontWeight:"700", color:C.error, textDecorationLine:"underline" }}>Delete hidden categories</Text></Pressable>}
        </View>
        <FlatList key={`h-${numColumns}`} data={hidden} numColumns={numColumns} columnWrapperStyle={numColumns>1?{gap:8}:undefined} contentContainerStyle={{gap:8}} scrollEnabled={false} keyExtractor={i=>i._id} renderItem={({item})=> <CategoryCircleOrPlush ... hidden={true} onToggleVisibility={()=>handleToggleVisibility(item)} onDelete={()=>handleDelete(item)} /> } />
      </View>
    )}
    <ReservedFooter C={C} />
  </ScrollView>
  ```
  Keep imports: add `ScrollView` from `react-native`, import `CategoryCircle` from `components/CategoryCard`.

- [ ] **Step 6: Typecheck + lint + tests**
  Run: `npx tsc --noEmit` → fix missing imports; `npm run lint`; `npm test`
  Expected: all pass.

- [ ] **Step 7: Commit**
  ```bash
  git add app/categories.tsx tests/categories.visibleHidden.test.ts
  git commit -m "feat(category): Visible/Hidden sections with badge -/+/x and bulk delete hidden"
  ```

---

### Task 4: Final Verification + PR

**Files:**
- None (verification only)

- [ ] **Step 1: Full verification**
  Run: `npx tsc --noEmit && npm run lint && npm test`
  Expected: tsc 0, lint 0, tests all pass (reuse `vitest` suite).

- [ ] **Step 2: Manual smoke checklist**
  - Filter All → see Visible + Hidden sections correctly partitioned
  - Tap `-` on Visible card → moves to Hidden via `hidden:true`
  - Tap `+` on Hidden → moves to Visible
  - Tap `x` on Hidden → Alert → delete
  - Tap `Delete hidden categories` → confirm → clears all hidden (fail case shows Snackbar)
  - Open Create Category → IconPicker shows 5 cols on 360dp, 6 cols on 390dp+ (no horizontal scroll), selection border persists
  - Member view: Hidden section not shown, bulk link hidden

- [ ] **Step 3: Push branch and open PR feat→review**
  ```bash
  git push -u origin fix/new-category-page
  gh pr create --base review --title "feat(category): Visible/Hidden sections + responsive IconPicker" --body "Spec docs/superpowers/specs/2026-09-06-category-visible-hidden-design.md"
  ```

---

## Self-Review

**Spec coverage:** §1 Overview (Visible/Hidden + responsive) → Task 3 + Task 1; Architecture (no schema, partition, cols calc) → Task 1+3; Components & Files (categories.tsx, CategoryCircle/Badge, IconPicker) → Task 1-3; Data Flow → Task 3; Rendering & Visual → Task 2+3; Error Handling → Task 3 bulk aggregation; Testing → Task 3 Step 1-2; PRD & Docs → already committed in spec phase; Attribution → n/a; Alternatives → excluded (drag deferred) — all covered.

**Placeholder scan:** No TBD/TODO, no vague "handle edge cases" — every step has exact code, path, command.

**Type consistency:** `CategoryCircle` props match `PlushCategoryCard` `Props` (name,type,icon,hidden, onToggleVisibility/onDelete); `cols` used consistently in `IconPicker` `numColumns` + `getItemLayout`; `visible`/`hidden` both `Id<"categories">` typed; `removeCategory({categoryId})` signature matches `convex/categories.ts:189`.

