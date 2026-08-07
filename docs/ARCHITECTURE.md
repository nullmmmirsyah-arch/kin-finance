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

### `accounts` table

```
householdId: id<households>
name: string                // e.g. "Cash", "BCA Savings"
type: "cash" | "bank" | "ewallet" | "credit_card"
balance: number             // current balance (auto-updated)
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
amount: number              // positive = income, negative = expense
type: "income" | "expense"
note: string | undefined    // optional description
date: number                // transaction date timestamp
createdBy: id<users>        // who created this
updatedBy: id<users>        // who last updated
createdAt: number
updatedAt: number
```

**Indexes:** `by_householdId` on `["householdId"]`, `by_accountId` on `["accountId"]`, `by_categoryId` on `["categoryId"]`, `by_date` on `["date"]`

---

### `budgets` table

```
householdId: id<households>
categoryId: id<categories>
amount: number              // budget limit per period
period: "monthly"           // only monthly for MVP
createdBy: id<users>
updatedBy: id<users>
createdAt: number
updatedAt: number
```

**Indexes:** `by_householdId` on `["householdId"]`, `by_categoryId` on `["categoryId"]`

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
| `budgets.list` | - | Budget[] | All budgets for household |
| `users.getMe` | - | User \| null | Current user profile |

---

### Mutations (write)

| Function | Args | Notes |
|----------|------|-------|
| `households.create` | { name } | Onboarding, creates + assigns owner |
| `households.update` | { householdId, name } | Owner only |
| `accounts.create` | { name, type, balance? } | Opening balance → auto create initial transaction |
| `accounts.update` | { accountId, name?, type? } | Owner only |
| `accounts.updateBalance` | { accountId, amount, operation } | Internal: adjust balance |
| `categories.create` | { name, type } | Owner only |
| `categories.update` | { categoryId, name?, type?, hidden? } | Owner only, toggle visibility |
| `transactions.create` | { accountId, categoryId, amount, type, note?, date } | Auto-update account balance |
| `transactions.update` | { transactionId, ...fields } | Auto-update account balance (reverse old + apply new) |
| `transactions.delete` | { transactionId } | Auto-update account balance (reverse) |
| `budgets.create` | { categoryId, amount } | Member can create |
| `budgets.update` | { budgetId, amount } | Member can update |
| `budgets.delete` | { budgetId } | Member can delete |

---

## Account Balance Auto-Update Logic

```
on create: account.balance += amount
on update: account.balance -= oldAmount; account.balance += newAmount
on delete: account.balance -= amount
```

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
| View/Create/Edit/Delete Transaction | ✅ | ✅ |
| Create Category | ✅ | ❌ |
| Edit Category | ✅ | ❌ |
| Delete Category | ✅ | ❌ |
| Toggle Category Visibility | ✅ | ❌ |
| View/Create/Edit/Delete Transaction (per category) | ✅ | Hanya jika category visible |
| View/Create/Edit/Delete Budget | ✅ | ✅ |
| View Budget (hidden category) | ✅ | ✅ |

---

## Visibility Rules

- **Account hidden:** balance tidak terlihat member, transaksi atas akun itu tetap bisa dilihat/dibuat/diedit oleh member.
- **Category hidden:** transaksi atas kategori itu sepenuhnya tidak terlihat dan tidak tersentuh member.

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
Generate Invite Code (households.generateInviteCode)
↓
Share code with member
```

### Flow 6: Member Joins Household

```
App Open → Onboarding
↓
Enter Invite Code → households.joinByCode
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
