# Design: Add Transaction Sheet — Kin Finance

> Date: 2026-09-07
> Status: Approved (gathering JSON `docs/kin-gathering-add-transaction.json`)
> Replaces: `app/transaction-form.tsx` vertical form
> Reference: 4 images (Expenses grid / Note+tags / Date picker / Transfer)

## 1. Overview & Scope

Mengganti halaman `transaction-form` vertikal menjadi **full-screen sheet modal** ala referensi, dengan tab Expenses/Income/Transfer di atas, grid kategori scroll di tengah, dan input+keypad di bawah. V1 scope:
- Q1 A ganti total, Q2 B grid scroll vertikal filtered, Q3 A dual card transfer+swap, Q4 A keypad kalkulator evaluasi + thousand live, Q5 A bare number (PRD currency-agnostic), Q6 A pill akun tappable + default lastTransaction, Q7 C single note + auto-suggest same category, Q8 B tanggal saja (household timezone), Q9 C no fee, Q10 A no foto, Q11 A header X + tabs + General pakai tema Kin (bukan kuning referensi), Q12 A pertahankan duplicate/hidden/whole-number/discard/Repeat-last.

Out of scope V1: tags chips, fee, foto/OCR, time picker, currency picker.

## 2. Architecture

- **Route**: `app/transaction-form.tsx` tetap path (deep-link `router.push("/transaction-form")` & edit `?id=` tidak broken), tapi UI dirombak jadi sheet. Alternatif: `presentation: "modal"` di `app/_layout.tsx` jika perlu.
- **State**: satu komponen utama + hooks lokal: `type` (expense|income|transfer), `categoryId`, `accountId`, `toAccountId`, `amountExpr` (string ekspresi mentah, mis. "12,000+5,000"), `amountValue` (number hasil eval), `date` (Date), `note` (string), `noteFocused`, errors.
- **Queries**: `api.accounts.list`, `api.categories.list` (filter by `type`, hidden-aware), `api.transactions.list` untuk dupe window & note suggest (limit 1000, search by category), `getLastTransaction()` SecureStore untuk default akun.
- **Mutations**: `api.transactions.create` / `update` / `remove` tetap, plus `periodBalances` recompute otomatis di server.
- **No schema change**: `convex/schema.ts:70` tetap `note?: string`, tidak tambah `tags`/`fee` di V1. Auto-suggest hanya client query.

## 3. Components (isolated, testable)

1. **SheetHeader** — `X` kiri (close → `handleBack` discard guard), tabs `Expenses | Income | Transfer` tengah (underline pakai `C.primary`, bukan kuning referensi — Q11 note), pill `General` kanan (ambil `household.name` via `api.households.getActive`, fallback "General").
2. **CategoryGrid** — `FlatList` 4 kolom `scrollEnabled={false}` (di dalam `KeyboardAwareScrollView`), sel ukuran tetap dari `useWindowDimensions` (tidak pernah melar — satu kategori tetap kotak kecil rata kiri), data = `categoryOptions` filtered by `type` (Q2) + tile `Add` (plus, dashed border, owner-only → `router.push("/category-form")`; member tanpa tile). Kategori yang baru dibuat terpilih otomatis saat kembali (`useFocusEffect` diff ID + flag eksplisit — tab switch / remote add tidak ikut). Render `CategoryIcon` 32px (reuse `components/CategoryIcon.tsx:1`), label 1 baris + ellipsis (nama panjang terpotong seragam — referensi pun memotong, mis. "Daily nes."). Hidden logic sudah di server `categories.list`. Selected border `2px C.primary`.
3. **TransferDualCard** (hanya `type===transfer`) — dua kartu `Payment account` / `Receive account` (border `C.border`, `Shadow.card`, `Radius.md`), tap buka **AccountSheet**, tombol tengah `⇄` swap (`[accountId,toAccountId]=[toAccountId,accountId]`).
4. **AccountPill + AccountSheet** — pill `BCA` style (Q6): menampilkan `account.name`, tap buka sheet akun (reuse `SelectField`-style sheet tapi tanpa search jika <8). Default awal: `lastTransaction.accountId` jika masih visible, else first visible. Member hanya lihat visible.
5. **Amount + Keypad** — amount besar kanan, bare whole number tanpa simbol currency (Q5 direvisi opsi A per PRD §1 currency-agnostic — label `IDR` dihapus). Input display = `formatAmountInput` live + evaluasi ekspresi. Keypad custom 4×4 penuh (uji user): `[1,2,3,⌫]`, `[4,5,6,+]`, `[7,8,9,-]`, `[.,0,×,÷]` — tanpa tombol `Today` (pill tanggal di samping akun mencukupi) dan tanpa `✓` (Save bar satu-satunya aksi simpan). Kolom operator dipisah visual (spacer + bg `C.surface` + teks `C.primary`); digit bg `C.background`. Evaluasi: parse `amountExpr` → token number/operator → hitung `left-to-right` (tanpa precedence, kontrak kalkulator — disengaja) via evaluator manual integer-only, tolak operan desimal, division truncates + zero → null; operator diabaikan saat input kosong/berakhiran operator.
6. **NoteField + AutoSuggest** — `Add a note` placeholder, max 200 (`NOTE_MAX_LENGTH`). Q4 note: keypad diganti Gboard saat note focused (Image2). Layar dibungkus `KeyboardAwareScrollView` (`react-native-keyboard-controller`, `keyboardShouldPersistTaps="handled"`) agar field note terangkat di atas keyboard device; keypad kustom disembunyikan saat mengetik, Save bar fixed di bawah (dismiss keyboard untuk mencapai). Pilih kategori saat mengetik men-dismiss keyboard kembali ke mode keypad. Suggestion chips di bawah input: query `api.transactions.list({categoryIds:[categoryId], limit:20})` ambil `note` unik, filter `includes` draft, tampil 3-5 chips tappable untuk fill. No tags chip storage.
7. **DatePicker** — pill tanggal menampilkan `formatDateShortTz`. Modal kalender (reuse `components/DateField` + `MonthPicker` logic: `maximumDate today`, future disabled `opacity 0.4`, timezone via `household.timezone` → `getPeriodBounds`). Q8 tanggal saja, simpan `date.getTime()` 00:00 household tz. Tidak ada tombol `Today` di keypad (uji user).
8. **Save Bar** — error inline (amount/account/category/date), `Button` Save disabled via `canSubmit` (same logic as now). Mas ulang `hapticSuccess/Warning/Error`, `Snackbar`, `duplicate Alert`, `discard guard`.

