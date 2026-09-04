# Household Delete / Leave / Transfer Ownership — Design

> Date: 2026-09-04
> Status: Approved (Opsi A — 3 mutation terpisah)
> Request: owner delete hard wipe household; member delete = leave (hapus membership saja); opsi wariskan ownership
> Source: `convex/schema.ts`, `convex/households.ts:342`, `app/(tabs)/settings.tsx`, `app/members.tsx`

## 1. Overview

Tambah fitur hapus/keluar household dengan permission branching:

- **Owner Delete** = hard delete cascade seluruh data scoped ke `householdId` (households, householdMemberships, accounts, categories, transactions, budgets, invitations, periodBalances). Owner dan semua member kehilangan akses, bisa bikin/join household baru (one-household-per-user tetap ditegakkan).
- **Member Leave** = hapus membership caller saja; transaksi/budget yang dibuat member tetap di household (audit trail). Caller menjadi household-free.
- **Transfer Ownership** = owner tunjuk member lain sebagai owner baru, lalu owner lama bisa leave atau tetap member (design pilih: transfer tanpa auto-leave, caller decide next step).

Tombol danger zone di **Settings** dan **Members** (Household section), label role-aware: "Delete Household" (owner) vs "Leave Household" (member). Owner flow tawarkan dialog opsi Transfer atau Delete.

## 2. Architecture

- **No schema migration.** Semua table sudah ada indeks `by_householdId` / `by_household_type`. Hapus via query+delete dalam mutation.
- **3 mutations di `convex/households.ts`:**
  1. `deleteHousehold({ householdId })` — owner only, hard delete cascade.
  2. `leaveHousehold({ householdId })` — member only (owner blocked unless sole-member case, throw guidance).
  3. `transferOwnership({ householdId, newOwnerUserId })` — owner only.
- Helper reuse: `getUserAndMembership`, `requireOwner` dari `convex/helpers.ts:6`. Tambah internal helper `deleteHouseholdCascade(ctx, householdId)` untuk reuse.
- Cascade order (avoid orphan FK visibility): transactions → budgets → periodBalances → accounts → categories → invitations → householdMemberships → households. Urutan tidak strict di Convex tapi delete transaksi dulu menghindari guard `accounts.remove`/`categories.remove` yang cek referencing tx (tidak relevan saat wipe, tapi konsisten).
- Convex mutation limit: collect via `withIndex("by_householdId", ...).collect()` per table (max ~10k tx). Jika >10k, loop `take(100)` batched delete. MVP tetap `collect()` + for-await delete; tambah guard `Too many` jika >10k sama seperti `periodBalances`.
- **Auth:** semua mutation require `ctx.auth.getUserIdentity()` + `getUserAndMembership`; throw `ConvexError` jika not signed in / not member / household mismatch.

## 3. Components & Files

### New / Modified Backend
- `convex/households.ts` — tambah 3 exports + helper `async function cascadeDelete(ctx, householdId)`.
- `convex/helpers.ts` — optional `requireMember` helper (inverse of requireOwner) jika perlu.
- Tests: `tests/households.deleteLeaveTransfer.test.ts` (convex-test, 3 suites).

### Frontend Modified
- `app/(tabs)/settings.tsx` — tambah Danger Zone card di bawah Categories (sebelum Sign Out). Detect `isOwner` via `members`+`me`. Button `variant="danger"`: owner → "Delete Household", member → "Leave Household". Press → Alert/dialog branching.
- `app/members.tsx` — tambah Danger Zone di bawah timezone/rename section (atau setelah FlatList). Same role-aware button.
- `components/ConfirmDialog.tsx` reuse Alert (native) — tidak butuh komponen baru.
- Owner delete flow: Alert "Delete Household?" → 3 actions: Cancel, Transfer Ownership, Delete All Data. Transfer → picker member list (SelectField atau Alert list) → `transferOwnership` → Snackbar success. Delete → second confirm "This will permanently delete all data for all members" → `deleteHousehold` → Snackbar + redirect `router.replace("/onboarding")`.
- Member leave flow: Alert "Leave Household? You will lose access..." → Confirm → `leaveHousehold` → Snackbar + redirect `/onboarding`.

