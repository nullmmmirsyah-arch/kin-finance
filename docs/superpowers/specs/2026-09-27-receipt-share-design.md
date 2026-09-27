# Share Bukti Transaksi Bank → Prefill Transaksi — Design

Tanggal: 2026-09-27 | Pendekatan: A Template Belajar (disetujui user per bagian)
Status: disetujui user per bagian (arsitektur, komponen, validasi)

## Tujuan

User men-share bukti transaksi dari m-banking / e-wallet (teks share atau
screenshot gambar) ke Kin Finance. Aplikasi membaca, mencocokkan template
per sumber bank, lalu membuka `transaction-form` yang sudah ter-prefill
(amount, tanggal, note, akun, kategori) untuk **dikonfirmasi user** sebelum
disimpan via `transactions.create` yang sudah ada. Mapping hanya dilakukan
sekali per sumber baru; berikutnya otomatis.

## Riset Context7

- `expo-share-intent` (`/achorein/expo-share-intent`, benchmark 84.82):
  config plugin `androidIntentFilters: ["text/*", "image/*"]` +
  `iosActivationRules`, hook `useShareIntent({ scheme })` dengan
  `{ shareIntent, resetShareIntent }`, tipe `text | weburl | media | file`,
  listener `onChange`/`onError`. Cara standar menerima share di Expo SDK 54.
- `expo-linking` docs (`/websites/expo_dev`): `Linking.addEventListener('url')`
  hanya untuk deep link — tidak cukup untuk share image/text, jadi tetap
  butuh `expo-share-intent`.
- Konsekuensi native: butuh `npx expo install expo-share-intent` (sesuai
  AGENTS.md, bukan bare npm), `prebuild`, EAS Build baru. Tidak jalan di
  Expo Go. Perubahan native tidak bisa OTA saja.

## Arsitektur & Scope

- Android v1 (PRD Android-first). iOS menyusul (butuh app group + share
  extension name, config terpisah).
- Seam OCR: `lib/ocr.ts` dengan interface `recognizeImageText(uri: string): Promise<string>`
  (+ `setOcrRecognizer(fn)` untuk override di test/dev). Adapter v1: on-device
  ML Kit (gratis, offline, privasi aman). Gagal → fallback tampilkan gambar
  sebagai referensi + isi manual, tidak blokir.
- Parser murni: `utils/receiptParser.ts` — `extractAmounts(text)`,
  `extractDates(text)`, `fingerprintScore(keywords, text)`. Regex-ID:
  `Rp`/`IDR` + ribuan `.` + desimal `,00` opsional, tanggal `dd/mm/yyyy`,
  `dd-mm-yyyy`, `dd MMM yyyy` (nama bulan Indonesia).
- Template tersimpan di Convex per-household agar sekeluarga ikut pakai.
- Logo TIDAK dideteksi dari citra (rapuh) — diganti label + icon pilihan user
  saat mapping pertama (mis. "BCA Mobile" + icon bank).

## Komponen & Data Flow

1. **ShareListener** di `app/_layout.tsx`: `useShareIntent()`; saat
   `shareIntent` masuk → salin ke state pending → `resetShareIntent()`.
    - `type text/weburl` → `rawText` langsung.
    - `type media/file` dengan `mimeType image/*` → `fileUri` + `recognizeImageText()` → `rawText`.
2. **Match template**: query `api.receiptTemplates.list` → skor tiap template
   = jumlah `keywords` yang muncul case-insensitive di `rawText`. Skor 0 →
   sumber baru. Skor tertinggi menang; tie (≥2 template berbagi skor maksimal
   >0) → `Alert.alert("Pilih sumber", …)` satu button per template (cap 3
   pertama + "Lainnya…" bila lebih, menuju `/receipt-map`).
3. **Sumber baru → rute `app/receipt-map.tsx`**: tampilkan `rawText` +
   thumbnail + kandidat amount/tanggal (radio), form label + icon + akun
   default + tipe default + kategori default + aturan keyword→kategori
   opsional. Simpan via `api.receiptTemplates.create`, lanjutkan sebagai draft.
4. **Sumber dikenal → draft langsung**: amount (sesuai `amountStrategy`),
   tanggal (parsed, clamp tidak future sesuai validasi), note (sesuai
   `noteStrategy`), akun/kategori default + lapis kategori (di bawah).
5. **Konfirmasi**: buka `/transaction-form` dengan params prefill
   (`prefillAmount`, `prefillDate`, `prefillNote`, `prefillAccountId`,
   `prefillCategoryId`, `prefillType`, `receiptImageUri?`) + banner sumber
   ("Dari BCA Mobile — periksa sebelum simpan") + thumbnail. Simpan tetap
   lewat flow existing termasuk duplicate-check 24 jam.
6. **Kategori 3 lapis** (urutan menang): (1) `keywordRules` template
   (`[{ keyword, categoryId }]` mis. "KOPI"→Food), (2) `defaultCategoryId`
   template, (3) saran histori `useNoteSuggestions` yang sudah ada.
   User selalu bisa ganti manual di form.

## Skema Convex Baru

`receiptTemplates` (household-scoped, pola seperti `accounts`/`categories`):

```text
householdId: id<households>
label: string                 // 2-30 chars, unik per household
icon: string | undefined      // ref icon-registry
keywords: string[]            // 1-8 kata unik fingerprint, mis. ["BCA","m-BCA"]
amountStrategy: "largest" | "afterKeyword"
amountKeyword: string | undefined  // dipakai saat afterKeyword
noteStrategy: "firstLine" | "afterKeyword" | "merchantLine"  // merchantLine = baris non-angka terpanjang (nama merchant)
noteKeyword: string | undefined  // dipakai saat noteStrategy afterKeyword
defaultAccountId: id<accounts> | undefined
defaultType: "expense" | "income" | "transfer"
defaultCategoryId: id<categories> | undefined
keywordRules: { keyword: string, categoryId: id<categories> }[]
createdBy: id<users>
createdAt / updatedAt: number
```

Fungsi: `receiptTemplates.list` (query), `create`/`update`/`remove`
(mutation, semua member boleh seperti budget — manage harian; validasi
label unik + keyword 1-8 + referensi akun/kategori se-household + tipe
kategori cocok `defaultType`). Tidak ada saldo/privacy baru — template
bukan data finansial.

## Error Handling (ikut ARCHITECTURE.md)

- Semua handler Convex: `ctx.auth.getUserIdentity()` + throw `ConvexError`
  string ramah; client via `getConvexErrorMessage`, Snackbar + haptic.
- Validasi inline di `receipt-map`; operasional via Snackbar.
- OCR gagal / tidak ada teks → fallback manual + gambar referensi.
- Tanggal future hasil parse → clamp ke hari ini (validasi existing
  menolak future).
- Amount tidak ketemu → field kosong + pesan "Nominal tidak terbaca —
  ketik manual".

## Testing

- Vitest murni: `tests/receiptParser.test.ts` — fixtures teks
  BCA/Mandiri/BRI/DANA/OVO/GoPay (amount `.`/`,00`, tanggal ID),
  `fingerprintScore` (match, tie, no-match).
- Verifikasi: `npx convex codegen` (setelah ubah `convex/*`) →
  `npx tsc --noEmit` → `npm run lint` → `npm test`.
- Manual: dev build (`com.kinfinance.app.dev`) + share asli dari aplikasi
  bank; Expo Go tidak bisa menguji share intent.

## Non-Goals v1

- iOS share extension, deteksi logo citra, AI/LLM inferensi, auto-save tanpa
  konfirmasi, multi-file share, PDF struk, edit/hapus template massal
  (CRUD dasar saja).
