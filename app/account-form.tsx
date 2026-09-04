import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useThemeColors } from "@/constants/theme";
import { ACCOUNT_TYPES, AccountType } from "@/constants/accounts";
import { validateAccountName, ACCOUNT_NAME_MAX } from "@/constants/validation";
import { AccountIcon } from "@/components/AccountIcon";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Chip } from "@/components/Chip";
import { useSnackbar } from "@/components/Snackbar";
import { useDiscardGuard } from "@/hooks/useDiscardGuard";
import { getConvexErrorMessage } from "@/lib/errors";
import { hapticError, hapticSuccess, hapticWarning } from "@/lib/haptics";

export default function AccountForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const accountId = params.id;
  const isEdit = accountId !== undefined;

  const result = useQuery(api.accounts.list);
  const createAccount = useMutation(api.accounts.create);
  const updateAccount = useMutation(api.accounts.update);
  const { show } = useSnackbar();
  const C = useThemeColors();

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("cash");
  const [openingBalance, setOpeningBalance] = useState("");
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingBalanceError, setOpeningBalanceError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const editingAccount = useMemo(() => {
    if (!isEdit || result?.accounts === null) return undefined;
    return result?.accounts?.find((a) => a._id === accountId);
  }, [isEdit, accountId, result]);

  const seeded = useRef(false);

  useEffect(() => {
    if (editingAccount && !seeded.current) {
      seeded.current = true;
      setName(editingAccount.name);
      setType(editingAccount.type);
      setHidden(editingAccount.hidden);
    }
  }, [editingAccount]);

  const trimmedName = name.trim();
  const canSubmit =
    validateAccountName(trimmedName) === null &&
    !isLoading &&
    (!isEdit || editingAccount !== undefined);

  const isDirty = useMemo(() => {
    if (!isEdit) {
      return (
        name.trim() !== "" ||
        type !== "cash" ||
        openingBalance !== "" ||
        hidden !== false
      );
    }
    if (!editingAccount) return false;
    return (
      name !== editingAccount.name ||
      type !== editingAccount.type ||
      hidden !== editingAccount.hidden
    );
  }, [isEdit, editingAccount, name, type, openingBalance, hidden]);

  const { handleBack, markIntentional } = useDiscardGuard({ isDirty });

  const handleSubmit = async () => {
    setError(null);
    setOpeningBalanceError(null);
    const err = validateAccountName(trimmedName);
    if (err) {
      setError(err);
      void hapticWarning();
      return;
    }

    setIsLoading(true);
    try {
      if (isEdit && accountId !== undefined) {
        await updateAccount({
          accountId: accountId as Id<"accounts">,
          name: trimmedName,
          type,
          hidden,
        });
      } else {
        const rawBalance =
          openingBalance.trim() === ""
            ? ""
            : openingBalance.replace(/,/g, "");
        const parsedBalance = rawBalance === "" ? undefined : Number(rawBalance);
        if (parsedBalance !== undefined && !Number.isSafeInteger(parsedBalance)) {
          setOpeningBalanceError("Opening balance must be a whole number.");
          void hapticWarning();
          setIsLoading(false);
          return;
        }
        await createAccount({
          name: trimmedName,
          type,
          openingBalance: parsedBalance,
          hidden,
        });
      }
      show(isEdit ? "Account updated" : "Account created");
      void hapticSuccess();
      markIntentional();
      router.back();
    } catch (e) {
      void hapticError();
      const message = getConvexErrorMessage(
        e,
        isEdit ? "Failed to update account." : "Failed to create account.",
      );
      // P1-9: operational errors via Snackbar, not inline
      show(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isEdit && result !== undefined && editingAccount === undefined) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">Account not found.</Text>
      </SafeAreaView>
    );
  }

  if (isEdit && editingAccount === undefined) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">Loading account…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-1">
        <View className="flex-row items-center gap-2 px-5 pt-4">
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 48, height: 48 }}
            className="items-center justify-center"
          >
            <Feather name="arrow-left" size={22} color={C.textPrimary} />
          </Pressable>
          <Text className="text-[28px] font-bold text-text-primary dark:text-text-primary-dark">
            {isEdit ? "Edit Account" : "Create Account"}
          </Text>
        </View>

        <KeyboardAwareScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-5 py-6"
          keyboardShouldPersistTaps="handled"
          bottomOffset={16}
        >
          <Input
            label="Account name"
            placeholder="e.g. Cash, BCA Savings"
            value={name}
            onChangeText={setName}
            maxLength={ACCOUNT_NAME_MAX}
            error={error}
          />

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
              Account type
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {ACCOUNT_TYPES.map((t) => (
                <Chip
                  key={t.id}
                  label={t.label}
                  active={type === t.id}
                  onPress={() => setType(t.id)}
                />
              ))}
            </View>
            <View className="flex-row items-center gap-2">
              <AccountIcon type={type} size={24} />
              <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
                {ACCOUNT_TYPES.find((t) => t.id === type)?.label} preview
              </Text>
            </View>
          </View>

          {!isEdit ? (
            <Input
              label="Opening balance (optional)"
              placeholder="0"
              value={openingBalance}
              onChangeText={(t) => {
                setOpeningBalance(t);
                if (openingBalanceError) setOpeningBalanceError(null);
              }}
              keyboardType="number-pad"
              amount
              error={openingBalanceError}
            />
          ) : null}

          <View
            style={{ borderColor: C.border }}
            className="flex-row items-center justify-between rounded-[12px] border bg-surface px-4 py-3 dark:bg-surface-dark"
          >
            <View className="flex-1">
              <Text className="text-base font-medium text-text-primary dark:text-text-primary-dark">
                Visible to members
              </Text>
              <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
                Members can see and use this account.
              </Text>
            </View>
            <Switch
              value={!hidden}
              onValueChange={(value) => setHidden(!value)}
              trackColor={{ true: C.primary, false: C.border }}
              thumbColor={C.background}
            />
          </View>

          <Button
            title={isEdit ? "Save Changes" : "Create Account"}
            onPress={handleSubmit}
            loading={isLoading}
            disabled={!canSubmit}
          />
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaView>
  );
}
