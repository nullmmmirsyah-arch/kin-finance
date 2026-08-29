import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  Text,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Radius, useThemeColors } from "@/constants/theme";
import { TRANSACTION_TYPES, TransactionType } from "@/constants/transactions";
import {
  validateNote,
  validateTransactionAmount,
  validateTransactionDate,
  NOTE_MAX_LENGTH,
} from "@/constants/validation";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Chip } from "@/components/Chip";
import { SelectField } from "@/components/SelectField";
import { DateField } from "@/components/DateField";
import { useSnackbar } from "@/components/Snackbar";
import { Skeleton } from "@/components/Skeleton";
import { useDiscardGuard } from "@/hooks/useDiscardGuard";
import { formatNumber } from "@/utils/format";
import { getConvexErrorMessage } from "@/lib/errors";
import { hapticError, hapticSuccess, hapticWarning } from "@/lib/haptics";
import {
  getLastTransaction,
  setLastTransaction,
  type LastTransaction,
} from "@/lib/last-transaction";

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
  const [accountError, setAccountError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [lastTransaction, setLastTransactionState] = useState<LastTransaction | null>(null);
  const lastTransactionRef = useRef<LastTransaction | null>(null);
  lastTransactionRef.current = lastTransaction;
  // Load persisted repeat-last (survives unmount / app restart) — P0-3
  useEffect(() => {
    if (isEdit) return;
    void getLastTransaction().then((v) => {
      if (v) setLastTransactionState(v);
    });
  }, [isEdit]);

  // Also watch recent transactions for duplicate detection — P0-3 + P1-9
  const recentForDupe = useQuery(
    api.transactions.recent,
    isEdit ? "skip" : { limit: 20 },
  );

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
    Keyboard.dismiss();
    const last = lastTransactionRef.current;
    if (!last) return;
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
      Keyboard.dismiss();
      setType(t);
      setError(null);
      setAmountError(null);
      setAccountError(null);
      setCategoryError(null);
      setDateError(null);
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
    if (amountError) setAmountError(null);
    if (error) setError(null);
  }, [amountError, error]);

  const parsedAmount = amountText.replace(/,/g, "");
  const amountValue =
    parsedAmount === "" || parsedAmount === "-"
      ? null
      : Number(parsedAmount);
  const signedAmount =
    type === "expense" ? -1 * (amountValue ?? 0) : (amountValue ?? 0);

  const handleAmountBlur = useCallback(() => {
    if (amountValue !== null && amountValue <= 0) {
      setAmountError("Enter an amount greater than zero.");
      void hapticWarning();
      return;
    }
    const err = validateTransactionAmount(signedAmount, type);
    if (err) {
      setAmountError(err);
      void hapticWarning();
    }
  }, [amountValue, signedAmount, type]);

  const handleAccountSelect = useCallback((id: string) => {
    setAccountId(id);
    setAccountError(null);
    if (error) setError(null);
  }, [error]);

  const handleToAccountSelect = useCallback((id: string) => {
    setToAccountId(id);
    setAccountError(null);
    if (error) setError(null);
  }, [error]);

  const handleCategorySelect = useCallback((id: string) => {
    setCategoryId(id);
    setCategoryError(null);
    if (error) setError(null);
  }, [error]);

  const canSubmit =
    validateTransactionAmount(signedAmount, type) === null &&
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

  const { handleBack, markIntentional } = useDiscardGuard({
    isDirty: hasInteracted,
  });

  const handleSubmit = async () => {
    setError(null);
    setAmountError(null);
    setAccountError(null);
    setCategoryError(null);
    setDateError(null);
    const validationWarning = () => void hapticWarning();
    if (
      amountValue === null ||
      amountValue <= 0 ||
      !Number.isFinite(amountValue)
    ) {
      setAmountError("Enter an amount greater than zero.");
      validationWarning();
      return;
    }
    const err = validateTransactionAmount(signedAmount, type);
    if (err) {
      setAmountError(err);
      validationWarning();
      return;
    }
    if (type === "transfer") {
      if (accountId === null || toAccountId === null) {
        setAccountError("Select both accounts.");
        validationWarning();
        return;
      }
      if (accountId === toAccountId) {
        setAccountError("From and To accounts must be different.");
        validationWarning();
        return;
      }
    } else {
      if (accountId === null) {
        setAccountError("Select an account.");
        validationWarning();
        return;
      }
      if (categoryId === null) {
        setCategoryError("Select a category.");
        validationWarning();
        return;
      }
    }
    const dateErr = validateTransactionDate(date.getTime());
    if (dateErr) {
      setDateError(dateErr);
      validationWarning();
      return;
    }
    const noteErr = validateNote(note.trim());
    if (noteErr) {
      setError(noteErr);
      validationWarning();
      return;
    }

    // Duplicate detection (P0-3): same amount+account(+category/toAccount) within 24h
    const doCreate = async () => {
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
          const persisted: LastTransaction = {
            type,
            amount: Math.abs(amountValue),
            accountId,
            toAccountId: toAccountId ?? undefined,
            categoryId: categoryId ?? undefined,
          };
          setLastTransactionState(persisted);
          void setLastTransaction(persisted);
        }
        show(isEdit ? "Transaction updated" : "Transaction added");
        void hapticSuccess();
        markIntentional();
        router.back();
      } catch (e) {
        // P1-9: operational errors via Snackbar + hapticError, not inline error
        void hapticError();
        show(
          getConvexErrorMessage(
            e,
            isEdit ? "Failed to update transaction." : "Failed to create transaction.",
          ),
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (!isEdit && recentForDupe?.transactions) {
      const dayMs = 24 * 60 * 60 * 1000;
      const dupe = recentForDupe.transactions.find((tx) => {
        if (Math.abs(tx.amount) !== Math.abs(signedAmount)) return false;
        if (tx.type !== type) return false;
        if (tx.accountId !== accountId) return false;
        if (type === "transfer" && tx.toAccountId !== toAccountId) return false;
        if (type !== "transfer" && tx.categoryId !== categoryId) return false;
        // within 24h
        return Math.abs(tx.date - date.getTime()) < dayMs;
      });
      if (dupe) {
        void hapticWarning();
        Alert.alert(
          "Possible duplicate",
          `You already have a ${type} of ${formatNumber(Math.abs(signedAmount))} on this account within the last 24 hours. Save anyway?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Save anyway", onPress: () => void doCreate() },
          ],
        );
        return;
      }
    }

    await doCreate();
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
                markIntentional();
                router.back();
                show("Transaction deleted", {
                  label: "Undo",
                  onPress: () => {
                    createTransaction(deletedPayload)
                      .then(() => {
                        void hapticSuccess();
                        show("Transaction restored");
                      })
                      .catch((e: unknown) => {
                        void hapticError();
                        show(
                          getConvexErrorMessage(e, "Failed to restore transaction."),
                        );
                      });
                  },
                });
              })
              .catch((e: unknown) => {
                void hapticError();
                show(getConvexErrorMessage(e, "Failed to delete transaction."));
              })
              .finally(() => setIsLoading(false));
          },
        },
      ],
    );
  };

  if (accountResult === undefined || (isEdit && getResult === undefined)) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        <View className="flex-row items-center gap-3 px-5 pt-4">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 48, height: 48 }}
            className="items-center justify-center"
          >
            <Feather name="arrow-left" size={22} color={C.textPrimary} />
          </Pressable>
          <View className="flex-1 gap-2">
            <Skeleton style={{ width: "55%", height: 28 }} />
            <Skeleton style={{ width: "70%", height: 16 }} />
          </View>
        </View>
        <View className="gap-4 px-5 pt-6">
          <Skeleton style={{ height: 148, borderRadius: Radius.md }} />
          <Skeleton style={{ height: 132, borderRadius: Radius.md }} />
          <Skeleton style={{ height: 148, borderRadius: Radius.md }} />
          <Skeleton style={{ height: 48, borderRadius: Radius.sm }} />
        </View>
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
      <View className="flex-1">
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

        <KeyboardAwareScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-5 py-6"
          keyboardShouldPersistTaps="handled"
          bottomOffset={16}
        >
          {error ? (
            <View className="rounded-2xl bg-error/10 px-4 py-3">
              <Text className="text-sm font-medium text-error dark:text-error-dark">{error}</Text>
            </View>
          ) : null}

          <View className="rounded-2xl border border-border bg-background px-4 py-4 dark:border-border-dark dark:bg-background-dark">
            <View className="gap-4">
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

              {!isEdit && lastTransaction ? (
                <Pressable
                  onPress={handleRepeatLast}
                  accessibilityRole="button"
                  accessibilityLabel="Repeat last transaction"
                  className="min-h-12 flex-row items-center gap-2 rounded-xl border border-border bg-background px-4 dark:border-border-dark dark:bg-background-dark"
                >
                  <Feather name="repeat" size={16} color={C.primary} />
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-primary dark:text-primary-dark">
                      Repeat last
                    </Text>
                    <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
                      {`Copies ${lastTransaction.type}, ${formatNumber(lastTransaction.amount)} — tap to reuse`}
                    </Text>
                  </View>
                </Pressable>
              ) : null}

              <View className="gap-1.5">
                <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                  Amount
                </Text>
                <Input
                  placeholder="0"
                  value={amountText}
                  onChangeText={handleAmountChange}
                  onBlur={handleAmountBlur}
                  keyboardType="number-pad"
                  amount
                  error={amountError}
                />
                <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
                  Enter a positive number — {type === "transfer" ? "this is the transfer amount" : type === "income" ? "income is recorded as positive" : "expenses will be recorded as negative"}
                </Text>
              </View>
            </View>
          </View>

          <View className="rounded-2xl border border-border bg-surface px-4 py-4 dark:border-border-dark dark:bg-surface-dark">
            {type === "transfer" ? (
              <View className="gap-4">
                <SelectField
                  label="From account"
                  placeholder="Select account"
                  value={accountId}
                  options={accountOptions}
                  onSelect={handleAccountSelect}
                  error={accountError}
                />
                <SelectField
                  label="To account"
                  placeholder="Select account"
                  value={toAccountId}
                  options={accountOptions.filter((o) => o.id !== accountId)}
                  onSelect={handleToAccountSelect}
                  error={accountError}
                />
              </View>
            ) : (
              <View className="gap-4">
                <SelectField
                  label="Account"
                  placeholder="Select account"
                  value={accountId}
                  options={accountOptions}
                  onSelect={handleAccountSelect}
                  error={accountError}
                />
                <SelectField
                  label="Category"
                  placeholder="Select category"
                  value={categoryId}
                  options={categoryOptions}
                  onSelect={handleCategorySelect}
                  error={categoryError}
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
              </View>
            )}
          </View>

          <View className="rounded-2xl border border-border bg-background px-4 py-4 dark:border-border-dark dark:bg-background-dark">
            <View className="gap-4">
              <View className="gap-1.5">
                <DateField
                  label="Date"
                  value={date}
                  maximumDate={new Date()}
                  onChange={setDate}
                  error={dateError}
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
            </View>
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
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaView>
  );
}
