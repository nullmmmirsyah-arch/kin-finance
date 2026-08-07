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
| `app/_layout.tsx` | Root layout, ConvexProvider, ClerkProvider |
| `app/index.tsx` | Auth gate (redirect signed in/out) |
| `app/home.tsx` | Dashboard (household summary, sign out) |
| `app/onboarding.tsx` | Create household flow |
| `convex/schema.ts` | Database schema definition |
| `convex/*.ts` | Query/mutation functions |

---

## Data Model

### `users` table

```
tokenIdentifier: string     // Clerk token ID
clerkUserId: string         // Clerk user ID
name: string | undefined    // display name
email: string | undefined   // email address
imageUrl: string | undefined // profile photo URL
```

**Indexes:** `by_tokenIdentifier` on `["tokenIdentifier"]`

---

### `households` table

```
name: string                // 3-50 chars, trimmed
createdAt: number           // timestamp
updatedAt: number           // timestamp
```

---

### `householdMemberships` table

```
householdId: id<households>
userId: id<users>
role: "owner" | "member"
```

**Indexes:** `by_householdId` on `["householdId"]`, `by_userId` on `["userId"]`

---

### `invitations` table

```
householdId: id<households>
codeHash: string             // SHA-256 hash of the code, never store plaintext
createdBy: id<users>         // owner who generated it
expiresAt: number            // timestamp (7 days from creation)
maxUses: number              // 1 = single-use (MVP default)
useCount: number             // redeemed count
revoked: boolean             // owner can revoke before expiry
createdAt: number
```

**Indexes:** `by_codeHash` on `["codeHash"]`, `by_householdId` on `["householdId"]`

---

### `accounts` table

```
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

```
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

```
householdId: id<households>
accountId: id<accounts>
categoryId: id<categories>
amount: number              // signed: positive = income, negative = expense; must agree with type
type: "income" | "expense"
note: string | undefined    // optional description
date: number                // transaction date timestamp
createdBy: id<users>        // who created this
updatedBy: id<users>        // who last updated
createdAt: number
updatedAt: number
```

**Invariant:** `amount > 0` when `type = "income"`, `amount < 0` when `type = "expense"`. Category type must match transaction type (income category for income transactions, expense category for expense transactions).

**Indexes:** `by_householdId` on `["householdId"]`, `by_accountId` on `["accountId"]`, `by_categoryId` on `["categoryId"]`, `by_date` on `["date"]`

---

### `budgets` table

```
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

**Invariant:** Unique constraint on `(householdId, categoryId, periodStart)` — one budget per category per month.

---

## Convex Functions

### Queries (read)

| Function | Args | Returns | Notes |
|----------|------|---------|-------|
| `households.getActive` | - | Household \| null | Current user's household |
| `accounts.list` | - | Account[] | Accounts visible to current user |
| `categories.list` | - | Category[] | Categories visible to current user |
| `transactions.list` | { startDate, endDate } | Transaction[] | Filter by date range |
| `transactions.listByAccount` | { accountId } | Transaction[] | Transactions for specific account |
| `budgets.list` | { periodStart: number } | Budget[] | Budgets for household in given month |
| `users.getMe` | - | User \| null | Current user profile |

---

### Mutations (write)

| Function | Args | Notes |
|----------|------|-------|
| `households.create` | { name } | Onboarding, creates + assigns owner |
| `households.update` | { householdId, name } | Owner only |
| `invitations.create` | - | Generate code, hash it, store with 7-day expiry, single-use |
| `invitations.revoke` | { invitationId } | Owner only, sets revoked = true |
| `invitations.redeem` | { code } | Atomic: check hash, expiry, revoked, useCount < maxUses, insert membership, increment useCount |
| `accounts.create` | { name, type, balance? } | Atomic: create account with zero balance → if balance != 0, post signed initial transaction via transactions.create |
| `accounts.update` | { accountId, name?, type?, hidden? } | Owner only, toggle visibility |
| `accounts.delete` | { accountId } | Owner only; reject if transactions reference this account |
| `accounts.updateBalance` | { accountId, amount, operation } | Internal: adjust balance |
| `categories.create` | { name, type } | Owner only |
| `categories.update` | { categoryId, name?, type?, hidden? } | Owner only, toggle visibility; reject type change if linked tx/budgets exist |
| `categories.delete` | { categoryId } | Owner only; reject if transactions or budgets reference this category |
| `transactions.create` | { accountId, categoryId, amount, type, note?, date } | Signed amount: +income, -expense; category type must match |
| `transactions.update` | { transactionId, ...fields } | Auto-update balance (reverse old + apply new); category type must match |
| `transactions.delete` | { transactionId } | Auto-update account balance (reverse) |
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
     - `categoryId`: initial balance category (system-managed)
     - `note`: "Initial balance"
   - The normal `transactions.create` balance update applies the signed amount to the account.
3. Account balance reflects the opening balance after step 2.

This ensures the opening balance is applied exactly once and goes through the same balance update path as all other transactions.

---

## Account Balance Auto-Update Logic

```
on create:
  account.balance += amount

on update:
  if accountId changed:
    oldAccount.balance -= oldAmount      // reverse from previous account
    newAccount.balance += newAmount      // apply to new account
  else (same account):
    account.balance += (newAmount - oldAmount)  // net adjustment

on delete:
  account.balance -= amount
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
| View/Create/Edit/Delete Transaction | ✅ | ✅ |
| Edit existing Transaction on hidden Account | ✅ | ✅ (existing only, cannot reassign to hidden) |
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
- **Category hidden:** transaksi atas kategori itu sepenuhnya tidak terlihat dan tidak tersentuh member.

---

## Invitation Security Model

- Codes are cryptographically random (8 alphanumeric chars).
- Only SHA-256 hashes are stored — plaintext is never persisted.
- Codes expire after 7 days.
- Codes are single-use (maxUses = 1).
- Owner can revoke unused codes.
- Redemption is atomic: hash → lookup → validate (expiry, revoked, useCount) → insert membership + increment useCount.
- Rate limiting: max 5 redemption attempts per code per minute.

---

## User Flows

### Flow 1: First Login (Onboarding)

```
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

```
App Open
↓
Clerk Auth Gate
↓ (signed in)
Check household (households.getActive)
↓ (found)
Home Screen (dashboard)
```

### Flow 3: Owner Creates Transaction

```
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

```
Settings → Categories
↓
Select Category → toggle "Visible to members"
↓
Save (categories.update)
↓
Members can no longer see/use that category
```

### Flow 5: Owner Invites Member

```
Settings → Household Members
↓
Tap "Generate Invite Code"
↓
Server: generate random code, hash (SHA-256), store hash + expiry (7 days) + maxUses (1)
↓
Display code to owner (plaintext, shown once)
↓
Owner shares code via copy/share
```

### Flow 6: Member Joins Household

```
App Open → Onboarding
↓
Tap "Join with Invite Code"
↓
Enter code → households.redeem
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

```
Create Account → fill name, type, initial balance
↓
Submit (accounts.create)
↓
Auto-create "initial balance" transaction
↓
Account appears with balance
```
