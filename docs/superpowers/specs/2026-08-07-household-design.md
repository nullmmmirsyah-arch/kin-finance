# Household Feature — Design Spec

> Date: 2026-08-07
> PRD: docs/Product Requirement Document/PRD_Household
> Status: Approved
> Supersedes: 2026-08-07-workspace-design.md

---

## Summary

Rename "Workspace" to "Household" across the entire codebase — database, Convex functions, UI, and error messages. All user-facing text in English. Term "Household" aligns with personal finance convention (YNAB, EveryDollar) and matches the "Kin" (family) brand.

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Term | Household | Standard in personal finance, warm but professional, matches "Kin" brand |
| UI Language | English | User preference for consistency |
| UX Flow | Dedicated Onboarding Screen | Same as before, unchanged |
| Data Model | Members Table (`householdMemberships`) | Future-proof for invite member |

---

## Rename Scope

### Database

| Before | After |
|--------|-------|
| `workspaces` table | `households` table |
| `workspaceMemberships` table | `householdMemberships` table |
| `workspaces.name` | `households.name` |
| `workspaces.createdAt` | `households.createdAt` |
| `workspaces.updatedAt` | `households.updatedAt` |
| `workspaceMemberships.workspaceId` | `householdMemberships.householdId` |
| `workspaceMemberships.userId` | `householdMemberships.userId` |
| `workspaceMemberships.role` | `householdMemberships.role` |
| Index `by_workspaceId` | Index `by_householdId` |
| Index `by_userId` | Index `by_userId` (unchanged) |

### Convex Functions

| Before | After |
|--------|-------|
| `convex/workspaces.ts` | `convex/households.ts` |
| `workspaces.create` | `households.create` |
| `workspaces.getActive` | `households.getActive` |
| `workspaces.update` | `households.update` |

### UI

| File | Change |
|------|--------|
| `app/onboarding.tsx` | All text → English, "workspace" → "household" |
| `app/home.tsx` | All text → English, "workspace" → "household" |

### Spec Docs

| Before | After |
|--------|-------|
| `2026-08-07-workspace-design.md` | Superseded by this file |
| PRD_Workspace | Rename to PRD_Household (or keep as reference) |

---

## Data Model

### `households` table

```text
name: string        // 3-50 chars, trimmed whitespace
createdAt: number   // auto-generated timestamp
updatedAt: number   // auto-generated timestamp
```

### `householdMemberships` table

```text
householdId: id<households>
userId: id<users>
role: v.union(v.literal("owner"), v.literal("member"))
```

**Indexes:**
- `by_householdId` on `["householdId"]`
- `by_userId` on `["userId"]`

---

## Convex Functions

### `convex/households.ts`

#### `create` (mutation)

- **Args:** `{ name: string }`
- **Behavior:**
  1. Validate name: required, 3-50 chars, trim whitespace
  2. Check user doesn't already have a household
  3. Insert into `households` table
  4. Insert into `householdMemberships` with role "owner"
  5. Return created household
- **Error messages (English):**
  - "You are not signed in."
  - "User not found."
  - "You already have a household."
  - "Household name is required."
  - "Household name must be at least 3 characters."
  - "Household name must be at most 50 characters."

#### `getActive` (query)

- **Args:** none
- **Behavior:**
  1. Get current user from auth
  2. Query `householdMemberships` by `userId`
  3. Join with `households` table
  4. Return first household (MVP: only 1 per user), or `null`
- **Returns:** `{ _id, name, createdAt, updatedAt } | null`

#### `update` (mutation)

- **Args:** `{ householdId: Id<"households">, name: string }`
- **Behavior:**
  1. Validate name: required, 3-50 chars, trim whitespace
  2. Check caller has "owner" role in `householdMemberships`
  3. Check household exists
  4. Update household name + `updatedAt`
  5. Return updated household
- **Error messages:**
  - "You are not signed in."
  - "User not found."
  - "You are not the owner of this household."
  - "Household not found."
  - (same name validation errors as create)

---

## UI Screens

### `app/onboarding.tsx` — Onboarding Screen

**Layout:**
- Full screen, centered content
- Title: "Welcome to Kin Finance"
- Description: "Create your Household to start managing your family's finances."
- TextInput: Household name (placeholder: "Household name")
- Button: "Create Household" with loading state
- Error message display below input (inline, not alert)

**Behavior:**
1. User types household name
2. Real-time validation (3-50 chars)
3. Submit → call `households:create` → `router.replace("/home")`
4. Disable button during submission to prevent double submit

### `app/home.tsx` — Dashboard

**New behavior:**
1. On mount, query `households:getActive`
2. If `null` → `router.replace("/onboarding")`
3. If household exists → display dashboard with household name
4. Show loading spinner while checking household

**Dashboard content (MVP placeholder):**
- Greeting: "Hello, {email}!"
- Household: "{household name}"
- "Sign Out" button

---

## User-Facing Text (All English)

| Context | Text |
|---------|------|
| Onboarding title | "Welcome to Kin Finance" |
| Onboarding description | "Create your Household to start managing your family's finances." |
| Onboarding button | "Create Household" |
| Onboarding input placeholder | "Household name" |
| Onboarding error (name short) | "Household name must be at least 3 characters." |
| Onboarding error (name long) | "Household name must be at most 50 characters." |
| Onboarding error (create failed) | "Failed to create household. Please try again." |
| Onboarding error (already exists) | "You already have a household." |
| Home dashboard | "Household: {name}" |
| Home greeting | "Hello, {email}!" |
| Home sign out button | "Sign Out" |
| Home sync error | "Failed to sync user." |
| Backend error (unauthenticated) | "You are not signed in." |
| Backend error (user not found) | "User not found." |
| Backend error (not owner) | "You are not the owner of this household." |
| Backend error (name required) | "Household name is required." |
| Backend error (name short) | "Household name must be at least 3 characters." |
| Backend error (name long) | "Household name must be at most 50 characters." |

---

## Validation Rules

- Required, 3-50 characters, trimmed whitespace
- One household per user (MVP)

---

## Permissions

| Action | Owner | Member |
|--------|:-----:|:------:|
| View Household | ✅ | ✅ |
| Rename Household | ✅ | ❌ |

- `getActive`: all authenticated users
- `update`: owner only (checked in mutation via `householdMemberships`)

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `convex/schema.ts` | Modify | Rename tables: `workspaces` → `households`, `workspaceMemberships` → `householdMemberships` |
| `convex/workspaces.ts` | Delete | Old file |
| `convex/households.ts` | Create | `create`, `getActive`, `update` functions |
| `app/onboarding.tsx` | Modify | English text, "household" terminology |
| `app/home.tsx` | Modify | English text, "household" terminology |
| `docs/superpowers/specs/2026-08-07-workspace-design.md` | Delete | Superseded |
| `docs/superpowers/specs/2026-08-07-household-design.md` | Create | This file |
| `docs/Product Requirement Document/PRD_Workspace` | Rename | To PRD_Household |

---

## Success Criteria

- [ ] All database tables renamed to `households` and `householdMemberships`
- [ ] All Convex functions renamed to `households.create`, `households.getActive`, `households.update`
- [ ] All user-facing text in English
- [ ] All error messages in English
- [ ] Onboarding screen shows "Create your Household"
- [ ] Home screen shows "Household: {name}"
- [ ] No remaining references to "workspace" in code or UI
