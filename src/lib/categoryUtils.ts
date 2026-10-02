import { getDefaultCategoryIcon, getDefaultCategoryColor, getDefaultCategoryHex } from "@/lib/categoryIcons";
import { getIconComponent } from "@/lib/categoryIconOptions";
import type { CustomCategory } from "@/services/categoryService";

/**
 * Resolve the icon component for a category — checks custom first, then defaults.
 */
export function getCategoryIcon(category: string, customCats?: CustomCategory[]) {
  const custom = customCats?.find((c) => c.name === category && !c.is_hidden_default);
  if (custom) return getIconComponent(custom.icon);
  return getDefaultCategoryIcon(category);
}

const hexToHsl = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

/**
 * Resolve HSL color string for a category — checks custom first, then defaults.
 */
export function getCategoryColor(category: string, customCats?: CustomCategory[]): string {
  const custom = customCats?.find((c) => c.name === category && !c.is_hidden_default);
  if (custom?.color) {
    try { return hexToHsl(custom.color); } catch { /* fallback */ }
  }
  return getDefaultCategoryColor(category);
}

/**
 * Resolve hex color for a category — checks custom first, then defaults.
 */
export function getCategoryHexColor(category: string, customCats?: CustomCategory[]): string {
  const custom = customCats?.find((c) => c.name === category && !c.is_hidden_default);
  if (custom?.color) return custom.color;
  return getDefaultCategoryHex(category);
}