### Out of scope
- Soft delete / archive flag.
- Auto-transfer on owner leave tanpa explicit pick.
- Penghapusan transaksi/budget milik member yang leave.

## 4. Data Flow

```
Client (Settings/Members) → role check (isOwner)
  owner: Alert → [Transfer] → transferOwnership(householdId, newOwnerUserId) → patch memberships
         [Delete]  → deleteHousehold(householdId) → cascadeDelete → null household → redirect onboarding
  member: Alert → leaveHousehold(householdId) → delete own membership → redirect onboarding
```

`getActive` setelah delete/leave return null → existing `useEffect(()=>{if(household===null) router.replace("/onboarding")})` di settings/members sudah handle redirect.

## 5. Error Handling & Edge Cases

- Owner `deleteHousehold` bukan owner → `You are not the owner of this household.`
- Member `leaveHousehold` tapi role owner → `Owners cannot leave. Transfer ownership or delete the household.` (block).
- `transferOwnership` target bukan member / owner sendiri / household mismatch → `Member not found.` / `Cannot transfer to yourself.`
- `transferOwnership` caller bukan owner → owner-only error.
- `householdId` mismatch (caller membership.householdId !== args.householdId) → `You are not a member of this household.`
- Sudah tidak punya household (membership null) → `You are not a member of a household.`
- Concurrency: jika member sudah di-remove owner sebelum leave, targetMembership null → throw Member not found.
- Hard delete idempotent: setelah household dihapus, query `households.getActive` null, `listMembers` null.

## 6. UI/UX Details

- Danger Zone: card `border C.error` + `Feather alert-triangle` + title "Danger Zone" `text C.error`. Button full-width `variant danger` (red bg). Icon `trash-2` / `log-out`.
- Owner Settings: tampilkan `Delete Household` + subtitle "Permanently delete all household data for everyone".
- Member Settings: `Leave Household` + subtitle "You will lose access to all household data".
- Members screen: same card di bawah Household name/timezone. Jika `isOwner` false, button Leave; jika true, button Delete (dengan opsi transfer).
- Timezone/BalanceMode section tetap read-only untuk member (sudah ada).
- Haptics: `hapticSuccess` on delete/leave/transfer, `hapticError` on failure via `lib/haptics.ts`.
- Snackbar via `useSnackbar().show` + `getConvexErrorMessage`.

## 7. Testing & Validation

- New `tests/households.deleteLeaveTransfer.test.ts`:
  1. owner delete cascade — seed household + 2 accounts + 2 categories + tx + budgets + periodBalances + invite + 2memberships → owner delete → assert households 0, accounts 0, categories 0, transactions 0, budgets 0, periodBalances 0, invitations 0, memberships 0.
  2. owner delete blocked for member.
  3. member leave — remove only caller membership, other data tetap 1 household, 1 membership tersisa, transaksi tetap.
  4. member leave blocked for owner.
  5. transferOwnership — owner→member swap roles, both memberships remain, data intact.
  6. transfer target not member → throw.
  7. leave after transfer — old owner (now member) bisa leave.
- Run: `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest). `npx convex codegen` sebelum typecheck jika schema berubah (tidak).
- Manual: Settings danger zone tampil sesuai role, Members danger zone sama, owner transfer picker, delete confirm kedua, redirect onboarding after success, `getActive` null, coba bikin household baru setelah delete/leave berhasil.

## 8. PRD & Docs Impact

- §2.1 Household row update: tambah Remove Member → Delete/Leave/Transfer (owner delete hard, member leave, transfer ownership).
- §2.3 Permission Matrix tambah: Delete Household (owner ✅ member ❌), Leave Household (owner ❌ member ✅), Transfer Ownership (owner ✅).
- §3.2 Household tambah subsection Delete/Leave/Transfer.
- §8 Change Log dated 2026-09-04.

## 9. Alternatives Considered

- B Single mutation `deleteOrLeave` — ditolak karena branching overload, error kurang spesifik.
- C Force transfer jika ada member — ditolak karena batasi owner yang memang ingin wipe total; opsi A beri kebebasan owner pilih Transfer ATAU Delete.
