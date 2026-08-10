# Kin Finance — Architecture

> Date: 2026-08-07
> Status: Approved

---

## System Architecture

```
┌─────────────────────────────────────────────────┐
│                MOBILE APP                        │
│          Expo (React Native 0.81)                │
│                                                  │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │  Expo Router │  │  Clerk Auth (Signed In/  │  │
│  │  (Screens)  │  │  Out)                    │  │
│  └──────┬──────┘  └──────────┬───────────────┘  │
│         │                     │                  │
│         └─────────┬──────────┘                  │
│                   │                             │
│         ┌─────────▼──────────┐                  │
│         │   Convex Provider   │                  │
│         │   (real-time sync)  │                  │
│         └─────────┬──────────┘                  │
└───────────────────┼─────────────────────────────┘
                    │
         ┌──────────▼──────────┐
         │   CONVEX BACKEND     │
         │                      │
         │  ┌─────────────────┐ │
         │  │ Auth (Clerk JWT) │ │
         │  └─────────────────┘ │
         │  ┌─────────────────┐ │
         │  │ Database Tables  │ │
         │  │ users            │ │
         │  │ households       │ │
         │  │ householdMembers │ │
         │  │ invitations      │ │
         │  │ accounts         │ │
         │  │ transactions     │ │
         │  │ budgets          │ │
         │  │ categories       │ │
         │  └─────────────────┘ │
         │  ┌─────────────────┐ │
         │  │ Queries (read)   │ │
         │  │ Mutations (write)│ │
         │  └─────────────────┘ │
         └──────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo SDK 54, React Native 0.81 |
| Navigation | Expo Router 6 |
| Auth | Clerk (`@clerk/expo`) |
| Backend | Convex 1.43 |
| Animation | Reanimated 4.1 |
| Language | TypeScript 5.9 |

---

## Responsibilities

| Component | Responsibility |
|-----------|---------------|
| `app/_layout.tsx` | Root layout, ConvexProvider, ClerkProvider, root stack (forms, members) |
| `app/index.tsx` | Auth gate (redirect signed in/out) |
| `app/(tabs)/home.tsx` | Dashboard (household summary, accounts, recent transactions) |
| `app/(tabs)/settings.tsx` | Settings (Household card → members, Categories) |
| `app/onboarding.tsx` | Create/Join household flow (toggle: create vs invite code) |
| `app/members.tsx` | Household Members (name + rename, member list, generate invite FAB) |
| `lib/errors.ts` | Shared `getConvexErrorMessage` helper for user-friendly error extraction |
| `convex/schema.ts` | Database schema definition |
| `convex/*.ts` | Query/mutation functions |

---

## Data Model

### `users` table

```text
tokenIdentifier: string     // Clerk token ID
clerkUserId: string         // Clerk user ID
name: string | undefined    // display name
email: string | undefined   // email address
imageUrl: string | undefined // profile photo URL
```

**Indexes:** `by_tokenIdentifier` on `["tokenIdentifier"]`

---

### `households` table

```text
name: string                // 3-50 chars, trimmed
createdAt: number           // timestamp
updatedAt: number           // timestamp
```

---

### `householdMemberships` table

```text
householdId: id<households>
userId: id<users>
role: "owner" | "member"
```

**Indexes:** `by_householdId` on `["householdId"]`, `by_userId` on `["userId"]`

---

### `invitations` table

```text
householdId: id<households>
codeHash: string             // server-secret HMAC-SHA-256 digest of the code, never store plaintext
createdBy: id<users>         // owner who generated it
expiresAt: number            // timestamp (7 days from creation)
maxUses: number              // 1 = single-use (MVP default)
useCount: number             // redeemed count
revoked: boolean             // owner can revoke before expiry
redemptionAttempts: number   // attempts in current rate-limit window
lastAttemptAt: number        // timestamp of last redemption attempt
createdAt: number
updatedAt: number
```

**Indexes:** `by_codeHash` on `["codeHash"]` (globally unique), `by_householdId` on `["householdId"]`

**Uniqueness:** `codeHash` is globally unique across all households, not scoped per household. `invitations.redeem` requires a single unambiguous `codeHash` match and rejects redemption if more than one invitation matches. `invitations.create` retries with a newly generated hash whenever insertion hits a `codeHash` uniqueness collision.

**Rate limiting:** `invitations.redeem` enforces max 5 attempts per code per 60-second window (`redemptionAttempts`/`lastAttemptAt`). Attempts outside the window reset the counter. The counter is incremented on every attempt regardless of validity so locked codes can't be probed.

**Secret:** code hashing uses the `INVITE_SECRET` Convex environment variable (HMAC key). It must be set on the deployment; `invitations.create`/`redeem` throw `ConvexError("Server configuration error.")` if missing.

---

### `accounts` table

```text
householdId: id<households>
name: string                // e.g. "Cash", "BCA Savings"
type: "cash" | "bank" | "ewallet" | "credit_card"
balance: number             // current balance (auto-updated)
hidden: boolean             // default false, owner toggle visibility for members
createdAt: number
updatedAt: number
```

**Indexes:** `by_householdId` on `["householdId"]`

---

### `categories` table

```text
householdId: id<households>
name: string                // e.g. "Food", "Transport"
type: "income" | "expense"
hidden: boolean             // default false, owner toggle
createdAt: number
updatedAt: number
```

**Indexes:** `by_householdId` on `["householdId"]`

---

### `transactions` table

```text
householdId: id<households>
accountId: id<accounts>                 // income/expense: the account; transfer: source (from)
categoryId: id<categories> | undefined  // income/expense only; undefined for transfer
toAccountId: id<accounts> | undefined   // transfer only (destination)
amount: number                          // income: > 0; expense: < 0; transfer: > 0 (magnitude)
type: "income" | "expense" | "transfer"
note: string | undefined                // optional description
date: number                            // transaction date timestamp
createdBy: id<users>                    // who created this
updatedBy: id<users>                    // who last updated
createdAt: number
updatedAt: number
```

**Invariant:**
- `amount > 0` when `type = "income"`, `amount < 0` when `type = "expense"`, `amount > 0` (magnitude) when `type = "transfer"`.
- Category type must match transaction type (income category for income transactions, expense category for expense transactions).
- Transfers have no category and must have `toAccountId !== accountId`.

**Indexes:** `by_householdId` on `["householdId"]`, `by_household_date` on `["householdId", "date"]`, `by_accountId` on `["accountId"]`, `by_toAccountId` on `["toAccountId"]`, `by_categoryId` on `["categoryId"]`

---

### `budgets` table

```text
householdId: id<households>
categoryId: id<categories>
periodStart: number          // first day of month (epoch ms), canonical monthly identity
amount: number               // budget limit for the period
createdBy: id<users>
updatedBy: id<users>
createdAt: number
updatedAt: number
```

**Indexes:** `by_householdId` on `["householdId"]`, `by_categoryId` on `["categoryId"]`, `by_household_period` on `["householdId", "periodStart"]`

**Timezone policy:** Month boundaries follow a single app-wide policy (UTC). `periodStart` is always normalized server-side to the first day of the UTC month (epoch ms at 00:00:00 UTC), applied identically in both `budgets.create` and `budgets.list`.

**Invariant:** Unique constraint on the full `(householdId, categoryId, periodStart)` identity — one budget per category per month. The `by_household_period` index is a lookup optimization only and must not be treated as sufficient for uniqueness; uniqueness checks always use the complete identity.

---

## Convex Functions

### Queries (read)

| Function | Args | Returns | Notes |
|----------|------|---------|-------|
| `households.getActive` | - | Household \| null | Current user's household |
| `households.listMembers` | { householdId } | `{ householdId, members: { userId, name?, email?, imageUrl?, role }[] }` \| null | Members of the given household (owner + members); `null` if signed out, not a member of that household, or the household does not exist |
| `accounts.list` | - | Account[] | Accounts visible to current user |
| `categories.list` | - | Category[] | Categories visible to current user |
| `transactions.list` | { startDate, endDate } | Transaction[] | Filter by date range |
| `budgets.list` | { periodStart: number } | Budget[] | Budgets for household in given month |
| `users.getMe` | - | User \| null | Current user profile |
| `invitations.listActive` | { householdId } | Invitation[] | Active (non-revoked, unexpired, unused) invitations for a household; `[]` if signed out or not a member |

---

### Mutations (write)

| Function | Args | Notes |
|----------|------|-------|
| `households.create` | { name } | Onboarding, creates + assigns owner |
| `households.update` | { householdId, name } | Owner only |
| `households.removeMember` | { householdId, userId } | Owner only; rejects removing the owner; deletes the membership, revoking access immediately; the member's transactions and budgets are retained |
| `invitations.create` | - | Generate code, hash it, store with 7-day expiry, single-use |
| `invitations.revoke` | { invitationId } | Owner only, sets revoked = true |
| `invitations.redeem` | { code } | Signed-in only; atomic `by_userId` check rejects existing household members, then: check hash, expiry, revoked, useCount < maxUses, insert membership, increment useCount |
| `accounts.create` | { name, type, openingBalance?, hidden? } | Atomic: create account with zero balance → if balance != 0, post signed initial transaction via transactions.create |
| `accounts.update` | { accountId, name?, type?, hidden? } | Owner only, toggle visibility |
| `accounts.remove` | { accountId } | Owner only; reject if transactions reference this account (as accountId or toAccountId) |
| `accounts.updateBalance` | { accountId, amount, operation } | Internal: adjust balance |
| `categories.create` | { name, type } | Owner only |
| `categories.update` | { categoryId, name?, type?, hidden? } | Owner only, toggle visibility; reject type change if linked tx/budgets exist |
| `categories.delete` | { categoryId } | Owner only; reject if transactions or budgets reference this category |
| `transactions.create` | { accountId, categoryId?, toAccountId?, amount, type, note?, date } | Signed amount: +income, -expense, +transfer magnitude; category type must match (income/expense); transfer: toAccountId != accountId, no category |
| `transactions.update` | { transactionId, ...fields } | Auto-update balance(s) (reverse old + apply new); category type must match (income/expense); member cannot reassign to hidden account |
| `transactions.delete` | { transactionId } | Auto-update account balance(s) (reverse) |
| `budgets.create` | { categoryId, amount, periodStart } | Member can create; category must be expense type; unique per (household, category, month) |
| `budgets.update` | { budgetId, amount } | Member can update |
| `budgets.delete` | { budgetId } | Member can delete |

---

## Account Creation Flow (Atomic)

1. Insert `accounts` with `balance: 0`.
2. If opening balance `!= 0`:
   - Create initial transaction via `transactions.create` with:
     - `amount`: signed (positive for income, negative for expense)
     - `type`: "income" if amount > 0, "expense" if amount < 0
     - `categoryId`: the reserved system-managed "Initial Balance" category matching the type
     - `note`: "Initial balance"
   - The normal `transactions.create` balance update applies the signed amount to the account.
3. Account balance reflects the opening balance after step 2.

**Opening-balance category contract:** Each household has two reserved, system-managed categories named "Initial Balance" — one of type `income` and one of type `expense` — created automatically with the household. The `categoryId` is selected by the signed opening amount: the income category when amount > 0, the expense category when amount < 0. These categories are protected and excluded from normal category management: `categories.create` cannot duplicate them, `categories.update`/`categories.delete` reject renaming, hiding, retyping, or deleting them, and they never appear in user-facing category selection screens. They are exempt from the "reject delete if referenced" guard because initial-balance transactions legitimately reference them. The transaction amount/type invariant still applies to opening transactions.

This ensures the opening balance is applied exactly once and goes through the same balance update path as all other transactions.

---

## Account Balance Auto-Update Logic

```text
income/expense (amount signed):
  on create:   account.balance += amount
  on update:   if accountId changed:
                 oldAccount.balance -= oldAmount      // reverse from previous account
                 newAccount.balance += newAmount      // apply to new account
               else (same account):
                 account.balance += (newAmount - oldAmount)  // net adjustment
  on delete:   account.balance -= amount

transfer (amount = positive magnitude):
  on create:   from.balance -= amount
               to.balance += amount
  on update:   reverse old:  oldFrom.balance += oldAmount; oldTo.balance -= oldAmount
               apply new:    newFrom.balance -= newAmount; newTo.balance += newAmount
  on delete:   from.balance += amount
               to.balance -= amount
```

All operations within one mutation — atomic.

---

## Permission Matrix

| Action | Owner | Member |
|--------|:-----:|:------:|
| View Household | ✅ | ✅ |
| Rename Household | ✅ | ❌ |
| Invite Member | ✅ | ❌ |
| Create Account | ✅ | ❌ |
| Edit Account | ✅ | ❌ |
| Delete Account | ✅ | ❌ |
| Toggle Account Visibility | ✅ | ❌ |
| View Account Balance | ✅ | Hanya jika visible |
| Select Account for new Transaction | ✅ | Hanya jika visible |
| View/Create/Edit/Delete Transaction | ✅ | Hanya jika category visible |
| Edit existing Transaction on hidden Account | ✅ | ✅ (existing only, cannot reassign to hidden) |
| Create/Reassign Transfer | ✅ | ✅ (both accounts visible) |
| Edit existing Transfer on hidden Account | ✅ | ✅ (existing only, cannot reassign to hidden) |
| Create Category | ✅ | ❌ |
| Edit Category | ✅ | ❌ |
| Delete Category | ✅ | ❌ |
| Toggle Category Visibility | ✅ | ❌ |
| View/Create/Edit/Delete Transaction (per category) | ✅ | Hanya jika category visible |
| View/Create/Edit/Delete Budget | ✅ | ✅ |
| View Budget (hidden category) | ✅ | ✅ |

---

## Visibility Rules

- **Account hidden:** balance tidak terlihat member. Member cannot select or reassign transactions to this account. Member CAN edit existing transactions that already reference this account.
- **Transfer on hidden account:** member cannot create or reassign a transfer involving a hidden account, but CAN view/edit/delete an existing transfer that touches one.
- **Category hidden:** transaksi atas kategori itu sepenuhnya tidak terlihat dan tidak tersentuh member. Transfers have no category and are unaffected.

---

## Error Handling Convention

All backend handlers require sign-in via `ctx.auth.getUserIdentity()` and throw `ConvexError` with a **plain-string, user-friendly message**:

```ts
throw new ConvexError("Invalid invite code.");
throw new ConvexError("You are not signed in.");
```

### Client-side extraction

Convex serializes `ConvexError` over the network; the client receives an error where:

- `error.data` = the original plain-string message (e.g. `"Invalid invite code."`)
- `error.message` = a technical wrapper (`"[Request ID: ...] Server Error"`)

Client code must **never display `error.message` directly** — it is technical. Use the shared helper `getConvexErrorMessage(error, fallback)` from `lib/errors.ts` in every `catch` block:

```ts
import { getConvexErrorMessage } from "@/lib/errors";

catch (e: any) {
  setError(getConvexErrorMessage(e, "Failed to join household. Please try again."));
}
```

Extraction order in `getConvexErrorMessage`:
1. `error.data` (plain string) — server's user-friendly message
2. `error.data.message` (string) — for object-shaped ConvexError data
3. `error.message` — generic JS Error message
4. First stack line — last resort
5. Provided fallback — final default

The fallback must always be a user-friendly sentence ("Failed to ..."). `getConvexErrorMessage` is used in all mutation catch blocks (onboarding, members, and any screen invoking a Convex mutation). Server-side `[CONVEX M(...)] ... Server Error` console output for thrown errors is Convex's default observability logging and is expected, not a bug.

---

## Invitation Security Model

- Codes are cryptographically random (8 alphanumeric chars, ~41 bits entropy).
- Only server-secret HMAC-SHA-256 digests (keyed with a server secret) are stored — plaintext and unkeyed hashes are never persisted.
- Codes expire after 7 days.
- Codes are single-use (maxUses = 1).
- Owner can revoke unused codes.
- Redemption is atomic: hash → lookup → validate (expiry, revoked, useCount) → insert membership + increment useCount.
- Rate limiting: max 5 redemption attempts per code per minute, plus redemption limits per actor (userId), IP, and device.

---

## User Flows

### Flow 1: First Login (Onboarding)

```text
App Open
↓
Clerk Auth Gate
↓ (signed in)
Check household (households.getActive)
↓ (null)
Onboarding Screen
↓
Create Household (households.create)
↓ (success)
Navigate to Home
```

### Flow 2: Returning User

```text
App Open
↓
Clerk Auth Gate
↓ (signed in)
Check household (households.getActive)
↓ (found)
Home Screen (dashboard)
```

### Flow 3: Owner Creates Transaction

```text
Home Screen
↓
Select Account
↓
Add Transaction → fill amount, category, date, note
↓
Submit (transactions.create)
↓
Account balance auto-updated
↓
Return to Home
```

### Flow 4: Owner Manages Category Visibility

```text
Settings → Categories
↓
Select Category → toggle "Visible to members"
↓
Save (categories.update)
↓
Members can no longer see/use that category
```

### Flow 5: Owner Invites Member

```text
Settings → Household Members
↓
Tap "Generate Invite Code"
↓
Server: generate random code, hash (server-secret HMAC-SHA-256), store digest + expiry (7 days) + maxUses (1)
↓
Display code to owner (plaintext, shown once)
↓
Owner shares code via copy/share
```

### Flow 6: Member Joins Household

```text
App Open → Onboarding
↓
Tap "Join with Invite Code"
↓
Enter code → invitations.redeem
↓
Server: hash input, lookup by codeHash
  → check: not expired
  → check: not revoked
  → check: useCount < maxUses
  → atomic: insert householdMembership + increment useCount
↓
Member added to household
↓
Navigate to Home (shared household)
```

### Flow 7: Account Opening Balance

```text
Create Account → fill name, type, initial balance
↓
Submit (accounts.create)
↓
Auto-create "initial balance" transaction
↓
Account appears with balance
```
