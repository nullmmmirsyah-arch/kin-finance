import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { useShareIntent } from "expo-share-intent";
import { api } from "@/convex/_generated/api";
import {
  extractDates,
  fingerprintScore,
  pickAmount,
  pickNote,
  resolveCategory,
} from "@/utils/receiptParser";
import { recognizeImageText } from "@/lib/ocr";
import { useSnackbar } from "@/components/Snackbar";
import { getConvexErrorMessage } from "@/lib/errors";

type Template = {
  label: string;
  keywords: string[];
  amountStrategy: "largest" | "afterKeyword";
  amountKeyword?: string | undefined;
  noteStrategy: "firstLine" | "afterKeyword" | "merchantLine";
  noteKeyword?: string | undefined;
  defaultAccountId?: string;
  defaultType: "expense" | "income" | "transfer";
  defaultCategoryId?: string;
  keywordRules?: { keyword: string; categoryId: string }[];
};

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
      tpl.templates === null ||
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
        let bestScore = 0;
        let top: Template[] = [];
        for (const t of templates) {
          const s = fingerprintScore(t.keywords, rawText);
          if (s > 0 && s > bestScore) {
            bestScore = s;
            top = [t];
          } else if (s > 0 && s === bestScore) {
            top.push(t);
          }
        }
        const applyTemplate = (
          best: Template,
          text: string,
          imgUri: string | undefined,
        ) => {
          const amount = pickAmount(
            text,
            best.amountStrategy,
            best.amountKeyword ?? undefined,
          );
          const note = pickNote(
            text.split("\n"),
            best.noteStrategy,
            best.noteKeyword ?? undefined,
          );
          const now = Date.now();
          const parsed = extractDates(text)[0];
          const params: Record<string, string> = {};
          if (amount !== null) params.prefillAmount = String(amount);
          if (note) params.prefillNote = note;
          params.prefillType = best.defaultType;
          if (
            parsed !== undefined &&
            Number.isFinite(parsed) &&
            parsed <= now
          ) {
            params.prefillDate = String(parsed);
          }
          if (best.defaultAccountId)
            params.prefillAccountId = best.defaultAccountId;
          const categoryId = resolveCategory(text, {
            keywordRules: best.keywordRules ?? [],
            ...(best.defaultCategoryId
              ? { defaultCategoryId: best.defaultCategoryId }
              : {}),
          });
          if (categoryId) params.prefillCategoryId = categoryId;
          if (imgUri) params.receiptImageUri = imgUri;
          params.receiptLabel = best.label;
          router.push({ pathname: "/transaction-form", params });
        };
        if (top.length === 0) {
          const params: Record<string, string> = { rawText };
          if (imageUri) params.imageUri = imageUri;
          router.push({ pathname: "/receipt-map", params });
        } else if (top.length === 1 && top[0]) {
          applyTemplate(top[0], rawText, imageUri);
        } else {
          const shown = top.slice(0, 3);
          const buttons = shown.map((t) => ({
            text: t.label,
            onPress: () => applyTemplate(t, rawText, imageUri),
          }));
          if (top.length > 3) {
            buttons.push({
              text: "Lainnya…",
              onPress: () => {
                const params: Record<string, string> = { rawText };
                if (imageUri) params.imageUri = imageUri;
                router.push({ pathname: "/receipt-map", params });
              },
            });
          }
          buttons.push({ text: "Batal", onPress: () => {} });
          Alert.alert("Pilih sumber", "Beberapa template cocok.", buttons);
        }
      } finally {
        resetShareIntent();
        processingRef.current = false;
      }
    })();
  }, [hasShareIntent, shareIntent, tpl, resetShareIntent, router, show]);

  return null;
}
