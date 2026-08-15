import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  validateNote,
  validateTransactionAmount,
  validateTransactionDate,
  NOTE_MAX_LENGTH,
  AMOUNT_MIN_ABS,
} from "@/constants/validation";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Chip } from "@/components/Chip";
import { SelectField } from "@/components/SelectField";
import { DateField } from "@/components/DateField";
import { useSnackbar } from "@/components/Snackbar";
import { formatNumber } from "@/utils/format";
import { getConvexErrorMessage } from "@/lib/errors";

export default function TransactionForm() {
  const router = useRouter();
  const navigation = useNavigation();
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

  const lastTransaction = useRef<{
    type: TransactionType;
    amount: number;
    accountId: string;
    toAccountId?: string;
    categoryId?: string;
  } | null>(null);

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

  const handleRepeatLast = () => {
    if (!lastTransaction.current) return;
    const last = lastTransaction.current;
    setType(last.type);
    setAmountText(formatNumber(last.amount));
    setAccountId(last.accountId);
    setToAccountId(last.toAccountId ?? null);
    setCategoryId(last.categoryId ?? null);
    setDate(new Date());
    setNote("");
  };

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

  const handleTypeChange = useCallback(
    (t: TransactionType) => {
      setType(t);
      setError(null);
      setAmountError(null);
      if (t === "transfer") {
        if (categoryId !== null) {
          show("Category cleared — does not match transfer type");
        }
        setCategoryId(null);
      } else {
        setToAccountId(null);
      }
    },
    [categoryId, show],
  );

  const handleAmountChange = useCallback((text: string) => {
    setAmountText(text);
  }, []);

  const parsedAmount = amountText.replace(/,/g, "");
  const amountValue =
    parsedAmount === "" || parsedAmount === "-"
      ? null
      : Number(parsedAmount);
  const signedAmount =
    type === "expense" ? -1 * (amountValue ?? 0) : (amountValue ?? 0);

  const canSubmit =
    amountValue !== null &&
    amountValue >= AMOUNT_MIN_ABS &&
    Number.isFinite(amountValue) &&
    !isLoading &&
    (type === "transfer"
      ? accountId !== null &&
        toAccountId !== null &&
        accountId !== toAccountId
      : accountId !== null && categoryId !== null);

  const hasInteracted = useMemo(() => {
    if (!isEdit) {
      return (
        amountText !== "" ||
        accountId !== null ||
        toAccountId !== null ||
        categoryId !== null ||
        note !== "" ||
        type !== "expense" ||
        date.toDateString() !== new Date().toDateString()
      );
    }
    if (!editingTx) return false;
    return (
      type !== editingTx.type ||
      amountValue !== Math.abs(editingTx.amount) ||
      accountId !== editingTx.accountId ||
      toAccountId !== (editingTx.toAccountId ?? null) ||
      categoryId !== (editingTx.categoryId ?? null) ||
      date.getTime() !== editingTx.date ||
      note !== (editingTx.note ?? "")
    );
  }, [
    isEdit,
    editingTx,
    type,
    amountValue,
    amountText,
    accountId,
    toAccountId,
    categoryId,
    date,
    note,
  ]);

  const intentionalBack = useRef(false);

  const handleBack = useCallback(() => {
    if (!hasInteracted) {
      router.back();
      return;
    }
    Alert.alert(
      "Discard unsaved changes?",
      "You have unsaved changes that will be lost.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            intentionalBack.current = true;
            router.back();
          },
        },
      ],
    );
  }, [hasInteracted, router]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (intentionalBack.current) {
        intentionalBack.current = false;
        return;
      }
      if (!hasInteracted) return;
      e.preventDefault();
      Alert.alert(
        "Discard unsaved changes?",
        "You have unsaved changes that will be lost.",
        [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
    return unsubscribe;
  }, [hasInteracted, navigation]);

  const handleSubmit = async () => {
    setError(null);
    setAmountError(null);
    if (
      amountValue === null ||
      amountValue <= 0 ||
      !Number.isFinite(amountValue)
    ) {
      setAmountError("Enter an amount greater than zero.");
      return;
    }
    const err = validateTransactionAmount(signedAmount, type);
    if (err) {
      setAmountError(err);
      return;
    }
    if (type === "transfer") {
      if (accountId === null || toAccountId === null) {
        setError("Select both accounts.");
        return;
      }
      if (accountId === toAccountId) {
        setError("From and To accounts must be different.");
        return;
      }
    } else {
      if (accountId === null || categoryId === null) {
        setError("Select an account and category.");
        return;
      }
    }
    const dateErr = validateTransactionDate(date.getTime());
    if (dateErr) {
      setError(dateErr);
      return;
    }
    const noteErr = validateNote(note.trim());
    if (noteErr) {
      setError(noteErr);
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
        lastTransaction.current = {
          type,
          amount: Math.abs(amountValue),
          accountId,
          toAccountId: toAccountId ?? undefined,
          categoryId: categoryId ?? undefined,
        };
      }
      show(isEdit ? "Transaction updated" : "Transaction added");
      intentionalBack.current = true;
      router.back();
    } catch (e) {
      setError(
        getConvexErrorMessage(
          e,
          isEdit ? "Failed to update transaction." : "Failed to create transaction.",
        ),
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
      "Delete this transaction? You can undo this right after.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            if (editingTx === undefined) return;
            const deletedPayload = {
              accountId: editingTx.accountId,
              categoryId: editingTx.categoryId,
              toAccountId: editingTx.toAccountId,
              amount: editingTx.amount,
              type: editingTx.type,
              note: editingTx.note,
              date: editingTx.date,
            };
            setIsLoading(true);
            removeTransaction({
              transactionId: transactionId as Id<"transactions">,
            })
              .then(() => {
                intentionalBack.current = true;
                router.back();
                show("Transaction deleted", {
                  label: "Undo",
                  onPress: () => {
                    createTransaction(deletedPayload)
                      .then(() => {
                        show("Transaction restored");
                      })
                      .catch((e: unknown) =>
                        show(
                          getConvexErrorMessage(e, "Failed to restore transaction."),
                        ),
                      );
                  },
                });
              })
              .catch((e: unknown) =>
                setError(
                  getConvexErrorMessage(e, "Failed to delete transaction."),
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
        <View className="flex-row items-center gap-3 px-5 pt-4">
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="h-12 w-12 items-center justify-center"
          >
            <Feather name="arrow-left" size={22} color={C.textPrimary} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
              {isEdit ? "Edit Transaction" : "New Transaction"}
            </Text>
            <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
              {type === "transfer" ? "Move money between accounts" : type === "income" ? "Record incoming money" : "Track an expense"}
            </Text>
          </View>
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 dark:bg-primary-dark/10">
            <Feather
              name={type === "transfer" ? "repeat" : type === "income" ? "arrow-down-left" : "arrow-up-right"}
              size={22}
              color={C.primary}
            />
          </View>
        </View>

        <ScrollView
          contentContainerClassName="gap-4 px-5 py-6"
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <View className="rounded-2xl bg-error/10 px-4 py-3">
              <Text className="text-sm font-medium text-error dark:text-error-dark">{error}</Text>
            </View>
          ) : null}

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
              {!isEdit && lastTransaction.current ? (
                <View className="items-start gap-1">
                  <Chip
                    label="Repeat last"
                    active={false}
                    onPress={handleRepeatLast}
                  />
                  <Text className="pl-1 text-xs text-text-secondary dark:text-text-secondary-dark">
                    Copies type, amount, and account from your previous transaction
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
              Amount
            </Text>
            <Input
              placeholder="0"
              value={amountText}
              onChangeText={handleAmountChange}
              keyboardType="number-pad"
              amount
              error={amountError}
            />
            <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
              Enter a positive number — {type === "transfer" ? "this is the transfer amount" : type === "income" ? "income is recorded as positive" : "expenses will be recorded as negative"}
            </Text>
          </View>

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
                    <View className="gap-1">
                      <Pressable
                        onPress={() => router.push("/category-form")}
                        accessibilityRole="button"
                        accessibilityLabel="Create a category"
                        className="min-h-12 items-center justify-center"
                      >
                        <Text className="text-sm font-medium text-primary dark:text-primary-dark">
                          Create a category
                        </Text>
                      </Pressable>
                      <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
                        After creating a category, come back here to continue
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </>
          )}

          <View className="gap-1.5">
            <DateField
              label="Date"
              value={date}
              maximumDate={new Date()}
              onChange={setDate}
            />
            <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
              Today&apos;s date is pre-filled — you can backdate transactions
            </Text>
          </View>

          <View className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                Note (optional)
              </Text>
              <Text className={`text-xs ${note.length >= 180 ? "text-error dark:text-error-dark" : note.length >= 150 ? "text-amber-600 dark:text-amber-400" : "text-text-secondary dark:text-text-secondary-dark"}`}>
                {note.length}/{NOTE_MAX_LENGTH}
              </Text>
            </View>
            <Input
              placeholder="e.g. Lunch with colleagues"
              value={note}
              onChangeText={setNote}
              maxLength={NOTE_MAX_LENGTH}
            />
          </View>

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
