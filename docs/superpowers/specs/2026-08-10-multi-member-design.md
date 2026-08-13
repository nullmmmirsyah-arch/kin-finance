# Multi-Member + Rename Household — Design Spec

> Date: 2026-08-10
> Status: Approved
> PRD: PRD_MultiMember, PRD_Household (rename section)

---

## Scope

- **A**: Full Multi-Member feature — invitations backend, onboarding join flow, Members screen in Settings
- **B**: Rename Household UI in Settings

Out of scope: minor home page transaction list, budget hidden-category spending detail (deferred).

---

## Data Model: `invitations` Table

Add to `convex/schema.ts`:

```
invitations: defineTable({
  householdId: v.id("households"),
  codeHash: v.string(),            // HMAC-SHA-256 digest of code, keyed with INVITE_SECRET
  createdBy: v.id("users"),        // owner who generated it
  expiresAt: number,                // timestamp (7 days from creation)
  maxUses: v.number(),              // 1 = single-use (MVP default)
  useCount: v.number(),             // redeemed count
  revoked: v.boolean(),             // owner can revoke before expiry
  redemptionAttempts: v.number(),   // rate-limit counter per code
  lastAttemptAt: v.number(),        // timestamp of last redemption attempt
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_codeHash", ["codeHash"])
  .index("by_householdId", ["householdId"])
```

- `codeHash` is globally unique (not scoped per household). Single `codeHash` match required; reject if >1 match.
- `maxUses` defaults to 1 (single-use). `useCount` increments atomically on redemption.
- `redemptionAttempts` + `lastAttemptAt` for per-code rate limiting (max 5 per minute window).

---

## Environment Variable

`INVITE_SECRET` — HMAC-SHA-256 key for hashing invite codes. Accessed via `process.env.INVITE_SECRET` inside mutations (Convex supports env vars in all function types).

---

## Convex Mutations: `convex/invitations.ts`

### `invitations.create`

**Args:** none

**Auth:** signed-in, owner of a household

**Logic:**
1. Verify user is owner of their household.
2. Generate cryptographically random 8-character alphanumeric code (uppercase A-Z, 0-9). Use Web Crypto `crypto.getRandomValues(new Uint8Array(n))` (available in Convex runtime). Map random bytes to charset via modulo.
3. Hash code: `HMAC-SHA-256(code.toLowerCase(), process.env.INVITE_SECRET)`.
4. Insert `invitations` doc:
   - `householdId`, `codeHash`, `createdBy: user._id`
   - `expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000`
   - `maxUses: 1`, `useCount: 0`, `revoked: false`
   - `redemptionAttempts: 0`, `lastAttemptAt: 0`
   - `createdAt: Date.now()`, `updatedAt: Date.now()`
5. If `codeHash` uniqueness collision (edge case), retry with newly generated code.
6. Return plaintext code (shown once to owner).

**Errors:**
- "You are not the owner of this household."
- "You are not signed in."

---

### `invitations.revoke`

**Args:** `{ invitationId: v.id("invitations") }`

**Auth:** signed-in, owner

**Logic:**
1. Verify invitation belongs to caller's household.
2. Verify caller is owner.
3. Set `revoked: true`, `updatedAt: Date.now()`.

**Errors:**
- "You are not the owner of this household."
- "Invitation not found."

---

### `invitations.redeem`

**Args:** `{ code: v.string() }`

**Auth:** signed-in (any user with valid Clerk identity)

**Logic (atomic):**
1. Validate user not already a member of any household (query `householdMemberships` by `userId`). If found, throw "You are already a member of a household."
2. Normalize code: trim + uppercase.
3. Compute `codeHash = HMAC-SHA-256(normalizedCode.toLowerCase(), process.env.INVITE_SECRET)`.
4. Lookup invitation by `codeHash`. If not found → "Invalid invite code."
5. Rate limit check:
   - If `lastAttemptAt` is within last 60 seconds AND `redemptionAttempts >= 5`:
     - Increment `redemptionAttempts` and throw "Too many attempts. Please try again later."
   - If `lastAttemptAt` is older than 60 seconds:
     - Reset `redemptionAttempts` to 0.
   - Increment `redemptionAttempts`, set `lastAttemptAt: Date.now()`.
6. Validate:
   - `expiresAt > Date.now()` → "This invite code has expired."
   - `revoked === false` → "This invite code has been revoked."
   - `useCount < maxUses` → "This invite code has already been used."
7. Atomic insert `householdMemberships` doc with role "member".
8. Increment `useCount`.

**Errors:**
- "Invalid invite code."
- "This invite code has expired."
- "This invite code has already been used."
- "This invite code has been revoked."
- "You are already a member of a household."
- "Too many attempts. Please try again later."

---

## Routing & File Structure

### New files

| File | Purpose |
|------|---------|
| `convex/invitations.ts` | Backend mutations/queries for invite codes |
| `app/members.tsx` | Household Members screen |

### Modified files

