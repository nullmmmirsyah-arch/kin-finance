import * as React from "react";
import { FlatList, Pressable, View, Text, useWindowDimensions } from "react-native";
import { SvgXml } from "react-native-svg";
import { useThemeColors } from "@/constants/theme";
import {
  ALL_CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICON,
  CATEGORY_STREAMLINE_MAP,
  ACCOUNT_STREAMLINE_MAP,
  getBody,
  getIconData,
  resolveIconName,
  isValidCategoryIcon,
  isAccountType,
} from "./internal";

export type IconRef = string | null | undefined;
export { ALL_CATEGORY_ICONS, DEFAULT_CATEGORY_ICON, CATEGORY_STREAMLINE_MAP, ACCOUNT_STREAMLINE_MAP, isValidCategoryIcon, isAccountType };
export type { CategoryIconName } from "@/constants/categoryIconNames";
export type { AccountType } from "@/constants/accounts";

// ── Deep Icon module: small interface, hides streamline data, fallback, lazy parse ──

export function Icon({ ref, size = 32 }: { ref?: IconRef; size?: number }) {
  const iconName = resolveIconName(ref ?? undefined);
  const body = getBody(iconName) ?? getBody(CATEGORY_STREAMLINE_MAP.other);
  if (!body) return null;
  const { width, height } = getIconData();
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-icon="${iconName}">${body}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} />;
}

export function getIconXml(ref?: IconRef): string {
  const iconName = resolveIconName(ref ?? undefined);
  const body = getBody(iconName) ?? getBody(CATEGORY_STREAMLINE_MAP.other) ?? "";
  const { width, height } = getIconData();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-icon="${iconName}">${body}</svg>`;
}

// Back-compat shims: hide that two modules collapsed
export function CategoryIcon({ name, size = 32 }: { name?: string | null; size?: number }) {
  return <Icon ref={name} size={size} />;
}
export function AccountIcon({ type, size = 32 }: { type?: string | null; size?: number }) {
  return <Icon ref={type} size={size} />;
}
export function getCategoryIconXml(name?: string | null): string {
  const iconName = (() => {
    if (name && isValidCategoryIcon(name)) return CATEGORY_STREAMLINE_MAP[name as import("./internal").CategoryIconName];
    return CATEGORY_STREAMLINE_MAP.other;
  })();
  const body = getBody(iconName) ?? getBody(CATEGORY_STREAMLINE_MAP.other) ?? "";
  const { width, height } = getIconData();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-icon="${iconName}">${body}</svg>`;
}
export function getAccountIconXml(type?: string | null): string {
  const iconName = type && isAccountType(type) ? ACCOUNT_STREAMLINE_MAP[type as import("./internal").AccountType] : ACCOUNT_STREAMLINE_MAP.bank;
  const body = getBody(iconName) ?? getBody(ACCOUNT_STREAMLINE_MAP.bank) ?? "";
  const { width, height } = getIconData();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-icon="${iconName}">${body}</svg>`;
}
export function getStreamlineIconName(name?: string): string {
  if (name && (name as string) in CATEGORY_STREAMLINE_MAP) return CATEGORY_STREAMLINE_MAP[name as keyof typeof CATEGORY_STREAMLINE_MAP];
  return CATEGORY_STREAMLINE_MAP.other;
}
export function getAccountIconName(type?: string): string {
  if (type && isAccountType(type)) return ACCOUNT_STREAMLINE_MAP[type as import("./internal").AccountType];
  return ACCOUNT_STREAMLINE_MAP.bank;
}

export function listIconRefs(): readonly string[] {
  return ALL_CATEGORY_ICONS;
}

// Ergonomic picker — collapses 28-line grid in category-form, virtualized for perf
const MemoIcon = React.memo(Icon);

export function IconPicker({
  value,
  onChange,
  size = 32,
}: {
  value?: string | null;
  onChange: (ref: string) => void;
  size?: number;
}) {
  const { width } = useWindowDimensions();
  const GAP = 8;
  const ITEM = 56;
  const H_PADDING = 40;
  const cols = Math.max(4, Math.min(6, Math.floor((width - H_PADDING + GAP) / (ITEM + GAP))));
  const C = useThemeColors();
  const renderItem = React.useCallback(
    ({ item: name }: { item: string }) => {
      const selected = value === name;
      const label = name.replace(/_/g, " ");
      return (
        <Pressable
          onPress={() => onChange(name)}
          accessibilityRole="button"
          accessibilityLabel={`Icon ${label}`}
          accessibilityHint={selected ? "Currently selected" : "Tap to select icon"}
          accessibilityState={{ selected }}
          className="items-center justify-center rounded-full"
          style={{
            width: 56,
            height: 56,
            backgroundColor: selected ? `${C.primary}14` : C.surface,
            borderWidth: selected ? 2 : 1,
            borderColor: selected ? C.primary : C.border,
          }}
        >
          <MemoIcon ref={name} size={size} />
        </Pressable>
      );
    },
    [value, onChange, size, C.primary, C.surface, C.border],
  );

  return (
    <FlatList
      data={[...ALL_CATEGORY_ICONS] as string[]}
      keyExtractor={(item) => item}
      renderItem={renderItem}
      numColumns={cols}
      columnWrapperStyle={cols > 1 ? { gap: GAP } : undefined}
      contentContainerStyle={{ gap: 8 }}
      scrollEnabled={false}
      initialNumToRender={16}
      windowSize={5}
      maxToRenderPerBatch={16}
      removeClippedSubviews
      getItemLayout={(_data, index) => ({
        length: 64,
        offset: 64 * Math.floor(index / cols),
        index,
      })}
      accessibilityLabel="Category icon picker"
    />
  );
}

// For SelectField etc — pure data, no leak
export function useIconOptions(): { id: string; label: string; icon: string }[] {
  return React.useMemo(
    () =>
      ALL_CATEGORY_ICONS.map((id) => ({
        id,
        label: id.replace(/_/g, " "),
        icon: id,
      })),
    [],
  );
}
