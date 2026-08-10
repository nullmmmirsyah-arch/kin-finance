import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useThemeColors } from "@/constants/theme";
import { TRANSACTION_TYPES, TransactionType } from "@/constants/transactions";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Chip } from "@/components/Chip";
import { SelectField } from "@/components/SelectField";
import { DateField } from "@/components/DateField";
import { useSnackbar } from "@/components/Snackbar";
import { formatNumber } from "@/utils/format";

export default function TransactionForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const transactionId = params.id;
  const isEdit = transactionId !== undefined;
  const C = useThemeColors();
  const { show } = useSnackbar();

  const getResult = useQuery(
    api.transactions.get,
    isEdit
      ? { transactionId: transactionId as Id<"transactions"> }
      : "skip",
  );
  const accountResult = useQuery(api.accounts.list);
  const categoryResult = useQuery(api.categories.list);
  const createTransaction = useMutation(api.transactions.create);
  const updateTransaction = useMutation(api.transactions.update);
  const removeTransaction = useMutation(api.transactions.remove);

  const [type, setType] = useState<TransactionType>("expense");
  const [amountText, setAmountText] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const editingTx = useMemo(
    () => (isEdit ? getResult?.transaction : undefined),
    [isEdit, getResult],
  );

  const seeded = useRef(false);
  useEffect(() => {
    if (editingTx && !seeded.current) {
      seeded.current = true;
      setType(editingTx.type);
      setAmountText(formatNumber(Math.abs(editingTx.amount)));
      setAccountId(editingTx.accountId);
      setToAccountId(editingTx.toAccountId ?? null);
      setCategoryId(editingTx.categoryId ?? null);
      setDate(new Date(editingTx.date));
      setNote(editingTx.note ?? "");
    }
  }, [editingTx]);

  const accountOptions = useMemo(() => {
    const accounts = accountResult?.accounts ?? [];
    const options = accounts.map((a) => ({ id: a._id, label: a.name }));
    const addIfMissing = (
      id: Id<"accounts"> | undefined,
      name: string | undefined,
    ) => {
      if (id && name && !options.some((o) => o.id === id)) {
        options.push({ id, label: name });
      }
    };
    if (isEdit && editingTx) {
      addIfMissing(editingTx.accountId, editingTx.account?.name);
      addIfMissing(editingTx.toAccountId, editingTx.toAccount?.name);
    }
    return options;
  }, [accountResult, isEdit, editingTx]);

  const categoryOptions = useMemo(() => {
    const categories = categoryResult?.categories ?? [];
    return categories
      .filter((c) => c.type === type)
      .map((c) => ({ id: c._id, label: c.name }));
  }, [categoryResult, type]);

  useEffect(() => {
    if (categoryResult === undefined) return;
    if (
      type !== "transfer" &&
      categoryId !== null &&
      !categoryOptions.some((o) => o.id === categoryId)
    ) {
      setCategoryId(null);
    }
  }, [categoryResult, type, categoryId, categoryOptions]);

  const handleTypeChange = (t: TransactionType) => {
    setType(t);
    if (t === "transfer") {
      setCategoryId(null);
    } else {
      setToAccountId(null);
    }
  };

  const parsedAmount = amountText.replace(/,/g, "");
  const amountValue =
    parsedAmount === "" || parsedAmount === "-"
      ? null
      : Number(parsedAmount);
  const signedAmount =
    type === "expense" ? -1 * (amountValue ?? 0) : (amountValue ?? 0);

  const canSubmit =
    amountValue !== null &&
    amountValue > 0 &&
    Number.isFinite(amountValue) &&
    !isLoading &&
    (type === "transfer"
      ? accountId !== null &&
        toAccountId !== null &&
        accountId !== toAccountId
      : accountId !== null && categoryId !== null);

  const handleSubmit = async () => {
    setError(null);
    setAmountError(null);
    if (
      amountValue === null ||
      amountValue <= 0 ||
      !Number.isFinite(amountValue)
    ) {
      setAmountError("Amount is required and must be greater than zero.");
      return;
    }
    if (type === "transfer") {
      if (accountId === null || toAccountId === null) {
        setError("From and To accounts are required.");
        return;
      }
      if (accountId === toAccountId) {
        setError("From and To accounts must be different.");
        return;
      }
    } else {
      if (accountId === null || categoryId === null) {
        setError("Account and category are required.");
        return;
      }
    }
    if (date.getTime() > Date.now()) {
      setError("Transaction date cannot be in the future.");
      return;
    }

    setIsLoading(true);
    try {
      const base = {
        amount: signedAmount,
        type,
        note: note.trim(),
        date: date.getTime(),
        accountId: accountId as Id<"accounts">,
        categoryId:
          type === "transfer"
            ? undefined
            : (categoryId as Id<"categories">),
        toAccountId:
          type === "transfer" ? (toAccountId as Id<"accounts">) : undefined,
      };
      if (isEdit && transactionId !== undefined) {
        await updateTransaction({
          transactionId: transactionId as Id<"transactions">,
          ...base,
        });
      } else {
        await createTransaction(base);
      }
      show(isEdit ? "Transaction updated" : "Transaction added");
      router.back();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : isEdit
            ? "Failed to update transaction."
            : "Failed to create transaction.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    setError(null);
    if (transactionId === undefined) return;
    Alert.alert(
      "Delete Transaction",
      "Delete this transaction? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setIsLoading(true);
            removeTransaction({
              transactionId: transactionId as Id<"transactions">,
            })
              .then(() => {
                show("Transaction deleted");
                router.back();
              })
              .catch((e: unknown) =>
                setError(
                  e instanceof Error
                    ? e.message
                    : "Failed to delete transaction.",
                ),
              )
              .finally(() => setIsLoading(false));
          },
        },
      ],
    );
  };

  if (accountResult === undefined || (isEdit && getResult === undefined)) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">Loading…</Text>
      </SafeAreaView>
    );
  }

  if (accountResult.accounts === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6 dark:bg-background-dark">
        <Text className="text-center text-sm text-text-secondary dark:text-text-secondary-dark">
          You are not a member of a household.
        </Text>
      </SafeAreaView>
    );
  }

  if (isEdit && getResult === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
          Transaction not found.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-row items-center gap-2 px-5 pt-4">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 48, height: 48 }}
            className="items-center justify-center"
          >
            <Feather name="arrow-left" size={22} color={C.textPrimary} />
          </Pressable>
          <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
            {isEdit ? "Edit Transaction" : "New Transaction"}
          </Text>
        </View>

        <ScrollView
          contentContainerClassName="gap-4 px-5 py-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
              Type
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {TRANSACTION_TYPES.map((t) => (
                <Chip
                  key={t.id}
                  label={t.label}
                  active={type === t.id}
                  onPress={() => handleTypeChange(t.id)}
                />
              ))}
            </View>
          </View>

          <Input
            label="Amount"
            placeholder="0"
            value={amountText}
            onChangeText={setAmountText}
            keyboardType={
              Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"
            }
            amount
            error={amountError}
          />

          {type === "transfer" ? (
            <>
              <SelectField
                label="From account"
                placeholder="Select account"
                value={accountId}
                options={accountOptions}
                onSelect={setAccountId}
              />
              <SelectField
                label="To account"
                placeholder="Select account"
                value={toAccountId}
                options={accountOptions.filter((o) => o.id !== accountId)}
                onSelect={setToAccountId}
              />
            </>
          ) : (
            <>
              <SelectField
                label="Account"
                placeholder="Select account"
                value={accountId}
                options={accountOptions}
                onSelect={setAccountId}
              />
              <SelectField
                label="Category"
                placeholder="Select category"
                value={categoryId}
                options={categoryOptions}
                onSelect={setCategoryId}
              />
              {categoryResult !== undefined && categoryOptions.length === 0 ? (
                <View className="gap-1.5">
                  <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
                    {categoryResult?.isOwner === true
                      ? `No ${type === "income" ? "income" : "expense"} categories yet. Create one to continue.`
                      : `No ${type === "income" ? "income" : "expense"} categories available yet.`}
                  </Text>
                  {categoryResult?.isOwner === true ? (
                    <Pressable
                      onPress={() => router.push("/category-form")}
                      accessibilityRole="button"
                      className="min-h-12 items-center justify-center"
                    >
                      <Text className="text-sm font-medium text-primary dark:text-primary-dark">
                        Create a category
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </>
          )}

          <DateField
            label="Date"
            value={date}
            maximumDate={new Date()}
            onChange={setDate}
          />

          <Input
            label="Note (optional)"
            placeholder="e.g. Lunch with colleagues"
            value={note}
            onChangeText={setNote}
            maxLength={200}
          />

          {error ? (
            <Text className="text-sm text-error dark:text-error-dark">{error}</Text>
          ) : null}

          <Button
            title={isEdit ? "Save Changes" : "Save Transaction"}
            onPress={handleSubmit}
            loading={isLoading}
            disabled={!canSubmit}
          />

          {isEdit ? (
            <Button
              title="Delete Transaction"
              variant="danger"
              onPress={handleDelete}
              loading={isLoading}
              disabled={isLoading}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
