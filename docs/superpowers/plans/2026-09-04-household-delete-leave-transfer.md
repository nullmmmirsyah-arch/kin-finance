# Household Delete / Leave / Transfer Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement owner hard-delete cascade, member leave (remove membership only), and transfer ownership for household per Opsi A design.

**Architecture:** 3 new Convex mutations in `convex/households.ts` sharing a `cascadeDelete` helper; frontend danger zone in Settings + Members with role-aware Alert flows; existing `getActive` null redirect reused.

**Tech Stack:** Convex 1.43, convex-test 0.0.55, Vitest 4, Expo Router 6, Clerk auth, NativeWind

## Global Constraints

- Expo SDK 54 — use `npx expo install <pkg>` never bare npm.
- After `convex/*.ts` change run `npx convex codegen` then `npx tsc --noEmit`.
- Verify with `npm run lint` and `npm test` (vitest) when touching pure utils/Convex.
- Use NativeWind `className` not `StyleSheet.create`; theme via `useThemeColors()` not hardcode.
- All Convex handlers require `ctx.auth.getUserIdentity()` and throw `ConvexError`.
- One household per user; amounts signed; owner/member matrix in PRD §2.3.

---

### Task 1: Backend mutations — deleteHousehold / leaveHousehold / transferOwnership

**Files:**
- Modify: `convex/households.ts:1-391` (add 3 mutations + cascade helper)
- Modify: `convex/helpers.ts:1-88` (optional requireMember helper if needed)
- Test: `tests/households.deleteLeaveTransfer.test.ts` (new)

**Interfaces:**
- Consumes: `getUserAndMembership(ctx)`, `requireOwner(membership)`, `Doc`, `Id`
- Produces: `api.households.deleteHousehold({ householdId }) => null`, `api.households.leaveHousehold({ householdId }) => null`, `api.households.transferOwnership({ householdId, newOwnerUserId }) => { oldOwnerId, newOwnerId }`

- [ ] **Step 1: Write failing test for cascade delete, leave, transfer**

```ts
// tests/households.deleteLeaveTransfer.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
const OWNER_TOKEN="owner|hh-del-test"; const MEMBER_TOKEN="member|hh-del-test";
describe("households delete/leave/transfer", () => {
  let t=convexTest(schema, import.meta.glob("../convex/**/*.*s"));
  beforeEach(()=>{t=convexTest(schema, import.meta.glob("../convex/**/*.*s"));});
  async function seed(ctx:any){
    const householdId=await ctx.db.insert("households",{name:"HH",createdAt:1,updatedAt:1});
    const ownerId=await ctx.db.insert("users",{tokenIdentifier:OWNER_TOKEN, clerkUserId:"c-owner"});
    const memberId=await ctx.db.insert("users",{tokenIdentifier:MEMBER_TOKEN, clerkUserId:"c-member"});
    await ctx.db.insert("householdMemberships",{householdId,userId:ownerId,role:"owner"});
    await ctx.db.insert("householdMemberships",{householdId,userId:memberId,role:"member"});
    const acc=await ctx.db.insert("accounts",{householdId,name:"Cash",type:"cash",balance:0,hidden:false,createdAt:1,updatedAt:1});
    const cat=await ctx.db.insert("categories",{householdId,name:"Food",type:"expense",hidden:false,createdAt:1,updatedAt:1});
    await ctx.db.insert("transactions",{householdId,accountId:acc,categoryId:cat,amount:-100,type:"expense",date:1,createdBy:ownerId,updatedBy:ownerId,createdAt:1,updatedAt:1});
    await ctx.db.insert("budgets",{householdId,categoryId:cat,periodStart:1,amount:1000,createdBy:ownerId,updatedBy:ownerId,createdAt:1,updatedAt:1});
    await ctx.db.insert("periodBalances",{householdId,periodType:"monthly",periodStart:1,periodEnd:2,income:0,expense:100,openingBalance:0,closingBalance:-100,createdAt:1,updatedAt:1});
    await ctx.db.insert("invitations",{householdId,codeHash:"abc",createdBy:ownerId,expiresAt:Date.now()+100000,maxUses:1,useCount:0,revoked:false,redemptionAttempts:0,lastAttemptAt:0,createdAt:1,updatedAt:1});
    return {householdId, ownerId, memberId};
  }
  it("owner can hard delete cascade", async()=>{
    const owner=t.withIdentity({tokenIdentifier:OWNER_TOKEN,subject:"owner"});
    const {householdId}=await t.run(async(ctx)=>seed(ctx));
    await owner.mutation(api.households.deleteHousehold,{householdId});
    const counts=await t.run(async(ctx)=>{
      return {
        hh: (await ctx.db.query("households").collect()).length,
        mem: (await ctx.db.query("householdMemberships").collect()).length,
        acc: (await ctx.db.query("accounts").collect()).length,
        cat: (await ctx.db.query("categories").collect()).length,
        tx: (await ctx.db.query("transactions").collect()).length,
        bud: (await ctx.db.query("budgets").collect()).length,
        per: (await ctx.db.query("periodBalances").collect()).length,
        inv: (await ctx.db.query("invitations").collect()).length,
      };
    });
    expect(counts).toEqual({hh:0,mem:0,acc:0,cat:0,tx:0,bud:0,per:0,inv:0});
  });
  it("member can leave (only own membership deleted)", async()=>{
    const member=t.withIdentity({tokenIdentifier:MEMBER_TOKEN,subject:"member"});
    const {householdId}=await t.run(async(ctx)=>seed(ctx));
    await member.mutation(api.households.leaveHousehold,{householdId});
    const after=await t.run(async(ctx)=>({mem:(await ctx.db.query("householdMemberships").collect()).length, hh:(await ctx.db.query("households").collect()).length, tx:(await ctx.db.query("transactions").collect()).length}));
    expect(after).toEqual({mem:1, hh:1, tx:1});
  });
  it("transferOwnership swaps roles", async()=>{
    const owner=t.withIdentity({tokenIdentifier:OWNER_TOKEN,subject:"owner"});
    const {householdId,memberId}=await t.run(async(ctx)=>seed(ctx));
    await owner.mutation(api.households.transferOwnership,{householdId, newOwnerUserId: memberId});
    const roles=await t.run(async(ctx)=> (await ctx.db.query("householdMemberships").collect()).map(m=>m.role).sort());
    expect(roles).toEqual(["member","owner"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/households.deleteLeaveTransfer.test.ts`
