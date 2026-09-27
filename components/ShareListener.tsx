import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { useShareIntent } from "expo-share-intent";
import { api } from "@/convex/_generated/api";
import { fingerprintScore, pickAmount, pickNote, resolveCategory } from "@/utils/receiptParser";
import { recognizeImageText } from "@/lib/ocr";
import { useSnackbar } from "@/components/Snackbar";
import { getConvexErrorMessage } from "@/lib/errors";

export function ShareListener() {
  const router = useRouter();
  const { show } = useSnackbar();
  const { shareIntent, resetShareIntent, hasShareIntent } = useShareIntent();
  const tpl = useQuery(api.receiptTemplates.list);
  const processingRef = useRef(false);

  useEffect(() => {
    if (
      !hasShareIntent ||
      !shareIntent ||
      shareIntent.type === null ||
      tpl === undefined ||
      processingRef.current
    ) {
      return;
    }
    processingRef.current = true;
    (async () => {
      try {
        let rawText = "";
        let imageUri: string | undefined;
        if (shareIntent.type === "media" || shareIntent.type === "file") {
          const img = (shareIntent.files ?? []).find((f) =>
            f.mimeType?.startsWith("image/"),
          );
          if (img) {
            imageUri = img.path;
            try {
              rawText = await recognizeImageText(img.path);
            } catch (e) {
              show(
                getConvexErrorMessage(
                  e,
                  "Could not read text — fill manually.",
                ),
              );
            }
          }
        } else if (shareIntent.type === "text") {
          rawText = shareIntent.text ?? "";
        } else if (shareIntent.type === "weburl") {
          rawText = shareIntent.webUrl ?? shareIntent.text ?? "";
        }
        if (!rawText && !imageUri) return;
        const templates = tpl.templates ?? [];
        let best: (typeof templates)[number] | null = null;
        let bestScore = 0;
        for (const t of templates) {
          const s = fingerprintScore(t.keywords, rawText);
          if (s > bestScore) {
            bestScore = s;
            best = t;
          }
        }
        if (!best) {
          const params: Record<string, string> = { rawText };
          if (imageUri) params.imageUri = imageUri;
          router.push({ pathname: "/receipt-map", params });
        } else {
          const amount = pickAmount(
            rawText,
            best.amountStrategy,
            best.amountKeyword ?? undefined,
          );
          const note = pickNote(
            rawText.split("\n"),
            best.noteStrategy,
            best.noteKeyword ?? undefined,
          );
          const params: Record<string, string> = {};
          if (amount !== null) params.prefillAmount = String(amount);
          if (note) params.prefillNote = note;
          if (best.defaultAccountId)
            params.prefillAccountId = best.defaultAccountId;
          const categoryId = resolveCategory(rawText, {
            keywordRules: best.keywordRules ?? [],
            ...(best.defaultCategoryId
              ? { defaultCategoryId: best.defaultCategoryId }
              : {}),
          });
          if (categoryId) params.prefillCategoryId = categoryId;
          if (imageUri) params.receiptImageUri = imageUri;
          params.receiptLabel = best.label;
          router.push({ pathname: "/transaction-form", params });
        }
      } finally {
        resetShareIntent();
        processingRef.current = false;
      }
    })();
  }, [hasShareIntent, shareIntent, tpl, resetShareIntent, router, show]);

  return null;
}
