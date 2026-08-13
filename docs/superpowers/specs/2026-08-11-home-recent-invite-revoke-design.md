# Revoke Invite UI + Home Recent Transactions — Design Spec

> Date: 2026-08-11
> Status: Approved
> PRD: PRD_MultiMember (revoke), PRD_Transactions (list behavior)

---

## Scope

- **A**: Wire-up invite revoke in the UI — Pending Invites section on the Members screen + auto-revoke previous active invites when a new code is generated.
- **B**: Fill the static "Recent Transactions" placeholder on the Home tab with real data.

Out of scope: `invitations.revoke`/`listActive` backend already exist and are unchanged. No schema changes. No changes to the Transactions tab list.

---

## Part A — Revoke Invite

### Backend: `convex/invitations.ts` → `create`

Modify `create` so that at most one active invite exists per household:

1. After owner check, before generating/hashing/inserting the new code, query all invitations for the household via index `by_householdId` (`.collect()`).
2. For each invitation that is still active — `!revoked && expiresAt > now && useCount < maxUses` — `ctx.db.patch(invitation._id, { revoked: true, updatedAt: now })`.
3. Proceed with existing code generation + insert.

Result: generating a new code invalidates any previously shared, unredeemed code (the auto-revoke behavior).

No change to `revoke` or `listActive`.

### Frontend: `app/members.tsx`

New state/hooks:
- `const invites = useQuery(api.invitations.listActive, household?._id ? { householdId: household._id } : "skip")`
- `const revokeInvite = useMutation(api.invitations.revoke)`
- `handleRevoke(invitationId)` — `Alert.alert` confirm ("Revoke Invite" / message / Cancel + destructive Revoke) → `await revokeInvite({ invitationId })` → snackbar "Invite revoked"; catch → `setError(getConvexErrorMessage(e, "Failed to revoke invite."))`.

Rendering — a "Pending Invites" section, only when `isOwner === true` and `invites` is an array with `length > 0`:

- One card per invitation, showing:
  - "Invite code" label (code plaintext is not stored — do not attempt to show it)
  - "Created {formatDateShort(createdAt)}" and "Expires {formatDateShort(expiresAt)}"
  - A **Revoke** button (danger/secondary) invoking `handleRevoke(invitation._id)`.
- Place it after the Household card, before the member list:
  - `>1` member branch: pass as `ListHeaderComponent` to the members `FlatList`.
  - solo-member branch: render above the `EmptyState`.
- Because the query is reactive, a revoked invite disappears from the section automatically.

Import `formatDateShort` from `@/utils/date`.

---

## Part B — Home Recent Transactions

### Backend: `convex/transactions.ts` → new query `recent`

```
args: { limit: v.optional(v.number()) }
```

Logic (mirrors `list`):
1. Same auth boilerplate — identity → user → membership; `null` → return `{ transactions: null, isOwner: false }`.
2. `limit = Math.min(Math.max(args.limit ?? 5, 1), 10)`.
3. `rows = await ctx.db.query("transactions").withIndex("by_household_date", q => q.eq("householdId", membership.householdId)).order("desc").take(limit)`
4. Join `category`/`account`/`toAccount`; for non-owners skip rows whose category exists and `category.hidden` (identical to `list`).
5. Return `{ transactions, isOwner }` (already sorted newest-first).

### Frontend: `app/(tabs)/home.tsx`

- `const recentTx = useQuery(api.transactions.recent, { limit: 5 })`
- Replace the static EmptyState block under "Recent Transactions":
  - `recentTx === undefined` → small `ActivityIndicator`.
  - `recentTx.transactions === null` → defensive "You are not a member of a household." text.
  - empty array → existing `EmptyState` ("No transactions yet" / "Start by recording your first transaction").
  - else → render up to 5 `TransactionCard`s with the same props mapping as the Transactions tab (`categoryName`, `isTransfer`, `toAccountName`, `note`, `amount`, `type`, `date`), `onPress` → push `/transaction-form?id=...`.
- Add a **"See All"** link in the section header row (same pattern as "Manage" in My Accounts) → `router.push("/transactions")`.
- Keep the existing `backgroundColor: C.background` card container.

---

## Error Handling

- All user-facing failures use `getConvexErrorMessage` + `setError`/snackbar — no raw backend errors.
- Recent-transactions states mirror the Transactions tab (`undefined` loading, `null` no-household, empty EmptyState).

---

## Verification

Per AGENTS.md:
1. `npx convex codegen` (only if Convex functions change — `invitations.ts`, `transactions.ts`).
2. `npx tsc --noEmit`
3. `npm run lint` (expo lint)
