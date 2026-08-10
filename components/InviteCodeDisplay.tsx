import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Share, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@expo/vector-icons/Feather";
import { Radius, Shadow, useThemeColors, useThemeGradients } from "@/constants/theme";
import { Button } from "@/components/Button";
import { useSnackbar } from "@/components/Snackbar";

type Props = {
  code: string;
  onDone: () => void;
};

export function InviteCodeDisplay({ code, onDone }: Props) {
  const C = useThemeColors();
  const gradients = useThemeGradients();
  const { show } = useSnackbar();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    show("Copied!");
  };

  const handleShare = async () => {
    await Share.share({
      message: `Join my household on Kin Finance! Use invite code: ${code}`,
    });
  };

  return (
    <View className="items-center gap-6">
      <LinearGradient
        colors={gradients.card}
        style={[
          Shadow.card,
          {
            borderRadius: Radius.lg,
            borderWidth: 1,
            borderColor: C.primaryLight,
            paddingVertical: 32,
            paddingHorizontal: 24,
            width: "100%",
          },
        ]}
        className="items-center gap-4"
      >
        <Feather name="key" size={32} color={C.primary} />
        <Text className="text-center text-sm text-text-secondary dark:text-text-secondary-dark">
          Your invite code
        </Text>
        <Text
          className="text-[28px] font-bold tracking-wider text-text-primary dark:text-text-primary-dark"
          style={{ fontFamily: "monospace" }}
        >
          {code}
        </Text>
        <Text className="text-center text-xs text-text-secondary dark:text-text-secondary-dark">
          Expires in 7 days. Single-use. Copy it now.
        </Text>
      </LinearGradient>

      <View className="w-full gap-3">
        <Button
          title={copied ? "Copied!" : "Copy to Clipboard"}
          onPress={handleCopy}
        />
        <Button
          title="Share"
          variant="secondary"
          onPress={handleShare}
        />
        <Button
          title="Done"
          variant="secondary"
          onPress={onDone}
        />
      </View>
    </View>
  );
}