| File | Change |
|------|--------|
| `convex/schema.ts` | Add `invitations` table |
| `app/_layout.tsx` | Add `<Stack.Screen name="members" />` |
| `app/onboarding.tsx` | Add toggle mode: Create / Join with Invite Code |
| `app/(tabs)/settings.tsx` | Add "Household" section (name + rename) + "Members" entry |
| `convex/_generated/` | Regenerated via `npx convex codegen` |

---

## Onboarding — Toggle Mode

**Screen:** `app/onboarding.tsx`

**Layout:**
- Toggle tab bar at top: "Create Household" (default) | "Join with Invite Code"
- Switching modes clears form and errors

### Create Household (default, unchanged)
- Input: household name (existing behavior)
- Tombol: "Create Household"

### Join with Invite Code (new)
- Input: invite code (8 alphanumeric characters, auto-uppercase on input, maxLength 8)
- Tombol: "Join Household"
- Loading state while calling `invitations.redeem`
- On success: `router.replace("/home")` (redirect to shared household)
- Error handling: show error message below input

**Code input validation (client-side):**
- Required
- Exactly 8 characters (alphanumeric, auto-uppercase)
- Trim whitespace

---

## Settings Screen

**Screen:** `app/(tabs)/settings.tsx`

**Layout changes:**
- **"Household" section** (top of screen):
  - Household name displayed as text
  - Owner only: pencil icon or "Rename" button
  - Tap rename → inline edit mode: text input + "Save Changes" / "Cancel"
  - Validation: min 3, max 50 chars, trimmed
- **"Household Members" section:**
  - Entry: "Members" with member count badge → navigates to `/members`
  - Icon: `users`

**Rename behavior:**
- Input prefilled with current household name
- Save calls `households.update({ householdId, name })`
- Error: "Household name must be at least 3 / at most 50 characters" (client-side validation before submit)

---

## Members Screen

**Screen:** `app/members.tsx`

### Empty state (only 1 member — owner alone)

```
Title: "You're the only member"
Description: "Invite family members to manage finances together."
Primary action: "Invite Member"
```

Tap "Invite Member" → trigger Generate Invite Code flow (same as below).

### Member list (2+ members)

List shows for each member:
- Name (or "User" if no name set)
- Email (or "No email")
- Role badge: "Owner" or "Member"

**Owner-only controls:**
- "Generate Invite Code" button at top of list
- "Remove" action on each member (except owner cannot remove self)
- Swipe left on member row → "Remove" button → confirmation dialog: "Remove [name] from household?"
- Calls `households.removeMember({ householdId, userId })`
- Error: "You cannot remove the owner of the household." (should not be reachable if UI blocks it)

**Member view:** List only (no generate/remove controls).

### Generate Invite Code flow

1. Owner taps "Generate Invite Code"
2. Calls `invitations.create`
3. Code displayed on screen:
   - Large, monospace text
   - "Copy to Clipboard" button (copies code to clipboard)
   - "Share" button (native share sheet via `expo-sharing`)
   - Note: "This code expires in 7 days and is single-use. Copy it now."
   - "Done" button to return to member list
4. Code is shown once — leaving screen without copying loses it (by design per PRD).

---

## Queries

### `invitations.listActive`

**Args:** `{ householdId: v.id("households") }`

**Auth:** signed-in, owner of the household

**Returns:** Array of active (non-expired, non-revoked, useCount < maxUses) invitations with metadata (createdAt, expiresAt, useCount, code preview).

Used in Members screen owner view to show pending active invitation (if any). Not critical for MVP — can be deferred if time-constrained.

---

## Error Handling

All ConvexError messages are user-friendly (no technical details). Client displays error message in UI. Pattern follows existing `convex/*.ts` conventions.

---

## Security Considerations

1. **HMAC key**: `INVITE_SECRET` stored in Convex env vars, never in code.
2. **Plaintext code**: shown once to owner only; never stored.
3. **Atomic redemption**: membership insert + useCount increment in same mutation.
4. **Rate limiting**: per-code attempt counter prevents brute-force (5 attempts/minute/code).
5. **Global codeHash uniqueness**: prevents cross-household collisions.
6. **Owner cannot be removed**: enforced both in UI and backend (`households.removeMember`).
7. **Existing member guard**: `invitations.redeem` checks `householdMemberships` by userId before joining.

---

## UI Components

### Invite Code Display

- Large monospace text (e.g. `A1B2C3D4`)
- Copy button with success feedback (Snackbar "Copied!")
- Share button: `expo-sharing` `shareAsync` with code as text

### Member Card

- Name, email, role badge
- Owner: removable (swipe left)
- Member: no remove action

---

## Verification

After implementation:
1. `npx convex codegen` — regenerate schema
2. `npx tsc --noEmit` — type check
3. `npm run lint` — lint check
4. Manual test: create household → generate invite code → open in incognito → sign up new user → join with code → verify both users share same household
5. Manual test: owner can rename household, member cannot
6. Manual test: rate limiting (5 rapid attempts → blocked)
