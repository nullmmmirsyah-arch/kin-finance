import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
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
import { validateBudgetAmount } from "@/constants/validation";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { SelectField } from "@/components/SelectField";
import { useSnackbar } from "@/components/Snackbar";
import { useDiscardGuard } from "@/hooks/useDiscardGuard";
import { formatAmountInput } from "@/utils/format";
import { CategoryIcon } from "@/components/CategoryIcon";
import { hapticSuccess, hapticError, hapticWarning } from "@/lib/haptics";
import { formatMonthLabel, getMonthBounds } from "@/utils/date";
import { resolveTimezone } from "@/constants/timezones";
import { getConvexErrorMessage } from "@/lib/errors";

export default function BudgetForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; periodStart?: string }>();
  const budgetId = params.id;
  const isEdit = budgetId !== undefined;

  const existingResult = useQuery(
    api.budgets.get,
    budgetId ? { budgetId: budgetId as Id<"budgets"> } : "skip",
  );
  const categoryOptions = useQuery(api.budgets.categoryOptions);
  const household = useQuery(api.households.getActive);
  const createBudget = useMutation(api.budgets.create);
  const updateBudget = useMutation(api.budgets.update);
  const { show } = useSnackbar();
  const C = useThemeColors();

  const timezone = resolveTimezone(household?.timezone);

  const [amount, setAmount] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const existingBudget = existingResult?.budget;

  const seeded = useRef(false);

  useEffect(() => {
    if (existingBudget && !seeded.current) {
      seeded.current = true;
      setAmount(formatAmountInput(String(existingBudget.amount)));
    }
  }, [existingBudget]);

  const rawPeriodStart = params.periodStart ? Number(params.periodStart) : NaN;
  const periodStart = Number.isFinite(rawPeriodStart)
    ? getMonthBounds(rawPeriodStart, timezone).start
    : getMonthBounds(Date.now(), timezone).start;

  const monthTs = existingBudget?.periodStart ?? periodStart;
  const monthLabel = formatMonthLabel(monthTs, timezone);

  const options = useMemo(
    () => (categoryOptions ?? []).map((c) => ({ id: c._id, label: c.name, icon: c.icon })),
    [categoryOptions],
  );

  const rawAmount = amount.replace(/,/g, "");
  const parsedAmount = Number(rawAmount);
  const amountValid = validateBudgetAmount(parsedAmount) === null;

  const isDirty = useMemo(() => {
    if (!isEdit) {
      return amount !== "" || selectedCategoryId !== null;
    }
    if (!existingBudget) return false;
    return amount.replace(/,/g, "") !== String(existingBudget.amount);
  }, [isEdit, existingBudget, amount, selectedCategoryId]);

  const { handleBack, markIntentional } = useDiscardGuard({ isDirty });

  const canSubmit =
    !isLoading &&
    household !== undefined &&
    household !== null &&
    (!isEdit || existingBudget !== undefined) &&
    (isEdit || (amountValid && selectedCategoryId !== null));

  const handleSubmit = async () => {
    setError(null);
    setCategoryError(null);

    const err = validateBudgetAmount(parsedAmount);
    if (err) {
      setError(err);
      void hapticWarning();
      return;
    }
    if (!isEdit && selectedCategoryId === null) {
      setCategoryError("Please select a category.");
      void hapticWarning();
      return;
    }

    setIsLoading(true);
    try {
      if (isEdit && budgetId !== undefined) {
        await updateBudget({
          budgetId: budgetId as Id<"budgets">,
          amount: parsedAmount,
        });
      } else {
        await createBudget({
          categoryId: selectedCategoryId as Id<"categories">,
          amount: parsedAmount,
          periodStart,
        });
      }
      show(isEdit ? "Budget updated" : "Budget created");
      void hapticSuccess();
      markIntentional();
      router.back();
    } catch (e) {
      void hapticError();
      const message = getConvexErrorMessage(
        e,
        isEdit ? "Failed to update budget." : "Failed to create budget.",
      );
      // P1-9: operational errors via Snackbar (e.g. duplicate budget)
      show(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isEdit && existingResult === undefined) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
          Loading budget…
        </Text>
      </SafeAreaView>
    );
  }

  if (isEdit && existingResult === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
          Budget not found.
        </Text>
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
            {isEdit ? "Edit Budget" : "Set Budget"}
          </Text>
        </View>

        <KeyboardAwareScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-5 py-6"
          keyboardShouldPersistTaps="handled"
          bottomOffset={16}
        >
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
              Month
            </Text>
            <View
              style={{
                borderColor: C.border,
                backgroundColor: C.background,
                borderRadius: Radius.sm,
              }}
              className="h-12 justify-center border px-4"
            >
              <Text className="text-base text-text-primary dark:text-text-primary-dark">
                {monthLabel}
              </Text>
            </View>
          </View>

          {isEdit ? (
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                Category
              </Text>
              <View
                style={{
                  borderColor: C.border,
                  backgroundColor: C.background,
                  borderRadius: Radius.sm,
                }}
                className="h-12 flex-row items-center gap-2 border px-4"
              >
                {existingBudget?.category?.icon ? (
                  <CategoryIcon name={existingBudget.category.icon} size={24} />
                ) : null}
                <Text className="text-base text-text-primary dark:text-text-primary-dark">
                  {existingBudget?.category?.name ?? "Unknown"}
                </Text>
              </View>
            </View>
          ) : (
            <SelectField
              label="Category"
              placeholder="Select a category"
              value={selectedCategoryId}
              options={options}
              onSelect={setSelectedCategoryId}
              error={categoryError}
            />
          )}

          <Input
            label="Amount"
            placeholder="Budget limit"
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            amount
            error={error}
          />

          <Button
            title={isEdit ? "Save Changes" : "Set Budget"}
            onPress={handleSubmit}
            loading={isLoading}
            disabled={!canSubmit}
          />
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaView>
  );
}
