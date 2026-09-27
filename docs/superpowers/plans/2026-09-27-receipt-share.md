# Share Bukti Bank → Prefill Transaksi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menerima share teks/gambar bukti bank via `expo-share-intent`, OCR on-device, cocokkan template per-bank, prefill `transaction-form` untuk konfirmasi user.

**Architecture:** Seam OCR (`lib/ocr.ts`) + parser murni (`utils/receiptParser.ts`) + tabel Convex `receiptTemplates` per-household + `ShareListener` di `_layout` + rute `receipt-map` + prefill params ke `transaction-form`. Android v1.

**Tech Stack:** Expo SDK 54, `expo-share-intent`, on-device ML Kit (`@react-native-ml-kit/text-recognition`), Convex 1.43, vitest, NativeWind.

## Global Constraints

- Install native deps hanya via `npx expo install <pkg>` agar versi cocok SDK 54 — never bare `npm install`.
- Setelah ubah `convex/*.ts`, jalankan `npx convex codegen` dulu, baru `npx tsc --noEmit`.
- Verifikasi tiap task: `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest saat sentuh pure utils / Convex functions).
- Styling: NativeWind `className`, tema via `useThemeColors()`, jangan hardcode warna; jangan pakai `style` callback di `Pressable`.
- Backend: tiap handler wajib `ctx.auth.getUserIdentity()`, throw `ConvexError` string ramah; client via `getConvexErrorMessage`.
- Native change (share-intent, ML Kit) butuh EAS build baru — tidak bisa OTA saja; tidak jalan di Expo Go.
- Amount integer-only (`formatNumber`, `formatAmountInput`); tanggal tidak boleh future (`validateTransactionDate`).

---

## File Map

- `utils/receiptParser.ts` (baru): `extractAmounts`, `extractDates`, `fingerprintScore`, `pickAmount`, `pickNote`.
- `tests/receiptParser.test.ts` (baru): fixtures teks BCA/Mandiri/DANA.
- `convex/schema.ts` (ubah): tambah tabel `receiptTemplates` + index `by_householdId`.
- `convex/receiptTemplates.ts` (baru): `list`/`create`/`update`/`remove`.
- `constants/validation.ts` (ubah): `validateTemplateLabel`, `validateTemplateKeywords`.
- `lib/ocr.ts` (baru): `recognizeImageText(uri)` seam + stub + adapter ML Kit.
- `app/_layout.tsx` (ubah): mount `ShareListener`, daftarkan rute `receipt-map` + prefill params.
- `components/ShareListener.tsx` (baru): `useShareIntent` → match template → router.
- `app/receipt-map.tsx` (baru): mapping sekali per sumber baru.
- `app/transaction-form.tsx` (ubah): terima prefill params + banner sumber + thumbnail.

---

### Task 1: Parser murni + fingerprint

**Files:**
- Create: `utils/receiptParser.ts`
- Test: `tests/receiptParser.test.ts`

**Interfaces:**
- Consumes: tidak ada (pure, tanpa deps).
- Produces: `extractAmounts(text: string): number[]`, `extractDates(text: string): number[]`, `fingerprintScore(keywords: string[], text: string): number`, `pickAmount(text: string, strategy: "largest" | "afterKeyword", keyword?: string): number | null`, `pickNote(lines: string[], strategy: "firstLine" | "afterKeyword" | "merchantLine", keyword?: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { extractAmounts, extractDates, fingerprintScore } from "../utils/receiptParser";

describe("extractAmounts", () => {
  it("parses Rp 150.000 and Rp 150.000,00 as 150000", () => {
    expect(extractAmounts("Transfer Rp 150.000 berhasil")).toEqual([150000]);
    expect(extractAmounts("Nominal Rp 150.000,00")).toEqual([150000]);
  });
});

describe("fingerprintScore", () => {
  it("counts case-insensitive keyword hits", () => {
    expect(fingerprintScore(["BCA", "m-BCA"], "m-bca transfer BCA")).toBe(2);
  });
});

describe("extractDates", () => {
  it("parses dd/mm/yyyy", () => {
    expect(extractDates("27/09/2026").length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/receiptParser.test.ts`
Expected: FAIL with "Cannot find module '../utils/receiptParser'".

- [ ] **Step 3: Write minimal implementation**

```ts
export function extractAmounts(text: string): number[] {
  const out: number[] = [];
  const re = /(?:Rp|IDR)\s*([\d.]+(?:,\d{1,2})?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const intPart = m[1].split(",")[0].replace(/\./g, "").replace(/[^0-9]/g, "");
    if (intPart === "") continue;
    const v = Number(intPart);
    if (Number.isSafeInteger(v) && v >= 1) out.push(v);
  }
  return out;
}

const BULAN: Record<string, number> = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
  juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
};

export function extractDates(text: string): number[] {
  const out: number[] = [];
  const reNum = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/g;
  let m: RegExpExecArray | null;
  while ((m = reNum.exec(text)) !== null) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (!Number.isNaN(d.getTime())) out.push(d.getTime());
  }
  const reId = /(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})/gi;
  while ((m = reId.exec(text)) !== null) {
    const d = new Date(Number(m[3]), BULAN[m[2].toLowerCase()], Number(m[1]));
    if (!Number.isNaN(d.getTime())) out.push(d.getTime());
  }
  return out;
}

export function fingerprintScore(keywords: string[], text: string): number {
  const lower = text.toLowerCase();
  let s = 0;
  for (const k of keywords) {
    if (k.trim() !== "" && lower.includes(k.toLowerCase())) s += 1;
  }
  return s;
}

export function pickAmount(text: string, strategy: "largest" | "afterKeyword", keyword?: string): number | null {
  if (strategy === "afterKeyword" && keyword) {
    const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
    if (idx >= 0) {
      const tail = extractAmounts(text.slice(idx, idx + 300));
      if (tail.length > 0) return tail[0];
    }
  }
  const all = extractAmounts(text);
  return all.length === 0 ? null : Math.max(...all);
}

export function pickNote(lines: string[], strategy: "firstLine" | "afterKeyword" | "merchantLine", keyword?: string): string {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (strategy === "afterKeyword" && keyword) {
    const i = clean.findIndex((l) => l.toLowerCase().includes(keyword.toLowerCase()));
    if (i >= 0 && clean[i + 1]) return clean[i + 1].slice(0, 200);
  }
  if (strategy === "merchantLine") {
    const nonNum = clean.filter((l) => extractAmounts(l).length === 0);
    if (nonNum.length > 0) return nonNum.sort((a, b) => b.length - a.length)[0].slice(0, 200);
  }
  return clean[0].slice(0, 200);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/receiptParser.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add utils/receiptParser.ts tests/receiptParser.test.ts
git commit -m "feat: add receipt parser and fingerprint matcher"
```

### Task 2: Tabel Convex receiptTemplates + validasi

**Files:**
- Modify: `convex/schema.ts`
- Modify: `constants/validation.ts`
- Create: `convex/receiptTemplates.ts`
- Test: `tests/receiptTemplates.test.ts` (ikut pola `tests/budgets.list.test.ts` + `convex-test`)

**Interfaces:**
- Consumes: `extractAmounts` tidak dipakai di server; pakai `getUserAndMembership` dari `./helpers`, `validateTemplateLabel/Keywords` dari `@/constants/validation`.
- Produces: `api.receiptTemplates.list` → `{ templates }`, `create`/`update`/`remove` mutations. Tipe template: `{ _id, householdId, label, icon?, keywords, amountStrategy, amountKeyword?, noteStrategy, noteKeyword?, defaultAccountId?, defaultType, defaultCategoryId?, keywordRules: { keyword: string; categoryId: Id<"categories"> }[] }`.

- [ ] **Step 1: Write the failing test (label unik per household)**

```ts
import { describe, expect, it } from "vitest";
import { validateTemplateLabel, validateTemplateKeywords } from "../constants/validation";

describe("validateTemplateLabel", () => {
  it("rejects empty and duplicates-length", () => {
    expect(validateTemplateLabel("")).not.toBeNull();
    expect(validateTemplateLabel("BCA Mobile")).toBeNull();
  });
});

describe("validateTemplateKeywords", () => {
  it("requires 1-8 keywords", () => {
    expect(validateTemplateKeywords([])).not.toBeNull();
    expect(validateTemplateKeywords(["BCA"])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/receiptTemplates.test.ts`
Expected: FAIL (file belum ada / fungsi belum ada).

- [ ] **Step 3: Tambah validasi di `constants/validation.ts`**

```ts
export const TEMPLATE_LABEL_MIN = 2;
export const TEMPLATE_LABEL_MAX = 30;

export function validateTemplateLabel(name: string): string | null {
  const t = name.trim();
  if (t.length === 0) return "Template label is required.";
  if (t.length < TEMPLATE_LABEL_MIN) return `Template label must be at least ${TEMPLATE_LABEL_MIN} characters.`;
  if (t.length > TEMPLATE_LABEL_MAX) return `Template label must be at most ${TEMPLATE_LABEL_MAX} characters.`;
  return null;
}

export function validateTemplateKeywords(kw: string[]): string | null {
  const clean = kw.map((k) => k.trim()).filter(Boolean);
  if (clean.length < 1) return "Add at least one keyword.";
  if (clean.length > 8) return "At most 8 keywords.";
  return null;
}
```

- [ ] **Step 4: Tambah tabel di `convex/schema.ts`**

```ts
receiptTemplates: defineTable({
  householdId: v.id("households"),
  label: v.string(),
  icon: v.optional(v.string()),
  keywords: v.array(v.string()),
  amountStrategy: v.union(v.literal("largest"), v.literal("afterKeyword")),
  amountKeyword: v.optional(v.string()),
  noteStrategy: v.union(v.literal("firstLine"), v.literal("afterKeyword"), v.literal("merchantLine")),
  noteKeyword: v.optional(v.string()),
  defaultAccountId: v.optional(v.id("accounts")),
  defaultType: v.union(v.literal("expense"), v.literal("income"), v.literal("transfer")),
  defaultCategoryId: v.optional(v.id("categories")),
  keywordRules: v.array(v.object({ keyword: v.string(), categoryId: v.id("categories") })),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_householdId", ["householdId"]),
```

- [ ] **Step 5: Buat `convex/receiptTemplates.ts` (ikut pola `convex/categories.ts:41-92`)**

```ts
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserAndMembership, findUserAndMembership, getScopedDoc } from "./helpers";
import { validateTemplateKeywords, validateTemplateLabel } from "../constants/validation";

const amountStrategy = v.union(v.literal("largest"), v.literal("afterKeyword"));
const noteStrategy = v.union(v.literal("firstLine"), v.literal("afterKeyword"), v.literal("merchantLine"));
const defaultType = v.union(v.literal("expense"), v.literal("income"), v.literal("transfer"));

export const list = query({
  args: {},
  handler: async (ctx) => {
    const result = await findUserAndMembership(ctx);
    if (result === null) return { templates: null };
    const all = await ctx.db
      .query("receiptTemplates")
      .withIndex("by_householdId", (q) => q.eq("householdId", result.membership.householdId))
      .collect();
    return { templates: all };
  },
});

export const create = mutation({
  args: {
    label: v.string(),
    icon: v.optional(v.string()),
    keywords: v.array(v.string()),
    amountStrategy,
    amountKeyword: v.optional(v.string()),
    noteStrategy,
    noteKeyword: v.optional(v.string()),
    defaultAccountId: v.optional(v.id("accounts")),
    defaultType,
    defaultCategoryId: v.optional(v.id("categories")),
    keywordRules: v.array(v.object({ keyword: v.string(), categoryId: v.id("categories") })),
  },
  handler: async (ctx, args) => {
    const { membership, user } = await getUserAndMembership(ctx);
    const labelErr = validateTemplateLabel(args.label);
    if (labelErr) throw new ConvexError(labelErr);
    const kwErr = validateTemplateKeywords(args.keywords);
    if (kwErr) throw new ConvexError(kwErr);
    const label = args.label.trim();
    const keywords = args.keywords.map((k) => k.trim()).filter(Boolean);
    const dup = await ctx.db
      .query("receiptTemplates")
      .withIndex("by_householdId", (q) => q.eq("householdId", membership.householdId))
      .filter((q) => q.eq(q.field("label"), label))
      .first();
    if (dup !== null) throw new ConvexError("Template label already exists.");
    if (args.defaultAccountId !== undefined) {
      await getScopedDoc(ctx, "accounts", args.defaultAccountId, membership.householdId);
    }
    if (args.defaultCategoryId !== undefined) {
      const cat = await getScopedDoc(ctx, "categories", args.defaultCategoryId, membership.householdId);
      if ((cat as { type: string }).type !== args.defaultType && args.defaultType !== "transfer") {
        throw new ConvexError("Category type must match transaction type.");
      }
    }
    const now = Date.now();
    const id = await ctx.db.insert("receiptTemplates", {
      householdId: membership.householdId,
      label,
      icon: args.icon,
      keywords,
      amountStrategy: args.amountStrategy,
      amountKeyword: args.amountKeyword,
      noteStrategy: args.noteStrategy,
      noteKeyword: args.noteKeyword,
      defaultAccountId: args.defaultAccountId,
      defaultType: args.defaultType,
      defaultCategoryId: args.defaultCategoryId,
      keywordRules: args.keywordRules,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});
```

`update`/`remove`: salin pola `convex/categories.ts:94-180` (getScopedDoc + validasi sama + patch `updatedAt`). Member boleh manage (tanpa `requireOwner`, seperti budget).

- [ ] **Step 6: Codegen + verifikasi**

Run: `npx convex codegen && npx tsc --noEmit && npm run lint && npx vitest run tests/receiptTemplates.test.ts`
Expected: PASS semua.

- [ ] **Step 7: Commit**

```bash
git add convex/schema.ts convex/receiptTemplates.ts constants/validation.ts tests/receiptTemplates.test.ts
git commit -m "feat: add receiptTemplates table and CRUD"
```

### Task 3: OCR seam + native share-intent install

**Files:**
- Create: `lib/ocr.ts`
- Modify: `app.config.js` (tambah plugin `expo-share-intent`)
- Modify: `package.json` (via expo install)

**Interfaces:**
- Consumes: `@react-native-ml-kit/text-recognition` (adapter; jika prebuild gagal, stub tetap jalan).
- Produces: `recognizeImageText(localUri: string): Promise<string>` — throw `ConvexError`-style Error ramah bila OCR tak tersedia.

- [ ] **Step 1: Install native packages**

Run: `npx expo install expo-share-intent @react-native-ml-kit/text-recognition`
Expected: `package.json` bertambah dua deps versi cocok SDK 54.

- [ ] **Step 2: Tambah config plugin di `app.config.js`**

```js
[
  "expo-share-intent",
  {
    iosActivationRules: {
      NSExtensionActivationSupportsText: true,
      NSExtensionActivationSupportsImageWithMaxCount: 1,
    },
    androidIntentFilters: ["text/*", "image/*"],
  },
],
```

- [ ] **Step 3: Buat `lib/ocr.ts` seam**

```ts
let recognizer: ((uri: string) => Promise<string>) | null = null;

export function setOcrRecognizer(fn: (uri: string) => Promise<string>) {
  recognizer = fn;
}

export async function recognizeImageText(localUri: string): Promise<string> {
  if (recognizer) return recognizer(localUri);
  try {
    const mod = await import("@react-native-ml-kit/text-recognition").catch(() => null);
    const rec = (mod as unknown as { TextRecognition?: { recognize: (url: string) => Promise<{ text: string }> } } | null)?.TextRecognition;
    if (!rec) throw new Error("OCR_UNAVAILABLE");
    const res = await rec.recognize(localUri);
    return res.text ?? "";
  } catch {
    throw new Error("Text recognition is unavailable — type the amount manually.");
  }
}
```

- [ ] **Step 4: Verifikasi (tanpa device)**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. Catatan: uji share sungguhan butuh `expo prebuild` + EAS build dev — di luar task ini.

- [ ] **Step 5: Commit**

```bash
git add lib/ocr.ts app.config.js package.json
git commit -m "feat: add OCR seam and share-intent config"
```

### Task 4: ShareListener + receipt-map + prefill form

**Files:**
- Create: `components/ShareListener.tsx`
- Create: `app/receipt-map.tsx`
- Modify: `app/_layout.tsx:104-121` (tambah `<Stack.Screen name="receipt-map" />`, mount `<ShareListener />` dalam `SnackbarProvider`)
- Modify: `app/transaction-form.tsx` (prefill params + banner + thumbnail)

**Interfaces:**
- Consumes: `useShareIntent` dari `expo-share-intent`, `api.receiptTemplates.list`, `pickAmount/pickNote/fingerprintScore`, `recognizeImageText`, `useSnackbar().show`, `getConvexErrorMessage`.
- Produces: navigasi `router.push({ pathname: "/receipt-map", params: { rawText, imageUri } })` atau `router.push({ pathname: "/transaction-form", params: { prefillAmount, prefillDate, prefillNote, prefillAccountId, prefillCategoryId, receiptImageUri, receiptLabel } })`.

- [ ] **Step 1: Buat `components/ShareListener.tsx`**

```tsx
import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { useShareIntent } from "expo-share-intent";
import { api } from "@/convex/_generated/api";
import { fingerprintScore, pickAmount, pickNote } from "@/utils/receiptParser";
import { recognizeImageText } from "@/lib/ocr";
import { useSnackbar } from "@/components/Snackbar";
import { getConvexErrorMessage } from "@/lib/errors";

export function ShareListener() {
  const router = useRouter();
  const { show } = useSnackbar();
  const { shareIntent, resetShareIntent } = useShareIntent();
  const tpl = useQuery(api.receiptTemplates.list);

  useEffect(() => {
    if (!shareIntent || tpl === undefined) return;
    (async () => {
      try {
        let rawText = shareIntent.text ?? "";
        let imageUri: string | undefined;
        if (shareIntent.type === "media" || shareIntent.type === "file") {
          const img = (shareIntent.files ?? []).find((f) => f.mimeType.startsWith("image/"));
          if (img) {
            imageUri = img.path;
            try {
              rawText = await recognizeImageText(img.path);
            } catch (e) {
              show(getConvexErrorMessage(e, "Could not read text — fill manually."));
            }
          }
        }
        if (!rawText && !imageUri) return;
        const templates = tpl.templates ?? [];
        let best: (typeof templates)[number] | null = null;
        let bestScore = 0;
        for (const t of templates) {
          const s = fingerprintScore(t.keywords, rawText);
          if (s > bestScore) { bestScore = s; best = t; }
        }
        if (!best) {
          router.push({ pathname: "/receipt-map", params: { rawText, imageUri } });
        } else {
          const amount = pickAmount(rawText, best.amountStrategy, best.amountKeyword ?? undefined);
          const note = pickNote(rawText.split("\n"), best.noteStrategy, best.noteKeyword ?? undefined);
          router.push({
            pathname: "/transaction-form",
            params: {
              prefillAmount: amount !== null ? String(amount) : undefined,
              prefillNote: note || undefined,
              prefillAccountId: best.defaultAccountId ?? undefined,
              prefillCategoryId: best.defaultCategoryId ?? undefined,
              receiptImageUri: imageUri,
              receiptLabel: best.label,
            },
          });
        }
      } finally {
        resetShareIntent();
      }
    })();
  }, [shareIntent, tpl, resetShareIntent, router, show]);

  return null;
}
```

- [ ] **Step 2: Buat `app/receipt-map.tsx` minimal** — form label + icon (opsional) + keyword (prefill 1 kata dari baris pertama) + kandidat amount (`extractAmounts(rawText)` radio) + akun/kategori default (pakai pola `AccountPill`/`CategoryGrid` dari `transaction-form.tsx:1024-1070`) + simpan via `api.receiptTemplates.create` lalu push ke `transaction-form` dengan prefill. Error inline + Snackbar via `getConvexErrorMessage`.

- [ ] **Step 3: Prefill di `transaction-form.tsx`** — baca `useLocalSearchParams<{ prefillAmount?: string; prefillNote?: string; prefillAccountId?: string; prefillCategoryId?: string; receiptImageUri?: string; receiptLabel?: string }>()`; `useEffect` sekali saat mount (guard `seeded`) isi `amountText`/`note`/`accountId`/`categoryId`; banner kuning di atas form bila `receiptLabel` ada: `"Dari {receiptLabel} — periksa sebelum simpan"` + thumbnail `expo-image` bila `receiptImageUri` ada.

- [ ] **Step 4: Verifikasi**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ShareListener.tsx app/receipt-map.tsx app/_layout.tsx app/transaction-form.tsx
git commit -m "feat: add share listener, receipt mapping, and prefill"
```

### Task 5: Kategori 3 lapis + uji manual

**Files:**
- Modify: `components/ShareListener.tsx` (tambah resolusi kategori)
- Modify: `app/receipt-map.tsx` (input keywordRules)
- Test: `tests/receiptParser.test.ts` (tambah kasus tie + afterKeyword)

**Interfaces:**
- Consumes: template `keywordRules`, `defaultCategoryId`, `useNoteSuggestions` existing.
- Produces: `resolveCategory(rawText, template): Id<"categories"> | null` — (1) keywordRules pertama yang match, (2) defaultCategoryId, (3) null (fallback histori di form).

- [ ] **Step 1: Tambah test tie + afterKeyword**

```ts
import { pickAmount, fingerprintScore } from "../utils/receiptParser";
import { describe, expect, it } from "vitest";

describe("pickAmount afterKeyword", () => {
  it("picks amount after keyword", () => {
    expect(pickAmount("Total Rp 10.000\nAdmin Rp 2.000", "afterKeyword", "Admin")).toBe(2000);
  });
});

describe("fingerprint tie", () => {
  it("equal scores tie", () => {
    expect(fingerprintScore(["BCA"], "BCA")).toBe(fingerprintScore(["BRI"], "BRI"));
  });
});
```

- [ ] **Step 2: Run test, expect FAIL lalu implement jika kurang, hingga PASS**

Run: `npx vitest run tests/receiptParser.test.ts`
Expected akhir: PASS.

- [ ] **Step 3: Implement `resolveCategory` di ShareListener** — loop `keywordRules`, return `categoryId` pertama yang keyword-nya ada di `rawText` (case-insensitive); else `defaultCategoryId ?? null`.

- [ ] **Step 4: Full verification**

Run: `npx convex codegen && npx tsc --noEmit && npm run lint && npm test`
Expected: PASS semua. Lalu manual di dev build: share teks + screenshot dari BCA/DANA → mapping sekali → share kedua otomatis prefill → konfirmasi simpan → cek duplicate-check tetap muncul bila sama dalam 24 jam.

- [ ] **Step 5: Commit**

```bash
git add components/ShareListener.tsx app/receipt-map.tsx tests/receiptParser.test.ts
git commit -m "feat: add 3-layer category resolution for receipts"
```
