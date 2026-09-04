// Deep Icon module is the source — this file is a thin re-export shim (no bundle cost).
// CATEGORY_ICON_MAP is deprecated: 56 PNG requires removed, kept as dummy map for legacy tests only.
export {
  ALL_CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICON,
  isValidCategoryIcon,
  CATEGORY_STREAMLINE_MAP,
  getStreamlineIconName,
} from "@/modules/icon-registry/internal";
export type { CategoryIconName } from "@/modules/icon-registry/internal";
import { ALL_CATEGORY_ICONS as _ALL, DEFAULT_CATEGORY_ICON as _DEF } from "@/modules/icon-registry/internal";
import { isValidCategoryIcon as _isValid } from "@/modules/icon-registry/internal";

// Deprecated: legacy PNG source map — returns dummy numbers, not PNG requires. No bundle cost.
// PNG files remain on disk for legacy fallback but are not imported here.
export const CATEGORY_ICON_MAP: Record<string, number> = Object.fromEntries(
  _ALL.map((k, i) => [k, i + 1]),
) as Record<string, number>;

export function getCategoryIconSource(name?: string): number {
  if (name && _isValid(name)) return CATEGORY_ICON_MAP[name];
  return CATEGORY_ICON_MAP[_DEF];
}
