# P0 Batch 2 Polish — Pull-to-Refresh, Search, Recent Fix, Haptics, EmptyState

> Date: 2026-08-27
> Status: Approved — Approach B (Balanced, hemat DB I/O)
> Scope: P0-1 s/d P0-5 dari analisa 2026-08-27

## 1. Goal

Kirim 5 polish ber-impact tinggi tanpa schema breaking:
banner pull-to-refresh di 4 tab, search note hemat I/O, fix bug `transactions.recent`, haptics di momen penting, dan EmptyState role-aware. Semua update tercatat di PRD living doc.

## 2. Context & Decisions Locked

| # | Item | Decision (user-confirmed 2026-08-27) |
|---|------|--------------------------------------|
| P0-1 | Pull-to-refresh & offline | **Semua 4 tab + banner** tipis di atas list (bukan full-screen). Refresh via `RefreshControl`. |
| P0-2 | Search transaksi | **Note saja, server-side, hemat** — substring case-insensitive, min 2 char, bounded scan `limit*10`, debounce 300ms. Tidak include amount search. |
| P0-3 | Recent pagination bug | **Tetap 5, fix bug saja** — owner juga pakai bounded scan, perbaiki hasMore, tidak jadi infinite scroll. |
| P0-4 | Haptics | **Hanya momen penting** — success create/update, warning validation, destructive delete. Tidak di chip selection. |
| P0-5 | EmptyState Member | **Tambah penjelasan role** — Member lihat deskripsi Owner-only tanpa FAB. |

Prior art:
- `convex/transactions.ts:475` `recent` owner path ignores cursor.
- `convex/transactions.ts:565` member hasMore terbalik.
- `app/(tabs)/home.tsx:37` RECENT_LIMIT=5 tapi pagesMap logic tidak reset benar.
- P0 polish 2026-08-26 sengaja defer haptics (Appendix A) — sekarang diaktifkan terbatas.

## 3. Design

### 3.1 P0-1 Pull-to-Refresh + Connectivity Banner

**Component baru:** `components/ConnectivityBanner.tsx`

```tsx
type Props = { visible: boolean; onRetry?: () => void }
// amber surface, Feather wifi-off 16, text "You're offline — showing cached data", Retry pressable
```

**Trigger:**
- `const isStale = query === undefined` selama >3000ms (timer via useEffect) → banner visible.
- Jika `query === null` dengan network error (deteksi via `getConvexErrorMessage` contains "Network" / "Failed to fetch") → banner + full description.
- Convex real-time: Retry tidak perlu manual refetch; `onRetry` cukup `show("Retrying…")` + trigger re-render (Convex auto re-subscribe). Untuk manual: `router.replace` same route forces remount.

**Placement per tab:**
- `app/(tabs)/home.tsx:252` ScrollView → `RefreshControl` + banner di atas `<ScrollView>` (sticky top 0).
- `app/(tabs)/transactions.tsx:409` SectionList → `refreshControl` prop + banner di atas SectionList.
- `app/(tabs)/accounts.tsx:143` FlatList → `refreshControl` + banner.
- `app/(tabs)/budgets.tsx:248` FlatList → sama.
- Semua pakai `useState refreshing` + `onRefresh` yang set `refreshing=true`, delay 600ms lalu false (Convex akan push data baru otomatis).

**No offline queue** — out of scope Batch 2.

### 3.2 P0-2 Search Transaksi (hemat I/O)

**Backend `convex/transactions.ts`:**

```ts
// tambah di ListFilters
type ListFilters = { accountIds?; categoryIds?; type?; search?: string }

// normalize
function normalizeSearch(raw?: string): string | undefined {
  const s = raw?.trim().toLowerCase();
  if (!s || s.length < 2) return undefined;
  return s;
}
function matchesFilters(row, filters): boolean {
  // ... existing account/category/type
  if (filters.search !== undefined) {
    const hay = (row.note ?? "").toLowerCase();
    if (!hay.includes(filters.search)) return false;
  }
  return true;
}
```

