# Transaction Form Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ubah layar input transaksi ala aplikasi referensi tanpa mengubah logic bisnis apa pun.

**Architecture:** Satu `KeyboardAwareScrollView` dengan content `space-between` (blok kategori di atas, blok akun + bottom card + chips menempel bawah sehingga gap Image 1 hilang); keypad 4 kolom dengan sel operator split; chips riwayat tampil saat note fokus walau draft kosong.

**Tech Stack:** Expo SDK 54, React Native, NativeWind v4 (`className`), `react-native-keyboard-controller` (`KeyboardAwareScrollView` saja — `KeyboardAvoidingView` dilarang PRD), Convex queries yang sudah ada, vitest.

## Global Constraints

- Install paket hanya via `npx expo install <pkg>` — tidak ada paket baru di plan ini.
- Styling via NativeWind `className`; warna runtime via `useThemeColors()` — jangan `Colors` langsung, jangan hardcode hex.
- Ikon hanya `@expo/vector-icons/Feather`.
- Jangan pakai `style` callback di `Pressable` (`style={({ pressed }) => ...}` merusak NativeWind v4) — pakai `useState` pressed + `style` statis.
- Amount bare whole number tanpa simbol currency (PRD §1) — tidak ada label `IDR`.
- Setiap `convex/*.ts` tidak disentuh; tidak ada perubahan schema.
- `handleKeypad` di `app/transaction-form.tsx:542-566` sudah menangani `⌫ + - × ÷ * / . digit` — keypad baru tidak boleh mengirim simbol lain.
- Verifikasi tiap task: `npx tsc --noEmit` dan `npm run lint`.

---

### Task 1: Chips riwayat saat draft kosong (`useNoteSuggestions`)

**Files:**
- Modify: `hooks/useNoteSuggestions.ts`
- Test: `tests/useNoteSuggestions.test.ts`

**Interfaces:**
- Consumes: `filterNoteSuggestions(notes: string[], draft: string, limit?: number): string[]` (ada, tidak diubah).
- Produces: `recentNoteSuggestions(notes: string[], limit?: number): string[]` — note unik non-kosong, urutan terbaru dulu, max `limit` (default 5). Hook `useNoteSuggestions(categoryId, draft)` mengembalikan `recentNoteSuggestions(notes)` saat `draft.trim() === ""`, else `filterNoteSuggestions(notes, draft, 5)`. Saat `categoryId` null → tetap `"skip"` (tidak ada chips, termasuk mode transfer).

- [ ] **Step 1: Write the failing test**

```ts
import { recentNoteSuggestions } from "@/hooks/useNoteSuggestions";

it("returns unique recent notes when draft is empty", () =>
  expect(
    recentNoteSuggestions(["Rajal 18.08.2026", "", "Test future", "Rajal 18.08.2026", "Pisang goreng madu"]),
  ).toEqual(["Rajal 18.08.2026", "Test future", "Pisang goreng madu"]));

it("limits recent notes", () =>
  expect(recentNoteSuggestions(["a", "b", "c", "d"], 2)).toEqual(["a", "b"]));
```

