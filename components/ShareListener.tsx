import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { useRouter, useRootNavigationState } from "expo-router";
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
  const rootState = useRootNavigationState();
  const tpl = useQuery(api.receiptTemplates.list);
  const processingRef = useRef(false);
  const attemptsRef = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(
    () => () => {
      if (retryTimer.current !== null) clearTimeout(retryTimer.current);
    },
    [],
  );

  const isNotReadyError = (e: unknown) =>
    e instanceof Error && e.message.includes("before mounting");

  // Returns false when the container isn't ready yet (caller retries).
  // Defined outside the effect for readability; effect deps include router.
  const dispatchPush = useCallback(
    (
      pathname: "/receipt-map" | "/transaction-form",
      params: Record<string, string>,
    ): boolean => {
      try {
        router.push({ pathname, params });
        return true;
      } catch (e) {
        if (isNotReadyError(e)) return false;
        throw e;
      }
    },
    [router],
  );

  useEffect(() => {
    if (
      !rootState?.key ||
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
        ): boolean => {
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
          return dispatchPush("/transaction-form", params);
        };
        const goToMap = (text: string, imgUri: string | undefined): boolean => {
          const params: Record<string, string> = { rawText: text };
          if (imgUri) params.imageUri = imgUri;
          return dispatchPush("/receipt-map", params);
        };
        const scheduleRetry = () => {
          attemptsRef.current += 1;
          processingRef.current = false;
          retryTimer.current = setTimeout(() => {
            retryTimer.current = null;
            setRetryTick((t) => t + 1);
          }, 300);
        };
        let dispatched: boolean;
        if (top.length === 0) {
          dispatched = goToMap(rawText, imageUri);
        } else if (top.length === 1 && top[0]) {
          dispatched = applyTemplate(top[0], rawText, imageUri);
        } else {
          const shown = top.slice(0, 3);
          const buttons = shown.map((t) => ({
            text: t.label,
            onPress: () => {
              if (!applyTemplate(t, rawText, imageUri)) {
                show("Navigation not ready — please try again.");
              }
            },
          }));
          if (top.length > 3) {
            buttons.push({
              text: "Lainnya…",
              onPress: () => {
                if (!goToMap(rawText, imageUri)) {
                  show("Navigation not ready — please try again.");
                }
              },
            });
          }
          buttons.push({ text: "Batal", onPress: () => {} });
          Alert.alert("Pilih sumber", "Beberapa template cocok.", buttons);
          dispatched = true;
        }
        if (!dispatched && attemptsRef.current < 8) {
          // Container raced us: keep the intent and retry shortly.
          scheduleRetry();
          return;
        }
      } finally {
        if (retryTimer.current !== null && attemptsRef.current < 8) {
          // Retry scheduled: keep the intent pending.
        } else {
          resetShareIntent();
          attemptsRef.current = 0;
        }
        processingRef.current = false;
      }
    })();
  }, [rootState?.key, hasShareIntent, shareIntent, tpl, resetShareIntent, router, show, retryTick, dispatchPush]);

  return null;
}