## 4. Data Flow

```
[household] → timezone → periodBounds
[lastTransaction] → default accountId/type/category
[categories.list] → CategoryGrid filtered
[accounts.list] → AccountPill/Sheet
[transactions.list dupeWindow] → duplicate check (±24h)
[transactions.list by category] → note suggestions
user input → validation (validateTransactionAmount/Note/Date) → create/update → periodBalances.recomputeAll → router.back
```

## 5. Styling Rules

- NativeWind `className`, theme via `useThemeColors()` / `useThemeGradients()` — jangan `Colors` langsung (AGENTS.md). Light `bg-background #FFFBF5`, dark `bg-background-dark #1C1917`. Card `Shadow.card`, `Radius.md/lg`. Icons `Feather`. `LinearGradient` tidak perlu di sheet (flat).
- **Gotcha**: jangan pakai `Pressable style={({pressed})=>...}` — pakai `useState pressed` + static `style` (nativewind #847).
- Amount live thousand: `formatAmountInput` + `wasDecimalTruncated` warning amber `Decimals are ignored — whole numbers only` (reuse `components/Input.tsx:29` logic).

## 6. Validation & Error Handling

- Pertahankan `convex/transactions.ts:58` checks: amount signed, category type match, hidden guards member, future date, note length.
- Client: `canSubmit` + `handleSubmit` sama, tambah keypad eval error → `amountError`.
- Duplicate: `dupeCheck` window ±24h same amount/account/(category|toAccount) → `Alert` "Possible duplicate" + `hapticWarning`.
- Discard: `useDiscardGuard` untuk header X & hardware back.
- Hidden: Member tidak melihat hidden kategori/akun di grid/sheet; reassign ke hidden diblock server.

## 7. Testing

- `npx tsc --noEmit`, `npm run lint`, `vitest` untuk pure utils (`formatAmountInput` eval, dupe logic).
- Manual: Expo SDK 54 `expo start`, cek light/dark, Member vs Owner, hidden, edit flow (?id=), add category back + auto-select, note suggest, date-pill→picker, swap transfer.
- Convex: `npx convex codegen` setelah schema (tidak ubah) + `npx convex dev` sync.

## 8. Documentation Updates (post-implement)

- PRD §3.6 Transactions: ganti Form UX paragraph (chip+SelectField) dengan Sheet spec (grid scroll, dual card, keypad, pill, note suggest, date only).
- PRD §2.2 keep amount/note rules, tambah catatan keypad eval & suggest.
- PRD §8 Change Log: entry 2026-09-07 Add Transaction Sheet (Q1-12).
- `docs/ARCHITECTURE.md` jika ada → update transaction-form seam.

## 9. Risks & Mitigations

- Keypad eval → risk injection: pakai manual parser integer-only, bukan `eval`.
- Grid banyak kategori → scroll performance: `FlatList` virtualized 4 kolom jika >30.
- Note suggest query cost → limit 20, cached, skip jika category null.
- LastTransaction default hidden → fallback first visible.

## 10. Verification Checklist

- [ ] Grid filtered by type, hidden respected, fixed cells, Add tile → back selected
- [ ] Transfer swap & pill, From≠To validation
- [ ] Keypad 4×4 digits/ops separated, Save submits, date pill → picker timezone-aware
- [ ] Note visible above device keyboard, suggest same category, max 200, dark/light
- [ ] Amount bare whole number, no currency symbol + whole-number warning
- [ ] Header X/tabs/General, Kin primary underline
- [ ] Duplicate, hidden, discard, Repeat last tetap