Append ke `tests/useNoteSuggestions.test.ts:9` (import `recentNoteSuggestions` di line 2).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/useNoteSuggestions.test.ts`
Expected: FAIL with "does not provide an export named 'recentNoteSuggestions'"

- [ ] **Step 3: Write minimal implementation**

Di `hooks/useNoteSuggestions.ts`, setelah `filterNoteSuggestions` (line 11):

```ts
export function recentNoteSuggestions(notes: string[], limit = 5): string[] {
  const uniq = Array.from(new Set(notes.filter((n) => n && n.trim())));
  return uniq.slice(0, limit);
}
```

Dan ubah return hook (line 33) menjadi:

```ts
return useMemo(
  () =>
    draft.trim()
      ? filterNoteSuggestions(notes, draft, 5)
      : recentNoteSuggestions(notes, 5),
  [notes, draft],
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/useNoteSuggestions.test.ts`
Expected: PASS (4 tests: 2 lama + 2 baru)

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit && git add hooks/useNoteSuggestions.ts tests/useNoteSuggestions.test.ts && git commit -m "feat: recent note suggestions when draft empty"
```

---

### Task 2: Label kategori di luar box (`CategoryGrid`)

**Files:**
- Modify: `components/transaction/CategoryGrid.tsx`

**Interfaces:**
- Consumes: props `CategoryGrid({ options, value, onSelect, isOwner, onAdd })` — tidak berubah.
- Produces: render yang sama secara kontrak (tile kategori + tile Add, `onSelect(id)`), hanya struktur visual berubah.

- [ ] **Step 1: Restruktur `renderItem` — label keluar dari box**

Ganti isi `renderItem` (`CategoryGrid.tsx:50-114`) sehingga tiap item adalah kolom luar selebar `cell`:

```tsx
renderItem={({ item }) => {
  if (item.kind === "add") {
    return (
      <View style={{ width: cell, alignItems: "center", gap: 6 }}>
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="Add category"
          style={[
            Shadow.card,
            {
              width: cell,
              aspectRatio: 1,
              borderRadius: Radius.md,
              backgroundColor: C.background,
              borderWidth: 1,
              borderColor: C.border,
              borderStyle: "dashed",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            },
          ]}
        >
          <Feather name="plus" size={28} color={C.primary} />
          <Text className="text-[11px] font-medium" style={{ color: C.primary }}>
            Add
          </Text>
        </Pressable>
      </View>
    );
  }
  const active = item.option.id === value;
  return (
    <View style={{ width: cell, alignItems: "center", gap: 6 }}>
      <Pressable
        onPress={() => onSelect(item.option.id)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={item.option.label}
        style={[
          Shadow.card,
          {
            width: "100%",
            aspectRatio: 1,
            borderRadius: Radius.md,
            backgroundColor: C.background,
            borderWidth: active ? 2 : 1,
            borderColor: active ? C.primary : C.border,
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <CategoryIcon name={item.option.icon ?? "other"} size={32} />
      </Pressable>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        className="text-center text-xs"
        style={{ color: C.textPrimary, maxWidth: "100%" }}
      >
        {item.option.label}
      </Text>
    </View>
  );
}}
```

Hapus `className="p-2"` pada Pressable kategori (padding dalam yang menyempitkan label). Font label naik 11px → 12px (`text-xs`).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: PASS, no errors in `CategoryGrid.tsx`
Run: `npm run lint`
Expected: PASS (no new warnings)

- [ ] **Step 3: Commit**

```bash
git add components/transaction/CategoryGrid.tsx && git commit -m "feat: category label outside icon box for readability"
```

- [ ] **Step 4: Manual check via `expo start`**

Kategori panjang (mis. buat "Daily necessities") tampil terpotong 1 baris ala referensi (`Daily nes…`), bukan `Fo…`; selected = border 2px primary; tile Add tetap dashed + owner-only.

---

### Task 3: Keypad operator berpasangan ala referensi

**Files:**
- Modify: `components/transaction/Keypad.tsx`

**Interfaces:**
- Consumes: prop `onKey(k: string)` — tidak berubah; hanya simbol `1-9 0 . ⌫ + - × ÷` yang dikirim (sudah didukung `handleKeypad`).
- Produces: grid R1 `1 2 3 ⌫`, R2 `4 5 6 [+|×]`, R3 `7 8 9 [-|÷]`, R4 `. 0(span 2) spacer`.

- [ ] **Step 1: Ganti body `Keypad` + tambah sel split**

Tambah komponen `SplitKey` setelah `KeyButton` (line 61), lalu ganti seluruh body `Keypad` (line 67-86) menjadi:

```tsx
export function Keypad({ onKey }: KeypadProps) {
  const C = useThemeColors();
  return (
    <View
      className="gap-1.5 p-3"
      style={{ borderTopWidth: 1, borderColor: C.border, backgroundColor: C.background }}
    >
      <View className="flex-row gap-1.5">
        {["1", "2", "3"].map((k) => (
          <KeyButton key={k} label={k} onKey={onKey} />
        ))}
        <View style={{ width: 8 }} />
        <KeyButton label="⌫" onKey={onKey} />
      </View>
      <View className="flex-row gap-1.5">
        {["4", "5", "6"].map((k) => (
          <KeyButton key={k} label={k} onKey={onKey} />
        ))}
        <View style={{ width: 8 }} />
        <SplitKey labels={["+", "×"]} onKey={onKey} />
      </View>
      <View className="flex-row gap-1.5">
        {["7", "8", "9"].map((k) => (
          <KeyButton key={k} label={k} onKey={onKey} />
        ))}
        <View style={{ width: 8 }} />
        <SplitKey labels={["-", "÷"]} onKey={onKey} />
      </View>
      <View className="flex-row gap-1.5">
        <KeyButton label="." onKey={onKey} />
        <View style={{ flex: 2, flexDirection: "row" }}>
          <KeyButton label="0" onKey={onKey} />
        </View>
        <View style={{ width: 8 }} />
        <View style={{ flex: 1 }} />
      </View>
    </View>
  );
}
```

Dan komponen `SplitKey` (taruh setelah `KeyButton`, sebelum `Keypad`):

```tsx
function SplitKey({ labels, onKey }: { labels: [string, string]; onKey: (k: string) => void }) {
  const C = useThemeColors();
  const [pressed, setPressed] = useState<string | null>(null);
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
      {labels.map((label) => (
        <Pressable
          key={label}
          onPress={() => onKey(label)}
          onPressIn={() => setPressed(label)}
          onPressOut={() => setPressed(null)}
          accessibilityRole="button"
          accessibilityLabel={KEY_LABELS[label] ?? label}
          style={{
            flex: 1,
            height: 52,
            borderRadius: Radius.md,
            backgroundColor: pressed === label ? C.surface : C.background,
            borderWidth: 1,
            borderColor: C.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: C.primary, fontWeight: "700", fontSize: 16 }}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
```

Hapus konstanta `KEYS` (`Keypad.tsx:7-12`) yang tidak lagi dipakai. `OP_KEYS` dan `KEY_LABELS` tetap dipakai (`KeyButton` + `SplitKey`).

Catatan layout: `KeyButton` punya `flex:1`, jadi wrapper `SplitKey` (`flex:1`) berisi 2 tombol `flex:1` sejajar selebar 1 tombol. Baris R4: `.` (flex 1) + wrapper `0` (flex 2 = selebar 2 digit) + spacer + view kosong flex 1 (sejajar kolom aksi, menjaga alignment).

- [ ] **Step 2: Typecheck + lint + unit eval**

Run: `npx tsc --noEmit`
Expected: PASS
Run: `npm run lint`
Expected: PASS
Run: `npx vitest run tests/keypadEval.test.ts`
Expected: PASS (evaluator tidak disentuh)

- [ ] **Step 3: Commit**

```bash
git add components/transaction/Keypad.tsx && git commit -m "feat: pair operators like reference keypad"
```

- [ ] **Step 4: Manual check via `expo start`**

Ketik `50000+25000` → display evaluasi `75,000`; `⌫` hapus 1 char; operator diabaikan saat input kosong; dark mode operator `primary`, digit `textPrimary`.

---

### Task 4: Restruktur form — `space-between` + bottom card + chips + pill overlap

**Files:**
- Modify: `app/transaction-form.tsx`

**Interfaces:**
- Consumes: `noteSuggestions` dari Task 1 (sekarang berisi riwayat saat draft kosong), `noteFocused`, semua state/handler yang ada — tidak ada signature berubah.
- Produces: layout baru dengan kontrak UX: (a) konten pendek → bottom block menempel bawah (tanpa gap tengah); (b) `noteFocused` → chips horizontal terlihat di dalam card; (c) note input selalu di dalam `KeyboardAwareScrollView` sehingga terangkat di atas keyboard device.

- [ ] **Step 1: `contentContainer` jadi `space-between` + bagi 2 blok**

Ubah `KeyboardAwareScrollView` (`transaction-form.tsx:755-760`):

```tsx
<KeyboardAwareScrollView
  className="flex-1"
  contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between" }}
  keyboardShouldPersistTaps="handled"
  bottomOffset={16}
>
```

Bungkus repeat-pill + category/transfer + error kategori (line 761-808) dalam:

```tsx
<View>
  ...repeat pill + category grid / transfer + errors (pindahkan utuh)...
</View>
```

Dan bungkus amount row + account/date row + note field (line 810-975) dalam:

```tsx
<View>
  ...amount + account/date + note + chips (lihat Step 2-4)...
</View>
```

- [ ] **Step 2: Gabung amount + note jadi satu bottom card**

Ganti amount row (line 810-849) + note field container (line 913-949) menjadi satu card. Struktur baru pengganti kedua blok tersebut (account/date row di Step 3 tetap di antara keduanya — urutan akhir: pill overlap → card):

```tsx
<View
  className="gap-2 rounded-2xl border p-3"
  style={{ borderColor: noteFocused ? C.primary : C.border, backgroundColor: C.background }}
>
  <View className="flex-row items-center gap-2">
    <Feather name="edit-3" size={16} color={C.textSecondary} />
    <TextInput
      placeholder="Add a note"
      placeholderTextColor={C.textSecondary}
      value={note}
      onChangeText={setNote}
      maxLength={NOTE_MAX_LENGTH}
      onFocus={() => setNoteFocused(true)}
      onBlur={() => setNoteFocused(false)}
      className="flex-1 text-sm"
      style={{ color: C.textPrimary }}
      returnKeyType="done"
      onSubmitEditing={() => setNoteFocused(false)}
    />
    <Pressable
      onPress={() => {
        setNoteFocused(false);
        Keyboard.dismiss();
      }}
    >
      <View className="items-end">
        <Text className="text-2xl font-bold tracking-tight" style={{ color: C.textPrimary }}>
          {(() => {
            const hasOp = /[+\-×÷*\/]/.test(amountText);
            if (hasOp) {
              return evalValue !== null ? formatNumber(evalValue) : amountText || "0";
            }
            const formatted = formatAmountInput(amountText);
            if (formatted) return formatted;
            return amountValue !== null && amountValue !== 0 ? formatNumber(amountValue) : "0";
          })()}
        </Text>
      </View>
    </Pressable>
  </View>
  <View className="flex-row items-center justify-end">
    <Text
      className="text-xs"
      style={{
        color:
          note.length >= 180
            ? C.error
            : note.length >= 150
              ? C.chartAmber
              : C.textSecondary,
      }}
    >
      {note.length}/{NOTE_MAX_LENGTH}
    </Text>
  </View>
  {wasDecimalTruncated(amountText) ? (
    <Text className="text-right text-xs" style={{ color: C.chartAmber }}>
      Decimals truncated — whole numbers only
    </Text>
  ) : null}
  {amountError ? (
    <Text className="text-right text-xs text-error dark:text-error-dark">{amountError}</Text>
  ) : null}
  {error ? (
    <View className="rounded-xl px-3 py-2" style={{ backgroundColor: `${C.error}14` }}>
      <Text className="text-xs font-medium" style={{ color: C.error }}>
        {error}
      </Text>
    </View>
  ) : null}
  {noteFocused && noteSuggestions.length > 0 ? (
    <FlatList
      data={noteSuggestions}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(s) => s}
      contentContainerStyle={{ gap: 8 }}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item: s }) => (
        <Pressable
          onPress={() => setNote(s)}
          style={{
            borderWidth: 1,
            borderColor: C.border,
            backgroundColor: C.surface,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
          }}
        >
          <Text className="text-xs" style={{ color: C.textPrimary }}>
            {s}
          </Text>
        </Pressable>
      )}
    />
  ) : null}
</View>
```

`FlatList` sudah di-import (line 6). Syarat tampil `noteFocused &&` adalah inti perilaku Image 3 — chips + keyboard device muncul bersamaan. Blok lama yang diganti: amount row (810-849) dan note container + suggestions vertikal (913-975) dihapus; error `dateError` untuk non-transfer (line 972-974) pindahkan ke bawah card.

- [ ] **Step 3: Account pill floating overlap di atas card**

Bungkus account/date row (line 852-910) dengan wrapper overlap — ganti `<View className="px-4 pb-2 flex-row ...">` pembuka menjadi:

```tsx
<View className="z-10 flex-row items-center gap-2 px-6" style={{ marginBottom: -14 }}>
```

(`px-6` agar pill menyempit dari tepi card; `-14` menaikkan pill menutupi border atas card; `z-10` di atas card.) Bungkus card Step 2 dengan padding atas ekstra: tambah `paddingTop: 22` pada style card agar isi tidak tertutup pill. Bungkus luar bottom block tetap `px-4 pb-2 gap-2` seperti sekarang.

- [ ] **Step 4: Typecheck + lint + commit**

Run: `npx tsc --noEmit`
Expected: PASS
Run: `npm run lint`
Expected: PASS

```bash
git add app/transaction-form.tsx && git commit -m "feat: bottom card with note+amount, floating account pill, no middle gap"
```

- [ ] **Step 5: Manual check via `expo start` (acceptance)**

Kategori sedikit → tidak ada gap antara card dan keypad. Tap note → keyboard device muncul, card + chips (`pisang goreng madu` dkk saat draft kosong) terlihat penuh di atas keyboard. Ketik `pis` → chips terfilter. Tap kategori → keyboard turun, keypad kembali. Tap amount → kembali ke mode keypad. Transfer mode → tidak ada chips. Dark mode terbaca.

---

### Task 5: Verifikasi akhir

- [ ] **Step 1: Full check**

Run: `npx tsc --noEmit`
Expected: PASS
Run: `npm run lint`
Expected: PASS
Run: `npm test`
Expected: PASS seluruh suite (termasuk `tests/useNoteSuggestions.test.ts` + `tests/keypadEval.test.ts`)

- [ ] **Step 2: Regression manual `expo start`**

Edit flow (`?id=`): seed amount/akun/kategori/tanggal/note benar; Save Changes + Delete + Undo tetap. Repeat-last pill tetap. Duplicate alert ±24h tetap. Discard guard (X dengan form kotor → konfirmasi) tetap. Member tanpa tile Add. Akun hidden tidak muncul di sheet.

---

## File map

| File | Task | Perubahan |
|---|---|---|
| `hooks/useNoteSuggestions.ts` | 1 | Tambah `recentNoteSuggestions`, hook return riwayat saat draft kosong |
| `tests/useNoteSuggestions.test.ts` | 1 | 2 test baru |
| `components/transaction/CategoryGrid.tsx` | 2 | Label keluar box, font 12 |
| `components/transaction/Keypad.tsx` | 3 | Sel split `[+\|×]` `[- \|÷]`, `0` lebar ganda |
| `app/transaction-form.tsx` | 4 | `space-between`, bottom card, chips saat fokus, pill overlap |
| Tidak disentuh | — | `convex/*`, `TransferDual`, validasi, dupe, discard, date picker, Save bar logic |
