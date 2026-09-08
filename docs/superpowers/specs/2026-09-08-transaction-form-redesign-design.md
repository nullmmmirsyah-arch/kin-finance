# Transaction Form Redesign — ala Referensi (Image 2+3)

Tanggal: 2026-09-08
Status: Approved (brainstorming)
Scope: `app/transaction-form.tsx`, `components/transaction/*`, `hooks/useNoteSuggestions.ts`

## 1. Masalah

- Image 1: lingkaran merah = sisa flex kosong di `KeyboardAwareScrollView`
  (`flex-1` + `contentContainer flexGrow:1`). Saat kategori sedikit (4 + Add),
  konten atas pendek, ScrollView tetap memenuhi layar → gap antara note field
  dan keypad.
- Label kategori sekarang di dalam card sempit → `Fo...` / `B...` tidak jelas.
- Note suggestions hanya muncul saat draft cocok
  (`useNoteSuggestions`: `if (!draft.trim()) return []`) → tidak seperti Image 3
  yang menampilkan chips riwayat saat keyboard buka.
- Keypad 4×4 memasangkan `×/÷` sebaris; referensi memasangkan `+/×` dan `-/÷`.

## 2. Keputusan (approved user)

- Pendekatan A: top scroll + bottom fixed.
- Kategori tetap kotak, label di luar box, 1 baris ellipsis ala referensi.
- Bottom card gabungan note+amount. Chips tampil saat fokus walau draft kosong.
- Keypad tanpa Today/✓, susunan operator samakan referensi.
- Save bar tetap satu-satunya submit.

## 3. Arsitektur layout

```
SafeAreaView
 └ View flex-1
    ├ Header (X | Expenses Income Transfer | household pill) — tidak berubah
    ├ ScrollView flex-1 = `KeyboardAwareScrollView` (`contentContainer
    │   flexGrow:1, space-between`; tetap satu-satunya mekanisme keyboard —
    │   tanpa `KeyboardAvoidingView` sesuai PRD)
    │   ├ Repeat-last pill (tidak berubah)
    │   └ CategoryGrid / TransferDual
    └ Bottom fixed (di luar ScrollView)
        ├ Account pill floating overlap (BCA + date pill)
        ├ Bottom card [icon | note .... amount IDR]
        │   └ Chips horizontal (saat note fokus)
        ├ Keypad (saat !noteFocused)
        └ Save bar
```

Gap hilang karena bottom selalu nempel bawah, tidak lagi tergantung tinggi grid.

## 4. Kategori

- Ikon box tetap kotak `aspectRatio:1`, `Radius.md`, `Shadow.card`.
- Label dipindah ke luar box: kolom penuh, `numberOfLines={1}`,
  `ellipsizeMode="tail"`, font 12, center — muat ~9-10 karakter
  (`Daily nes.`, `Trans`) seperti referensi.
- Selected: `borderWidth:2, borderColor: primary`.
- `accessibilityLabel` = nama penuh.

## 5. Bottom card + chips + keyboard-avoiding (syarat utama)

- Satu card: `[✎ TextInput note .... amount + IDR]`, tanpa ikon kamera.
  Kamera dihilangkan — tidak ada fitur receipt di scope ini. Amount read-only display (tap → kembali ke keypad mode).
- Chips: `FlatList` horizontal dalam card, `max 5`, dari transaksi terakhir
  kategori ini. Hanya saat kategori dipilih (expense/income); transfer tidak
  ada kategori → tidak ada chips. Tampil saat `noteFocused` walau draft kosong;
  tap chip → `setNote(chip)`. Saat draft ada → filter `includes` seperti sekarang.
- Keyboard (PRD melarang `KeyboardAvoidingView`): note input tetap di dalam
  satu `KeyboardAwareScrollView` dengan `contentContainer {flexGrow:1,
  justifyContent:'space-between'}` (blok atas: kategori, blok bawah menempel
  bawah: akun + card + chips). Saat `noteFocused`, keypad unmount dan
  `KeyboardAwareScrollView` otomatis scroll field ke atas keyboard device
  (`keyboardShouldPersistTaps="handled"`). Tidak ada kode scroll manual.
- Counter `n/200` tetap, warna amber ≥150, error ≥180.

## 6. Keypad

- 4 kolom. Kolom aksi kanan split pada baris 2-3:
  - R1: `1 2 3 ⌫`
  - R2: `4 5 6 [+|×]` (dua tombol setengah lebar dalam satu sel)
  - R3: `7 8 9 [-|÷]`
  - R4: `. 0 (span 2 kolom) spacer`
- Operator `*`/`/` tetap dinormalisasi ke `×`/`÷`.
- Evaluasi ekspresi (`evaluateKeypadExpression`) tidak berubah.
- Teken operator: `C.primary`, digit: `textPrimary`. Patuhi NativeWind v4:
  tidak ada `style` callback di `Pressable`; pakai `useState pressed`.

## 7. Data flow / validasi (tidak berubah)

- `type`, `amountText`, `accountId`, `toAccountId`, `categoryId`, `date`, `note`
  state tetap. `signedAmount`, `canSubmit`, duplicate-check ±24h, discard guard,
  repeat-last, TransferDual, account sheet, date picker — tidak berubah.
- Error inline (amount/account/category/date) tetap di posisi masing-masing;
  error note tetap di card.

## 8. Error handling

- Keyboard gagal terangkat → fallback `onFocus scrollToEnd` + `Keyboard.dismiss`
  saat pilih kategori/tipe (perilaku sekarang dipertahankan).
- Chips query `undefined` → sembunyikan chips, jangan blokir submit.

## 9. Verifikasi

- `npx tsc --noEmit`, `npm run lint`.
- Manual `expo start`: (a) kategori sedikit → tidak ada gap; (b) tap note →
  keyboard device muncul, card + chips terlihat, tidak ketutup; (c) tap kategori
  → keyboard turun, keypad kembali; (d) operator `+× -÷` evaluasi benar;
  (e) dark mode hooks (`useThemeColors`), `className` NativeWind, ikon Feather.
- `npm test` hanya jika menyentuh `utils/` atau `convex/` (tidak direncanakan).

## 10. Non-goals

- Lingkaran kategori, tombol Today/✓ kuning, upload foto receipt.
- Perubahan schema Convex, PRD amounts/permission.