- `list` args tambah `search: v.optional(v.string())`
- `summary` args tambah `search: v.optional(v.string())`
- `summary` loop: cek `row.note` langsung tanpa hydrate (hemat). Member hidden check tetap sebelum matchesFilters agar hidden notes tidak bocor tapi juga tidak dihitung.
- Tidak ada index baru. Scan tetap `SCAN_BUDGET = limit*10` untuk list, `SUMMARY_BATCH_SIZE=10000` untuk summary. Pinned index logic unchanged — search adalah post-index filter (OR tidak relevan, search single value).

**Frontend `app/(tabs)/transactions.tsx`:**

- State: `const [searchDraft, setSearchDraft] = useState("")`, `const [searchCommitted, setSearchCommitted] = useState("")`
- Debounce: `useEffect(() => { const t = setTimeout(()=>setSearchCommitted(searchDraft.trim()), 300); return ()=>clearTimeout(t)}, [searchDraft])`
- `queryArgs` include `...(searchCommitted.length>=2 ? {search: searchCommitted} : {})`
- `queryKey = JSON.stringify(queryArgs)` sudah include search → reset pagination otomatis via existing `useEffect` clear pagesMap.
- UI: di atas `HeaderPill` row, tambah `View` dengan `Input` search (Feather search 16 left, clear X right). `placeholder="Search notes…"`, `value={searchDraft}`, `onChangeText={setSearchDraft}`. Tidak auto-focus.
- Empty state baru: jika `searchCommitted` aktif dan sections.length===0 dan !invalidCustomRange → `EmptyState icon="search" title='No results for "X"' description="Try a different keyword or clear search." actionLabel="Clear search" onAction={()=>{setSearchDraft(""); setSearchCommitted("")}}`

**I/O hemat guarantee:** search <2 char = no filter (no extra scan). search >=2 = bounded scan same as other filters, tidak walk uncapped tambahan.

### 3.3 P0-3 Fix `transactions.recent`

**Bug sekarang (`convex/transactions.ts:490-574`):**
- Owner: `take(limit)` tanpa cursor, tanpa SCAN_BUDGET, tanpa hasMore truthful.
- Member: `hasMore = collected.length < limit && scanned >= SCAN_BUDGET` terbalik (harusnya hasMore false jika range exhausted).

**Fix:**

```ts
// recent handler unified
const SCAN_BUDGET = limit * 10;
let scanned=0, cursorDate=args.cursor?.date, cursorId=args.cursor?.id, atBoundary=false;
const collected=[]; const cache=new Map();
let lastScanned, rangeExhausted=false;
while(collected.length < limit && scanned < SCAN_BUDGET){
  const batch = Math.min(SCAN_BUDGET - scanned, limit*4);
  const rows = await ctx.db.query("transactions")
    .withIndex("by_household_date", q=>{
      const base=q.eq("householdId", membership.householdId);
      if(cursorDate===undefined) return base;
      return atBoundary ? base.lt("date", cursorDate) : base.lte("date", cursorDate);
    }).order("desc").take(batch+1) // +1 untuk tie detection
  // ... pastCursor logic sama seperti list, hydrate via cache, skip hidden for member
  // track rangeExhausted = rows.length < batch
}
const hasMore = !rangeExhausted && collected.length>0 && lastScanned!==undefined ? ... : false
return { transactions: collected, isOwner, cursor: hasMore ? {date: lastCollected.date, id: lastCollected._id} : undefined, hasMore }
```

- Owner dan member share loop yang sama.
- `home.tsx:98` `useEffect` pagesMap tetap tapi `recent` sekarang support cursor → hasMore true akan allow Load more jika nanti dibutuhkan, tapi Batch 2 tetap cap 5 (tidak tambah UI load more). Fix hanya backend truthfulness + home dedup sudah benar.

### 3.4 P0-4 Haptics — Momen Penting Saja

**Wrapper baru `lib/haptics.ts`:**

```ts
import * as Haptics from "expo-haptics";
export async function hapticSuccess(){ try{ await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)} catch{}}
export async function hapticWarning(){ try{ await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)} catch{}}
export async function hapticError(){ try{ await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)} catch{}}
```

