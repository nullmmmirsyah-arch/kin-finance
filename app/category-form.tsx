import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  Switch,
  Text,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useThemeColors } from "@/constants/theme";
import { CATEGORY_TYPES, CategoryType } from "@/constants/categories";
import { DEFAULT_CATEGORY_ICON, type CategoryIconName, isValidCategoryIcon } from "@/modules/icon-registry";
import { IconPicker } from "@/modules/icon-registry";
import { validateCategoryName, CATEGORY_NAME_MAX } from "@/constants/validation";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Chip } from "@/components/Chip";
import { useSnackbar } from "@/components/Snackbar";
import { useDiscardGuard } from "@/hooks/useDiscardGuard";
import { getConvexErrorMessage } from "@/lib/errors";
import { hapticSuccess } from "@/lib/haptics";

export default function CategoryForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const categoryId = params.id;
  const isEdit = categoryId !== undefined;

  const result = useQuery(api.categories.list);
  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);
  const { show } = useSnackbar();
  const C = useThemeColors();

  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const [icon, setIcon] = useState<CategoryIconName>(DEFAULT_CATEGORY_ICON);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const editingCategory = useMemo(() => {
    if (!isEdit || result?.categories === null) return undefined;
    return result?.categories?.find((c) => c._id === categoryId);
  }, [isEdit, categoryId, result]);

  const seeded = useRef(false);

  useEffect(() => {
    if (editingCategory && !seeded.current) {
      seeded.current = true;
      setName(editingCategory.name);
      setType(editingCategory.type);
      setIcon(
        isValidCategoryIcon(editingCategory.icon ?? "")
          ? (editingCategory.icon as CategoryIconName)
          : DEFAULT_CATEGORY_ICON,
      );
      setHidden(editingCategory.hidden);
    }
  }, [editingCategory]);

  const trimmedName = name.trim();
  const canSubmit =
    validateCategoryName(trimmedName) === null &&
    !isLoading &&
    result?.isOwner === true &&
    (!isEdit || editingCategory !== undefined);

  const isDirty = useMemo(() => {
    if (!isEdit) {
      return (
        name.trim() !== "" ||
        type !== "expense" ||
        icon !== DEFAULT_CATEGORY_ICON ||
        hidden !== false
      );
    }
    if (!editingCategory) return false;
    return (
      name !== editingCategory.name ||
      type !== editingCategory.type ||
      icon !== (editingCategory.icon ?? DEFAULT_CATEGORY_ICON) ||
      hidden !== editingCategory.hidden
    );
  }, [isEdit, editingCategory, name, type, icon, hidden]);

  const { handleBack, markIntentional } = useDiscardGuard({ isDirty });

  const handleSubmit = async () => {
    setError(null);
    const err = validateCategoryName(trimmedName);
    if (err) {
      setError(err);
      return;
    }

    setIsLoading(true);
    try {
      if (isEdit && categoryId !== undefined) {
        await updateCategory({
          categoryId: categoryId as Id<"categories">,
          name: trimmedName,
          type,
          icon,
          hidden,
        });
      } else {
        await createCategory({
          name: trimmedName,
          type,
          icon,
          hidden,
        });
      }
      show(isEdit ? "Category updated" : "Category created");
      void hapticSuccess();
      markIntentional();
      router.back();
    } catch (e) {
      const message = getConvexErrorMessage(
        e,
        isEdit ? "Failed to update category." : "Failed to create category.",
      );
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (result !== undefined && result.isOwner === false) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6 dark:bg-background-dark">
        <Text className="text-center text-sm text-text-secondary dark:text-text-secondary-dark">
          You are not the owner of this household.
        </Text>
      </SafeAreaView>
    );
  }

  if (isEdit && result !== undefined && editingCategory === undefined) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">Category not found.</Text>
      </SafeAreaView>
    );
  }

  if (isEdit && editingCategory === undefined) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">Loading category…</Text>
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
            {isEdit ? "Edit Category" : "Create Category"}
          </Text>
        </View>

        <KeyboardAwareScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-5 py-6"
          keyboardShouldPersistTaps="handled"
          bottomOffset={16}
        >
          <Input
            label="Category name"
            placeholder="e.g. Food, Salary"
            value={name}
            onChangeText={setName}
            maxLength={CATEGORY_NAME_MAX}
            error={error}
          />

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
              Category type
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {CATEGORY_TYPES.map((t) => (
                <Chip
                  key={t.id}
                  label={t.label}
                  active={type === t.id}
                  onPress={() => setType(t.id)}
                />
              ))}
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
              Icon
            </Text>
            <IconPicker value={icon} onChange={(v) => setIcon(v as CategoryIconName)} />
          </View>

          <View
            style={{ borderColor: C.border }}
            className="flex-row items-center justify-between rounded-[12px] border bg-surface px-4 py-3 dark:bg-surface-dark"
          >
            <View className="flex-1">
              <Text className="text-base font-medium text-text-primary dark:text-text-primary-dark">
                Visible to members
              </Text>
              <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">
                Members can see and use this category.
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
            title={isEdit ? "Save Changes" : "Create Category"}
            onPress={handleSubmit}
            loading={isLoading}
            disabled={!canSubmit}
          />
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaView>
  );
}
