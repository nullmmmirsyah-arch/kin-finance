let recognizer: ((uri: string) => Promise<string>) | null = null;

export function setOcrRecognizer(fn: (uri: string) => Promise<string>) {
  recognizer = fn;
}

export async function recognizeImageText(localUri: string): Promise<string> {
  if (recognizer) return recognizer(localUri);
  try {
    const mod = await import("@react-native-ml-kit/text-recognition").catch(() => null);
    type Recognizer = { recognize: (url: string) => Promise<{ text: string }> };
    const m = mod as unknown as { default?: Recognizer; TextRecognition?: Recognizer } | null;
    const rec = m?.default ?? m?.TextRecognition;
    if (!rec) throw new Error("OCR_UNAVAILABLE");
    const res = await rec.recognize(localUri);
    return res.text ?? "";
  } catch {
    throw new Error("Text recognition is unavailable — type the amount manually.");
  }
}