**Call sites (hanya 5 file):**
- `app/transaction-form.tsx:336` after `show("Transaction added/updated")` → `hapticSuccess()`
- `app/transaction-form.tsx:180` on `setAmountError` validation → `hapticWarning()`
- `app/account-form.tsx`, `app/category-form.tsx`, `app/budget-form.tsx` after successful `create/update` → `hapticSuccess()`
- `app/members.tsx:59` after `updateTimezone` success dan `app/budget-form` delete → `hapticSuccess()` / `hapticWarning()` on error
- `convex` tidak pakai haptics (client only).

Tidak di `components/Chip.tsx`, `FilterSheet`, `SelectField` selection — sesuai keputusan.

### 3.5 P0-5 EmptyState Role-Aware

- `app/(tabs)/accounts.tsx:125`:
  ```tsx
  <EmptyState
    icon="credit-card"
    title="No accounts yet"
    description={isOwner ? "Add your first account to start tracking your money." : "Only the Owner can add accounts. Contact your household Owner to set up your first account."}
    actionLabel={isOwner ? "Add Account" : undefined}
    onAction={isOwner ? ()=>router.push("/account-form") : undefined}
  />
  ```
- `app/(tabs)/transactions.tsx` empty sudah ada 3 cabang (invalidCustomRange / filtersActive / no transactions). Tambah cabang ke-4 prioritas tertinggi: `if (searchCommitted.length>=2) → search empty` sebelum `filtersActive` check.
- Copy tetap English (PRD §1).

## 4. Data Flow

```
User pull → RefreshControl onRefresh → setRefreshing(true) → 600ms → false
                ↘ Convex real-time push → query updated → banner hidden

User type "lunch" → searchDraft → 300ms debounce → searchCommitted → queryKey change → reset cursor/pagesMap → transactions.list({search}) + summary({search}) → SectionList re-render

Home mount → recent({limit:5}) → unified scan engine (owner/member) → 5 rows + hasMore false → grouped by day → render

Create transaction success → Snackbar + hapticSuccess() → router.back()
```

## 5. Error Handling

- Banner menggantikan full-screen error untuk staleness; full-screen tetap untuk `household === null` (not member) seperti `transactions.tsx:292`.
- Haptics wrapper swallow error (Expo Go tidak support di web).
- Search tidak throw jika <2 char — treated as no filter.
- `npx convex codegen` wajib setelah ubah `convex/transactions.ts` args.

## 6. Testing & Verification

- Unit: `tests/transactions.search.test.ts` — owner/member: note substring, case-insensitive, <2 char ignored, hidden notes excluded for member, summary totals respect search, transfers excluded.
- Unit: `tests/transactions.recent.test.ts` — owner pagination with cursor, hasMore false at exhaustion, no duplicates across pages, tie on same date.
- Manual: pull-to-refresh di 4 tab (Android device), banner muncul saat airplane mode, haptics terasa di create/delete, empty Member di Accounts tanpa FAB.
- Gate: `npx convex codegen` → `npx tsc --noEmit` → `npm test` → `npm run lint`

## 7. PRD Documentation Updates

Per §0 Update workflow:

- §2.1 Transactions row: tambah “Supports server-side substring search by note (min 2 chars) on `list` and `summary`.”
- §3.6 Filtering: sub-section “Search” jelaskan debounce, min 2, post-index filter, SCAN_BUDGET unchanged, summary hydration-free.
- §3.6 / §3.8 Recent: dokumentasikan recent unified engine + cap 5 tetap.
- §3.8 / §5.4 + §5.2 Responsibilities: tambah `components/ConnectivityBanner.tsx`, `lib/haptics.ts`, pull-to-refresh di semua tab, haptics notification types.
- §5.4 Error Handling: tambah banner pattern (stale >3s → banner, Retry).
- §8 Change Log: entry 2026-08-27 “P0 Batch 2 Polish” dengan 5 bullet, Header Last updated → 2026-08-27.
- Verifikasi vs live code sebelum merge (PRD is accurate to what exists).

## 8. Out of Scope (Batch 2)

- Offline queue / optimistic mutation, full-text search index, amount numeric search, infinite scroll di Home, haptics di chip selection, i18n Indonesia.
