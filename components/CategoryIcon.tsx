import { SvgXml } from "react-native-svg";
import { isValidCategoryIcon, type CategoryIconName } from "@/constants/categoryIconNames";
import { CATEGORY_STREAMLINE_MAP } from "@/constants/streamlineIconMap";
import streamlineData from "@/constants/streamlineIconData.json";

type Props = {
  name?: string | null;
  size?: number;
};

const ICON_WIDTH = (streamlineData as { width: number }).width ?? 24;
const ICON_HEIGHT = (streamlineData as { height: number }).height ?? 24;
const ICONS = (streamlineData as { icons: Record<string, { body: string }> }).icons;

function getBody(iconName: string): string | undefined {
  return ICONS[iconName]?.body;
}

function resolveIconName(name?: string | null): string {
  if (name && isValidCategoryIcon(name)) {
    return CATEGORY_STREAMLINE_MAP[name as CategoryIconName];
  }
  return CATEGORY_STREAMLINE_MAP.other;
}

export function CategoryIcon({ name, size = 32 }: Props) {
  const iconName = resolveIconName(name ?? undefined);
  const body = getBody(iconName) ?? getBody(CATEGORY_STREAMLINE_MAP.other);
  if (!body) return null;
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_WIDTH}" height="${ICON_HEIGHT}" viewBox="0 0 ${ICON_WIDTH} ${ICON_HEIGHT}">${body}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} />;
}

export function getCategoryIconXml(name?: string | null): string {
  const iconName = resolveIconName(name ?? undefined);
  const body = getBody(iconName) ?? getBody(CATEGORY_STREAMLINE_MAP.other) ?? "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_WIDTH}" height="${ICON_HEIGHT}" viewBox="0 0 ${ICON_WIDTH} ${ICON_HEIGHT}">${body}</svg>`;
}
