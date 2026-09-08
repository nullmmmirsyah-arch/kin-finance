import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { TRANSACTION_TYPES, TransactionType } from "@/constants/transactions";
import {
  validateNote,
  validateTransactionAmount,
  validateTransactionDate,
  NOTE_MAX_LENGTH,
} from "@/constants/validation";
import { Button } from "@/components/Button";
import { Skeleton } from "@/components/Skeleton";
import { AccountIcon } from "@/components/AccountIcon";
import { useSnackbar } from "@/components/Snackbar";
import { useDiscardGuard } from "@/hooks/useDiscardGuard";
import { useNoteSuggestions } from "@/hooks/useNoteSuggestions";
import { CategoryGrid } from "@/components/transaction/CategoryGrid";
import { TransferDual } from "@/components/transaction/TransferDual";
import { AccountPill } from "@/components/transaction/AccountPill";
import { Keypad } from "@/components/transaction/Keypad";
import { formatAmountInput, formatNumber, wasDecimalTruncated } from "@/utils/format";
import { formatDateShortTz, getDayBounds } from "@/utils/date";
import { resolveTimezone } from "@/constants/timezones";
import { evaluateKeypadExpression } from "@/utils/keypadEval";
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
  const household = useQuery(api.households.getActive);
  const tz = useMemo(() => resolveTimezone(household?.timezone), [household?.timezone]);
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
  const [noteFocused, setNoteFocused] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [accountSheetTarget, setAccountSheetTarget] = useState<"single" | "from" | "to">("single");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateDraft, setDateDraft] = useState<Date | null>(null);

  const noteSuggestions = useNoteSuggestions(categoryId, note);

  const [lastTransaction, setLastTransactionState] = useState<LastTransaction | null>(null);
  const [lastChecked, setLastChecked] = useState(false);
  // True once the user explicitly picks/swaps/repeats an account — auto-applied
  // defaults must not count as interaction (discard guard) nor be reapplied.
  const [accountTouched, setAccountTouched] = useState(false);
  // Load persisted repeat-last (survives unmount / app restart) — P0-3
  useEffect(() => {
    if (isEdit) return;
    void getLastTransaction().then((v) => {
      if (v) setLastTransactionState(v);
      setLastChecked(true);
    });
  }, [isEdit]);

  // Duplicate detection windowed query — P0-3 review: query within 24h window + matching fields, skip in edit
  const dupeWindow = useMemo(() => {
    const ts = date.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    return { startDate: ts - dayMs, endDate: ts + dayMs };
  }, [date]);
  const dupeCheck = useQuery(
    api.transactions.list,
    isEdit || accountId === null
      ? "skip"
      : {
          startDate: dupeWindow.startDate,
          endDate: dupeWindow.endDate,
          limit: 1000,
          type,
          accountIds: [accountId as Id<"accounts">],
          ...(type !== "transfer" && categoryId
            ? { categoryIds: [categoryId as Id<"categories">] }
            : {}),
        },
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
    const last = lastTransaction;
    if (!last) return;
    // Persisted IDs may be stale (account hidden/deleted since) — validate
    // against visible options; fall back instead of saving stale IDs.
    const isVisible = (id: string | undefined) =>
      id !== undefined && accountOptions.some((o) => o.id === id);
    setType(last.type);
    setAmountText(formatNumber(last.amount));
    setAccountId(
      isVisible(last.accountId) ? last.accountId : (accountOptions[0]?.id ?? null),
    );
    setToAccountId(
      last.toAccountId && isVisible(last.toAccountId) ? last.toAccountId : null,
    );
    setCategoryId(last.categoryId ?? null);
    setDate(new Date());
    setNote("");
    setAccountTouched(true);
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
      .map((c) => ({ id: c._id, label: c.name, icon: c.icon }));
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

  // Default account when creating: lastTransaction account if still visible,
  // else first visible account so new users can save without manual selection.
  // Never reapply once the user has touched account selection.
  useEffect(() => {
    if (isEdit || !lastChecked || accountTouched) return;
    if (accountResult === undefined) return;
    if (accountId !== null) return;
    if (accountOptions.length === 0) return;
    const lastId = lastTransaction?.accountId;
    if (lastId && accountOptions.some((o) => o.id === lastId)) {
      setAccountId(lastId);
      if (
        lastTransaction?.toAccountId &&
        toAccountId === null &&
        accountOptions.some((o) => o.id === lastTransaction.toAccountId)
      ) {
        setToAccountId(lastTransaction.toAccountId);
      }
      return;
    }
    setAccountId(accountOptions[0].id);
  }, [isEdit, lastChecked, accountTouched, accountResult, lastTransaction, accountId, accountOptions, toAccountId]);

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

  // Keypad-aware amount value: evaluate expression if possible, else fallback to numeric parse
  const evalValue = useMemo(() => evaluateKeypadExpression(amountText), [amountText]);
  const parsedAmount = amountText.replace(/,/g, "");
  const amountValue =
    evalValue !== null
      ? evalValue
      : parsedAmount === "" || parsedAmount === "-"
        ? null
        : Number(parsedAmount);
  const signedAmount =
    type === "expense" ? -1 * (amountValue ?? 0) : (amountValue ?? 0);

  const handleAccountSelect = useCallback((id: string) => {
    setAccountId(id);
    setAccountTouched(true);
    setAccountError(null);
    if (error) setError(null);
  }, [error]);

  const handleToAccountSelect = useCallback((id: string) => {
    setToAccountId(id);
    setAccountTouched(true);
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
    (isEdit || dupeCheck !== undefined || accountId === null) &&
    (type === "transfer"
      ? accountId !== null &&
        toAccountId !== null &&
        accountId !== toAccountId
      : accountId !== null && categoryId !== null);

  const hasInteracted = useMemo(() => {
    if (!isEdit) {
      return (
        amountText !== "" ||
        accountTouched ||
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
    accountTouched,
    categoryId,
    date,
    note,
  ]);

  const { handleBack, markIntentional } = useDiscardGuard({
    isDirty: hasInteracted,
  });

  // Synchronous re-entrancy lock: Button `disabled` and keypad both funnel
  // here, but rapid taps can land before React re-renders — the ref blocks
  // the second invocation from creating a duplicate transaction.
  const submittingRef = useRef(false);
  const runSubmit = useCallback(async () => {
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

    // Block submit while duplicate query unresolved — preserve warning once resolves
    if (!isEdit && accountId !== null && dupeCheck === undefined) {
      void hapticWarning();
      show("Checking for duplicates… please try again.");
      return;
    }

    // Duplicate detection (P0-3): same amount+account(+category/toAccount) within 48h window (±24h)
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

    if (!isEdit && dupeCheck?.transactions) {
      const dayMs = 24 * 60 * 60 * 1000;
      const dupe = dupeCheck.transactions.find((tx) => {
        if (Math.abs(tx.amount) !== Math.abs(signedAmount)) return false;
        if (tx.type !== type) return false;
        if (tx.accountId !== accountId) return false;
        if (type === "transfer" && tx.toAccountId !== toAccountId) return false;
        if (type !== "transfer" && tx.categoryId !== categoryId) return false;
        // within 24h (window query already limited, keep check as guard)
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
  }, [
    amountValue,
    signedAmount,
    type,
    accountId,
    toAccountId,
    categoryId,
    date,
    note,
    isEdit,
    dupeCheck,
    transactionId,
    updateTransaction,
    createTransaction,
    show,
    markIntentional,
    router,
  ]);

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await runSubmit();
    } finally {
      submittingRef.current = false;
    }
  }, [runSubmit]);

  const handleKeypad = useCallback(
    (k: string) => {
      if (k === "⌫") {
        setAmountText((prev) => prev.slice(0, -1));
        if (amountError) setAmountError(null);
        if (error) setError(null);
        return;
      }
      if (k === "✓") {
        void handleSubmit();
        return;
      }
      if (k === "Today") {
        // Household-day start (Q8: Today = 00:00) — no picker; the date pill
        // opens it. Start-of-day can never be in the future, so no clamping.
        const start = new Date(getDayBounds(new Date(), tz).start);
        setDate(start);
        setDateDraft(start);
        return;
      }
      if (k === "+" || k === "-" || k === "×" || k === "÷" || k === "*" || k === "/") {
        // Ignore operators on empty input or after another operator/dot.
        if (amountText === "" || /[+\-×÷*/.]$/.test(amountText)) return;
        const op = k === "*" ? "×" : k === "/" ? "÷" : k;
        setAmountText((prev) => prev + op);
        if (amountError) setAmountError(null);
        if (error) setError(null);
        return;
      }
      if (k === "." || /^\d$/.test(k)) {
        setAmountText((prev) => prev + k);
        if (amountError) setAmountError(null);
        if (error) setError(null);
      }
    },
    [amountError, error, amountText, handleSubmit, tz],
  );

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

  const selectedAccount = accountResult.accounts.find((a) => a._id === accountId) ?? null;
  const toAcc = accountResult.accounts.find((a) => a._id === toAccountId) ?? null;

  const handleSwap = () => {
    const prevFrom = accountId;
    const prevTo = toAccountId;
    setAccountId(prevTo);
    setToAccountId(prevFrom);
    setAccountTouched(true);
    setAccountError(null);
  };

  // Date draft lifecycle: sync draft on open so Done can't write a stale
  // draft (e.g. after Repeat Last changed the date), clear on dismiss.
  const openDatePicker = () => {
    setDateDraft(date);
    setShowDatePicker(true);
  };
  const closeDatePicker = () => {
    setDateDraft(null);
    setShowDatePicker(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-1">
        {/* Header: X | tabs Expenses Income Transfer | pill General */}
        <View className="flex-row items-center justify-between px-4 pt-2">
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
          >
            <Feather name="x" size={22} color={C.textPrimary} />
          </Pressable>
          <View className="flex-1 flex-row items-center justify-center gap-5">
            {TRANSACTION_TYPES.map((t) => {
              const active = type === t.id;
              const label = t.id === "expense" ? "Expenses" : t.id === "income" ? "Income" : "Transfer";
              return (
                <Pressable
                  key={t.id}
                  onPress={() => handleTypeChange(t.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className="items-center pb-2"
                >
                  <Text
                    className={`text-[15px] font-semibold ${active ? "text-text-primary dark:text-text-primary-dark" : "text-text-secondary dark:text-text-secondary-dark"}`}
                  >
                    {label}
                  </Text>
                  {active ? (
                    <View style={{ height: 3, backgroundColor: C.primary, width: 32, borderRadius: 999, marginTop: 4 }} />
                  ) : (
                    <View style={{ height: 3, marginTop: 4, width: 32 }} />
                  )}
                </Pressable>
              );
            })}
          </View>
          <View
            style={{
              borderWidth: 1,
              borderColor: C.border,
              backgroundColor: C.background,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              flexDirection: "row",
              gap: 6,
              alignItems: "center",
            }}
          >
            <Feather name="book" size={14} color={C.textSecondary} />
            <Text numberOfLines={1} className="text-xs font-medium" style={{ color: C.textPrimary }}>
              {household?.name ?? "General"}
            </Text>
          </View>
        </View>

        {/* Repeat last pill */}
        {!isEdit && lastTransaction ? (
          <Pressable
            onPress={handleRepeatLast}
            accessibilityRole="button"
            accessibilityLabel="Repeat last transaction"
            className="mx-4 mt-2 flex-row items-center gap-2 rounded-xl border px-4 py-3"
            style={{ borderColor: C.border, backgroundColor: C.background }}
          >
            <Feather name="repeat" size={16} color={C.primary} />
            <Text className="flex-1 text-sm" style={{ color: C.textPrimary }}>
              Repeat last • {lastTransaction.type} {formatNumber(lastTransaction.amount)}
            </Text>
          </Pressable>
        ) : null}

        {/* Category grid or Transfer dual */}
        <View className="flex-1 pt-2">
          {type !== "transfer" ? (
            <CategoryGrid
              options={categoryOptions}
              value={categoryId}
              onSelect={handleCategorySelect}
              isOwner={categoryResult?.isOwner ?? false}
              onAdd={() => router.push("/category-form")}
            />
          ) : (
            <TransferDual
              fromAcc={selectedAccount ? { name: selectedAccount.name, type: selectedAccount.type } : null}
              toAcc={toAcc ? { name: toAcc.name, type: toAcc.type } : null}
              onSelectFrom={() => {
                setAccountSheetTarget("from");
                setShowAccountSheet(true);
              }}
              onSelectTo={() => {
                setAccountSheetTarget("to");
                setShowAccountSheet(true);
              }}
              onSwap={handleSwap}
            />
          )}
          {type !== "transfer" && categoryError ? (
            <Text className="px-4 pt-1 text-xs text-error dark:text-error-dark">{categoryError}</Text>
          ) : null}
          {type === "transfer" && accountError ? (
            <Text className="px-4 pt-1 text-xs text-error dark:text-error-dark">{accountError}</Text>
          ) : null}
        </View>

        {/* Amount row */}
        <View className="px-4 py-3 border-t" style={{ borderColor: C.border, backgroundColor: C.background }}>
          <Pressable
            onPress={() => {
              // keep amount editing via keypad; hide note keyboard
              setNoteFocused(false);
              Keyboard.dismiss();
            }}
          >
            <View className="flex-row items-end justify-end gap-2">
              {/* Currency-agnostic: bare whole number, no symbol (PRD §1). */}
              <Text className="text-3xl font-bold tracking-tight" style={{ color: C.textPrimary }}>
                {(() => {
                  const hasOp = /[+\-×÷*\/]/.test(amountText);
                  if (hasOp) {
                    return evalValue !== null ? formatNumber(evalValue) : amountText || "0";
                  }
                  const formatted = formatAmountInput(amountText);
                  if (formatted) return formatted;
                  return amountValue !== null && amountValue !== 0 ? formatNumber(amountValue) : "0";
                })()}
              </Text>
            </View>
          </Pressable>
          {wasDecimalTruncated(amountText) ? (
            <Text className="pt-1 text-right text-xs" style={{ color: C.chartAmber }}>
              Decimals truncated — whole numbers only
            </Text>
          ) : null}
          {amountError ? (
            <Text className="pt-1 text-right text-xs text-error dark:text-error-dark">{amountError}</Text>
          ) : null}
          {error ? (
            <View className="mt-2 rounded-xl px-3 py-2" style={{ backgroundColor: `${C.error}14` }}>
              <Text className="text-xs font-medium" style={{ color: C.error }}>
                {error}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Account pill for expense/income */}
        {type !== "transfer" ? (
          <View className="px-4 pb-2 flex-row items-center gap-2">
            <AccountPill
              label="Select account"
              account={selectedAccount ? { name: selectedAccount.name, type: selectedAccount.type } : null}
              onPress={() => {
                setAccountSheetTarget("single");
                setShowAccountSheet(true);
              }}
            />
            {accountError ? (
              <Text className="text-xs text-error dark:text-error-dark">{accountError}</Text>
            ) : null}
            <Pressable
              onPress={openDatePicker}
              style={{
                borderWidth: 1,
                borderColor: C.border,
                backgroundColor: C.background,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
                flexDirection: "row",
                gap: 6,
                alignItems: "center",
              }}
            >
              <Feather name="calendar" size={14} color={C.textSecondary} />
              <Text className="text-xs font-medium" style={{ color: C.textPrimary }}>
                {formatDateShortTz(date.getTime(), tz)}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="px-4 pb-2 flex-row items-center gap-2">
            <Pressable
              onPress={openDatePicker}
              style={{
                borderWidth: 1,
                borderColor: C.border,
                backgroundColor: C.background,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
                flexDirection: "row",
                gap: 6,
                alignItems: "center",
              }}
            >
              <Feather name="calendar" size={14} color={C.textSecondary} />
              <Text className="text-xs font-medium" style={{ color: C.textPrimary }}>
                {formatDateShortTz(date.getTime(), tz)}
              </Text>
            </Pressable>
            {dateError ? (
              <Text className="text-xs text-error dark:text-error-dark">{dateError}</Text>
            ) : null}
          </View>
        )}

        {/* Note field + suggestions */}
        <View className="px-4 pb-2 gap-2">
          <View
            className="flex-row items-center gap-2 rounded-xl border px-3"
            style={{
              borderColor: noteFocused ? C.primary : C.border,
              backgroundColor: C.background,
              height: 48,
            }}
          >
            <Feather name="edit-3" size={16} color={C.textSecondary} />
            <TextInput
              placeholder="Add a note"
              placeholderTextColor={C.textSecondary}
              value={note}
              onChangeText={setNote}
              maxLength={NOTE_MAX_LENGTH}
              onFocus={() => setNoteFocused(true)}
              onBlur={() => setNoteFocused(false)}
              className="flex-1 text-sm"
              style={{ color: C.textPrimary }}
              returnKeyType="done"
              onSubmitEditing={() => setNoteFocused(false)}
            />
            <Text
              className="text-xs"
              style={{
                color:
                  note.length >= 180
                    ? C.error
                    : note.length >= 150
                      ? C.chartAmber
                      : C.textSecondary,
              }}
            >
              {note.length}/{NOTE_MAX_LENGTH}
            </Text>
          </View>
          {noteSuggestions.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {noteSuggestions.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setNote(s)}
                  style={{
                    borderWidth: 1,
                    borderColor: C.border,
                    backgroundColor: C.surface,
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text className="text-xs" style={{ color: C.textPrimary }}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {dateError && type !== "transfer" ? (
            <Text className="text-xs text-error dark:text-error-dark">{dateError}</Text>
          ) : null}
        </View>

        {/* Keypad or spacer when note focused */}
        {!noteFocused ? (
          <Keypad onKey={handleKeypad} />
        ) : (
          <View style={{ height: 12 }} />
        )}

        {/* Save bar */}
        <View className="px-4 py-3 gap-2 border-t" style={{ borderColor: C.border, backgroundColor: C.background }}>
          <Button
            title={isEdit ? "Save Changes" : "Save"}
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
        </View>

        {/* Account sheet modal */}
        <Modal
          visible={showAccountSheet}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAccountSheet(false)}
        >
          <Pressable
            className="flex-1 justify-end bg-black/40"
            onPress={() => setShowAccountSheet(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={[
                Shadow.elevated,
                {
                  backgroundColor: C.background,
                  borderTopLeftRadius: Radius.lg,
                  borderTopRightRadius: Radius.lg,
                  maxHeight: 420,
                  padding: 16,
                },
              ]}
            >
              <Text className="mb-3 text-base font-semibold" style={{ color: C.textPrimary }}>
                Select account
              </Text>
              <FlatList
                data={accountOptions}
                keyExtractor={(o) => o.id}
                renderItem={({ item }) => {
                  const acc = accountResult.accounts.find((a) => a._id === item.id) ?? null;
                  const isSelected =
                    (accountSheetTarget === "single" && accountId === item.id) ||
                    (accountSheetTarget === "from" && accountId === item.id) ||
                    (accountSheetTarget === "to" && toAccountId === item.id);
                  return (
                    <Pressable
                      onPress={() => {
                        if (accountSheetTarget === "to") {
                          handleToAccountSelect(item.id);
                        } else {
                          handleAccountSelect(item.id);
                        }
                        setShowAccountSheet(false);
                      }}
                      className="flex-row items-center gap-3 py-3"
                      style={{ borderBottomWidth: 1, borderBottomColor: C.border }}
                    >
                      <AccountIcon type={acc?.type ?? "cash"} size={20} />
                      <Text className="flex-1 text-sm" style={{ color: C.textPrimary }}>
                        {item.label}
                      </Text>
                      {isSelected ? <Feather name="check" size={16} color={C.primary} /> : null}
                    </Pressable>
                  );
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>

        {/* Date picker modal */}
        {showDatePicker ? (
          Platform.OS === "ios" ? (
            <Modal
              visible={showDatePicker}
              transparent
              animationType="fade"
              onRequestClose={() => closeDatePicker()}
            >
              <Pressable
                className="flex-1 items-center justify-center bg-black/40 px-6"
                onPress={() => closeDatePicker()}
              >
                <Pressable
                  style={[
                    Shadow.card,
                    { borderRadius: Radius.md, backgroundColor: C.background, padding: 16 },
                  ]}
                  className="gap-2"
                  onPress={(e) => e.stopPropagation()}
                >
                  <DateTimePicker
                    value={dateDraft ?? date}
                    mode="date"
                    display="spinner"
                    maximumDate={new Date(getDayBounds(new Date(), tz).end - 1)}
                    onChange={(event: DateTimePickerEvent, d?: Date) => {
                      if (event.type === "set" && d) {
                        const todayEndInner = getDayBounds(new Date(), tz).end;
                        const clamped = d.getTime() >= todayEndInner ? new Date(todayEndInner - 1) : d;
                        setDateDraft(clamped);
                      }
                    }}
                  />
                  <Button title="Cancel" variant="ghost" onPress={() => closeDatePicker()} />
                  <Button
                    title="Done"
                    variant="secondary"
                    onPress={() => {
                      if (dateDraft) {
                        const todayEndInner = getDayBounds(new Date(), tz).end;
                        const clamped = dateDraft.getTime() >= todayEndInner ? new Date(todayEndInner - 1) : dateDraft;
                        setDate(clamped);
                      }
                      closeDatePicker();
                    }}
                  />
                </Pressable>
              </Pressable>
            </Modal>
          ) : (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              maximumDate={new Date(getDayBounds(new Date(), tz).end - 1)}
              onChange={(event: DateTimePickerEvent, d?: Date) => {
                closeDatePicker();
                if (event.type === "set" && d) {
                  const todayEndInner = getDayBounds(new Date(), tz).end;
                  const clamped = d.getTime() >= todayEndInner ? new Date(todayEndInner - 1) : d;
                  setDate(clamped);
                }
              }}
            />
          )
        ) : null}
      </View>
    </SafeAreaView>
  );
}
