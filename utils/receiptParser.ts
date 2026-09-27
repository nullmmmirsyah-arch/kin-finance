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
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12) continue;
    const d = new Date(Number(m[3]), month - 1, day);
    if (!Number.isNaN(d.getTime())) out.push(d.getTime());
  }
  const reId = /(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})/gi;
  while ((m = reId.exec(text)) !== null) {
    const day = Number(m[1]);
    if (day < 1 || day > 31) continue;
    const d = new Date(Number(m[3]), BULAN[m[2].toLowerCase()], day);
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

export function resolveCategory(
  rawText: string,
  template: {
    keywordRules: { keyword: string; categoryId: string }[];
    defaultCategoryId?: string;
  },
): string | null {
  const lower = rawText.toLowerCase();
  for (const rule of template.keywordRules) {
    const kw = rule.keyword.trim().toLowerCase();
    if (kw !== "" && lower.includes(kw)) return rule.categoryId;
  }
  return template.defaultCategoryId ?? null;
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
