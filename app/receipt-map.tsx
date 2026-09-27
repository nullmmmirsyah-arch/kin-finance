import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Feather from "@expo/vector-icons/Feather";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Radius, useThemeColors } from "@/constants/theme";
import {
  validateTemplateKeywords,
  validateTemplateLabel,
  NOTE_MAX_LENGTH,
} from "@/constants/validation";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useSnackbar } from "@/components/Snackbar";
import { getConvexErrorMessage } from "@/lib/errors";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import {
  extractAmounts,
  extractDates,
} from "@/utils/receiptParser";
import { formatNumber } from "@/utils/format";

type DefaultType = "expense" | "income" | "transfer";

const TYPE_OPTIONS: { id: DefaultType; label: string }[] = [
  { id: "expense", label: "Expense" },
  { id: "income", label: "Income" },
  { id: "transfer", label: "Transfer" },
];

function keywordPrefill(rawText: string): string {
  const firstLine = rawText
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return "";
  const words = firstLine.split(/[^A-Za-z0-9]+/).filter((w) => w.length >= 4);
  if (words.length === 0) return "";
  return words.reduce((a, b) => (b.length > a.length ? b : a));
}

function firstNoteLine(rawText: string): string {
  const line = rawText
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return (line ?? "").slice(0, NOTE_MAX_LENGTH);
}

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function RadioRow({
  selected,
  label,
  sub,
  onPress,
  testID,
}: {
  selected: boolean;
  label: string;
  sub?: string | null;
  onPress: () => void;
  testID?: string;
}) {
  const C = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      testID={testID}
      className="flex-row items-center gap-3 rounded-xl border px-4 py-3"
      style={{
        borderColor: selected ? C.primary : C.border,
        backgroundColor: C.background,
      }}
    >
      <Feather
        name={selected ? "check-circle" : "circle"}
        size={18}
        color={selected ? C.primary : C.textSecondary}
      />
      <View className="flex-1">
        <Text
          className="text-sm font-medium"
          style={{ color: C.textPrimary }}
        >
          {label}
        </Text>
        {sub ? (
          <Text className="text-xs" style={{ color: C.textSecondary }}>
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function SectionTitle({ children }: { children: string }) {
  const C = useThemeColors();
  return (
    <Text
      className="text-[13px] font-semibold uppercase tracking-wider"
      style={{ color: C.textSecondary }}
    >
      {children}
    </Text>
  );
}

export default function ReceiptMap() {
  const router = useRouter();
  const rawParams = useLocalSearchParams<{
    rawText?: string;
    imageUri?: string;
  }>();
  const rawText = Array.isArray(rawParams.rawText)
    ? (rawParams.rawText[0] ?? "")
    : (rawParams.rawText ?? "");
  const imageUri = Array.isArray(rawParams.imageUri)
    ? rawParams.imageUri[0]
    : rawParams.imageUri;
  const C = useThemeColors();
  const { show } = useSnackbar();

  const accountResult = useQuery(api.accounts.list);
  const categoryResult = useQuery(api.categories.list);
  const createTemplate = useMutation(api.receiptTemplates.create);

  const amounts = useMemo(() => extractAmounts(rawText), [rawText]);
  const dateCandidates = useMemo(() => {
    const now = Date.now();
    const past = [...new Set(extractDates(rawText))].filter((t) => t <= now);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const today = startOfToday.getTime();
    const all = past.some((t) => t === today) ? past : [...past, today];
    return all.sort((a, b) => b - a);
  }, [rawText]);

  const [amountText, setAmountText] = useState(() =>
    amounts.length > 0 ? formatNumber(Math.max(...amounts)) : "",
  );
  const [selectedDate, setSelectedDate] = useState<number>(
    () => dateCandidates[0] ?? Date.now(),
  );
  const [label, setLabel] = useState("");
  const [keyword, setKeyword] = useState(() => keywordPrefill(rawText));
  const [icon, setIcon] = useState("");
  const [defaultType, setDefaultType] = useState<DefaultType>("expense");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [keywordError, setKeywordError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const accounts = useMemo(
    () => accountResult?.accounts ?? [],
    [accountResult],
  );
  const categories = useMemo(
    () => (categoryResult?.categories ?? []).filter((c) => c.type === defaultType),
    [categoryResult, defaultType],
  );

  const handleTypeChange = (t: DefaultType) => {
    setDefaultType(t);
    if (t === "transfer") {
      setCategoryId(null);
    } else if (categoryId !== null) {
      const stillVisible = (categoryResult?.categories ?? []).some(
        (c) => c._id === categoryId && c.type === t,
      );
      if (!stillVisible) setCategoryId(null);
    }
  };

  const handleSave = async () => {
    setLabelError(null);
    setKeywordError(null);
    setAmountError(null);
    const labelErr = validateTemplateLabel(label);
    if (labelErr) {
      setLabelError(labelErr);
      void hapticError();
      return;
    }
    const kwErr = validateTemplateKeywords(keyword.trim() === "" ? [] : [keyword]);
    if (kwErr) {
      setKeywordError(kwErr);
      void hapticError();
      return;
    }
    const amount = Number(amountText.replace(/,/g, ""));
    if (!Number.isSafeInteger(amount) || amount < 1) {
      setAmountError("Pick an amount from the receipt or type one.");
      void hapticError();
      return;
    }
    const now = Date.now();
    const date = selectedDate > now ? now : selectedDate;
    setIsLoading(true);
    try {
      const cleanIcon = icon.trim();
      await createTemplate({
        label: label.trim(),
        ...(cleanIcon === "" ? {} : { icon: cleanIcon }),
        keywords: [keyword.trim()],
        amountStrategy: "largest",
        noteStrategy: "firstLine",
        ...(accountId === null
          ? {}
          : { defaultAccountId: accountId as Id<"accounts"> }),
        defaultType,
        ...(categoryId === null || defaultType === "transfer"
          ? {}
          : { defaultCategoryId: categoryId as Id<"categories"> }),
        keywordRules: [],
      });
      void hapticSuccess();
      show("Receipt template saved");
      const params: Record<string, string> = {
        prefillAmount: String(amount),
        prefillDate: String(date),
        receiptLabel: label.trim(),
      };
      const note = firstNoteLine(rawText);
      if (note) params.prefillNote = note;
      if (accountId !== null) params.prefillAccountId = accountId;
      if (categoryId !== null && defaultType !== "transfer")
        params.prefillCategoryId = categoryId;
      if (imageUri) params.receiptImageUri = imageUri;
      router.replace({ pathname: "/transaction-form", params });
    } catch (e) {
      void hapticError();
      show(getConvexErrorMessage(e, "Failed to save template."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-row items-center gap-3 px-4 pt-2 pb-1">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{ width: 48, height: 48 }}
          className="items-center justify-center"
        >
          <Feather name="arrow-left" size={22} color={C.textPrimary} />
        </Pressable>
        <Text
          className="flex-1 text-lg font-bold"
          style={{ color: C.textPrimary }}
        >
          Map receipt
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={{ width: "100%", height: 180, borderRadius: Radius.md }}
            contentFit="cover"
            accessibilityLabel="Receipt image"
          />
        ) : null}

        <View className="gap-2">
          <SectionTitle>Receipt text</SectionTitle>
          <ScrollView
            style={{
              maxHeight: 160,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: Radius.sm,
              backgroundColor: C.background,
              padding: 12,
            }}
          >
            <Text
              selectable
              className="text-sm"
              style={{ color: C.textPrimary }}
            >
              {rawText === "" ? "No text captured." : rawText}
            </Text>
          </ScrollView>
        </View>

        <View className="gap-2">
          <SectionTitle>Amount</SectionTitle>
          {amounts.length > 0 ? (
            <FlatList
              data={[...new Set(amounts)].sort((a, b) => b - a)}
              keyExtractor={(v) => String(v)}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => (
                <RadioRow
                  selected={amountText.replace(/,/g, "") === String(item)}
                  label={formatNumber(item)}
                  onPress={() => {
                    setAmountText(formatNumber(item));
                    setAmountError(null);
                  }}
                />
              )}
            />
          ) : (
            <Text className="text-sm" style={{ color: C.textSecondary }}>
              No amounts found — type the amount below.
            </Text>
          )}
          <Input
            label="Amount"
            amount
            keyboardType="numeric"
            placeholder="0"
            value={amountText}
            onChangeText={(t) => {
              setAmountText(t);
              if (amountError) setAmountError(null);
            }}
            error={amountError}
          />
        </View>

        <View className="gap-2">
          <SectionTitle>Date</SectionTitle>
          <FlatList
            data={dateCandidates}
            keyExtractor={(v) => String(v)}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => (
              <RadioRow
                selected={selectedDate === item}
                label={formatDay(item)}
                onPress={() => setSelectedDate(item)}
              />
            )}
          />
        </View>

        <View className="gap-2">
          <SectionTitle>Template</SectionTitle>
          <Input
            label="Label"
            placeholder="e.g. BCA transfer"
            value={label}
            onChangeText={(t) => {
              setLabel(t);
              if (labelError) setLabelError(null);
            }}
            error={labelError}
            maxLength={30}
          />
          <Input
            label="Keyword"
            placeholder="e.g. BCA"
            value={keyword}
            onChangeText={(t) => {
              setKeyword(t);
              if (keywordError) setKeywordError(null);
            }}
            error={keywordError}
            autoCapitalize="none"
          />
          <Input
            label="Icon (optional)"
            placeholder="Leave empty to skip"
            value={icon}
            onChangeText={setIcon}
            autoCapitalize="none"
          />
        </View>

        <View className="gap-2">
          <SectionTitle>Default type</SectionTitle>
          <View className="flex-row gap-2">
            {TYPE_OPTIONS.map((t) => {
              const active = defaultType === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => handleTypeChange(t.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className="flex-1 items-center rounded-xl border px-3 py-3"
                  style={{
                    borderColor: active ? C.primary : C.border,
                    backgroundColor: active ? C.surface : C.background,
                  }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{
                      color: active ? C.primary : C.textSecondary,
                    }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="gap-2">
          <SectionTitle>Default account</SectionTitle>
          {accountResult === undefined ? (
            <Text className="text-sm" style={{ color: C.textSecondary }}>
              Loading accounts…
            </Text>
          ) : accounts.length === 0 ? (
            <Text className="text-sm" style={{ color: C.textSecondary }}>
              No accounts yet — you can pick one later in the form.
            </Text>
          ) : (
            <FlatList
              data={accounts}
              keyExtractor={(a) => a._id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => (
                <RadioRow
                  selected={accountId === item._id}
                  label={item.name}
                  sub={formatNumber(item.balance)}
                  onPress={() =>
                    setAccountId((prev) =>
                      prev === item._id ? null : item._id,
                    )
                  }
                />
              )}
            />
          )}
        </View>

        {defaultType !== "transfer" ? (
          <View className="gap-2">
            <SectionTitle>Default category</SectionTitle>
            {categoryResult === undefined ? (
              <Text className="text-sm" style={{ color: C.textSecondary }}>
                Loading categories…
              </Text>
            ) : categories.length === 0 ? (
              <Text className="text-sm" style={{ color: C.textSecondary }}>
                No categories of this type — you can pick one later in the form.
              </Text>
            ) : (
              <FlatList
                data={categories}
                keyExtractor={(c) => c._id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                renderItem={({ item }) => (
                  <RadioRow
                    selected={categoryId === item._id}
                    label={item.name}
                    onPress={() =>
                      setCategoryId((prev) =>
                        prev === item._id ? null : item._id,
                      )
                    }
                  />
                )}
              />
            )}
          </View>
        ) : null}
      </ScrollView>

      <View
        className="px-4 py-3 border-t"
        style={{ borderColor: C.border, backgroundColor: C.background }}
      >
        <Button
          title="Save template & continue"
          onPress={() => void handleSave()}
          loading={isLoading}
          disabled={isLoading}
        />
      </View>
    </SafeAreaView>
  );
}