Expected: FAIL — `api.households.deleteHousehold is not a function`

- [ ] **Step 3: Write minimal implementation in convex/households.ts**

Add after `removeMember` export (~line 391):

```ts
async function cascadeDelete(ctx:any, householdId: Id<"households">){
  const tables: Array<"transactions"|"budgets"|"periodBalances"|"accounts"|"categories"|"invitations"|"householdMemberships"> = ["transactions","budgets","periodBalances","accounts","categories","invitations","householdMemberships"];
  for(const table of tables){
    const docs = await ctx.db.query(table).withIndex("by_householdId" as any, (q:any)=>q.eq("householdId", householdId)).collect();
    for(const d of docs) await ctx.db.delete(d._id);
  }
  // households last
  await ctx.db.delete(householdId);
}

export const deleteHousehold = mutation({
  args:{ householdId: v.id("households") },
  handler: async(ctx, args)=>{
    const {user, membership}= await getUserAndMembership(ctx);
    requireOwner(membership);
    if(membership.householdId !== args.householdId) throw new ConvexError("You are not the owner of this household.");
    const household = await ctx.db.get(args.householdId);
    if(!household) throw new ConvexError("Household not found.");
    await cascadeDelete(ctx, args.householdId);
    return null;
  }
});

export const leaveHousehold = mutation({
  args:{ householdId: v.id("households") },
  handler: async(ctx, args)=>{
    const {user, membership}= await getUserAndMembership(ctx);
    if(membership.householdId !== args.householdId) throw new ConvexError("You are not a member of this household.");
    if(membership.role === "owner") throw new ConvexError("Owners cannot leave. Transfer ownership or delete the household.");
    await ctx.db.delete(membership._id);
    return null;
  }
});

export const transferOwnership = mutation({
  args:{ householdId: v.id("households"), newOwnerUserId: v.id("users") },
  handler: async(ctx, args)=>{
    const {membership}= await getUserAndMembership(ctx);
    requireOwner(membership);
    if(membership.householdId !== args.householdId) throw new ConvexError("You are not the owner of this household.");
    if(args.newOwnerUserId === membership.userId) throw new ConvexError("Cannot transfer to yourself.");
    const target = await ctx.db.query("householdMemberships").withIndex("by_householdId",(q)=>q.eq("householdId",args.householdId)).filter((q)=>q.eq(q.field("userId"), args.newOwnerUserId)).first();
    if(!target) throw new ConvexError("Member not found.");
    if(target.role === "owner") throw new ConvexError("Target is already owner.");
    await ctx.db.patch(membership._id,{role:"member"});
    await ctx.db.patch(target._id,{role:"owner"});
    return {oldOwnerId: membership.userId, newOwnerId: target.userId};
  }
});
```

Handle `transactions` alternative index `by_household_date` fallback if `by_householdId` missing for that table — use `by_householdId` where exists, for transactions use `by_householdId`.

- [ ] **Step 4: Run codegen and tests**

Run: `npx convex codegen && npx tsc --noEmit && npm test -- tests/households.deleteLeaveTransfer.test.ts`
Expected: PASS 3/3

- [ ] **Step 5: Commit**

```bash
git add convex/households.ts tests/households.deleteLeaveTransfer.test.ts
git commit -m "feat(households): add delete/leave/transferOwnership mutations with cascade"
```

---

### Task 2: Frontend Danger Zone — Settings + Members screens

**Files:**
- Modify: `app/(tabs)/settings.tsx:1-360` (add danger zone card + handlers)
- Modify: `app/members.tsx:1-462` (add danger zone + transfer picker)
- Test: manual + `npx tsc --noEmit`

