import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Radius, Shadow, useThemeColors } from "@/constants/theme";
import { getConvexErrorMessage } from "@/lib/errors";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { Skeleton } from "@/components/Skeleton";
import { useSnackbar } from "@/components/Snackbar";
import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";

export function HouseholdSwitcher({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const C = useThemeColors();
  const { show } = useSnackbar();
  const mine = useQuery(api.households.listMine);
  const switchActive = useMutation(api.households.switchActive);
  const [switchingId, setSwitchingId] = useState<Id<"households"> | null>(null);

  const handleSelect = async (householdId: Id<"households">, isActive: boolean) => {
    if (isActive || switchingId !== null) {
      if (isActive) onClose();
      return;
    }
    setSwitchingId(householdId);
    try {
      await switchActive({ householdId });
      void hapticSuccess();
      onClose();
    } catch (e: unknown) {
      void hapticError();
      show(getConvexErrorMessage(e, "Failed to switch household."));
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40 px-5 pb-8" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={Shadow.card}
          className="rounded-2xl bg-background p-5 dark:bg-background-dark"
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-text-primary dark:text-text-primary-dark">
              Switch Household
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close household switcher"
              className="h-10 w-10 items-center justify-center rounded-full bg-surface dark:bg-surface-dark"
            >
              <Feather name="x" size={18} color={C.textSecondary} />
            </Pressable>
          </View>

          <View className="mt-4 gap-2">
            {mine === undefined ? (
              <>
                <Skeleton style={{ height: 56, borderRadius: Radius.md }} />
                <Skeleton style={{ height: 56, borderRadius: Radius.md }} />
              </>
            ) : (
              mine.map(({ household, role, isActive }) => {
                const switching = switchingId === household._id;
                const busy = switchingId !== null;
                return (
                  <Pressable
                    key={household._id}
                    onPress={() => void handleSelect(household._id, isActive)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={`${household.name}${isActive ? ", current household" : ""}`}
                    style={{
                      opacity: busy && !switching ? 0.5 : 1,
                      borderWidth: 1,
                      borderColor: isActive ? C.primary : C.border,
                      backgroundColor: isActive ? `${C.primary}14` : C.background,
                      borderRadius: Radius.md,
                    }}
                    className="flex-row items-center gap-3 px-4 py-3.5"
                  >
                    <View className="flex-1 gap-0.5">
                      <Text
                        numberOfLines={1}
                        className="text-[15px] font-semibold leading-5 text-text-primary dark:text-text-primary-dark"
                      >
                        {household.name}
                      </Text>
                      <Text className="text-xs leading-4 text-text-secondary dark:text-text-secondary-dark">
                        {role === "owner" ? "Owner" : "Member"}
                      </Text>
                    </View>
                    {switching ? (
                      <ActivityIndicator color={C.primary} />
                    ) : isActive ? (
                      <Feather name="check" size={20} color={C.primary} />
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