**Interfaces:**
- Consumes: `api.households.deleteHousehold`, `api.households.leaveHousehold`, `api.households.transferOwnership`, `api.households.listMembers`, `api.households.getActive`
- Produces: role-aware UI, Alert flows, redirect to `/onboarding`

- [ ] **Step 1: Add danger zone UI skeleton (no logic) test fails**

Write interim check: `grep -r "Danger Zone" app/(tabs)/settings.tsx` should find text.

- [ ] **Step 2: Implement Settings danger zone**

In `settings.tsx` after Categories card, before Account/Sign Out:

```tsx
const deleteHousehold = useMutation(api.households.deleteHousehold);
const leaveHousehold = useMutation(api.households.leaveHousehold);
const [isDeleting,setIsDeleting]=useState(false);

const handleDanger = useCallback(()=>{
  if(!household?._id) return;
  if(isOwner){
    Alert.alert("Delete Household?","Permanently delete all data for everyone?",[
      {text:"Cancel",style:"cancel"},
      {text:"Transfer Ownership",onPress:()=> router.push("/members")},
      {text:"Delete All",style:"destructive",onPress: async()=>{
        Alert.alert("Confirm Delete","This cannot be undone.",[
          {text:"Cancel",style:"cancel"},
          {text:"Delete",style:"destructive",onPress: async()=>{
            setIsDeleting(true);
            try{ await deleteHousehold({householdId:household._id}); show("Household deleted"); router.replace("/onboarding"); void hapticSuccess();}
            catch(e){show(getConvexErrorMessage(e,"Failed to delete."));} finally{setIsDeleting(false);}
          }}
        ]);
      }}
    ]);
  } else {
    Alert.alert("Leave Household?","You will lose access to all data.",[
      {text:"Cancel",style:"cancel"},
      {text:"Leave",style:"destructive",onPress: async()=>{
        setIsDeleting(true);
        try{ await leaveHousehold({householdId:household._id}); show("Left household"); router.replace("/onboarding"); void hapticSuccess();}
        catch(e){show(getConvexErrorMessage(e,"Failed to leave."));} finally{setIsDeleting(false);}
      }}
    ]);
  }
},[household, isOwner, deleteHousehold, leaveHousehold]);

// JSX danger card:
<View style={[Shadow.card,{borderRadius:Radius.md,backgroundColor:C.background,borderWidth:1,borderColor:C.error}]} className="mt-6 px-4 py-4">
  <View className="flex-row items-center gap-2"><Feather name="alert-triangle" size={18} color={C.error}/><Text style={{color:C.error}} className="text-sm font-semibold">Danger Zone</Text></View>
  <Text className="mt-1 text-xs text-text-secondary dark:text-text-secondary-dark">{isOwner?"Permanently delete all household data for everyone.":"You will lose access to all household data."}</Text>
  <View className="mt-3"><Button title={isOwner?"Delete Household":"Leave Household"} variant="danger" onPress={handleDanger} loading={isDeleting} disabled={isDeleting || isOwner===undefined}/></View>
</View>
```

- [ ] **Step 3: Implement Members danger zone + transfer picker**

In `members.tsx` after timezone section, similar danger card. For transfer: when owner taps Transfer, show member picker via `Alert` list or `SelectField`. Use `transferOwnership` mutation.

```tsx
const transferOwnership = useMutation(api.households.transferOwnership);
// inside danger handler for owner: show member choice
const handleTransfer = (newOwnerId: Id<"users">)=>{
  Alert.alert("Transfer ownership?",`Make ${name} the new owner?`,[
    {text:"Cancel",style:"cancel"},
    {text:"Transfer",onPress: async()=>{
      try{ await transferOwnership({householdId:household._id, newOwnerUserId:newOwnerId}); show("Ownership transferred"); void hapticSuccess();}
      catch(e){show(getConvexErrorMessage(e,"Failed to transfer."));}
    }}
  ]);
};
```

- [ ] **Step 4: Verify typecheck and lint**

Run: `npx convex codegen && npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/settings.tsx app/members.tsx
git commit -m "feat(ui): danger zone delete/leave/transfer in Settings+Members"
```

---

### Task 3: PRD update + final verification

**Files:**
- Modify: `docs/Product Requirement Document/PRD.md` (add delete/leave/transfer rows, permission matrix, §3.2)
- Test: `npm test` full suite

**Interfaces:**
- Consumes: design doc
- Produces: PRD §2.1, §2.3, §3.2 updated, §8 Change Log entry

- [ ] **Step 1: Update PRD tables**

Add to §2.1 Household row: `delete (owner hard cascade), leave (member remove membership), transferOwnership (owner → member)`. Update §2.3 matrix 3 rows. Update §3.2 with Delete/Leave/Transfer subsection.

- [ ] **Step 2: Run full verification**

Run: `npx tsc --noEmit ; npm run lint ; npm test`
Expected: all PASS (new test 7 cases including blocked cases)

- [ ] **Step 3: Commit**

```bash
git add docs/Product\ Requirement\ Document/PRD.md
git commit -m "docs(prd): household delete/leave/transfer"
```

